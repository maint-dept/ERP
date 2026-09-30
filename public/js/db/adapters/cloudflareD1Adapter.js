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

  async _ensureTable() {
    await this._query(
      `CREATE TABLE IF NOT EXISTS erp_tables (table_name TEXT PRIMARY KEY, raw_json TEXT NOT NULL DEFAULT '[]', item_count INTEGER DEFAULT 0, updated_at TEXT)`
    );
  }

  async saveRecord(collection, docId, data) {
    try {
      if (typeof window !== 'undefined' && window.storage && window.storage.data && window.storage.data[collection]) {
        return this.saveTable(collection, window.storage.data[collection]);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async saveTable(collection, dataObj) {
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

      await this._query(
        `INSERT INTO erp_tables (table_name, raw_json, item_count, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(table_name) DO UPDATE SET raw_json=excluded.raw_json, item_count=excluded.item_count, updated_at=excluded.updated_at`,
        [collection, rawJson, itemCount, now]
      );
      return { success: true, updateTime: now };
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
