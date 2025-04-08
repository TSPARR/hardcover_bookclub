// Debugging version of sort-manager.js
export const SortManager = {
    bookId: null,
    
    init(bookId) {
        this.bookId = bookId;
        
        // Setup dropdown event listeners for saving sort options
        this._setupDropdownListeners();
        
        // Set up event listener for tab changes
        this._setupTabListener();
        
        return this;
    },
    
    /**
     * Set up event listeners for dropdown items
     */
    _setupDropdownListeners() {
        const dropdownItems = document.querySelectorAll('.dropdown-item[data-sort-option]');
        dropdownItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const sortOption = item.dataset.sortOption;
                this._saveSortOption(sortOption);
            });
        });
    },
    
    /**
     * Set up listener for tab changes
     */
    _setupTabListener() {
        // Listen for Bootstrap tab change events
        document.addEventListener('shown.bs.tab', (event) => {
            
            // Check if discussion tab was selected
            if (event.target.id === 'discussion-tab') {
                this._handleDiscussionTabActivation();
            }
        });
        
        // Fallback for direct URL navigation
        this._checkInitialTabState();
    },
    
    /**
     * Check initial tab state on page load
     */
    _checkInitialTabState() {
        const url = new URL(window.location.href);
        const tabParam = url.searchParams.get('tab');
        const discussionTab = document.getElementById('discussion-tab');
                
        if ((tabParam === 'discussion') || 
            (discussionTab && discussionTab.classList.contains('active'))) {
            this._handleDiscussionTabActivation();
        }
    },
    
    /**
     * Handle activation of discussion tab
     */
    _handleDiscussionTabActivation() {
        const savedSortOption = this._getSavedSortOption();
        const currentSortOption = this._getCurrentSortFromURL();
        
        // Only redirect if no current sort option is set and we have a saved option
        if (!currentSortOption && savedSortOption) {
            console.log('[SortManager] Redirecting to saved sort:', savedSortOption);
            
            // Construct URL with saved sort option
            const url = new URL(window.location.href);
            url.searchParams.set('sort', savedSortOption);
            url.searchParams.set('tab', 'discussion');
            
            // Reload the page with the new sort option
            window.location.href = url.toString();
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