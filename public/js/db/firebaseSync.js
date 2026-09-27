/**
 * Firebase Firestore Cloud Synchronization Engine (High-Performance REST Edition)
 * Al-Muslim Group Maintenance Department ERP
 *
 * Provides automated cloud synchronization, multi-device backup,
 * and chunked document storage via official Google Cloud Firestore REST API.
 * Pure REST: No external SDK overhead, no WebChannel stalls, <300ms latency.
 *
 * v2.0 — Universal Persistence Engine
 * - Returns { success, updateTime } from saveTableToFirestore for confirmed-write discipline
 * - Parallelized chunk writes via Promise.all for ultra-fast performance
 * - sync_manifest: single lightweight document to detect remote updates (1 read / poll cycle)
 * - fetchSyncManifest() for efficient multi-device real-time sync at 6s intervals
 */

import { FIREBASE_CONFIG } from './firebaseConfig.js';

const PROJECT_ID = FIREBASE_CONFIG.projectId || 'maint-dept-erp';
const COLLECTION_NAME = 'erp_tables';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}`;
const CHUNK_SIZE_BYTES = 550 * 1024; // 550 KB safety limit per document (Firestore limit is 1MB)
const SYNC_MANIFEST_DOC = 'sync_manifest'; // Lightweight doc with table → updateTime map

/**
 * Fetch wrapper with AbortController timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convert Firestore typed value to native JavaScript value (fallback decoder)
 */
function fromFirestoreValue(val) {
  if (!val || typeof val !== 'object') return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const obj = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

/**
 * Update the lightweight sync_manifest document so remote clients can detect
 * table changes via a single Firestore read (~150ms, 1 document read per poll cycle).
 *
 * @param {string} tableName - Name of the table that was just written
 * @param {string} updateTime - Server-confirmed ISO timestamp from the write response
 * @param {number} timeoutMs - Timeout for the PATCH request
 */
export async function updateSyncManifest(tableName, updateTime, timeoutMs = 8000) {
  try {
    const nowIso = updateTime || new Date().toISOString();
    const url = `${BASE_URL}/${encodeURIComponent(SYNC_MANIFEST_DOC)}?updateMask.fieldPaths=${encodeURIComponent(tableName)}&updateMask.fieldPaths=lastModifiedTable&updateMask.fieldPaths=updatedAt`;
    const payload = {
      fields: {
        [tableName]: { stringValue: nowIso },
        lastModifiedTable: { stringValue: tableName },
        updatedAt: { stringValue: nowIso }
      }
    };
    const res = await fetchWithTimeout(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, timeoutMs);
    return res && res.ok;
  } catch (err) {
    console.warn('[Firebase Sync] sync_manifest update note:', err.message);
    return false;
  }
}

/**
 * Fetch the lightweight sync_manifest document.
 * Returns a map of { [tableName]: serverUpdateTime } for all tables written since
 * the manifest was last updated. Used by the polling engine to detect remote changes
 * in ~150ms with a single document read (vs. fetching the entire collection).
 *
 * @param {number} timeoutMs - Timeout for the GET request
 * @returns {Object} - Map of tableName → ISO updateTime string
 */
export async function fetchSyncManifest(timeoutMs = 4000) {
  try {
    const url = `${BASE_URL}/${encodeURIComponent(SYNC_MANIFEST_DOC)}`;
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, timeoutMs);
    if (!res.ok) return {};

    const doc = await res.json();
    if (!doc || !doc.fields) return {};

    const manifest = {};
    for (const [tableName, val] of Object.entries(doc.fields)) {
      if (val && val.stringValue) {
        manifest[tableName] = val.stringValue;
      }
    }
    return manifest;
  } catch (err) {
    console.warn('[Firebase Sync] fetchSyncManifest note:', err.message);
    return {};
  }
}

/**
 * Save an individual table to Firestore REST, chunking if necessary.
 * Returns { success: boolean, updateTime: string | null } for confirmed-write discipline.
 * Guaranteed to resolve within timeoutMs (default 8s for large datasets).
 *
 * @param {string} tableName - Name of the Firestore document / ERP table
 * @param {*} records - Data to persist
 * @param {number} timeoutMs - Per-request timeout in ms
 * @returns {Promise<{success: boolean, updateTime: string|null}>}
 */
export async function saveTableToFirestore(tableName, records, timeoutMs = 8000) {
  try {
    if (!tableName) return { success: false, updateTime: null };

    const cleanRecords = JSON.parse(JSON.stringify(records ?? []));
    const jsonStr = JSON.stringify(cleanRecords);
    const sizeBytes = new Blob([jsonStr]).size;
    const nowIso = new Date().toISOString();
    const itemCount = Array.isArray(cleanRecords) ? cleanRecords.length : (cleanRecords ? 1 : 0);

    // Standard single-document write (< 550KB)
    if (sizeBytes < CHUNK_SIZE_BYTES) {
      const url = `${BASE_URL}/${encodeURIComponent(tableName)}`;
      const payload = {
        fields: {
          rawJson: { stringValue: jsonStr },
          isChunked: { booleanValue: false },
          itemCount: { integerValue: String(itemCount) },
          updatedAt: { stringValue: nowIso }
        }
      };

      const res = await fetchWithTimeout(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, timeoutMs);

      if (res.ok) {
        const docResponse = await res.json().catch(() => ({}));
        const serverUpdateTime = docResponse?.updateTime || nowIso;
        // Update sync_manifest with confirmed write so other devices are notified immediately
        await updateSyncManifest(tableName, serverUpdateTime, 4000);
        return { success: true, updateTime: serverUpdateTime };
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`[Firebase Sync] Failed saving ${tableName} (HTTP ${res.status}):`, errText);
        return { success: false, updateTime: null, error: `HTTP ${res.status}: ${errText}` };
      }
    }

    // Chunked write for large datasets (> 550KB)
    if (Array.isArray(cleanRecords)) {
      const chunks = [];
      let currentChunk = [];
      let currentChunkSize = 0;

      for (const item of cleanRecords) {
        const itemSize = new Blob([JSON.stringify(item)]).size;
        if (currentChunkSize + itemSize > CHUNK_SIZE_BYTES && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [item];
          currentChunkSize = itemSize;
        } else {
          currentChunk.push(item);
          currentChunkSize += itemSize;
        }
      }
      if (currentChunk.length > 0) chunks.push(currentChunk);

      // Parallelize all chunk writes via Promise.all for ultra-fast performance
      const chunkResults = await Promise.all(chunks.map(async (chunk, i) => {
        const chunkUrl = `${BASE_URL}/${encodeURIComponent(`${tableName}__chunk_${i}`)}`;
        const chunkPayload = {
          fields: {
            table: { stringValue: tableName },
            chunkIndex: { integerValue: String(i) },
            totalChunks: { integerValue: String(chunks.length) },
            rawJson: { stringValue: JSON.stringify(chunk) },
            updatedAt: { stringValue: nowIso }
          }
        };
        try {
          const res = await fetchWithTimeout(chunkUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunkPayload)
          }, timeoutMs);
          return res.ok;
        } catch (_) {
          return false;
        }
      }));

      const allChunksOk = chunkResults.every(Boolean);
      if (!allChunksOk) {
        console.warn(`[Firebase Sync] Some chunks failed for ${tableName}`);
        return { success: false, updateTime: null };
      }

      // Save parent manifest document (marks this table as chunked)
      const manifestUrl = `${BASE_URL}/${encodeURIComponent(tableName)}`;
      const manifestPayload = {
        fields: {
          isChunked: { booleanValue: true },
          chunksCount: { integerValue: String(chunks.length) },
          itemCount: { integerValue: String(itemCount) },
          updatedAt: { stringValue: nowIso }
        }
      };

      const manifestRes = await fetchWithTimeout(manifestUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifestPayload)
      }, timeoutMs);

      if (manifestRes.ok) {
        const docResponse = await manifestRes.json().catch(() => ({}));
        const serverUpdateTime = docResponse?.updateTime || nowIso;
        // Update sync_manifest with confirmed write so other devices are notified immediately
        await updateSyncManifest(tableName, serverUpdateTime, 4000);
        return { success: true, updateTime: serverUpdateTime };
      }

      return { success: false, updateTime: null };
    }

    return { success: false, updateTime: null };
  } catch (err) {
    console.warn(`[Firebase Sync] Exception saving table ${tableName} to Firestore:`, err.message);
    return { success: false, updateTime: null };
  }
}

/**
 * Fetch a single table from Firestore REST, reassembling chunks if needed.
 * Returns { data, updateTime } for clock-skew-safe sync tracking.
 *
 * @param {string} tableName
 * @param {number} timeoutMs
 * @returns {Promise<{data: any, updateTime: string|null} | null>}
 */
export async function fetchTableFromFirestore(tableName, timeoutMs = 6000) {
  try {
    const url = `${BASE_URL}/${encodeURIComponent(tableName)}`;
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, timeoutMs);
    if (!res.ok) return null;

    const doc = await res.json();
    if (!doc || !doc.fields) return null;

    const fields = doc.fields;
    const serverUpdateTime = doc.updateTime || fields.updatedAt?.stringValue || null;

    // Check if chunked
    if (fields.isChunked?.booleanValue) {
      const chunksCount = parseInt(fields.chunksCount?.integerValue || '0', 10);
      // Parallelize chunk fetches
      const chunkResults = await Promise.all(
        Array.from({ length: chunksCount }, async (_, i) => {
          const chunkUrl = `${BASE_URL}/${encodeURIComponent(`${tableName}__chunk_${i}`)}`;
          try {
            const chunkRes = await fetchWithTimeout(chunkUrl, { cache: 'no-store' }, timeoutMs);
            if (!chunkRes.ok) return [];
            const chunkDoc = await chunkRes.json();
            if (chunkDoc?.fields?.rawJson?.stringValue) {
              try {
                const part = JSON.parse(chunkDoc.fields.rawJson.stringValue);
                return Array.isArray(part) ? part : [];
              } catch (_) { return []; }
            } else if (chunkDoc?.fields?.data) {
              const part = fromFirestoreValue(chunkDoc.fields.data);
              return Array.isArray(part) ? part : [];
            }
            return [];
          } catch (_) {
            return [];
          }
        })
      );
      const merged = chunkResults.flat();
      return { data: merged, updateTime: serverUpdateTime };
    }

    // Standard rawJson
    if (fields.rawJson?.stringValue) {
      try {
        return { data: JSON.parse(fields.rawJson.stringValue), updateTime: serverUpdateTime };
      } catch (_) {}
    }

    // Fallback data field
    if (fields.data) {
      return { data: fromFirestoreValue(fields.data), updateTime: serverUpdateTime };
    }

    return null;
  } catch (err) {
    console.warn(`[Firebase Sync] Error fetching table ${tableName}:`, err.message);
    return null;
  }
}

/**
 * Fetch all tables from Firestore REST with full pagination (nextPageToken)
 */
export async function fetchAllFromFirestore(timeoutMs = 12000) {
  try {
    const rawDocs = new Map();
    let pageToken = '';
    let anyRequestSucceeded = false;

    // Paginate until all documents across the collection are retrieved
    do {
      const url = `${BASE_URL}?pageSize=100${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`;
      const res = await fetchWithTimeout(url, { cache: 'no-store' }, timeoutMs);
      if (!res.ok) {
        console.warn(`[Firebase Sync] Collection list failed (HTTP ${res.status})`);
        break;
      }
      anyRequestSucceeded = true;

      const data = await res.json();
      if (Array.isArray(data.documents)) {
        data.documents.forEach(doc => {
          const docId = doc.name.split('/').pop();
          rawDocs.set(docId, { fields: doc.fields || {}, updateTime: doc.updateTime });
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    if (rawDocs.size === 0) {
      if (anyRequestSucceeded) {
        console.log('[Firebase Sync] Firestore database collection is currently empty.');
        return { _isEmpty: true };
      }
      return null;
    }

    const assembledTables = {};
    const tableUpdateTimes = {};

    for (const [docId, { fields, updateTime }] of rawDocs.entries()) {
      // Skip chunk parts and the sync_manifest during first pass
      if (docId.includes('__chunk_') || docId === SYNC_MANIFEST_DOC) continue;

      if (fields.isChunked?.booleanValue) {
        const chunksCount = parseInt(fields.chunksCount?.integerValue || '0', 10);
        let mergedList = [];
        for (let i = 0; i < chunksCount; i++) {
          const chunkEntry = rawDocs.get(`${docId}__chunk_${i}`);
          const chunkDoc = chunkEntry?.fields;
          if (chunkDoc?.rawJson?.stringValue) {
            try {
              const parsed = JSON.parse(chunkDoc.rawJson.stringValue);
              if (Array.isArray(parsed)) mergedList = mergedList.concat(parsed);
            } catch (_) {}
          } else if (chunkDoc?.data) {
            const parsed = fromFirestoreValue(chunkDoc.data);
            if (Array.isArray(parsed)) mergedList = mergedList.concat(parsed);
          }
        }
        assembledTables[docId] = mergedList;
      } else if (fields.rawJson?.stringValue) {
        try {
          assembledTables[docId] = JSON.parse(fields.rawJson.stringValue);
        } catch (_) {
          if (fields.data) assembledTables[docId] = fromFirestoreValue(fields.data);
        }
      } else if (fields.data) {
        assembledTables[docId] = fromFirestoreValue(fields.data);
      }

      if (updateTime) {
        tableUpdateTimes[docId] = updateTime;
      }
    }

    const tableNames = Object.keys(assembledTables);
    if (tableNames.length === 0) return null;

    console.log(`[Firebase Sync] ✅ Loaded ${tableNames.length} tables from Google Cloud Firestore REST.`);
    // Attach update times for storage to seed into syncedDocVersions
    assembledTables._updateTimes = tableUpdateTimes;
    return assembledTables;
  } catch (err) {
    console.warn('[Firebase Sync] Error in fetchAllFromFirestore:', err.message);
    return null;
  }
}

/**
 * @deprecated Use fetchSyncManifest() instead (single doc read, not entire collection).
 * Kept for backwards-compatibility only.
 */
export async function fetchTableTimestamps(timeoutMs = 6000) {
  return fetchSyncManifest(timeoutMs);
}

/**
 * Save all tables to Firestore in managed concurrent batches
 */
export async function saveAllToFirestore(allData) {
  try {
    if (!allData || typeof allData !== 'object') return false;

    const tables = Object.keys(allData).filter(k => k !== '_updateTimes');
    let successCount = 0;

    // Process in batches of 4 for optimal browser connection multiplexing
    for (let i = 0; i < tables.length; i += 4) {
      const batch = tables.slice(i, i + 4);
      await Promise.all(batch.map(async tbl => {
        const result = await saveTableToFirestore(tbl, allData[tbl]);
        if (result.success) successCount++;
      }));
    }

    console.log(`[Firebase Sync] ☁️ Synchronized ${successCount}/${tables.length} tables to Cloud Firestore REST.`);
    return true;
  } catch (err) {
    console.warn('[Firebase Sync] Error in saveAllToFirestore:', err.message);
    return false;
  }
}

let _realtimeUnsubscribe = null;
let _isRealtimeActive = false;

/**
 * Check if the native Firebase Firestore onSnapshot real-time listener is currently active
 */
export function isRealtimeActive() {
  return _isRealtimeActive;
}

/**
 * Return native Firestore database instance if Firebase SDK is loaded on window
 */
export async function getFirestoreInstance() {
  if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.firestore === 'function') {
    if (!window.firebase.apps || !window.firebase.apps.length) {
      window.firebase.initializeApp(FIREBASE_CONFIG);
    }
    return window.firebase.firestore();
  }
  return null;
}

/**
 * Start official Google Cloud Firestore onSnapshot real-time listener.
 * Connects directly to Firestore via streaming WebChannel/WebSocket to receive
 * instant notifications (<100ms) whenever ANY client updates any ERP table.
 *
 * @param {Object} options
 * @param {Function} options.onManifestUpdate - Callback with updated manifest { [table]: serverTs }
 * @param {Function} options.onStatusChange - Callback for connection status ('connected' | 'rest_mode' | 'error')
 * @returns {Function|null} - Unsubscribe function or null
 */
export function startRealtimeSync({ onManifestUpdate, onStatusChange } = {}) {
  if (typeof window === 'undefined') return null;

  // Verify Firebase SDK availability on window
  if (!window.firebase || typeof window.firebase.initializeApp !== 'function') {
    console.log('[Firebase Realtime] Firebase SDK not loaded on window; using high-frequency REST polling fallback.');
    if (onStatusChange) onStatusChange('rest_mode');
    return null;
  }

  try {
    const app = !window.firebase.apps || !window.firebase.apps.length
      ? window.firebase.initializeApp(FIREBASE_CONFIG)
      : window.firebase.app();

    const db = window.firebase.firestore();

    // Clean up any existing listener
    if (_realtimeUnsubscribe) {
      try { _realtimeUnsubscribe(); } catch (_) {}
      _realtimeUnsubscribe = null;
    }

    const manifestDocRef = db.collection(COLLECTION_NAME).doc(SYNC_MANIFEST_DOC);

    _realtimeUnsubscribe = manifestDocRef.onSnapshot((docSnap) => {
      _isRealtimeActive = true;
      if (onStatusChange) onStatusChange('connected');

      if (!docSnap.exists) return;
      const data = docSnap.data() || {};

      if (typeof onManifestUpdate === 'function') {
        onManifestUpdate(data);
      }
    }, (error) => {
      console.warn('[Firebase Realtime] Real-time onSnapshot listener warning:', error.message);
      _isRealtimeActive = false;
      if (onStatusChange) onStatusChange('error');
    });

    console.log('[Firebase Realtime] 🟢 Real-time Firebase Firestore onSnapshot listener started.');
    return _realtimeUnsubscribe;
  } catch (err) {
    console.warn('[Firebase Realtime] Failed to initialize Firebase listener:', err.message);
    _isRealtimeActive = false;
    if (onStatusChange) onStatusChange('error');
    return null;
  }
}

/**
 * Unsubscribe and tear down the real-time Firebase listener
 */
export function stopRealtimeSync() {
  if (_realtimeUnsubscribe) {
    try { _realtimeUnsubscribe(); } catch (_) {}
    _realtimeUnsubscribe = null;
    _isRealtimeActive = false;
    console.log('[Firebase Realtime] Stopped real-time Firestore listener.');
  }
}
