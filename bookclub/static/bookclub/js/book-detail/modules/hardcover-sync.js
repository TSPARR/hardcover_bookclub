// hardcover-sync.js - Handles syncing with Hardcover API
import { Storage } from '../utils/storage.js';
import { DomHelpers } from '../utils/dom-helpers.js';

export const HardcoverSync = {
    bookId: null,
    hardcoverId: null,
    progressTracker: null,
    hardcoverModal: null,
    modalBody: null,
    applyButton: null,
    selectedProgress: null,
    onProgressSynced: null, // Callback for when progress is synced
    AUTO_SYNC_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    
    /**
     * Initialize the Hardcover sync module
     * @param {string} bookId - Book ID
     * @param {string} hardcoverId - Hardcover ID
     * @param {object} progressTracker - Progress tracker instance
     * @returns {object} - HardcoverSync instance
     */
    init(bookId, hardcoverId, progressTracker) {
        this.bookId = bookId;
        this.hardcoverId = hardcoverId;
        this.progressTracker = progressTracker;
        
        this.modalBody = document.getElementById('hardcoverSyncModalBody');
        this.applyButton = document.getElementById('applyProgressBtn');
        
        // Initialize modal if available
        const modalElement = document.getElementById('hardcoverSyncModal');
        if (modalElement) {
            this.hardcoverModal = new bootstrap.Modal(modalElement);
        }
        
        this._setupEventListeners();
        
        // Check if we need to auto-sync on page load
        if (progressTracker && progressTracker.isAutoSyncEnabled()) {
            this._checkIfSyncNeeded();
        }
        
        return this;
    },
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Sync button
        const syncButton = document.getElementById('syncHardcoverProgress');
        if (syncButton) {
            syncButton.addEventListener('click', (e) => {
                e.preventDefault();
                this._openSyncModal();
            });
        }
        
        // Apply button
        if (this.applyButton) {
            this.applyButton.addEventListener('click', () => this._applySelectedProgress());
        }
    },
    
    /**
     * Check if sync is needed based on last sync time
     */
    _checkIfSyncNeeded() {
        if (Storage.isSyncNeeded(this.bookId, this.AUTO_SYNC_INTERVAL)) {
            console.log('Auto-sync: Time to sync progress');
            this.fetchAndApplyProgress();
        } else {
            console.log('Auto-sync: Recent sync exists, skipping');
        }
    },
    
    /**
     * Open Hardcover sync modal and load progress
     */
    _openSyncModal() {
        if (!this.hardcoverModal || !this.modalBody) return;
        
        // Reset state
        this.selectedProgress = null;
        this.applyButton.disabled = true;
        
        // Show loading state
        this.modalBody.innerHTML = `
            <p>Fetching your reading progress from Hardcover...</p>
            <div class="d-flex justify-content-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
        
        // Show the modal
        this.hardcoverModal.show();
        
        // Fetch progress data
        this._fetchProgressData();
    },
    
    /**
     * Fetch progress data from Hardcover API
     */
    _fetchProgressData() {
        if (!this.hardcoverId) {
            this._showModalError('No Hardcover ID available.');
            return;
        }
        
        fetch(`/api/hardcover-progress/${this.hardcoverId}/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch progress data');
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    this._showModalError(data.error);
                    return;
                }
                
                if (!data.progress || data.progress.length === 0) {
                    this._showModalInfo('No reading progress found for this book on Hardcover.');
                    return;
                }
                
                // Display the progress options
                this._displayProgressOptions(data.progress);
                
                // Update last sync time
                Storage.updateLastSyncTime(this.bookId);
                const lastSyncTimeEl = document.getElementById('lastSyncTime');
                if (lastSyncTimeEl) {
                    lastSyncTimeEl.textContent = new Date().toLocaleString();
                }
            })
            .catch(error => {
                this._showModalError(error.message);
            });
    },
    
    /**
     * Display progress options in the modal
     * @param {Array} progressData - Progress data from Hardcover
     */
    _displayProgressOptions(progressData) {
        if (!this.modalBody) return;
        
        let html = '<p>Select progress to import:</p><div class="list-group">';
        
        progressData.forEach((item, index) => {
            const status = item.finished_at ? 'Finished' : (item.started_at ? 'In Progress' : 'Not started');
            const format = item.reading_format === 'audio' ? 'Audiobook' : 'Book';
            const progress = item.progress || 0;
            
            let details = '';
            if (item.reading_format === 'audio' && item.current_position) {
                const hours = Math.floor(item.current_position / 3600);
                const minutes = Math.floor((item.current_position % 3600) / 60);
                details = `${hours}h ${minutes}m`;
                
                if (item.finished_at && item.edition && item.edition.audio_seconds) {
                    const totalHours = Math.floor(item.edition.audio_seconds / 3600);
                    const totalMinutes = Math.floor((item.edition.audio_seconds % 3600) / 60);
                    details = `${totalHours}h ${totalMinutes}m (Complete)`;
                }
            } else if (item.current_page) {
                details = `Page ${item.current_page}`;
                
                if (item.finished_at && item.edition && item.edition.pages) {
                    details = `Page ${item.edition.pages} (Complete)`;
                }
            }
            
            html += `
                <button type="button" class="list-group-item list-group-item-action" data-index="${index}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${format}</strong>
                            ${details ? `<small class="d-block text-muted">${details}</small>` : ''}
                        </div>
                        <span class="badge ${item.finished_at ? 'bg-success' : 'bg-primary'}">${status}</span>
                    </div>
                    <div class="progress mt-2" style="height: 20px;">
                        <div class="progress-bar" role="progressbar" style="width: ${progress}%;" 
                             aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
                            ${progress}%
                        </div>
                    </div>
                </button>
            `;
        });
        
        html += '</div>';
        this.modalBody.innerHTML = html;
        
        // Store the progress data for later use
        window.hardcoverProgressData = progressData;
        
        // Add event listeners to the progress options
        document.querySelectorAll('.list-group-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.list-group-item').forEach(el => {
                    el.classList.remove('active');
                });
                item.classList.add('active');
                this.selectedProgress = window.hardcoverProgressData[parseInt(item.dataset.index)];
                this.applyButton.disabled = false;
            });
        });
    },
    
    /**
     * Show error message in modal
     * @param {string} message - Error message
     */
    _showModalError(message) {
        if (this.modalBody) {
            this.modalBody.innerHTML = `<div class="alert alert-danger">${message}</div>`;
        }
    },
    
    /**
     * Show info message in modal
     * @param {string} message - Info message
     */
    _showModalInfo(message) {
        if (this.modalBody) {
            this.modalBody.innerHTML = `<div class="alert alert-info">${message}</div>`;
        }
    },
    
    /**
     * Apply selected progress to book
     */
    _applySelectedProgress() {
        if (!this.selectedProgress || !this.bookId) return;
        
        // Prepare the data
        let progressType, progressValue;
        
        // Set form values based on selected progress
        if (this.selectedProgress.reading_format === 'audio') {
            // For audiobooks
            progressType = 'audio';
            if (this.selectedProgress.current_position) {
                const hours = Math.floor(this.selectedProgress.current_position / 3600);
                const minutes = Math.floor((this.selectedProgress.current_position % 3600) / 60);
                progressValue = `${hours}h ${minutes}m`;
            } else {
                progressValue = Math.min(this.selectedProgress.progress || 0, 100) + '%';
            }
        } else {
            // For books
            if (this.selectedProgress.finished_at && this.selectedProgress.edition && this.selectedProgress.edition.pages) {
                // For finished books, use the total page count
                progressType = 'page';
                progressValue = this.selectedProgress.edition.pages;
            } else if (this.selectedProgress.current_page) {
                // For in-progress books with a page number
                progressType = 'page';
                progressValue = this.selectedProgress.current_page;
            } else {
                // Default to percentage
                progressType = 'percent';
                progressValue = Math.min(this.selectedProgress.progress || 0, 100);
            }
        }
        
        // Create a simplified object with the Hardcover data for saving
        const hardcoverData = {
            started_at: this.selectedProgress.started_at,
            finished_at: this.selectedProgress.finished_at,
            progress: Math.min(this.selectedProgress.progress || 0, 100),
            current_page: this.selectedProgress.current_page,
            current_position: this.selectedProgress.current_position,
            reading_format: this.selectedProgress.reading_format,
            edition_id: this.selectedProgress.edition?.id,
            edition_pages: this.selectedProgress.edition?.pages,
            edition_audio_seconds: this.selectedProgress.edition?.audio_seconds,
            edition_title: this.selectedProgress.edition?.title,
            edition_format: this.selectedProgress.reading_format_id,
            rating: this.selectedProgress.rating,
            user_book_id: this.selectedProgress.read_id
        };
        
        // Update progress via API
        fetch(`/books/${this.bookId}/update-progress/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': DomHelpers.getCsrfToken()
            },
            body: JSON.stringify({
                progress_type: progressType,
                progress_value: progressValue,
                hardcover_data: hardcoverData
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // If edition info was updated and requires a reload
                if (this.selectedProgress.edition && this.selectedProgress.edition.id && data.reload) {
                    // Small delay to let the server process the edition update
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                } else {
                    // Update the UI without reloading
                    if (this.onProgressSynced) {
                        this.onProgressSynced(this.selectedProgress, data.progress);
                    }
                    
                    // Call updateProgressFromSync directly if callback not set up
                    if (!this.onProgressSynced && this.progressTracker) {
                        this.progressTracker.updateProgressFromSync(this.selectedProgress, data.progress);
                    }
                    
                    // Close the modal
                    if (this.hardcoverModal) {
                        this.hardcoverModal.hide();
                    }
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
     * Fetch and automatically apply progress (for auto-sync)
     */
    fetchAndApplyProgress() {
        if (!this.hardcoverId || !this.bookId) return;
        
        console.log('Auto-sync: Fetching progress from Hardcover');
        
        // Fetch reading progress from Hardcover
        fetch(`/api/hardcover-progress/${this.hardcoverId}/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch progress data');
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error('Auto-sync error:', data.error);
                    return;
                }

                if (!data.progress || data.progress.length === 0) {
                    console.log('Auto-sync: No progress found');
                    return;
                }

                // Auto-select the most recent progress
                let mostRecentProgress = data.progress[0];
                
                // If multiple progress entries exist, find the one with highest progress
                if (data.progress.length > 1) {
                    // Sort by progress percentage (highest first)
                    data.progress.sort((a, b) => (b.progress || 0) - (a.progress || 0));
                    mostRecentProgress = data.progress[0];
                }

                // Apply the progress automatically
                this.selectedProgress = mostRecentProgress;
                this._applySelectedProgress();
                
                // Update last sync time
                Storage.updateLastSyncTime(this.bookId);
                const lastSyncTimeEl = document.getElementById('lastSyncTime');
                if (lastSyncTimeEl) {
                    lastSyncTimeEl.textContent = new Date().toLocaleString();
                }
            })
            .catch(error => {
                console.error('Auto-sync error:', error);
            });
    }
};