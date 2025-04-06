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
        
        // Apply any sort preference from localStorage
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
                
                // Navigate to the URL without reloading the page if possible
                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('sort', sortOption);
                
                // Update dropdown button text
                const sortDropdownButton = document.getElementById('sortDropdown');
                if (sortDropdownButton) {
                    sortDropdownButton.textContent = 'Sort by: ' + option.textContent;
                }
                
                // Navigate to the new URL
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
     * Apply any saved sort preference
     */
    _applySavedSortPreference() {
        // Get the saved preference
        const savedSort = Storage.get(this.storageKey);
        
        // Check if we're not already using the saved sort
        if (savedSort) {
            const currentUrl = new URL(window.location.href);
            const currentSort = currentUrl.searchParams.get('sort');
            
            // If URL doesn't have a sort parameter or it's different from saved preference
            if (!currentSort && savedSort) {
                // Update the URL with the saved preference
                currentUrl.searchParams.set('sort', savedSort);
                window.location.href = currentUrl.toString();
            }
        }
    }
};