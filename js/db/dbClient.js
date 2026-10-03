/**
 * Unified Database Client (Adapter Layer Interface)
 * Al-Muslim Group ERP — Database Architecture
 *
 * Core Design Decision:
 * All ERP modules interact with this unified client interface regardless of
 * whether the active underlying provider is MySQL, PostgreSQL, Turso,
 * Cloudflare D1, or Neon.
 *
 * Examples:
 *   const machines = await db.machines.getAll();
 *   await db.machines.create({ name: 'Brother S-7200C', ... });
 *   await db.maintenance.create({ machineId, issue, ... });
 *   await db.stock.add({ partId, qty, supplierId });
 *   await db.stock.remove({ partId, qty, reason });
 */

import { storage } from './storage.js';
import { TABLE_NAMES } from './schema.js';
import { syncManager } from './syncManager.js';

function createEntityRepository(tableName) {
  return {
    tableName,
    async getAll() {
      const data = storage.getTable(tableName);
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') return Object.values(data);
      return [];
    },
    async getById(id) {
      const list = await this.getAll();
      return list.find(item => item && (item.id === id || item._id === id)) || null;
    },
    async create(data) {
      if (!data) throw new Error('Data payload required');
      const itemWithId = {
        id: data.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
      };
      if (typeof storage.addItem === 'function') {
        await storage.addItem(tableName, itemWithId);
      } else {
        const table = storage.getTable(tableName) || [];
        if (Array.isArray(table)) table.push(itemWithId);
        else table[itemWithId.id] = itemWithId;
        await storage.saveTable(tableName, true);
      }
      return itemWithId;
    },
    async update(id, updates) {
      if (!id) throw new Error('Record ID required for update');
      if (typeof storage.updateItem === 'function') {
        return await storage.updateItem(tableName, id, { ...updates, updatedAt: new Date().toISOString() });
      }
      const table = storage.getTable(tableName) || [];
      if (Array.isArray(table)) {
        const idx = table.findIndex(r => r && (r.id === id || r._id === id));
        if (idx !== -1) {
          table[idx] = { ...table[idx], ...updates, updatedAt: new Date().toISOString() };
          await storage.saveTable(tableName, true);
          return table[idx];
        }
      } else if (table && table[id]) {
        table[id] = { ...table[id], ...updates, updatedAt: new Date().toISOString() };
        await storage.saveTable(tableName, true);
        return table[id];
      }
      throw new Error(`Record ${id} not found in ${tableName}`);
    },
    async delete(id) {
      if (!id) throw new Error('Record ID required for delete');
      if (typeof storage.deleteItem === 'function') {
        return await storage.deleteItem(tableName, id);
      }
      const table = storage.getTable(tableName);
      if (Array.isArray(table)) {
        const filtered = table.filter(r => r && r.id !== id && r._id !== id);
        storage.data[tableName] = filtered;
        await storage.saveTable(tableName, true);
        return true;
      } else if (table && table[id]) {
        delete table[id];
        await storage.saveTable(tableName, true);
        return true;
      }
      return false;
    }
  };
}

export const db = {
  // Core schemas specified by the ERP design
  machines:           createEntityRepository(TABLE_NAMES.MACHINES || 'machines'),
  machineCategories:  createEntityRepository(TABLE_NAMES.CATEGORIES || 'machine_categories'),
  brands:             createEntityRepository(TABLE_NAMES.BRANDS || 'brands'),
  locations:          createEntityRepository(TABLE_NAMES.LINES || 'locations'),
  machineMovements:   createEntityRepository(TABLE_NAMES.TRANSFERS || 'machine_movements'),
  maintenance:        createEntityRepository(TABLE_NAMES.PREVENTIVE_MAINTENANCE || 'maintenance'),
  spareParts:         createEntityRepository(TABLE_NAMES.SPARE_PARTS || 'spare_parts'),
  stockTransactions:  createEntityRepository(TABLE_NAMES.STOCK_TRANSACTIONS || 'stock_transactions'),
  suppliers:          createEntityRepository(TABLE_NAMES.SUPPLIERS || 'suppliers'),
  users:              createEntityRepository(TABLE_NAMES.USERS || 'users'),
  auditLogs:          createEntityRepository(TABLE_NAMES.AUDIT_LOGS || 'audit_logs'),

  // Specialized helpers
  stock: {
    async getAll() {
      return db.spareParts.getAll();
    },
    async add({ partId, quantity, unitCost, supplierId, notes, createdBy }) {
      const qty = Number(quantity) || 0;
      const part = await db.spareParts.getById(partId);
      const currentQty = part ? (Number(part.quantity || part.stockQuantity) || 0) : 0;
      const newQty = currentQty + qty;

      if (part) {
        await db.spareParts.update(partId, {
          quantity: newQty,
          stockQuantity: newQty,
          lastPurchasePrice: unitCost !== undefined ? unitCost : part.lastPurchasePrice
        });
      }

      // Record transaction log
      const tx = await db.stockTransactions.create({
        partId,
        type: 'IN',
        quantity: qty,
        balanceAfter: newQty,
        unitCost: unitCost || 0,
        supplierId: supplierId || null,
        notes: notes || 'Stock received',
        createdBy: createdBy || 'system'
      });

      return { success: true, newQuantity: newQty, transaction: tx };
    },
    async remove({ partId, quantity, machineId, reason, createdBy }) {
      const qty = Number(quantity) || 0;
      const part = await db.spareParts.getById(partId);
      if (!part) throw new Error('Spare part not found');

      const currentQty = Number(part.quantity || part.stockQuantity) || 0;
      if (currentQty < qty) {
        throw new Error(`Insufficient stock: available ${currentQty}, requested ${qty}`);
      }
      const newQty = currentQty - qty;

      await db.spareParts.update(partId, {
        quantity: newQty,
        stockQuantity: newQty
      });

      // Record transaction log
      const tx = await db.stockTransactions.create({
        partId,
        type: 'OUT',
        quantity: qty,
        balanceAfter: newQty,
        machineId: machineId || null,
        reason: reason || 'Issued for maintenance',
        createdBy: createdBy || 'system'
      });

      return { success: true, newQuantity: newQty, transaction: tx };
    }
  },

  // Direct access to underlying Sync Manager & Storage
  sync: syncManager,
  storage: storage
};

// Also expose globally for browser console debugging if needed
if (typeof window !== 'undefined') {
  window.erpDb = db;
}
