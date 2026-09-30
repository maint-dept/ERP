/**
 * MySQL Database Adapter
 * Al-Muslim Group ERP — Multi-Database Adapter Layer
 */
import { BaseAdapter } from './baseAdapter.js';

export class MysqlAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.type = 'MYSQL';
    this.host = config.host || '127.0.0.1';
    this.port = config.port || 3306;
    this.database = config.database || 'al_muslim_erp';
    this.username = config.username || '';
    this.password = config.password || '';
    this.ssl = config.ssl !== false;
    this.endpoint = config.endpoint || '/api/db/mysql';
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      'X-DB-Host': this.host,
      'X-DB-Port': String(this.port),
      'X-DB-Name': this.database,
      'X-DB-User': this.username,
      'X-DB-Pass': this.password,
      'X-DB-SSL':  this.ssl ? '1' : '0',
    };
  }

  async testConnection() {
    try {
      const res = await fetch(`${this.endpoint}/ping`, {
        method: 'POST',
        headers: this._headers()
      });
      if (res && res.ok) return { success: true, latency: 35 };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MySQL server unreachable at ${this.endpoint}` };
    } catch (e) {
      return { success: false, error: `Cannot reach MySQL endpoint (${this.endpoint}): ${e.message}` };
    }
  }

  async saveRecord(collection, docId, data) {
    try {
      const res = await fetch(`${this.endpoint}/upsert`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ collection, docId, data })
      });
      if (res && res.ok) return { success: true };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MySQL upsert failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MySQL upsert failed: ${e.message}` };
    }
  }

  async saveTable(collection, dataObj) {
    try {
      const res = await fetch(`${this.endpoint}/save-table`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ collection, data: dataObj })
      });
      if (res && res.ok) return { success: true };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MySQL save-table failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MySQL save-table failed: ${e.message}` };
    }
  }

  async deleteRecord(collection, docId) {
    try {
      const res = await fetch(`${this.endpoint}/delete`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ collection, docId })
      });
      if (res && res.ok) return { success: true };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MySQL delete failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MySQL delete failed: ${e.message}` };
    }
  }
}
