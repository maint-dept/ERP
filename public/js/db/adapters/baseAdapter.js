/**
 * Base Adapter for Database Providers
 * Al-Muslim Group Multi-Database Sync Architecture
 */
export class BaseAdapter {
  constructor(config) {
    this.config = config;
    this.id = config.id || 'default';
    this.name = config.name || 'Unknown Database';
    this.role = config.role || 'BACKUP';
    this.type = config.type || 'UNKNOWN';
    this.isPrimary = this.role === 'PRIMARY';
  }

  /**
   * Initialize or test the database connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    throw new Error('testConnection() must be implemented by the adapter');
  }

  /**
   * Save a single record/document
   * @param {string} collection - The table or collection name
   * @param {string} docId - The unique identifier
   * @param {Object} data - The data payload
   * @returns {Promise<{success: boolean, updateTime?: string, error?: string}>}
   */
  async saveRecord(collection, docId, data) {
    throw new Error('saveRecord() must be implemented by the adapter');
  }

  /**
   * Save/Batch write an entire table (used for chunked sync)
   * @param {string} collection - The table name
   * @param {Object} dataObj - The full dataset indexed by ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async saveTable(collection, dataObj) {
    throw new Error('saveTable() must be implemented by the adapter');
  }

  /**
   * Delete a record
   * @param {string} collection - The table name
   * @param {string} docId - The unique identifier
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteRecord(collection, docId) {
    throw new Error('deleteRecord() must be implemented by the adapter');
  }
}
