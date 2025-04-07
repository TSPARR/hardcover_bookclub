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
        
        // Listen for tab changes
        this._setupTabListeners();
        
        // Check URL and activate appropriate tab
        this._activateTabFromUrl();
        
        return this;
    },
    
    /**
     * Set up event listeners for Bootstrap tabs
     */
    _setupTabListeners() {
        // Listen for Bootstrap tab events
        const tabLinks = document.querySelectorAll('.nav-tabs .nav-link');
        tabLinks.forEach(tab => {
            tab.addEventListener('shown.bs.tab', (event) => {
                const tabId = event.target.id.replace('-tab', '');
                const url = new URL(window.location.href);
                
                // Update tab parameter
                url.searchParams.set('tab', tabId);
                
                // For discussion tab, apply saved sort if there's no current sort
                if (tabId === 'discussion') {
                    const savedSort = Storage.get(this.storageKey);
                    if (savedSort && !url.searchParams.get('sort')) {
                        url.searchParams.set('sort', savedSort);
                        // Reload to apply the sort from server side
                        window.location.href = url.toString();
                        return;
                    }
                } else {
                    // For other tabs, remove sort parameter
                    url.searchParams.delete('sort');
                }
                
                // Update URL without reload
                window.history.pushState({}, '', url.toString());
            });
        });
    },
    
    /**
     * Check the URL for tab parameter and activate the appropriate tab
     */
    _activateTabFromUrl() {
        const url = new URL(window.location.href);
        const tabParam = url.searchParams.get('tab');
        
        if (tabParam) {
            const tabEl = document.getElementById(`${tabParam}-tab`);
            if (tabEl) {
                const tab = new bootstrap.Tab(tabEl);
                tab.show();
            }
        }
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
                
                // Create a URL with the sort and tab parameters
                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('sort', sortOption);
                currentUrl.searchParams.set('tab', 'discussion');
                
                // Update dropdown button text immediately for better UX
                const sortDropdownButton = document.getElementById('sortDropdown');
                if (sortDropdownButton) {
                    const optionText = option.textContent.trim();
                    sortDropdownButton.textContent = 'Sort by: ' + optionText;
                }
                
                // Navigate to the new URL to apply the sort
                window.location.href = currentUrl.toString();
            });
        });
        
        // Apply saved sort when on the discussion tab
        this._applyCurrentSort();
    },
    
    /**
     * Save the user's sort preference to localStorage
     * @param {string} sortOption - The selected sort option
     */
    _saveSortPreference(sortOption) {
        Storage.save(this.storageKey, sortOption);
    },
    
    /**
     * Apply the current sort based on URL parameter or saved preference
     */
    _applyCurrentSort() {
        const url = new URL(window.location.href);
        const tabParam = url.searchParams.get('tab');
        
        // Only apply on discussion tab
        if (tabParam !== 'discussion') {
            return;
        }
        
        // Get current sort from URL or saved preference
        let currentSort = url.searchParams.get('sort');
        if (!currentSort) {
            currentSort = Storage.get(this.storageKey);
            
            // If we have a saved sort but it's not in the URL, add it and reload
            if (currentSort) {
                url.searchParams.set('sort', currentSort);
                window.location.href = url.toString();
                return;
            }
        }
        
        // Update dropdown text to match current sort
        if (currentSort) {
            const sortDropdownButton = document.getElementById('sortDropdown');
            if (sortDropdownButton) {
                const sortOption = document.querySelector(`[data-sort-option="${currentSort}"]`);
                if (sortOption) {
                    const optionText = sortOption.textContent.trim();
                    sortDropdownButton.textContent = 'Sort by: ' + optionText;
                }
            }
            
            // Mark the active sort option in the dropdown
            const sortOptions = document.querySelectorAll('[data-sort-option]');
            sortOptions.forEach(option => {
                if (option.getAttribute('data-sort-option') === currentSort) {
                    option.classList.add('active');
                } else {
                    option.classList.remove('active');
                }
            });
        }
    }
};