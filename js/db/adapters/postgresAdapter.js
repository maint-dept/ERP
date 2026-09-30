/**
 * PostgreSQL Database Adapter
 * Al-Muslim Group ERP — Multi-Database Adapter Layer
 *
 * NOTE: Direct TCP connections are impossible from browser JS.
 * This adapter communicates with a REST proxy (self-hosted or via Neon HTTP API).
 * For Neon, use the NeonAdapter which speaks Neon's serverless HTTP driver directly.
 */
import { BaseAdapter } from './baseAdapter.js';

export class PostgresAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.type = 'POSTGRESQL';
    // REST proxy endpoint — the server.js /api/db/pg route or a custom endpoint
    this.endpoint = config.endpoint || config.host || '';
    this.database = config.database || 'erp';
    this.username = config.username || '';
    this.password = config.password || '';
    this.ssl = config.ssl !== false;
    this.port = config.port || 5432;
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      'X-DB-Host': this.endpoint,
      'X-DB-Port': String(this.port),
      'X-DB-Name': this.database,
      'X-DB-User': this.username,
      'X-DB-Pass': this.password,
      'X-DB-SSL':  this.ssl ? '1' : '0',
    };
  }

  async testConnection() {
    try {
      const res = await fetch('/api/db/pg/ping', { method: 'POST', headers: this._headers() });
      if (res.ok) return { success: true, latency: null };
      const txt = await res.text();
      return { success: false, error: txt };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async saveRecord(collection, docId, data) {
    try {
      const res = await fetch('/api/db/pg/upsert', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ collection, docId, data })
      });
      if (res.ok) return { success: true };
      return { success: false, error: await res.text() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async saveTable(collection, dataObj) {
    try {
      const res = await fetch('/api/db/pg/save-table', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ collection, data: dataObj })
      });
      if (res.ok) return { success: true };
      return { success: false, error: await res.text() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async deleteRecord(collection, docId) {
    try {
      const res = await fetch('/api/db/pg/delete', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ collection, docId })
      });
      if (res.ok) return { success: true };
      return { success: false, error: await res.text() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
