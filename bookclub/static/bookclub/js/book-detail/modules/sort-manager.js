// sort-manager.js - Module for handling book detail page sorting
import { Storage } from '../utils/storage.js';

/**
 * SortManager - Handles sorting functionality for book comments
 * and persists sort preferences in localStorage
 */
export const SortManager = {
    /**
     * Initialize the sort manager
     * @param {string} bookId - The current book ID
     * @returns {Object} - The SortManager instance
     */
    init(bookId) {
        if (!bookId) return this;
        
        this.bookId = bookId;
        this.storageKey = `book_${bookId}_sort`;
        
        // Set up event listeners for the sort dropdown
        this._setupSortDropdown();
        
        // Apply any sort preference from localStorage, but only if we're on the discussion tab
        this._applySavedSortPreference();
        
        return this;
    },
    
    /**
     * Set up event listeners for the sort dropdown
     */
    _setupSortDropdown() {
        // Find all sort options in dropdown
        const sortOptions = document.querySelectorAll('[data-sort-option]');
        
        // Add event listeners to each option
        sortOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Get the sort option from the data attribute
                const sortOption = option.getAttribute('data-sort-option');
                
                // Save the user's preference
                this._saveSortPreference(sortOption);
                
                // Create a clean URL with only the sort and tab parameters
                const currentUrl = new URL(window.location.origin + window.location.pathname);
                currentUrl.searchParams.set('sort', sortOption);
                currentUrl.searchParams.set('tab', 'discussion');
                
                // Update dropdown button text
                const sortDropdownButton = document.getElementById('sortDropdown');
                if (sortDropdownButton) {
                    sortDropdownButton.textContent = 'Sort by: ' + option.textContent;
                }
                
                // Navigate to the new URL without any fragment identifier
                window.location.href = currentUrl.toString();
            });
        });
    },
    
    /**
     * Save the user's sort preference to localStorage
     * @param {string} sortOption - The selected sort option
     */
    _saveSortPreference(sortOption) {
        Storage.save(this.storageKey, sortOption);
    },
    
    /**
     * Apply any saved sort preference, but only if already on discussion tab
     */
    _applySavedSortPreference() {
        // Check if we're already on the discussion tab
        const currentUrl = new URL(window.location.href);
        const currentTab = currentUrl.searchParams.get('tab');
        
        // Only apply saved sort if we're already on the discussion tab
        if (currentTab === 'discussion') {
            // Get the saved preference
            const savedSort = Storage.get(this.storageKey);
            const currentSort = currentUrl.searchParams.get('sort');
            
            // If URL doesn't have a sort parameter or it's different from saved preference
            if (savedSort && !currentSort) {
                // Apply the saved sort but keep the tab parameter
                currentUrl.searchParams.set('sort', savedSort);
                window.location.href = currentUrl.toString();
            }
        }
    }
};