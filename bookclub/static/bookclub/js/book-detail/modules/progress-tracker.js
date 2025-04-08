// progress-tracker.js - Handles user reading progress tracking and updates
import { Storage } from '../utils/storage.js';
import { DomHelpers } from '../utils/dom-helpers.js';
import { ProgressValidator } from './progress-validator.js';

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
        this._setupProgressValidation();
        
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
            progressType.addEventListener('change', () => {
                this._updateProgressHelp();
                // Re-validate when type changes
                const progressValue = document.getElementById('progressValue');
                if (progressValue && progressValue.value.trim() !== '') {
                    const event = new Event('input', { bubbles: true });
                    progressValue.dispatchEvent(event);
                }
            });
        }
        
        // Comment progress type change
        const commentProgressType = document.getElementById('comment_progress_type');
        if (commentProgressType) {
            commentProgressType.addEventListener('change', () => {
                this._updateCommentProgressHelp();
                // Re-validate when type changes
                const commentProgressValue = document.getElementById('comment_progress_value');
                if (commentProgressValue && commentProgressValue.value.trim() !== '') {
                    const event = new Event('input', { bubbles: true });
                    commentProgressValue.dispatchEvent(event);
                }
            });
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
        
        // Dispatch an event for other modules to listen for
        const toggleEvent = new CustomEvent('autoSyncToggled', {
            detail: { enabled: enabled, bookId: this.bookId }
        });
        document.dispatchEvent(toggleEvent);
        
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
            helpText.textContent = 'Enter the timestamp (e.g., "2h 30m" or "1:30:00").';
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
            helpText.textContent = 'Enter the timestamp (e.g., "2h 30m" or "1:30:00").';
        } else {
            helpText.textContent = 'Enter a percentage (e.g., "75").';
        }
    },

   /**
     * Update status badges based on progress data
     * @param {object} progressData - Progress data from server
     */
    _updateStatusBadges(progressData) {
        // Validate input
        if (!progressData) {
            console.warn('No progress data provided to update status badges');
            return;
        }

        // Add or update the "Finished" badge if we're at 100%
        const normalizedProgress = parseFloat(progressData.normalized_progress);
        
        // Find any existing status badges
        const progressContainer = document.querySelector('.progress-indicator .card-body') || 
                                document.querySelector('.progress').closest('.card-body') || 
                                document.querySelector('.progress').closest('.accordion-body');
        
        if (!progressContainer) {
            console.warn('Could not find progress container for status badge');
            return;
        }
        
        // Remove any existing badges first
        const existingBadge = progressContainer.querySelector('.badge.bg-success, .badge.bg-primary');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        if (normalizedProgress >= 100) {
            // Create finished badge
            const finishedBadge = document.createElement('div');
            finishedBadge.className = 'badge bg-success w-100 p-2 mt-2';
            finishedBadge.textContent = 'Finished';
            progressContainer.appendChild(finishedBadge);
        } else if (normalizedProgress > 0) {
            // Create in progress badge
            const progressBadge = document.createElement('div');
            progressBadge.className = 'badge bg-primary w-100 p-2 mt-2';
            progressBadge.textContent = 'In Progress';
            progressContainer.appendChild(progressBadge);
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
        
        // Get book metadata for validation
        const bookData = {
            book: {
                pages: parseInt(document.querySelector('meta[name="book-pages"]')?.content),
                audio_seconds: parseInt(document.querySelector('meta[name="book-audio-seconds"]')?.content)
            },
            edition: {
                pages: parseInt(document.querySelector('meta[name="edition-pages"]')?.content),
                audio_seconds: parseInt(document.querySelector('meta[name="edition-audio-seconds"]')?.content)
            }
        };
        
        // Validate progress value
        const validation = ProgressValidator.validate(progressType, progressValue, bookData);
        if (!validation.isValid) {
            alert(validation.message);
            return;
        }
        
        // Format the validated value
        const formattedValue = ProgressValidator.formatProgressValue(progressType, validation.value);
        
        // Check if auto-sync is enabled
        const autoSyncEnabled = this.autoSyncToggle && this.autoSyncToggle.checked;
        
        const data = {
            progress_type: progressType,
            progress_value: formattedValue,
            clear_hardcover_data: !autoSyncEnabled // Clear Hardcover data if auto-sync is off
        };
        
        // If it's audio progress and we have seconds, include them for the server
        if (progressType === 'audio' && validation.seconds) {
            data.hardcover_data = {
                current_position: validation.seconds
            };
        }
        
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
                // Force update the progress display with the new data
                this._updateProgressDisplay(data.progress);
                
                // Update status badges if appropriate
                this._updateStatusBadges(data.progress);
                
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
        
        // Get current username from the meta tag
        const currentUsername = document.querySelector('meta[name="current-username"]')?.content;

        // Update the current user's progress bar in book details accordion
        const progressBar = document.querySelector('#bookDetailsAccordion .progress-bar');
        if (progressBar) {
            // Make sure we're working with a number
            const normalizedProgress = parseFloat(progressData.normalized_progress);
            
            // Directly set all properties
            progressBar.style.width = `${normalizedProgress}%`;
            progressBar.setAttribute('aria-valuenow', normalizedProgress);
            
            // Update the data-progress attribute on the parent progress container
            const progressContainer = progressBar.closest('.progress');
            if (progressContainer) {
                progressContainer.setAttribute('data-progress', normalizedProgress.toFixed(2));
            }
        }
        
        // Also update the current user's progress in the group members table if it exists
        if (currentUsername) {
            // Find the progress bar in the group members table that belongs to the current user
            const groupMembersTable = document.querySelector('.group-members-progress-card table');
            if (groupMembersTable) {
                // Each row in the table corresponds to a group member
                const rows = groupMembersTable.querySelectorAll('tbody tr');
                
                // Loop through each row to find the current user
                rows.forEach(row => {
                    const usernameCell = row.querySelector('td:first-child');
                    const username = usernameCell?.textContent.trim();
                    
                    // If we found the current user's row
                    if (username === currentUsername) {
                        const normalizedProgress = parseFloat(progressData.normalized_progress);
                        
                        // Get the progress bar in this row
                        const memberProgressBar = row.querySelector('.progress-bar');
                        const memberProgressContainer = row.querySelector('.progress');
                        
                        if (memberProgressBar && memberProgressContainer) {
                            // Update the width of the progress bar
                            memberProgressBar.style.width = `${normalizedProgress}%`;
                            
                            // Update the data-progress attribute
                            memberProgressContainer.setAttribute('data-progress', normalizedProgress.toFixed(2));
                            
                            // If the progress is 0, make sure we're using the secondary style
                            if (normalizedProgress === 0) {
                                memberProgressBar.classList.add('bg-secondary');
                            } else {
                                memberProgressBar.classList.remove('bg-secondary');
                            }
                            
                            // Update the status badge
                            const statusBadge = row.querySelector('.badge');
                            if (statusBadge) {
                                // Remove existing classes
                                statusBadge.classList.remove('bg-secondary', 'bg-primary', 'bg-success');
                                
                                // Set appropriate class and text based on progress
                                if (normalizedProgress >= 100) {
                                    statusBadge.classList.add('bg-success');
                                    statusBadge.textContent = 'Finished';
                                } else if (normalizedProgress > 0) {
                                    statusBadge.classList.add('bg-primary');
                                    statusBadge.textContent = 'In Progress';
                                } else {
                                    statusBadge.classList.add('bg-secondary');
                                    statusBadge.textContent = 'Not Started';
                                }
                            }
                        }
                    }
                });
            }
        }
        
        // Update progress text outside the bar
        const progressText = document.querySelector('.accordion-body .d-flex div') || 
                            document.querySelector('.card-body .d-flex div');
                            
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
        // If progressData is undefined, create a basic object
        if (!progressData) {
            progressData = {
                normalized_progress: syncData.progress || 0,
                progress_type: syncData.reading_format || 'percent',
                progress_value: syncData.progress || '0'
            };
        }

        // Ensure normalized_progress exists
        if (progressData.normalized_progress === undefined) {
            progressData.normalized_progress = progressData.progress || 
                                            syncData.progress || 
                                            0;
        }

        // Update UI with new progress
        this._updateProgressDisplay(progressData);
        
        // Update status badges
        this._updateStatusBadges(progressData);
        
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
            
            // Also update RatingManager if available
            if (window.RatingManager) {
                // Update the interactive stars display
                if (window.RatingManager.interactiveStarsContainer) {
                    window.RatingManager.interactiveStarsContainer.dataset.localRating = "0"; // Clear local rating
                }
                
                // Update display with hardcover rating
                window.RatingManager._updateRatingDisplay(syncData.rating, true);
                
                // Show sync notification
                const syncLabel = document.querySelector('.hardcover-sync-label');
                if (syncLabel) {
                    syncLabel.innerHTML = '<i class="bi bi-link"></i> Synced from Hardcover';
                    syncLabel.classList.remove('d-none');
                }
            }
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
    },
    
    /**
     * Set up live validation for progress fields
     */
    _setupProgressValidation() {
        const progressTypeInput = document.getElementById('progressType');
        const progressValueInput = document.getElementById('progressValue');
        const progressHelp = document.getElementById('progressHelp');
        
        if (!progressTypeInput || !progressValueInput) return;
        
        // Get book metadata for validation
        const bookData = {
            book: {
                pages: parseInt(document.querySelector('meta[name="book-pages"]')?.content),
                audio_seconds: parseInt(document.querySelector('meta[name="book-audio-seconds"]')?.content)
            },
            edition: {
                pages: parseInt(document.querySelector('meta[name="edition-pages"]')?.content),
                audio_seconds: parseInt(document.querySelector('meta[name="edition-audio-seconds"]')?.content)
            }
        };
        
        // Add input event listener to validate on typing
        progressValueInput.addEventListener('input', () => {
            const type = progressTypeInput.value;
            const value = progressValueInput.value;
            
            if (value.trim() === '') return; // Skip validation for empty values
            
            const validation = ProgressValidator.validate(type, value, bookData);
            
            if (!validation.isValid) {
                progressValueInput.classList.add('is-invalid');
                
                // Create or update validation feedback
                let feedback = progressValueInput.nextElementSibling;
                if (!feedback || !feedback.classList.contains('invalid-feedback')) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    progressValueInput.parentNode.insertBefore(feedback, progressValueInput.nextSibling);
                }
                
                feedback.textContent = validation.message;
            } else {
                progressValueInput.classList.remove('is-invalid');
                progressValueInput.classList.add('is-valid');
                
                // Remove validation feedback if it exists
                const feedback = progressValueInput.nextElementSibling;
                if (feedback && feedback.classList.contains('invalid-feedback')) {
                    feedback.remove();
                }
            }
        });
        
        // Also set up validation for the comment form if it exists
        this._setupCommentFormValidation(bookData);
    },
    
    /**
     * Set up validation for the comment form
     */
    _setupCommentFormValidation(bookData) {
        const commentForm = document.querySelector('form[action*="book_detail"]');
        if (!commentForm) return;
        
        const progressTypeInput = document.getElementById('comment_progress_type');
        const progressValueInput = document.getElementById('comment_progress_value');
        
        if (!progressTypeInput || !progressValueInput) return;
        
        // Add submit event listener to validate before submission
        commentForm.addEventListener('submit', (e) => {
            const type = progressTypeInput.value;
            const value = progressValueInput.value;
            
            const validation = ProgressValidator.validate(type, value, bookData);
            
            if (!validation.isValid) {
                e.preventDefault();
                
                // Show error message
                progressValueInput.classList.add('is-invalid');
                
                // Create or update validation feedback
                let feedback = progressValueInput.nextElementSibling;
                if (!feedback || !feedback.classList.contains('invalid-feedback')) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    progressValueInput.parentNode.insertBefore(feedback, progressValueInput.nextSibling);
                }
                
                feedback.textContent = validation.message;
                
                // Scroll to the error
                progressValueInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // Format the value before submission
                progressValueInput.value = ProgressValidator.formatProgressValue(type, validation.value);
                
                // If it's audio progress and we have seconds, include them in a hidden field
                if (type === 'audio' && validation.seconds) {
                    let hardcoverDataInput = document.getElementById('hardcover_data');
                    
                    if (!hardcoverDataInput) {
                        hardcoverDataInput = document.createElement('input');
                        hardcoverDataInput.type = 'hidden';
                        hardcoverDataInput.id = 'hardcover_data';
                        hardcoverDataInput.name = 'hardcover_data';
                        commentForm.appendChild(hardcoverDataInput);
                    }
                    
                    const hardcoverData = {
                        current_position: validation.seconds
                    };
                    
                    hardcoverDataInput.value = JSON.stringify(hardcoverData);
                }
            }
        });
        
        // Add input validation for the comment form
        progressValueInput.addEventListener('input', () => {
            const type = progressTypeInput.value;
            const value = progressValueInput.value;
            
            if (value.trim() === '') return; // Skip validation for empty values
            
            const validation = ProgressValidator.validate(type, value, bookData);
            
            if (!validation.isValid) {
                progressValueInput.classList.add('is-invalid');
                progressValueInput.classList.remove('is-valid');
                
                // Create or update validation feedback
                let feedback = progressValueInput.nextElementSibling;
                if (!feedback || !feedback.classList.contains('invalid-feedback')) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    progressValueInput.parentNode.insertBefore(feedback, progressValueInput.nextSibling);
                }
                
                feedback.textContent = validation.message;
            } else {
                progressValueInput.classList.remove('is-invalid');
                progressValueInput.classList.add('is-valid');
                
                // Remove validation feedback if it exists
                const feedback = progressValueInput.nextElementSibling;
                if (feedback && feedback.classList.contains('invalid-feedback')) {
                    feedback.remove();
                }
            }
        });
    }
};