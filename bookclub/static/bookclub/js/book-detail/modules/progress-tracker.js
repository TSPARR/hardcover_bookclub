// progress-tracker.js - Handles user reading progress tracking and updates
import { Storage } from '../utils/storage.js';
import { DomHelpers } from '../utils/dom-helpers.js';

export const ProgressTracker = {
    bookId: null,
    progressModal: null,
    progressModalInstance: null,
    autoSyncToggle: null,
    lastSyncTimeEl: null,
    onProgressUpdated: null, // Callback for when progress is updated
    
    /**
     * Initialize the progress tracker
     * @param {string} bookId - Book ID
     * @returns {object} - ProgressTracker instance
     */
    init(bookId) {
        this.bookId = bookId;
        this.progressModal = document.getElementById('progressUpdateModal');
        this.autoSyncToggle = document.getElementById('autoSyncToggle');
        this.lastSyncTimeEl = document.getElementById('lastSyncTime');
        
        // Initialize Bootstrap modal if available
        if (this.progressModal) {
            this.progressModalInstance = new bootstrap.Modal(this.progressModal);
        }
        
        this._setupEventListeners();
        this._setupAutoSync();
        
        // Update last sync time display if available
        if (this.lastSyncTimeEl) {
            this.lastSyncTimeEl.textContent = Storage.getLastSyncTimeFormatted(bookId);
        }
        
        return this;
    },
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Update progress button
        const updateProgressBtn = document.getElementById('updateProgressBtn');
        if (updateProgressBtn) {
            updateProgressBtn.addEventListener('click', () => this._openProgressModal());
        }
        
        // Save progress button
        const saveProgressBtn = document.getElementById('saveProgressBtn');
        if (saveProgressBtn) {
            saveProgressBtn.addEventListener('click', () => this._saveProgress());
        }
        
        // Progress type change (to update help text)
        const progressType = document.getElementById('progressType');
        if (progressType) {
            progressType.addEventListener('change', () => this._updateProgressHelp());
        }
        
        // Comment progress type change
        const commentProgressType = document.getElementById('comment_progress_type');
        if (commentProgressType) {
            commentProgressType.addEventListener('change', () => this._updateCommentProgressHelp());
        }
        
        // Auto sync toggle
        if (this.autoSyncToggle) {
            this.autoSyncToggle.addEventListener('change', () => this._toggleAutoSync());
        }
        
        // Clear sync button
        const clearSyncButton = document.getElementById('clearSyncButton');
        if (clearSyncButton) {
            clearSyncButton.addEventListener('click', (e) => {
                e.preventDefault();
                this._clearSyncData();
            });
        }
    },
    
    /**
     * Set up auto sync feature
     */
    _setupAutoSync() {
        if (this.autoSyncToggle) {
            const autoSyncEnabled = Storage.get(`auto_sync_${this.bookId}`, false);
            this.autoSyncToggle.checked = autoSyncEnabled;
        }
    },
    
    /**
     * Toggle auto sync on/off
     */
    _toggleAutoSync() {
        const enabled = this.autoSyncToggle.checked;
        Storage.save(`auto_sync_${this.bookId}`, enabled);
        
        // If enabled, check if sync is needed immediately
        if (enabled && window.HardcoverSync) {
            setTimeout(() => {
                window.HardcoverSync._checkIfSyncNeeded();
            }, 500);
        }
    },
    
    /**
     * Clear sync data and reset
     */
    _clearSyncData() {
        Storage.remove(`last_sync_${this.bookId}`);
        
        if (this.lastSyncTimeEl) {
            this.lastSyncTimeEl.textContent = "Never";
        }
        
        // Show confirmation message
        const syncInfo = document.querySelector('.sync-info');
        if (syncInfo) {
            const message = document.createElement('div');
            message.className = 'mt-1 text-success';
            message.innerHTML = '<small>Sync cleared! ✓</small>';
            syncInfo.appendChild(message);
            
            // Remove the message after 3 seconds
            setTimeout(() => {
                message.remove();
            }, 3000);
        }
        
        // If auto-sync is enabled, trigger a sync immediately
        if (this.autoSyncToggle && this.autoSyncToggle.checked && window.HardcoverSync) {
            setTimeout(() => {
                window.HardcoverSync.fetchAndApplyProgress();
            }, 500);
        }
    },
    
    /**
     * Open progress update modal
     */
    _openProgressModal() {
        if (this.progressModalInstance) {
            this.progressModalInstance.show();
        }
    },
    
    /**
     * Update help text for progress type
     */
    _updateProgressHelp() {
        const progressType = document.getElementById('progressType');
        const helpText = document.getElementById('progressHelp');
        
        if (!progressType || !helpText) return;
        
        const selectedType = progressType.value;
        
        if (selectedType === 'page') {
            helpText.textContent = "Enter the page number you're currently on.";
        } else if (selectedType === 'audio') {
            helpText.textContent = 'Enter the timestamp (e.g., "2h 30m").';
        } else {
            helpText.textContent = 'Enter a percentage (e.g., "75").';
        }
    },
    
    /**
     * Update help text for comment progress type
     */
    _updateCommentProgressHelp() {
        const commentProgressType = document.getElementById('comment_progress_type');
        const helpText = document.getElementById('commentProgressHelp');
        
        if (!commentProgressType || !helpText) return;
        
        const selectedType = commentProgressType.value;
        
        if (selectedType === 'page') {
            helpText.textContent = "Enter the page number you're commenting about.";
        } else if (selectedType === 'audio') {
            helpText.textContent = 'Enter the timestamp (e.g., "2h 30m").';
        } else {
            helpText.textContent = 'Enter a percentage (e.g., "75").';
        }
    },
    
    /**
     * Save progress updates to the server
     */
    _saveProgress() {
        const progressType = document.getElementById('progressType').value;
        const progressValue = document.getElementById('progressValue').value;
        
        if (!progressType || !progressValue) {
            alert('Please enter a valid progress value.');
            return;
        }
        
        const data = {
            progress_type: progressType,
            progress_value: progressValue
        };
        
        console.log('Saving progress:', data); // Debug log
        
        // Send update to server
        fetch(`/books/${this.bookId}/update-progress/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': DomHelpers.getCsrfToken()
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Progress update successful:', data.progress); // Debug log
                
                // Force update the progress display with the new data
                this._updateProgressDisplay(data.progress);
                
                // Close the modal
                if (this.progressModalInstance) {
                    this.progressModalInstance.hide();
                }
                
                // Call progress update callback
                if (typeof this.onProgressUpdated === 'function') {
                    this.onProgressUpdated(data.progress);
                }
                
                // Update last sync time
                Storage.updateLastSyncTime(this.bookId);
                if (this.lastSyncTimeEl) {
                    this.lastSyncTimeEl.textContent = new Date().toLocaleString();
                }
            } else {
                alert('Error updating progress: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error updating progress. Please try again.');
        });
    },
    
    /**
     * Update progress UI after changes
     * @param {object} progressData - New progress data
     */
    _updateProgressDisplay(progressData) {
        if (!progressData) return;
        
        console.log('Updating progress display:', progressData); // Debug log
        
        // Update progress bar
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            // Make sure we're working with a number
            const normalizedProgress = parseFloat(progressData.normalized_progress);
            
            console.log('Setting progress bar to:', normalizedProgress); // Debug log
            
            // Directly set all properties
            progressBar.style.width = `${normalizedProgress}%`;
            progressBar.setAttribute('aria-valuenow', normalizedProgress);
            progressBar.textContent = `${normalizedProgress.toFixed(1)}%`;
        }
        
        // Update progress text
        const progressText = document.querySelector('.card-body .d-flex div');
        if (progressText) {
            let text = '';
            if (progressData.progress_type === 'page') {
                text = `Page ${progressData.progress_value}`;
            } else if (progressData.progress_type === 'audio') {
                text = `Audio: ${progressData.progress_value}`;
            } else {
                text = `${progressData.progress_value}% complete`;
            }
            progressText.textContent = text;
        }
        
        // Update comment form fields if they exist
        const commentProgressType = document.getElementById('comment_progress_type');
        const commentProgressValue = document.getElementById('comment_progress_value');
        
        if (commentProgressType && commentProgressValue) {
            commentProgressType.value = progressData.progress_type;
            commentProgressValue.value = progressData.progress_value;
        }
    },
    
    /**
     * Update progress UI from Hardcover sync data
     * @param {object} syncData - Hardcover sync data
     * @param {object} progressData - Local progress data
     */
    updateProgressFromSync(syncData, progressData) {
        // Update UI with new progress
        this._updateProgressDisplay(progressData);
        
        // Update status badges if applicable
        const cardBody = document.querySelector('.progress-indicator .card-body');
        if (cardBody) {
            // Handle finished badge
            if (syncData.finished_at && !cardBody.querySelector('.badge.bg-success')) {
                // Remove in progress badge if it exists
                const inProgressBadge = cardBody.querySelector('.badge.bg-primary');
                if (inProgressBadge) inProgressBadge.remove();
                
                // Add finished badge
                const finishedBadge = DomHelpers.createElement('div', {
                    className: 'badge bg-success w-100 p-2 mt-2'
                }, 'Finished');
                
                cardBody.appendChild(finishedBadge);
            } 
            // Handle in progress badge
            else if (syncData.started_at && 
                    !cardBody.querySelector('.badge.bg-primary') && 
                    !cardBody.querySelector('.badge.bg-success')) {
                
                // Add in progress badge
                const inProgressBadge = DomHelpers.createElement('div', {
                    className: 'badge bg-primary w-100 p-2 mt-2'
                }, 'In Progress');
                
                cardBody.appendChild(inProgressBadge);
            }
        }
        
        // Handle rating display if available
        if (syncData.rating) {
            this._updateRatingDisplay(syncData.rating);
        }
        
        // Update last sync time
        Storage.updateLastSyncTime(this.bookId);
        if (this.lastSyncTimeEl) {
            this.lastSyncTimeEl.textContent = new Date().toLocaleString();
        }
    },
    
    /**
     * Update star rating display
     * @param {number} rating - Rating value (0-5)
     */
    _updateRatingDisplay(rating) {
        const ratingDisplay = document.querySelector('.book-rating');
        if (!ratingDisplay || !rating) return;
        
        const ratingValue = parseFloat(rating);
        if (isNaN(ratingValue)) return;
        
        // Generate star HTML
        let starsHTML = '';
        
        // Full stars
        const fullStars = Math.floor(ratingValue);
        for (let i = 0; i < fullStars; i++) {
            starsHTML += '<i class="bi bi-star-fill text-warning"></i>';
        }
        
        // Half star if needed
        if (ratingValue % 1 >= 0.5) {
            starsHTML += '<i class="bi bi-star-half text-warning"></i>';
        }
        
        // Empty stars
        const emptyStars = 5 - Math.ceil(ratingValue);
        for (let i = 0; i < emptyStars; i++) {
            starsHTML += '<i class="bi bi-star text-warning"></i>';
        }
        
        starsHTML += `<span class="rating-value ms-1 text-muted">${ratingValue}</span>`;
        
        // Update the rating display
        ratingDisplay.innerHTML = starsHTML;
        ratingDisplay.title = `${ratingValue} / 5`;
        ratingDisplay.classList.remove('text-muted');
    },
    
    /**
     * Check if auto sync is enabled
     * @returns {boolean} - Auto sync status
     */
    isAutoSyncEnabled() {
        return Storage.get(`auto_sync_${this.bookId}`, false);
    }
};