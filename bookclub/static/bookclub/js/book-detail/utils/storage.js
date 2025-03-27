// storage.js - Storage utility functions

const STORAGE_PREFIX = 'bookclub_';

export const Storage = {
    /**
     * Save a value to localStorage with prefix
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     */
    save(key, value) {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    },
    
    /**
     * Get a value from localStorage with prefix
     * @param {string} key - Storage key
     * @param {any} defaultValue - Default value if key doesn't exist
     * @returns {any} - Retrieved value or default
     */
    get(key, defaultValue = null) {
        const value = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (value === null) return defaultValue;
        
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    },
    
    /**
     * Remove a value from localStorage
     * @param {string} key - Storage key to remove
     */
    remove(key) {
        localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    },
    
    /**
     * Check if a sync should happen based on last sync time
     * @param {string} bookId - Book ID
     * @param {number} interval - Sync interval in milliseconds
     * @returns {boolean} - True if sync is needed
     */
    isSyncNeeded(bookId, interval) {
        const lastSync = this.get(`last_sync_${bookId}`);
        if (!lastSync) return true;
        
        return (Date.now() - parseInt(lastSync)) > interval;
    },
    
    /**
     * Update the last sync time for a book
     * @param {string} bookId - Book ID
     */
    updateLastSyncTime(bookId) {
        this.save(`last_sync_${bookId}`, Date.now().toString());
    },
    
    /**
     * Get a formatted last sync time
     * @param {string} bookId - Book ID
     * @returns {string} - Formatted date or "Never"
     */
    getLastSyncTimeFormatted(bookId) {
        const lastSync = this.get(`last_sync_${bookId}`);
        if (!lastSync) return "Never";
        
        return new Date(parseInt(lastSync)).toLocaleString();
    }
};