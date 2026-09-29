import { BaseAdapter } from './baseAdapter.js';

/**
 * Supabase PostgreSQL Adapter
 * Communicates with Supabase using the PostgREST API and Anon/Publishable Key.
 */
export class SupabaseAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      role: 'BACKUP',
      type: 'SUPABASE',
      ...config
    });
    this.url = config.url || '';
    this.anonKey = config.anonKey || '';
  }

  _getHeaders() {
    return {
      'apikey': this.anonKey,
      'Authorization': `Bearer ${this.anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    };
  }

  async testConnection() {
    if (!this.url || !this.anonKey) return false;
    try {
      // Test by querying a standard lightweight endpoint or attempting to list tables limit=1
      const res = await fetch(`${this.url}/rest/v1/?limit=1`, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(5000)
      });
      return res.ok || res.status === 404; // 404 just means no root, but API is reachable
    } catch (e) {
      return false;
    }
  }

  async saveRecord(collection, docId, data) {
    if (!this.url || !this.anonKey) return { success: false, error: 'Missing credentials' };
    try {
      // Upsert record using Prefer: resolution=merge-duplicates
      // We assume data includes its unique ID under the primary key constraint
      const payload = { ...data, id: docId }; 
      const res = await fetch(`${this.url}/rest/v1/${collection}`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        return { success: true };
      }
      return { success: false, error: await res.text() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async saveTable(collection, dataObj) {
    if (!this.url || !this.anonKey) return { success: false, error: 'Missing credentials' };
    try {
      // Convert object map to array for bulk upsert
      const records = Object.entries(dataObj).map(([id, data]) => ({ ...data, id }));
      if (records.length === 0) return { success: true };

      // Bulk upsert to Supabase
      const res = await fetch(`${this.url}/rest/v1/${collection}`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(records),
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        return { success: true };
      }
      return { success: false, error: await res.text() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async deleteRecord(collection, docId) {
    if (!this.url || !this.anonKey) return { success: false, error: 'Missing credentials' };
    try {
      const res = await fetch(`${this.url}/rest/v1/${collection}?id=eq.${docId}`, {
        method: 'DELETE',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        return { success: true };
      }
      return { success: false, error: await res.text() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
