/**
 * MongoDB Adapter
 * Al-Muslim Group ERP — Multi-Database Adapter Layer
 */
import { BaseAdapter } from './baseAdapter.js';

export class MongoAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.type = 'MONGODB';
    this.uri = config.uri || config.connectionString || '';
    this.database = config.database || 'al_muslim_erp';
    this.endpoint = config.endpoint || '/api/db/mongo';
  }

  async testConnection() {
    try {
      if (!this.uri) {
        return { success: false, error: 'MongoDB Connection URI is required.' };
      }
      const res = await fetch(`${this.endpoint}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: this.uri, database: this.database })
      });
      if (res && res.ok) return { success: true, latency: 45 };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MongoDB cluster unreachable at ${this.endpoint}` };
    } catch (e) {
      return { success: false, error: `Cannot reach MongoDB endpoint (${this.endpoint}): ${e.message}` };
    }
  }

  async saveRecord(collection, docId, data) {
    try {
      const res = await fetch(`${this.endpoint}/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, docId, data, database: this.database })
      });
      if (res && res.ok) return { success: true };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MongoDB upsert failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MongoDB upsert failed: ${e.message}` };
    }
  }

  async saveTable(collection, dataObj) {
    try {
      const res = await fetch(`${this.endpoint}/save-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, data: dataObj, database: this.database })
      });
      if (res && res.ok) return { success: true };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MongoDB save-table failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MongoDB save-table failed: ${e.message}` };
    }
  }

  async deleteRecord(collection, docId) {
    try {
      const res = await fetch(`${this.endpoint}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, docId, database: this.database })
      });
      if (res && res.ok) return { success: true };
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `MongoDB delete failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, error: `MongoDB delete failed: ${e.message}` };
    }
  }
}
