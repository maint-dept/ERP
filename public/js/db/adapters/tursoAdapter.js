/**
 * Turso (LibSQL) Database Adapter
 * Al-Muslim Group ERP — Multi-Database Adapter Layer
 *
 * Turso exposes an HTTP API: POST /v2/pipeline
 * with Authorization: Bearer <auth-token>
 * No SDK needed — pure fetch works from the browser.
 */
import { BaseAdapter } from './baseAdapter.js';

export class TursoAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.type = 'TURSO';
    // e.g. https://<db-name>-<org>.turso.io
    this.databaseUrl = (config.databaseUrl || config.url || '').replace(/\/$/, '');
    this.authToken = config.authToken || config.token || '';
  }

  async _sql(statements) {
    const url = `${this.databaseUrl}/v2/pipeline`;
    const body = JSON.stringify({
      requests: statements.map(s => ({
        type: 'execute',
        stmt: typeof s === 'string' ? { sql: s } : s
      }))
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Turso HTTP ${res.status}: ${txt}`);
    }
    return res.json();
  }

  async testConnection() {
    try {
      const t0 = Date.now();
      await this._sql([{ sql: 'SELECT 1', args: [] }]);
      return { success: true, latency: Date.now() - t0 };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async _ensureTable(collection) {
    await this._sql([{
      sql: `CREATE TABLE IF NOT EXISTS "${collection}" (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT)`,
      args: []
    }]);
  }

  async saveRecord(collection, docId, data) {
    try {
      await this._ensureTable(collection);
      const json = JSON.stringify(data);
      const now  = new Date().toISOString();
      await this._sql([{
        sql:  `INSERT INTO "${collection}" (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
        args: [{ type: 'text', value: docId }, { type: 'text', value: json }, { type: 'text', value: now }]
      }]);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async saveTable(collection, dataObj) {
    try {
      await this._ensureTable(collection);
      const entries = Array.isArray(dataObj)
        ? dataObj.map(r => [r.id || r._id || String(Math.random()), r])
        : Object.entries(dataObj);
      if (entries.length === 0) return { success: true };
      const now  = new Date().toISOString();
      const stmts = entries.map(([id, row]) => ({
        sql:  `INSERT INTO "${collection}" (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
        args: [
          { type: 'text', value: String(id) },
          { type: 'text', value: JSON.stringify(row) },
          { type: 'text', value: now }
        ]
      }));
      await this._sql(stmts);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async deleteRecord(collection, docId) {
    try {
      await this._sql([{
        sql:  `DELETE FROM "${collection}" WHERE id = ?`,
        args: [{ type: 'text', value: docId }]
      }]);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
