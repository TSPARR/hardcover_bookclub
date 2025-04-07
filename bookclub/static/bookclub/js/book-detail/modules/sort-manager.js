// Debugging version of sort-manager.js
export const SortManager = {
    bookId: null,
    
    init(bookId) {
        this.bookId = bookId;
        
        // Defer setup to ensure DOM is fully loaded
        this._deferSetup();
        
        return this;
    },
    
    /**
     * Defer setup to ensure DOM elements are available
     */
    _deferSetup() {
        // Use mutation observer as a backup to catch dynamically loaded elements
        const observer = new MutationObserver((mutations, obs) => {
            const sortDropdown = document.getElementById('sortDropdown');
            if (sortDropdown) {
                this._setupSortDropdown(sortDropdown);
                obs.disconnect();
            }
        });
        
        // Start observing the entire document
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Fallback timeout in case mutation observer fails
        setTimeout(() => {
            const sortDropdown = document.getElementById('sortDropdown');
            if (sortDropdown) {
                this._setupSortDropdown(sortDropdown);
            } else {
                console.warn('[SortManager] Could not find sort dropdown element after timeout');
            }
        }, 2000);
    },
    
    /**
     * Set up the sort dropdown element
     * @param {HTMLElement} sortDropdown - The sort dropdown button
     */
    _setupSortDropdown(sortDropdown) {
        // Try to retrieve saved sort option from localStorage
        const savedSortOption = this._getSavedSortOption();
        const currentSortOption = this._getCurrentSortFromURL();
        
        
        // Add event listeners to dropdown items
        const dropdownItems = document.querySelectorAll('.dropdown-item[data-sort-option]');
        dropdownItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const sortOption = item.dataset.sortOption;
                
                // Save to localStorage
                this._saveSortOption(sortOption);
                
                // Trigger navigation
                window.location.href = item.getAttribute('href');
            });
        });
        
        // Only redirect if no current sort option is set
        if (!currentSortOption && savedSortOption) {
            
            // Find the corresponding dropdown item
            const savedItem = document.querySelector(`.dropdown-item[data-sort-option="${savedSortOption}"]`);
            if (savedItem) {
                
                // Construct URL with saved sort option
                const url = new URL(window.location.href);
                url.searchParams.set('sort', savedSortOption);
                url.searchParams.set('tab', 'discussion');
                
                // Reload the page with the new sort option
                window.location.href = url.toString();
            }
        }
    },
    
    /**
     * Get the display text for a sort option
     * @param {string} sortOption - The sort option
     * @returns {string} The display text
     */
    _getSortText(sortOption) {
        switch (sortOption) {
            case 'date_desc': return 'Newest First';
            case 'date_asc': return 'Oldest First';
            case 'progress_desc': return 'Most Progress First';
            case 'progress_asc': return 'Least Progress First';
            default: return 'Sort';
        }
    },
    
    /**
     * Save the current sort option to localStorage
     * @param {string} sortOption - The sort option to save
     */
    _saveSortOption(sortOption) {
        try {
            // Validate sort option to prevent storing invalid values
            const validOptions = ['date_desc', 'date_asc', 'progress_desc', 'progress_asc'];
            if (!validOptions.includes(sortOption)) {
                console.warn('[SortManager] Invalid sort option:', sortOption);
                return;
            }
            
            // Use book-specific key to prevent conflicts
            const storageKey = `book_sort_option_${this.bookId}`;
            localStorage.setItem(storageKey, sortOption);
        } catch (error) {
            console.error('[SortManager] Error saving sort option:', error);
        }
    },
    
    /**
     * Retrieve the saved sort option from localStorage
     * @returns {string|null} The saved sort option or null
     */
    _getSavedSortOption() {
        try {
            const storageKey = `book_sort_option_${this.bookId}`;
            const savedSortOption = localStorage.getItem(storageKey);
            return savedSortOption;
        } catch (error) {
            console.error('[SortManager] Error retrieving sort option:', error);
            return null;
        }
    },
    
    /**
     * Get the current sort option from the URL
     * @returns {string|null} The current sort option or null
     */
    _getCurrentSortFromURL() {
        const url = new URL(window.location.href);
        const sortParam = url.searchParams.get('sort');
        return sortParam;
    }
};