/**
 * Enterprise Server-Sent Events (SSE) Real-Time Synchronization Engine
 * Al-Muslim Group ERP — Multi-User Live Collaboration Hub
 *
 * Provides sub-10ms real-time push synchronization across all connected factory devices.
 * Eliminates repetitive short-polling, saving server bandwidth and memory.
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';

class RealtimeService {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 50;
    this.reconnectDelay = 3000;
    this._listeners = new Map();
    this._endpoint = '/api/realtime/stream';
  }

  /**
   * Initialize and connect to the SSE stream
   */
  init() {
    if (typeof window === 'undefined' || !window.EventSource) {
      console.warn('[RealtimeService] EventSource API is not supported in this browser.');
      return;
    }
    this.connect();
  }

  /**
   * Establish persistent EventSource connection
   */
  connect() {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (_) {}
      this.eventSource = null;
    }

    try {
      const isGhPages = typeof window !== 'undefined' && window.location && window.location.hostname.includes('github.io');
      this._endpoint = isGhPages ? 'https://moviezonex.com/api/realtime/stream' : '/api/realtime/stream';
      this.eventSource = new EventSource(this._endpoint);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('[RealtimeService] ⚡ Connected to Real-Time SSE Hub');
        this._updateStatusIndicator(true);
        window.dispatchEvent(new CustomEvent('erp:realtime-connected', { detail: { timestamp: new Date().toISOString() } }));
      };

      this.eventSource.onmessage = (e) => {
        if (!e || !e.data) return;
        try {
          const payload = JSON.parse(e.data);
          this._handleRealtimeMessage(payload);
        } catch (err) {
          console.warn('[RealtimeService] Message parse notice:', err.message);
        }
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this._updateStatusIndicator(false);
        // EventSource automatically attempts to reconnect on failure
        window.dispatchEvent(new CustomEvent('erp:realtime-disconnected', { detail: { attempts: this.reconnectAttempts } }));
      };
    } catch (err) {
      console.warn('[RealtimeService] Connection initialization notice:', err.message);
    }
  }

  /**
   * Process incoming real-time change message
   * @param {Object} payload - Message payload
   */
  _handleRealtimeMessage(payload) {
    if (!payload || typeof payload !== 'object') return;

    if (payload.type === 'CONNECTED') {
      console.log(`[RealtimeService] 🌐 Session active (${payload.activeClients} active factory devices)`);
      return;
    }

    const { table, action, id, data } = payload;
    if (!table) return;

    console.log(`[RealtimeService] ⚡ Event received: [${table}] ${action} ${id || ''}`);

    // 1. Granular Single-Record Updates
    if (action === 'RECORD_SAVED' && id && data && typeof data === 'object') {
      this._applySingleRecordUpdate(table, id, data);
    } else if (action === 'RECORD_DELETED' && id) {
      this._applySingleRecordDelete(table, id);
    } else if (action === 'TABLE_SAVED') {
      this._applyTableInvalidation(table);
    }

    // 2. Dispatch system-wide custom events for UI reactivity
    window.dispatchEvent(new CustomEvent('erp:realtime-event', { detail: payload }));
    if (table === TABLE_NAMES.MACHINES) {
      window.dispatchEvent(new CustomEvent('erp:realtime-machine-updated', { detail: payload }));
      window.dispatchEvent(new CustomEvent('erp:inventory-updated', { detail: payload }));
    } else if (table === TABLE_NAMES.NOTIFICATIONS) {
      window.dispatchEvent(new CustomEvent('erp:realtime-notification-updated', { detail: payload }));
      window.dispatchEvent(new CustomEvent('erp:notifications-updated', { detail: payload }));
      if (data && typeof data === 'object') {
        import('./webPushService.js').then(({ webPushService }) => {
          webPushService.sendPushNotification(data);
        }).catch(() => {});
      }
    } else if (table === TABLE_NAMES.TRANSFERS || table === TABLE_NAMES.TRANSFER_REQUESTS) {
      window.dispatchEvent(new CustomEvent('erp:realtime-transfer-updated', { detail: payload }));
      window.dispatchEvent(new CustomEvent('erp:transfers-updated', { detail: payload }));
    } else {
      window.dispatchEvent(new CustomEvent('erp:storage-updated', { detail: payload }));
    }
  }

  /**
   * Apply in-memory and local cache update for a single record without full re-fetch
   */
  _applySingleRecordUpdate(tableName, docId, recordData) {
    if (!storage || !storage.data) return;
    const currentTable = storage.data[tableName];
    if (!Array.isArray(currentTable)) return;

    let idx = currentTable.findIndex(item => item && (item.id === docId || item._id === docId));
    if (idx === -1 && tableName === TABLE_NAMES.EMPLOYEES && recordData && recordData.cardNumber) {
      const cleanCard = String(recordData.cardNumber).trim().toUpperCase();
      idx = currentTable.findIndex(item => item && String(item.cardNumber || '').trim().toUpperCase() === cleanCard);
    }

    if (idx !== -1) {
      // 🛡️ Anti-Auto-Resurrect Safeguard for Employees
      if (tableName === TABLE_NAMES.EMPLOYEES) {
        const local = currentTable[idx];
        const localInactive = local && (local.status === 'INACTIVE' || local.status === 'TERMINATED' || local.status === 'ON_LEAVE');
        const incomingActive = recordData && recordData.status === 'ACTIVE';
        if (localInactive && incomingActive) {
          const localTs = new Date(local.updatedAt || 0).getTime();
          const incomingTs = new Date(recordData.updatedAt || 0).getTime();
          // If local was marked inactive and incoming is not strictly newer, protect local inactive status!
          if (!recordData.updatedAt || incomingTs <= localTs) {
            recordData = { ...recordData, status: local.status, updatedAt: local.updatedAt };
          }
        }
      }
      currentTable[idx] = { ...currentTable[idx], ...recordData };
    } else {
      currentTable.unshift(recordData);
    }

    if (tableName === TABLE_NAMES.MACHINES && typeof storage.rebuildAllIndexes === 'function') {
      storage.rebuildAllIndexes();
    }
    if (typeof storage._invalidateTableIdMap === 'function') {
      storage._invalidateTableIdMap(tableName);
    }

    // Persist to IndexedDB locally
    if (typeof idbCache !== 'undefined' && idbCache.setTable) {
      idbCache.setTable(tableName, currentTable).catch(() => {});
    }

    // Trigger row update in UI
    if (tableName === TABLE_NAMES.EMPLOYEES && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:employees-updated', { detail: { id: docId, record: currentTable[idx] } }));
      window.dispatchEvent(new CustomEvent('erp:storage-updated', { detail: { table: tableName, id: docId } }));
    } else {
      this._highlightInventoryRow(docId);
    }
  }

  /**
   * Remove record locally when deleted remotely
   */
  _applySingleRecordDelete(tableName, docId) {
    if (!storage || !storage.data) return;
    const currentTable = storage.data[tableName];
    if (!Array.isArray(currentTable)) return;

    storage.data[tableName] = currentTable.filter(item => item && item.id !== docId && item._id !== docId);

    if (tableName === TABLE_NAMES.MACHINES && typeof storage.rebuildAllIndexes === 'function') {
      storage.rebuildAllIndexes();
    }
    if (typeof storage._invalidateTableIdMap === 'function') {
      storage._invalidateTableIdMap(tableName);
    }

    if (typeof idbCache !== 'undefined' && idbCache.setTable) {
      idbCache.setTable(tableName, storage.data[tableName]).catch(() => {});
    }

    if (tableName === TABLE_NAMES.EMPLOYEES && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:employees-updated', { detail: { id: docId } }));
      window.dispatchEvent(new CustomEvent('erp:storage-updated', { detail: { table: tableName, id: docId } }));
    }
  }

  /**
   * When whole table is saved remotely, trigger background delta refresh
   */
  _applyTableInvalidation(tableName) {
    if (storage && typeof storage.checkAndSyncRemoteChanges === 'function') {
      storage.checkAndSyncRemoteChanges().catch(() => {});
    }
  }

  /**
   * Subtle visual highlight when row updates in real-time
   */
  _highlightInventoryRow(docId) {
    if (typeof document === 'undefined') return;
    const rowEl = document.querySelector(`tr[data-id="${docId}"], tr[data-machine-id="${docId}"]`);
    if (rowEl) {
      rowEl.classList.add('realtime-updated-highlight');
      setTimeout(() => {
        rowEl.classList.remove('realtime-updated-highlight');
      }, 1500);
    }
  }

  /**
   * Updates real-time connectivity status pill in navbar
   */
  _updateStatusIndicator(online) {
    if (typeof document === 'undefined') return;
    const indicator = document.getElementById('nav-realtime-pill');
    if (indicator) {
      indicator.innerHTML = online 
        ? '<span class="live-dot"></span> Live' 
        : '<span style="color: #94a3b8;">○</span> Connecting';
      indicator.title = online 
        ? 'Real-Time SSE Connected: Live Factory Sync Active' 
        : 'Connecting to Real-Time SSE Hub...';
    }
  }

  /**
   * Broadcast change event to Node.js real-time hub
   */
  broadcastChange(payload) {
    if (!payload || !payload.table) return;
    try {
      const isGhPages = typeof window !== 'undefined' && window.location && window.location.hostname.includes('github.io');
      const endpoint = isGhPages ? 'https://moviezonex.com/api/realtime/broadcast' : '/api/realtime/broadcast';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DATA_CHANGED',
          table: payload.table,
          id: payload.id || null,
          action: payload.type || 'RECORD_SAVED',
          data: payload.data || null,
          senderId: this.clientId || null,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});
    } catch (_) {}
  }

  /**
   * Close connection on logout or unload
   */
  disconnect() {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (_) {}
      this.eventSource = null;
    }
    this.isConnected = false;
    this._updateStatusIndicator(false);
  }
}

export const realtimeService = new RealtimeService();

if (typeof window !== 'undefined') {
  window.realtimeService = realtimeService;
}
