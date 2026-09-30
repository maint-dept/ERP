/**
 * Neon Serverless PostgreSQL Adapter
 * Al-Muslim Group ERP — Multi-Database Adapter Layer
 *
 * Neon exposes a serverless HTTP API via @neondatabase/serverless,
 * but we can hit it directly with fetch using the standard pg connection string.
 *
 * REST endpoint: https://console.neon.tech/api/v2/projects/{project_id}/...
 *
 * For DATA operations we use Neon's HTTP query endpoint:
 *   POST https://<host>/sql   (requires the Neon serverless driver or CORS proxy)
 *
 * The simplest browser-compatible approach: use the Neon HTTP endpoint
 *   POST https://<host>/sql
 *   Authorization: Bearer <api_key>
 *   Content-Type: application/sql
 *
 * Since the Neon HTTP driver may not be CORS-accessible from all origins,
 * we provide a configurable proxyUrl fallback (e.g., server.js /api/db/neon).
 */
import { BaseAdapter } from './baseAdapter.js';

export class NeonAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.type = 'NEON';
    // Full Neon connection string: postgres://user:pass@host/dbname
    this.connectionString = config.connectionString || '';
    // Optional: override with a CORS-friendly REST proxy
    this.proxyUrl = config.proxyUrl || '/api/db/neon';
    this._parsed = this._parseConnectionString(this.connectionString);
  }

  _parseConnectionString(cs) {
    if (!cs) return {};
    try {
      // postgres://user:pass@host:5432/dbname?sslmode=require
      const u = new URL(cs.replace(/^postgres:\/\//, 'http://').replace(/^postgresql:\/\//, 'http://'));
      return {
        user:     decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        host:     u.hostname,
        port:     u.port || '5432',
        database: (u.pathname || '/').replace(/^\//, '') || 'neondb',
        ssl:      u.searchParams.get('sslmode') !== 'disable'
      };
    } catch (_) {
      return {};
    }
  }

  async _sql(sql, params = []) {
    // Route through the local proxy (server.js) so credentials stay server-side
    const res = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Neon-Connection': this.connectionString
      },
      body: JSON.stringify({ sql, params })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Neon proxy ${res.status}: ${txt}`);
    }
    return res.json();
  }

  async testConnection() {
    try {
      const t0 = Date.now();
      await this._sql('SELECT 1 AS ok');
      return { success: true, latency: Date.now() - t0 };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async _ensureTable(collection) {
    await this._sql(
      `CREATE TABLE IF NOT EXISTS "${collection}" (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())`
    );
  }

  async saveRecord(collection, docId, data) {
    try {
      await this._ensureTable(collection);
      await this._sql(
        `INSERT INTO "${collection}" (id, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [docId, JSON.stringify(data)]
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
      for (const [id, row] of entries) {
        await this._sql(
          `INSERT INTO "${collection}" (id, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [String(id), JSON.stringify(row)]
        );
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async deleteRecord(collection, docId) {
    try {
      await this._sql(`DELETE FROM "${collection}" WHERE id = $1`, [docId]);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
