import { BaseAdapter } from './baseAdapter.js';
import * as firebaseSync from '../firebaseSync.js';
import { FIREBASE_CONFIG } from '../firebaseConfig.js';

/**
 * Universal Firebase Firestore Cloud Adapter
 * Supports BOTH the default primary project (maint-dept-erp)
 * and ANY custom secondary Firebase project (e.g. Maint Dept ERP 2023)
 * via direct official Cloud Firestore REST API.
 */
export class FirebaseAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      role: 'BACKUP',
      type: 'FIREBASE',
      ...config
    });

    this.projectId = (config.projectId || '').trim();
    this.apiKey = (config.apiKey || '').trim();
    this.authDomain = (config.authDomain || '').trim();

    // Auto-parse if full JSON config is provided in connStr
    if (config.connStr) {
      try {
        const parsed = JSON.parse(config.connStr);
        if (parsed.projectId) this.projectId = parsed.projectId.trim();
        if (parsed.apiKey) this.apiKey = parsed.apiKey.trim();
        if (parsed.authDomain) this.authDomain = parsed.authDomain.trim();
      } catch (_) {
        const pMatch = config.connStr.match(/["']?projectId["']?\s*[:=]\s*["']([^"'\s,]+)["']/i);
        const kMatch = config.connStr.match(/["']?apiKey["']?\s*[:=]\s*["']([^"'\s,]+)["']/i);
        if (pMatch) this.projectId = pMatch[1].trim();
        if (kMatch) this.apiKey = kMatch[1].trim();
      }
    }

    // Check if this adapter is specifically the primary default instance
    const defaultProjectId = (FIREBASE_CONFIG && FIREBASE_CONFIG.projectId) || 'maint-dept-erp';
    this.isPrimaryDefault = (!this.projectId || this.projectId === defaultProjectId) && !this.apiKey;
    if (!this.projectId) {
      this.projectId = defaultProjectId;
    }
  }

  /**
   * Helper to derive the direct link to the project's Firestore Rules tab.
   */
  getRulesUrl() {
    if (!this.projectId) return 'https://console.firebase.google.com';
    return `https://console.firebase.google.com/project/${encodeURIComponent(this.projectId)}/firestore/rules`;
  }

  /**
   * Test connection to this Firebase Firestore instance.
   * Returns { success, latency?, isAuthError?, error? }
   */
  async testConnection() {
    if (!this.projectId) {
      return { success: false, error: 'Missing Firebase Project ID.' };
    }
    const startTime = Date.now();
    try {
      let url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/databases/(default)/documents`;
      if (this.apiKey) url += `?key=${encodeURIComponent(this.apiKey)}`;

      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(8000)
      }).catch(err => {
        throw new Error(`Cannot reach Firebase server: ${err.message}`);
      });

      const latency = Date.now() - startTime;
      if (res.ok) {
        return { success: true, latency: latency || 35 };
      }

      const errText = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          isAuthError: true,
          error: `Firebase authentication / permission denied (HTTP ${res.status}). In Firebase Console → Firestore Database → Rules tab, ensure rules allow read and write.`
        };
      }

      if (res.status === 404) {
        return {
          success: false,
          error: `Firebase Project "${this.projectId}" not found (HTTP 404). Please verify your Project ID in Firebase Console.`
        };
      }

      return { success: false, error: `HTTP ${res.status}: ${errText.substring(0, 150)}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Save an entire table to Firestore.
   * If primary default project, delegates to optimized firebaseSync.
   * If custom secondary project (e.g. Maint Dept ERP 2023), writes directly to that project's Firestore endpoint.
   */
  async saveTable(collection, dataObj) {
    // If primary default, use the primary sync engine
    if (this.isPrimaryDefault) {
      try {
        const result = await firebaseSync.saveTableToFirestore(collection, dataObj);
        if (result && result.success) {
          return { success: true, updateTime: result.updateTime };
        }
        return { success: false, error: 'Firebase primary saveTable returned unsuccessful' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    // For secondary project, write directly to this.projectId:
    if (!this.projectId) {
      return { success: false, error: 'Missing Firebase Project ID.' };
    }

    try {
      const nowIso = new Date().toISOString();
      const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/databases/(default)/documents/erp_tables`;
      const keyParam = this.apiKey ? `?key=${encodeURIComponent(this.apiKey)}` : '';

      let records = dataObj;
      if (records && !Array.isArray(records) && typeof records === 'object') {
        const vals = Object.values(records);
        if (vals.length > 0 && vals[0] && typeof vals[0] === 'object' && vals[0].id) {
          records = vals;
        }
      }

      const rawJson = JSON.stringify(records ?? []);
      const itemCount = Array.isArray(records) ? records.length : 1;

      // Small table (< 450 KB): write directly as single doc
      if (rawJson.length < 450 * 1024) {
        const docUrl = `${baseUrl}/${encodeURIComponent(collection)}${keyParam}`;
        const payload = {
          fields: {
            table: { stringValue: collection },
            isChunked: { booleanValue: false },
            itemCount: { integerValue: String(itemCount) },
            rawJson: { stringValue: rawJson },
            updatedAt: { stringValue: nowIso }
          }
        };

        const res = await fetch(docUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(25000)
        });

        if (res.ok) {
          await this._updateManifest(collection, nowIso).catch(() => {});
          return { success: true, updateTime: nowIso };
        }

        const errText = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            isAuthError: true,
            error: `Firebase write denied (HTTP ${res.status}). In Firebase Console → Rules tab, set: allow read, write: if true;`
          };
        }
        return { success: false, error: `HTTP ${res.status}: ${errText.substring(0, 200)}` };
      }

      // Large table (>= 450 KB): chunk across multiple documents
      const CHUNK_SIZE_BYTES = 450 * 1024;
      const chunks = [];
      if (Array.isArray(records)) {
        let curChunk = [];
        let curSize = 0;
        for (const item of records) {
          const sz = JSON.stringify(item).length;
          if (curSize + sz > CHUNK_SIZE_BYTES && curChunk.length > 0) {
            chunks.push(curChunk);
            curChunk = [item];
            curSize = sz;
          } else {
            curChunk.push(item);
            curSize += sz;
          }
        }
        if (curChunk.length > 0) chunks.push(curChunk);
      } else {
        chunks.push(records);
      }

      // Parallel chunk writes
      await Promise.all(chunks.map(async (chunk, i) => {
        const chunkUrl = `${baseUrl}/${encodeURIComponent(`${collection}__chunk_${i}`)}${keyParam}`;
        const chunkPayload = {
          fields: {
            table: { stringValue: collection },
            chunkIndex: { integerValue: String(i) },
            totalChunks: { integerValue: String(chunks.length) },
            rawJson: { stringValue: JSON.stringify(chunk) },
            updatedAt: { stringValue: nowIso }
          }
        };
        const chunkRes = await fetch(chunkUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunkPayload),
          signal: AbortSignal.timeout(30000)
        });
        if (!chunkRes.ok) {
          const txt = await chunkRes.text().catch(() => '');
          throw new Error(`Chunk ${i} failed (HTTP ${chunkRes.status}): ${txt.substring(0, 100)}`);
        }
      }));

      // Write parent manifest document
      const parentUrl = `${baseUrl}/${encodeURIComponent(collection)}${keyParam}`;
      const parentPayload = {
        fields: {
          table: { stringValue: collection },
          isChunked: { booleanValue: true },
          chunksCount: { integerValue: String(chunks.length) },
          itemCount: { integerValue: String(itemCount) },
          updatedAt: { stringValue: nowIso }
        }
      };

      const parentRes = await fetch(parentUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parentPayload),
        signal: AbortSignal.timeout(25000)
      });

      if (!parentRes.ok) {
        const txt = await parentRes.text().catch(() => '');
        return { success: false, error: `Parent manifest doc failed (HTTP ${parentRes.status}): ${txt.substring(0, 150)}` };
      }

      await this._updateManifest(collection, nowIso).catch(() => {});
      return { success: true, updateTime: nowIso };

    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async _updateManifest(tableName, nowIso) {
    const keyParam = this.apiKey ? `?key=${encodeURIComponent(this.apiKey)}` : '';
    const manifestUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/databases/(default)/documents/erp_tables/sync_manifest${keyParam}&updateMask.fieldPaths=${encodeURIComponent(tableName)}&updateMask.fieldPaths=lastModifiedTable&updateMask.fieldPaths=updatedAt`;
    const payload = {
      fields: {
        [tableName]: { stringValue: nowIso },
        lastModifiedTable: { stringValue: tableName },
        updatedAt: { stringValue: nowIso }
      }
    };
    await fetch(manifestUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    }).catch(() => {});
  }

  /**
   * Fetch a table from this project's Firestore database.
   */
  async fetchTable(collection) {
    if (this.isPrimaryDefault) {
      return firebaseSync.fetchTableFromFirestore(collection);
    }
    if (!this.projectId) return null;
    try {
      const keyParam = this.apiKey ? `?key=${encodeURIComponent(this.apiKey)}` : '';
      const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/databases/(default)/documents/erp_tables`;
      const url = `${baseUrl}/${encodeURIComponent(collection)}${keyParam}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const doc = await res.json();
      if (!doc || !doc.fields) return null;

      const fields = doc.fields;
      const updateTime = doc.updateTime || fields.updatedAt?.stringValue || null;

      if (fields.isChunked?.booleanValue === false && fields.rawJson?.stringValue) {
        return {
          data: JSON.parse(fields.rawJson.stringValue),
          updateTime
        };
      }

      if (fields.isChunked?.booleanValue === true) {
        const count = parseInt(fields.chunksCount?.integerValue || '0', 10);
        const chunkDocs = await Promise.all(
          Array.from({ length: count }, async (_, i) => {
            const cUrl = `${baseUrl}/${encodeURIComponent(`${collection}__chunk_${i}`)}${keyParam}`;
            const cRes = await fetch(cUrl, { signal: AbortSignal.timeout(12000) });
            if (!cRes.ok) return [];
            const cDoc = await cRes.json();
            const raw = cDoc?.fields?.rawJson?.stringValue;
            return raw ? JSON.parse(raw) : [];
          })
        );
        return {
          data: chunkDocs.flat(),
          updateTime
        };
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Safe non-destructive single record save.
   */
  async saveRecord(collection, docId, data) {
    if (typeof window !== 'undefined' && window.storage && window.storage.data && window.storage.data[collection]) {
      return this.saveTable(collection, window.storage.data[collection]);
    }
    return { success: true };
  }

  /**
   * Safe record deletion.
   */
  async deleteRecord(collection, docId) {
    if (typeof window !== 'undefined' && window.storage && window.storage.data && window.storage.data[collection]) {
      return this.saveTable(collection, window.storage.data[collection]);
    }
    return { success: true };
  }
}
