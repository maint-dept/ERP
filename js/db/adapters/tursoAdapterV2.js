/**
 * Turso (LibSQL) Database Adapter
 * Al-Muslim Group ERP — Multi-Database Adapter Layer
 *
 * Turso exposes an HTTP API: POST /v2/pipeline
 * with Authorization: Bearer <auth-token>
 * No SDK needed — pure fetch works directly from the browser.
 *
 * Architecture:
 * Uses unified `erp_tables` key-value JSON store for ultra-fast, 1-query-per-table sync:
 *   { table_name TEXT PK, raw_json TEXT, item_count INT, updated_at TEXT }
 */
import { BaseAdapter } from './baseAdapter.js';

export class TursoAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      role: 'BACKUP',
      type: 'TURSO',
      ...config
    });

    let rawUrl = (config.databaseUrl || config.url || '').trim().replace(/\/$/, '');
    // Auto-convert libsql:// to https://
    rawUrl = rawUrl.replace(/^libsql:\/\//i, 'https://');
    if (rawUrl && !/^https?:\/\//i.test(rawUrl)) {
      rawUrl = 'https://' + rawUrl;
    }
    this.databaseUrl = rawUrl;

    // Clean up auth token
    let rawToken = (config.authToken || config.token || '').trim();
    rawToken = rawToken.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '');
    this.authToken = rawToken;
  }

  async _sql(statements) {
    if (!this.databaseUrl || !this.authToken) {
      throw new Error('Missing Turso Database URL or Auth Token.');
    }

    const url = `${this.databaseUrl}/v2/pipeline`;
    const requests = statements.map(s => {
      const stmtObj = typeof s === 'string' ? { sql: s } : { ...s };
      if (stmtObj.args && Array.isArray(stmtObj.args) && stmtObj.args.length === 0) {
        delete stmtObj.args;
      }
      return {
        type: 'execute',
        stmt: stmtObj
      };
    });

    // Best practice: include close operation
    requests.push({ type: 'close' });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ requests }),
      signal: AbortSignal.timeout(20000)
    }).catch(err => {
      throw new Error(`Cannot reach Turso host: ${err.message}`);
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Turso authentication failed (HTTP ${res.status}). Please verify your Turso Auth Token.`);
      }
      if (res.status === 404) {
        throw new Error(`Turso database not found (HTTP 404). Please verify your Database URL.`);
      }
      throw new Error(`Turso HTTP ${res.status}: ${txt.substring(0, 200)}`);
    }

    const data = await res.json();
    if (data && Array.isArray(data.results)) {
      for (const r of data.results) {
        if (r && r.type === 'error') {
          throw new Error(r.error?.message || 'Turso query execution error');
        }
      }
    }
    return data;
  }

  async _ensureTable() {
    await this._sql([{
      sql: `CREATE TABLE IF NOT EXISTS erp_tables (
        table_name TEXT PRIMARY KEY,
        raw_json TEXT NOT NULL DEFAULT '[]',
        item_count INTEGER DEFAULT 0,
        updated_at TEXT
      );`
    }]);
  }

  async testConnection() {
    if (!this.databaseUrl || !this.authToken) {
      return { success: false, error: 'Missing Turso Database URL or Auth Token.' };
    }
    const t0 = Date.now();
    try {
      await this._sql([{ sql: 'SELECT 1 AS ok' }]);
      // Automatically ensure erp_tables exists
      await this._ensureTable();
      return { success: true, latency: Date.now() - t0 };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async saveTable(collection, dataObj) {
    if (!this.databaseUrl || !this.authToken) {
      return { success: false, error: 'Missing Turso Database URL or Auth Token.' };
    }
    try {
      await this._ensureTable();
      let records = dataObj;
      if (records && !Array.isArray(records) && typeof records === 'object') {
        const vals = Object.values(records);
        if (vals.length > 0 && vals[0] && typeof vals[0] === 'object' && vals[0].id) {
          records = vals;
        }
      }
      const rawJson = JSON.stringify(records ?? []);
      const itemCount = Array.isArray(records) ? records.length : 1;
      const now = new Date().toISOString();

      await this._sql([{
        sql: `INSERT INTO erp_tables (table_name, raw_json, item_count, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(table_name) DO UPDATE SET raw_json=excluded.raw_json, item_count=excluded.item_count, updated_at=excluded.updated_at`,
        args: [
          { type: 'text', value: collection },
          { type: 'text', value: rawJson },
          { type: 'integer', value: String(itemCount) },
          { type: 'text', value: now }
        ]
      }]);
      return { success: true, updateTime: now };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async saveRecord(collection, docId, data) {
    if (!this.databaseUrl || !this.authToken) return { success: false, error: 'Missing credentials' };
    try {
      if (typeof window !== 'undefined' && window.storage && window.storage.data && window.storage.data[collection]) {
        return this.saveTable(collection, window.storage.data[collection]);
      }
      const existing = await this.fetchTable(collection);
      let list = (existing && Array.isArray(existing.data)) ? existing.data : [];
      const idx = list.findIndex(r => r && (r.id === docId || r._id === docId));
      const updatedRow = { ...data, id: docId };
      if (idx >= 0) list[idx] = updatedRow; else list.push(updatedRow);
      return this.saveTable(collection, list);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async fetchTable(collection) {
    if (!this.databaseUrl || !this.authToken) return null;
    try {
      await this._ensureTable();
      const res = await this._sql([{
        sql: `SELECT raw_json, updated_at FROM erp_tables WHERE table_name = ? LIMIT 1`,
        args: [{ type: 'text', value: collection }]
      }]);
      const rows = res.results?.[0]?.response?.result?.rows;
      if (rows && rows.length > 0 && rows[0][0]) {
        const val = rows[0][0];
        const jsonStr = (typeof val === 'object' && val !== null && 'value' in val) ? val.value : val;
        return { data: JSON.parse(jsonStr) };
      }
      return { data: [] };
    } catch (_) {
      return null;
    }
  }

  async deleteRecord(collection, docId) {
    if (!this.databaseUrl || !this.authToken) return { success: false, error: 'Missing credentials' };
    try {
      if (typeof window !== 'undefined' && window.storage && window.storage.data && window.storage.data[collection]) {
        return this.saveTable(collection, window.storage.data[collection]);
      }
      const existing = await this.fetchTable(collection);
      if (existing && Array.isArray(existing.data)) {
        const filtered = existing.data.filter(r => r && r.id !== docId && r._id !== docId);
        return this.saveTable(collection, filtered);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
