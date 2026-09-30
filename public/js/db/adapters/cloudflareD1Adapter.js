/**
 * Cloudflare D1 Database Adapter
 * Al-Muslim Group ERP — Multi-Database Adapter Layer
 *
 * Cloudflare D1 REST API:
 *   POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query
 *   Authorization: Bearer <api_token>
 *
 * Note: The CF API does not support cross-origin requests from browsers by default.
 * When deployed on CF Pages it works natively; otherwise a CORS proxy or Worker is needed.
 */
import { BaseAdapter } from './baseAdapter.js';

const CF_API = 'https://api.cloudflare.com/client/v4';

export class CloudflareD1Adapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.type = 'CLOUDFLARE_D1';
    this.accountId  = config.accountId  || '';
    this.databaseId = config.databaseId || '';
    this.apiToken   = config.apiToken   || '';
  }

  get _endpoint() {
    return `${CF_API}/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
  }

  async _query(sql, params = []) {
    const res = await fetch(this._endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.apiToken}`
      },
      body: JSON.stringify({ sql, params })
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error((json.errors || []).map(e => e.message).join('; ') || 'D1 query failed');
    }
    return json.result;
  }

  async testConnection() {
    try {
      const t0 = Date.now();
      await this._query('SELECT 1 AS ok');
      return { success: true, latency: Date.now() - t0 };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async _ensureTable(collection) {
    await this._query(
      `CREATE TABLE IF NOT EXISTS "${collection}" (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT)`
    );
  }

  async saveRecord(collection, docId, data) {
    try {
      await this._ensureTable(collection);
      await this._query(
        `INSERT INTO "${collection}" (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
        [docId, JSON.stringify(data), new Date().toISOString()]
      );
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
      const now = new Date().toISOString();
      // D1 has a 100-statement batch limit; chunk accordingly
      const CHUNK = 90;
      for (let i = 0; i < entries.length; i += CHUNK) {
        const chunk = entries.slice(i, i + CHUNK);
        // Use a multi-row INSERT with individual ON CONFLICT statements
        for (const [id, row] of chunk) {
          await this._query(
            `INSERT INTO "${collection}" (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
            [String(id), JSON.stringify(row), now]
          );
        }
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async deleteRecord(collection, docId) {
    try {
      await this._query(`DELETE FROM "${collection}" WHERE id = ?`, [docId]);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
