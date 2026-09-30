import { BaseAdapter } from './baseAdapter.js';

/**
 * Supabase Setup SQL definition
 * Can be copied directly by the user to initialize the single-table JSON blob store in Supabase.
 */
export const SUPABASE_SETUP_SQL = `-- ==============================================================
-- Al-Muslim Group ERP — Supabase Storage Table Setup
-- Run this once in your Supabase SQL Editor:
-- ==============================================================
CREATE TABLE IF NOT EXISTS erp_tables (
  table_name TEXT PRIMARY KEY,
  raw_json TEXT NOT NULL DEFAULT '[]',
  item_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE erp_tables ENABLE ROW LEVEL SECURITY;

-- Allow Anon API Key to Read, Insert, and Update ERP tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'erp_tables' AND policyname = 'Allow anon full access'
  ) THEN
    CREATE POLICY "Allow anon full access" ON erp_tables
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

/**
 * Supabase PostgreSQL Adapter — JSON Blob Store Design
 *
 * Uses a SINGLE table `erp_tables` as a key-value JSON blob store,
 * mirroring the Firebase REST design. Each ERP table = one row:
 *   { table_name (PK), raw_json TEXT, item_count INT, updated_at TIMESTAMPTZ }
 */
export class SupabaseAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      role: 'BACKUP',
      type: 'SUPABASE',
      ...config
    });
    this.url = (config.url || '').trim().replace(/\/$/, '');
    this.anonKey = (config.anonKey || '').trim();

    // Auto-parse from a single raw connStr if provided
    if (config.connStr) {
      const urlMatch = config.connStr.match(/https:\/\/[^\s"',]+/i);
      const keyMatch = config.connStr.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/i);
      if (urlMatch) this.url = urlMatch[0].trim().replace(/\/$/, '');
      if (keyMatch) this.anonKey = keyMatch[0].trim();
    }
  }

  /**
   * Helper to derive the direct link to the user's Supabase SQL Editor.
   */
  getDashboardSqlUrl() {
    if (!this.url) return 'https://supabase.com/dashboard';
    const match = this.url.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
    if (match && match[1]) {
      return `https://supabase.com/dashboard/project/${match[1]}/sql/new`;
    }
    return 'https://supabase.com/dashboard';
  }

  _getHeaders(extra = {}) {
    return {
      'apikey': this.anonKey,
      'Authorization': `Bearer ${this.anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
      ...extra
    };
  }

  /**
   * Test connection by pinging the Supabase REST endpoint and verifying erp_tables exists.
   * Returns { success, latency?, isTableMissing?, isAuthError?, error? }
   */
  async testConnection() {
    if (!this.url || !this.anonKey) {
      return { success: false, error: 'Missing Supabase Project URL or Anon API Key.' };
    }
    const startTime = Date.now();
    try {
      // 1. Verify endpoint & credentials by pinging root PostgREST OpenAPI schema
      const pingRes = await fetch(`${this.url}/rest/v1/?limit=1`, {
        method: 'GET',
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${this.anonKey}`
        },
        signal: AbortSignal.timeout(7000)
      }).catch(err => {
        throw new Error(`Cannot reach Supabase host: ${err.message}`);
      });

      if (pingRes.status === 401 || pingRes.status === 403) {
        return {
          success: false,
          isAuthError: true,
          error: `Authentication failed (HTTP ${pingRes.status}). Please verify your Supabase Anon / Publishable Key.`
        };
      }

      // 2. Check if erp_tables table exists in PostgreSQL schema
      const res = await fetch(
        `${this.url}/rest/v1/erp_tables?limit=1&select=table_name`,
        {
          method: 'GET',
          headers: this._getHeaders(),
          signal: AbortSignal.timeout(8000)
        }
      );
      const latency = Date.now() - startTime;

      if (res.ok) {
        return { success: true, latency };
      }

      const errText = await res.text().catch(() => '');
      if (
        res.status === 404 || 
        res.status === 400 || 
        errText.includes('erp_tables') || 
        errText.includes('42P01') || 
        errText.includes('schema cache')
      ) {
        return {
          success: false,
          isTableMissing: true,
          sqlUrl: this.getDashboardSqlUrl(),
          error: 'Table "erp_tables" not found in Supabase. Please run the 1-step setup SQL in Supabase SQL Editor.'
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          isAuthError: true,
          error: `Authentication failed (HTTP ${res.status}). Please check your Supabase Anon Key.`
        };
      }

      return { success: false, error: `HTTP ${res.status}: ${errText.substring(0, 200)}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Save an entire ERP table as a single JSON blob row in erp_tables.
   * dataObj can be an Array or plain Object.
   */
  async saveTable(collection, dataObj) {
    if (!this.url || !this.anonKey) {
      return { success: false, error: 'Missing Supabase credentials' };
    }
    try {
      // Normalize input: ERP tables are arrays; handle edge cases safely
      let records = dataObj;
      if (records && !Array.isArray(records) && typeof records === 'object') {
        const vals = Object.values(records);
        if (vals.length > 0 && vals[0] && typeof vals[0] === 'object' && vals[0].id) {
          records = vals;
        }
      }

      const rawJson = JSON.stringify(records ?? []);
      const itemCount = Array.isArray(records) ? records.length : 1;
      const nowIso = new Date().toISOString();

      const payload = {
        table_name: collection,
        raw_json: rawJson,
        item_count: itemCount,
        updated_at: nowIso
      };

      // Must explicitly supply on_conflict=table_name for PostgREST upsert
      const res = await fetch(`${this.url}/rest/v1/erp_tables?on_conflict=table_name`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000)
      });

      if (res.ok || res.status === 201 || res.status === 204) {
        return { success: true, updateTime: nowIso };
      }

      const errText = await res.text().catch(() => '');
      if (
        res.status === 404 || 
        errText.includes('erp_tables') || 
        errText.includes('42P01') || 
        errText.includes('schema cache')
      ) {
        return {
          success: false,
          isTableMissing: true,
          error: 'Table "erp_tables" not found in Supabase. Please run the setup SQL in Supabase SQL Editor.'
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          isAuthError: true,
          error: 'Authentication failed (HTTP ' + res.status + '). Please check your Supabase Anon API Key.'
        };
      }

      return { success: false, error: `HTTP ${res.status}: ${errText.substring(0, 300)}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Save a single record safely without wiping out the rest of the collection.
   */
  async saveRecord(collection, docId, data) {
    if (!this.url || !this.anonKey) return { success: false, error: 'Missing credentials' };
    try {
      // If we have live memory storage, persist the full updated collection
      if (typeof window !== 'undefined' && window.storage && window.storage.data && window.storage.data[collection]) {
        return this.saveTable(collection, window.storage.data[collection]);
      }

      // Otherwise fetch table from Supabase, merge, and save
      const existing = await this.fetchTable(collection);
      let list = (existing && Array.isArray(existing.data)) ? existing.data : [];
      const idx = list.findIndex(r => r && (r.id === docId || r._id === docId));
      const updatedRow = { ...data, id: docId };
      if (idx >= 0) {
        list[idx] = updatedRow;
      } else {
        list.push(updatedRow);
      }
      return this.saveTable(collection, list);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Fetch a specific table's data from erp_tables.
   */
  async fetchTable(collection) {
    if (!this.url || !this.anonKey) return null;
    try {
      const res = await fetch(
        `${this.url}/rest/v1/erp_tables?table_name=eq.${encodeURIComponent(collection)}&select=raw_json,updated_at`,
        {
          method: 'GET',
          headers: this._getHeaders(),
          signal: AbortSignal.timeout(10000)
        }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      try {
        return {
          data: JSON.parse(rows[0].raw_json),
          updateTime: rows[0].updated_at
        };
      } catch (_) { return null; }
    } catch (e) { return null; }
  }

  /**
   * Delete a record from erp_tables.
   */
  async deleteRecord(collection, docId) {
    if (!this.url || !this.anonKey) return { success: false, error: 'Missing credentials' };
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
