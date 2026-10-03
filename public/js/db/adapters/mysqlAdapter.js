/**
 * MySQL Database Adapter
 * Al-Muslim Group ERP — Multi-Database Adapter Layer
 * Compatible with Paid Hosting (PHP REST API) and Node.js backend proxy
 */
import { BaseAdapter } from './baseAdapter.js';

export class MysqlAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);
    this.type = 'MYSQL';
    this.name = config.name || 'MySQL Database';
    this.host = config.host || 'localhost';
    this.port = config.port || 3306;
    this.database = config.database || 'al_muslim_erp';
    this.username = config.username || '';
    this.password = config.password || '';
    this.apiKey = config.apiKey || '';
    this.ssl = config.ssl !== false;
    let rawEndpoint = (config.endpoint || '/api/db/mysql').trim().replace(/\/$/, '');
    if (rawEndpoint && !rawEndpoint.startsWith('/') && !/^https?:\/\//i.test(rawEndpoint)) {
      rawEndpoint = 'https://' + rawEndpoint;
    }
    this.endpoint = rawEndpoint;
  }

  _headers() {
    const headers = {
      'Content-Type': 'application/json',
      'X-DB-Host': this.host,
      'X-DB-Port': String(this.port),
      'X-DB-Name': this.database,
      'X-DB-User': this.username,
      'X-DB-Pass': this.password,
      'X-DB-SSL':  this.ssl ? '1' : '0',
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  _getUrl(action) {
    if (this.endpoint.includes('.php')) {
      const sep = this.endpoint.includes('?') ? '&' : '?';
      return `${this.endpoint}${sep}action=${action}`;
    }
    // Standard REST or Node proxy route
    return `${this.endpoint}/${action}`;
  }

  async testConnection() {
    try {
      const start = Date.now();
      const url = this._getUrl('ping');
      const res = await fetch(url, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ action: 'ping', apiKey: this.apiKey })
      });
      const latency = Date.now() - start;

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          success: true,
          latency: data.latency || latency,
          message: data.message || 'Connected to MySQL successfully!',
          version: data.version || 'MySQL 8.x',
          database: data.database || this.database,
          tablesCount: data.tablesCount ?? 0,
          totalItems: data.totalItems ?? 0
        };
      }

      const errText = await res.text().catch(() => '');
      let parsedErr = '';
      try {
        const j = JSON.parse(errText);
        parsedErr = j.error || j.message || errText;
      } catch (_) {
        parsedErr = errText;
      }

      return {
        success: false,
        error: parsedErr || `MySQL server returned HTTP ${res.status}`
      };
    } catch (e) {
      return {
        success: false,
        error: `Cannot reach MySQL endpoint (${this.endpoint}): ${e.message}. Check CORS, HTTPS or hosting URL.`
      };
    }
  }

  async saveRecord(collection, docId, data) {
    try {
      const url = this._getUrl('upsert');
      const res = await fetch(url, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ action: 'upsert', collection, docId, data, apiKey: this.apiKey })
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
      const url = this._getUrl('save_table');
      const res = await fetch(url, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ action: 'save_table', collection, data: dataObj, apiKey: this.apiKey })
      });
      if (res && res.ok) {
        const json = await res.json().catch(() => ({}));
        return { success: true, ...json };
      }
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MySQL save-table failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MySQL save-table failed: ${e.message}` };
    }
  }

  async getTable(collection) {
    try {
      let url = this._getUrl('get_table');
      if (url.includes('?')) {
        url += `&table=${encodeURIComponent(collection)}`;
      } else {
        url += `?table=${encodeURIComponent(collection)}`;
      }
      const res = await fetch(url, {
        method: 'GET',
        headers: this._headers()
      });
      if (res && res.ok) {
        const json = await res.json();
        return { success: true, data: json.data || [], itemCount: json.itemCount || 0 };
      }
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MySQL getTable failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MySQL getTable failed: ${e.message}` };
    }
  }

  async getAllTables() {
    try {
      const url = this._getUrl('get_all');
      const res = await fetch(url, {
        method: 'GET',
        headers: this._headers()
      });
      if (res && res.ok) {
        const json = await res.json();
        return { success: true, tables: json.tables || {}, tableCount: json.tableCount || 0 };
      }
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MySQL getAllTables failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MySQL getAllTables failed: ${e.message}` };
    }
  }

  async getTableTimestamps() {
    try {
      const url = this._getUrl('stats');
      const res = await fetch(url, {
        method: 'GET',
        headers: this._headers()
      });
      if (res && res.ok) {
        const json = await res.json();
        const timestamps = {};
        if (Array.isArray(json.tables)) {
          json.tables.forEach(t => {
            if (t.table_name && t.updated_at) {
              timestamps[t.table_name] = t.updated_at;
            }
          });
        }
        return { success: true, timestamps, totalTables: json.totalTables || Object.keys(timestamps).length };
      }
      return { success: false, timestamps: {} };
    } catch (e) {
      return { success: false, error: e.message, timestamps: {} };
    }
  }

  async deleteRecord(collection, docId) {
    try {
      const url = this._getUrl('delete');
      const res = await fetch(url, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ action: 'delete', collection, docId, apiKey: this.apiKey })
      });
      if (res && res.ok) return { success: true };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MySQL delete failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MySQL delete failed: ${e.message}` };
    }
  }
}

