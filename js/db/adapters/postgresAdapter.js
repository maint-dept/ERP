/**
 * PostgreSQL Database Adapter
 * Al-Muslim Group ERP — Multi-Database Adapter Layer
 * Compatible with Paid Hosting (PHP REST API bridge pg_api.php) and Node.js proxy
 */
import { BaseAdapter } from './baseAdapter.js';

export class PostgresAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);
    this.type = 'POSTGRESQL';
    this.name = config.name || 'PostgreSQL Database';
    this.host = config.host || 'localhost';
    this.port = config.port || 5432;
    this.database = config.database || 'motaherh_maint_pg';
    this.username = config.username || 'motaherh_pguser';
    this.password = config.password || '';
    this.apiKey = config.apiKey || '';
    this.ssl = config.ssl !== false;

    let rawEndpoint = (config.endpoint || '').trim().replace(/\/$/, '');
    if (!rawEndpoint ||
        rawEndpoint === 'api/pg_api.php' ||
        rawEndpoint === '/api/pg_api.php' ||
        rawEndpoint.includes('://api/pg_api.php') ||
        rawEndpoint === '/api/db/pg' ||
        (rawEndpoint.includes('api/pg_api.php') && !rawEndpoint.startsWith('http'))) {
      if (typeof window !== 'undefined' && window.location && (window.location.hostname.includes('github.io') || window.location.hostname.includes('moviezonex.com'))) {
        rawEndpoint = 'https://moviezonex.com/pg_api.php';
      } else {
        rawEndpoint = rawEndpoint || '/api/db/pg';
      }
    } else if (!/^https?:\/\//i.test(rawEndpoint) && !rawEndpoint.startsWith('/')) {
      rawEndpoint = 'https://' + rawEndpoint;
    }
    this.endpoint = rawEndpoint;
  }

  _headers() {
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
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
    const cu = (typeof window !== 'undefined' && window.authService?.getCurrentUser) ? window.authService.getCurrentUser() : null;
    if (cu?.role) headers['X-User-Role'] = cu.role;
    if (cu?.id) headers['X-User-Id'] = cu.id;
    return headers;
  }

  _getUrl(action) {
    const tParam = `_t=${Date.now()}`;
    if (this.endpoint.includes('.php')) {
      const sep = this.endpoint.includes('?') ? '&' : '?';
      return `${this.endpoint}${sep}action=${action}&${tParam}`;
    }
    // Standard REST or Node proxy route
    return `${this.endpoint}/${action}?${tParam}`;
  }

  async testConnection() {
    try {
      const start = Date.now();
      const url = this._getUrl('ping');
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: this._headers(),
        body: JSON.stringify({ action: 'ping', apiKey: this.apiKey })
      });
      const latency = Date.now() - start;

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          success: true,
          latency: data.latency || latency,
          message: data.message || 'Connected to PostgreSQL successfully!',
          version: data.version || 'PostgreSQL 15+',
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
        error: parsedErr || `PostgreSQL server returned HTTP ${res.status}`
      };
    } catch (e) {
      return {
        success: false,
        error: `Cannot reach PostgreSQL endpoint (${this.endpoint}): ${e.message}. Check CORS, HTTPS or hosting URL.`
      };
    }
  }

  async saveRecord(collection, docId, data) {
    try {
      const url = this._getUrl('upsert');
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: this._headers(),
        body: JSON.stringify({ action: 'upsert', collection, docId, data, apiKey: this.apiKey })
      });
      if (res && res.ok) return { success: true };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `PostgreSQL upsert failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `PostgreSQL upsert failed: ${e.message}` };
    }
  }

  async saveTable(collection, dataObj) {
    try {
      const url = this._getUrl('save_table');
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: this._headers(),
        body: JSON.stringify({ action: 'save_table', collection, data: dataObj, apiKey: this.apiKey })
      });
      if (res && res.ok) {
        const json = await res.json().catch(() => ({}));
        return { success: true, ...json, updateTime: json.updatedAt || json.updateTime };
      }
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `PostgreSQL save-table failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `PostgreSQL save-table failed: ${e.message}` };
    }
  }

  async saveMultipleTables(tablesObj) {
    try {
      const url = this._getUrl('save_multiple_tables');
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: this._headers(),
        body: JSON.stringify({ action: 'save_multiple_tables', tables: tablesObj, apiKey: this.apiKey })
      });
      if (res && res.ok) {
        const json = await res.json().catch(() => ({}));
        return { success: true, ...json, updateTime: json.updatedAt || json.updateTime };
      }
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `PostgreSQL save-multiple-tables failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `PostgreSQL save-multiple-tables failed: ${e.message}` };
    }
  }

  async getTable(collection) {
    try {
      let url = this._getUrl('get_table');
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}table=${encodeURIComponent(collection)}`;
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: this._headers()
      });
      if (res && res.ok) {
        const json = await res.json();
        return { success: true, data: json.data || [], itemCount: json.itemCount || 0 };
      }
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `PostgreSQL getTable failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `PostgreSQL getTable failed: ${e.message}` };
    }
  }

  async getAllTables() {
    try {
      const url = this._getUrl('get_all');
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: this._headers()
      });
      if (res && res.ok) {
        const json = await res.json();
        return { success: true, tables: json.tables || {}, tableCount: json.tableCount || 0 };
      }
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `PostgreSQL getAllTables failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `PostgreSQL getAllTables failed: ${e.message}` };
    }
  }

  async getTableTimestamps() {
    try {
      const url = this._getUrl('stats');
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
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
        cache: 'no-store',
        headers: this._headers(),
        body: JSON.stringify({ action: 'delete', collection, docId, apiKey: this.apiKey })
      });
      if (res && res.ok) return { success: true };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `PostgreSQL delete failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `PostgreSQL delete failed: ${e.message}` };
    }
  }
}
