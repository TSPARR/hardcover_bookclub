// rating-manager.js - Handles book rating functionality
import { DomHelpers } from '../utils/dom-helpers.js';
import { Storage } from '../utils/storage.js';

export const RatingManager = {
    bookId: null,
    ratingStars: null,
    clearRatingBtn: null,
    interactiveStarsContainer: null,
    onRatingUpdated: null, // Callback for when rating is updated
    warningMessage: null,
    
    /**
     * Initialize the rating manager
     * @param {string} bookId - Book ID
     * @returns {object} - RatingManager instance
     */
    init(bookId) {
        this.bookId = bookId;
        this.ratingStars = document.querySelectorAll('.rating-star');
        this.clearRatingBtn = document.getElementById('clearRating');
        this.interactiveStarsContainer = document.getElementById('ratingStars');
        
        // Only proceed with initialization if rating controls exist
        if (this.interactiveStarsContainer) {
            this._setupEventListeners();
            
            // Initialize stars based on current local rating
            this._updateStarsDisplay();
            
            // Check auto-sync status and update warning if needed
            this._checkAutoSyncStatus();
        }
        
        return this;
    },
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Handle star hover
        if (this.ratingStars) {
            this.ratingStars.forEach(star => {
                star.addEventListener('mouseenter', () => {
                    const rating = parseInt(star.dataset.rating);
                    this._highlightStars(rating);
                });
            });
        }
        
        // Handle mouse leave from rating area
        if (this.interactiveStarsContainer) {
            this.interactiveStarsContainer.addEventListener('mouseleave', () => {
                this._updateStarsDisplay();
            });
            
            // Handle star click
            this.interactiveStarsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('rating-star')) {
                    const rating = parseInt(e.target.dataset.rating);
                    this._saveRating(rating);
                }
            });
        }
        
        // Handle clear rating
        if (this.clearRatingBtn) {
            this.clearRatingBtn.addEventListener('click', () => {
                this._saveRating(null);
            });
        }
        
        // Listen for auto-sync toggle changes from progress tracker
        document.addEventListener('autoSyncToggled', (e) => {
            this._checkAutoSyncStatus();
        });
    },
    
    /**
     * Check auto-sync status and update warning message
     */
    _checkAutoSyncStatus() {
        const autoSyncEnabled = Storage.get(`auto_sync_${this.bookId}`, false);
        const hardcoverReadId = document.querySelector('.rating-controls')?.dataset.hardcoverReadId;
        
        // Find or create warning message element
        const container = document.querySelector('.rating-controls');
        if (!container) return;
        
        // Remove any existing warning
        const existingWarning = container.querySelector('.auto-sync-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
        
        // Only show warning if auto-sync is enabled and there's a Hardcover read ID
        if (autoSyncEnabled && hardcoverReadId) {
            const warning = document.createElement('small');
            warning.className = 'text-muted d-block mt-2 auto-sync-warning';
            warning.innerHTML = '<i class="bi bi-info-circle"></i> Auto-sync is enabled. Your local rating will be overwritten by Hardcover sync.';
            container.appendChild(warning);
            
            // Store reference to the warning
            this.warningMessage = warning;
            
            // Set cookie for server-side checks
            document.cookie = `auto_sync_${this.bookId}=true; path=/; max-age=31536000`;
        } else {
            // Clear cookie
            document.cookie = `auto_sync_${this.bookId}=false; path=/; max-age=31536000`;
        }
    },
    
    /**
     * Highlight stars up to the given rating
     * @param {number} rating - Rating to highlight
     */
    _highlightStars(rating) {
        if (!this.ratingStars) return;
        
        this.ratingStars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            if (starRating <= rating) {
                star.classList.remove('bi-star');
                star.classList.add('bi-star-fill');
            } else {
                star.classList.remove('bi-star-fill', 'bi-star-half');
                star.classList.add('bi-star');
            }
        });
    },
    
    /**
     * Update stars based on current saved rating
     */
    _updateStarsDisplay() {
        if (!this.ratingStars || !this.interactiveStarsContainer) return;
        
        // Check if we have a local rating stored in a data attribute
        const currentRating = this.interactiveStarsContainer.dataset.localRating ? 
                             parseFloat(this.interactiveStarsContainer.dataset.localRating) : 0;
        
        if (currentRating > 0) {
            this.ratingStars.forEach(star => {
                const starRating = parseInt(star.dataset.rating);
                if (starRating <= Math.floor(currentRating)) {
                    star.classList.remove('bi-star', 'bi-star-half');
                    star.classList.add('bi-star-fill');
                } else if (starRating === Math.ceil(currentRating) && 
                          currentRating % 1 >= 0.5) {
                    // Handle half star
                    star.classList.remove('bi-star', 'bi-star-fill');
                    star.classList.add('bi-star-half');
                } else {
                    star.classList.remove('bi-star-fill', 'bi-star-half');
                    star.classList.add('bi-star');
                }
            });
        } else {
            this.ratingStars.forEach(star => {
                star.classList.remove('bi-star-fill', 'bi-star-half');
                star.classList.add('bi-star');
            });
        }
    },
    
    /**
     * Save rating to server
     * @param {number|null} rating - Rating value or null to clear
     */
    _saveRating(rating) {
        if (!this.bookId) return;
        
        fetch(`/books/${this.bookId}/update-rating/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': DomHelpers.getCsrfToken()
            },
            body: JSON.stringify({ 
                rating: rating
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update the displayed rating
                this._updateRatingDisplay(data.effective_rating, false);
                
                // Store local rating for the interactive stars
                if (this.interactiveStarsContainer) {
                    this.interactiveStarsContainer.dataset.localRating = data.rating || "0";
                    
                    // Update the stars display
                    this._updateStarsDisplay();
                }
                
                // Call rating update callback if defined
                if (this.onRatingUpdated) {
                    this.onRatingUpdated(data);
                }
            } else {
                console.error('Error saving rating:', data.error);
                alert(`Error saving rating: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error saving rating. Please try again.');
        });
    },
    
    /**
     * Update the rating display with the new rating
     * @param {number|null} rating - New rating value
     * @param {boolean} isHardcoverRating - Whether it's from Hardcover
     */
    _updateRatingDisplay(rating, isHardcoverRating) {
        const ratingDisplay = document.querySelector('.rating-display');
        if (!ratingDisplay) return;
        
        if (rating) {
            // Generate star HTML
            let starsHTML = '';
            
            // Full stars
            const fullStars = Math.floor(rating);
            for (let i = 0; i < fullStars; i++) {
                starsHTML += '<i class="bi bi-star-fill text-warning"></i>';
            }
            
            // Half star if needed
            if (rating % 1 >= 0.5) {
                starsHTML += '<i class="bi bi-star-half text-warning"></i>';
            }
            
            // Empty stars
            const emptyStars = 5 - Math.ceil(rating);
            for (let i = 0; i < emptyStars; i++) {
                starsHTML += '<i class="bi bi-star text-warning"></i>';
            }
            
            starsHTML += `<span class="rating-value ms-1 text-muted">${rating}</span>`;
            
            // Update the rating display
            ratingDisplay.innerHTML = starsHTML;
            ratingDisplay.title = `${rating} / 5`;
            ratingDisplay.classList.remove('text-muted');
        } else {
            // No rating
            ratingDisplay.innerHTML = '<small>No rating</small>';
            ratingDisplay.title = '';
            ratingDisplay.classList.add('text-muted');
        }
    }
};