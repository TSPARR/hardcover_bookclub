// book-detail.js - Save this in your static/js/ directory
document.addEventListener('DOMContentLoaded', function () {
    // Get page elements
    const syncButton = document.getElementById('syncHardcoverProgress');
    const updateProgressBtn = document.getElementById('updateProgressBtn');
    const saveProgressBtn = document.getElementById('saveProgressBtn');
    const applyButton = document.getElementById('applyProgressBtn');
    const modalBody = document.getElementById('hardcoverSyncModalBody');
    const showSpoilersToggle = document.getElementById('showSpoilersToggle');
    const spoilerBtns = document.querySelectorAll('.show-spoiler-btn');
    const autoSyncToggle = document.getElementById('autoSyncToggle');
    const lastSyncTime = document.getElementById('lastSyncTime');

    let hardcoverModal;
    let progressModal;
    let selectedProgress = null;
    const AUTO_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const STORAGE_PREFIX = 'bookclub_';
    const bookId = document.getElementById('book-id')?.value;
    
    // Initialize auto-sync feature if toggle exists
    if (autoSyncToggle) {
        const autoSyncKey = `${STORAGE_PREFIX}auto_sync_${bookId}`;
        const autoSyncEnabled = localStorage.getItem(autoSyncKey) === 'true';
        
        // Set initial state of toggle
        autoSyncToggle.checked = autoSyncEnabled;
        
        // Handle toggle change
        autoSyncToggle.addEventListener('change', function() {
            localStorage.setItem(autoSyncKey, this.checked);
            if (this.checked) {
                checkIfSyncNeeded();
            }
        });
        
        // Check if we should run auto-sync on page load
        if (autoSyncEnabled) {
            checkIfSyncNeeded();
        }
    }
    
    // Function to check if sync is needed based on last sync time
    function checkIfSyncNeeded() {
        if (!bookId) return;
        
        const lastSyncKey = `${STORAGE_PREFIX}last_sync_${bookId}`;
        const lastSync = localStorage.getItem(lastSyncKey);
        
        // Update the UI to show last sync time if available
        if (lastSyncTime && lastSync) {
            const syncDate = new Date(parseInt(lastSync));
            lastSyncTime.textContent = syncDate.toLocaleString();
        }
        
        // Check if we need to sync (first time or interval passed)
        if (!lastSync || (Date.now() - parseInt(lastSync) > AUTO_SYNC_INTERVAL)) {
            console.log('Auto-sync: Time to sync progress');
            fetchAndApplyProgress();
        } else {
            console.log('Auto-sync: Recent sync exists, skipping');
        }
    }
    
    // Function to fetch and automatically apply progress
    function fetchAndApplyProgress() {
        const hardcoverId = document.getElementById('hardcover-id')?.value;
        if (!hardcoverId || !bookId) return;
        
        console.log('Auto-sync: Fetching progress from Hardcover');
        
        // Fetch reading progress from Hardcover
        fetch(`/api/hardcover-progress/${hardcoverId}/`)
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
                applyProgressToBook(mostRecentProgress);
                
                // Update last sync time
                localStorage.setItem(`${STORAGE_PREFIX}last_sync_${bookId}`, Date.now().toString());
                if (lastSyncTime) {
                    lastSyncTime.textContent = new Date().toLocaleString();
                }
            })
            .catch(error => {
                console.error('Auto-sync error:', error);
            });
    }
    
    // Function to apply progress to the book
    function applyProgressToBook(progress) {
        if (!progress || !bookId) return;
        
        // Prepare the data
        let progressType, progressValue;
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

        // Set form values based on selected progress
        if (progress.reading_format === 'audio') {
            // For audiobooks
            progressType = 'audio';
            if (progress.current_position) {
                const hours = Math.floor(progress.current_position / 3600);
                const minutes = Math.floor((progress.current_position % 3600) / 60);
                progressValue = `${hours}h ${minutes}m`;
            } else {
                progressValue = progress.progress + '%';
            }
        } else {
            // For books
            if (progress.finished_at && progress.edition.pages) {
                // For finished books, use the total page count
                progressType = 'page';
                progressValue = progress.edition.pages;
            } else if (progress.current_page) {
                // For in-progress books with a page number
                progressType = 'page';
                progressValue = progress.current_page;
            } else {
                // Default to percentage
                progressType = 'percent';
                progressValue = progress.progress;
            }
        }

        // Create a simplified object with the Hardcover data for saving
        const hardcoverData = {
            started_at: progress.started_at,
            finished_at: progress.finished_at,
            progress: progress.progress,
            current_page: progress.current_page,
            current_position: progress.current_position,
            reading_format: progress.reading_format,
            edition_id: progress.edition.id,
            edition_pages: progress.edition.pages,
            edition_audio_seconds: progress.edition.audio_seconds,
            edition_title: progress.edition.title,
            edition_format: progress.reading_format_id
        };

        // Log what we're updating
        console.log('Auto-sync: Applying progress', {
            type: progressType,
            value: progressValue,
            normalized: progress.progress
        });

        // Update progress via API
        fetch(`/books/${bookId}/update-progress/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                progress_type: progressType,
                progress_value: progressValue,
                hardcover_data: hardcoverData,
                auto_sync: true // Flag to indicate this is an auto-sync
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Auto-sync: Progress updated successfully');
                    
                    // If the page needs to reload (new edition selected)
                    if (progress.edition && progress.edition.id && data.reload) {
                        window.location.reload();
                        return;
                    }
                    
                    // Update the UI without reloading
                    updateProgressUI(progressType, progressValue, data.progress, progress);
                } else {
                    console.error('Auto-sync: Error updating progress', data.error);
                }
            })
            .catch(error => {
                console.error('Auto-sync: Error updating progress', error);
            });
    }
    
    // Function to update the UI with new progress
    function updateProgressUI(progressType, progressValue, progressData, hardcoverProgress) {
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = progressData.normalized_progress + '%';
            progressBar.textContent = parseFloat(progressData.normalized_progress).toFixed(1) + '%';
            progressBar.setAttribute('aria-valuenow', progressData.normalized_progress);
        }

        // Update the progress text
        const progressText = document.querySelector('.card-body .d-flex div');
        if (progressText) {
            if (progressType === 'page') {
                progressText.textContent = 'Page ' + progressValue;
            } else if (progressType === 'audio') {
                progressText.textContent = 'Audio: ' + progressValue;
            } else {
                progressText.textContent = progressValue + '% complete';
            }
        }

        // Update the hidden fields for comments if they exist
        const commentProgressType = document.getElementById('comment_progress_type');
        const commentProgressValue = document.getElementById('comment_progress_value');
        if (commentProgressType && commentProgressValue) {
            commentProgressType.value = progressType;
            commentProgressValue.value = progressValue;
        }

        // Add status badge if needed
        const cardBody = document.querySelector('.progress-indicator .card-body');
        if (cardBody) {
            if (hardcoverProgress.finished_at && !cardBody.querySelector('.badge.bg-success')) {
                // Remove in progress badge if it exists
                const inProgressBadge = cardBody.querySelector('.badge.bg-primary');
                if (inProgressBadge) inProgressBadge.remove();

                // Add finished badge
                const finishedBadge = document.createElement('div');
                finishedBadge.className = 'badge bg-success w-100 p-2 mt-2';
                finishedBadge.textContent = 'Finished';
                cardBody.appendChild(finishedBadge);
            } else if (hardcoverProgress.started_at && !cardBody.querySelector('.badge.bg-primary') && !cardBody.querySelector('.badge.bg-success')) {
                // Add in progress badge
                const inProgressBadge = document.createElement('div');
                inProgressBadge.className = 'badge bg-primary w-100 p-2 mt-2';
                inProgressBadge.textContent = 'In Progress';
                cardBody.appendChild(inProgressBadge);
            }
        }

        // Refresh spoilers
        checkSpoilers();
    }

    // Progress update modal
    if (updateProgressBtn) {
        updateProgressBtn.addEventListener('click', function () {
            if (!progressModal) {
                progressModal = new bootstrap.Modal(document.getElementById('progressUpdateModal'));
            }
            progressModal.show();
        });
    }

    // Update help text based on progress type selection
    const progressTypeSelect = document.getElementById('progressType');
    if (progressTypeSelect) {
        progressTypeSelect.addEventListener('change', function () {
            const helpText = document.getElementById('progressHelp');
            const selectedType = this.value;

            if (selectedType === 'page') {
                helpText.textContent = 'Enter the page number you\'re currently on.';
            } else if (selectedType === 'audio') {
                helpText.textContent = 'Enter the timestamp (e.g., "2h 30m").';
            } else {
                helpText.textContent = 'Enter a percentage (e.g., "75").';
            }
        });
    }

    // Handle comment progress type selection
    const commentProgressType = document.getElementById('comment_progress_type');
    if (commentProgressType) {
        commentProgressType.addEventListener('change', function() {
            const helpText = document.getElementById('commentProgressHelp');
            const selectedType = this.value;

            if (selectedType === 'page') {
                helpText.textContent = 'Enter the page number you\'re commenting about.';
            } else if (selectedType === 'audio') {
                helpText.textContent = 'Enter the timestamp (e.g., "2h 30m").';
            } else {
                helpText.textContent = 'Enter a percentage (e.g., "75").';
            }
        });
    }

    // Save progress button
    if (saveProgressBtn) {
        saveProgressBtn.addEventListener('click', function () {
            const progressType = document.getElementById('progressType').value;
            const progressValue = document.getElementById('progressValue').value;
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            const bookId = document.getElementById('book-id').value;

            // Send update to server
            fetch(`/books/${bookId}/update-progress/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    progress_type: progressType,
                    progress_value: progressValue
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Update the progress display without page reload
                        document.querySelector('.progress-bar').style.width = data.progress.normalized_progress + '%';
                        document.querySelector('.progress-bar').textContent = parseFloat(data.progress.normalized_progress).toFixed(1) + '%';
                        document.querySelector('.progress-bar').setAttribute('aria-valuenow', data.progress.normalized_progress);

                        // Update the progress text
                        let progressText = '';
                        if (progressType === 'page') {
                            progressText = 'Page ' + progressValue;
                        } else if (progressType === 'audio') {
                            progressText = 'Audio: ' + progressValue;
                        } else {
                            progressText = progressValue + '% complete';
                        }
                        document.querySelector('.card-body .d-flex div').textContent = progressText;

                        // Update the hidden field for comments
                        document.getElementById('comment_progress_type').value = progressType;
                        document.getElementById('comment_progress_value').value = progressValue;

                        // Close the modal
                        progressModal.hide();

                        // Refresh spoilers
                        checkSpoilers();
                    } else {
                        alert('Error updating progress: ' + (data.error || 'Unknown error'));
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error updating progress. Please try again.');
                });
        });
    }

    // Spoiler functionality
    if (showSpoilersToggle) {
        // Toggle all spoilers based on checkbox
        showSpoilersToggle.addEventListener('change', function () {
            const spoilerComments = document.querySelectorAll('.spoiler-comment');

            spoilerComments.forEach(comment => {
                if (this.checked) {
                    comment.querySelector('.spoiler-warning').style.display = 'none';
                    comment.querySelector('.spoiler-content').style.display = 'block';
                } else {
                    comment.querySelector('.spoiler-warning').style.display = 'block';
                    comment.querySelector('.spoiler-content').style.display = 'none';
                }
            });
        });
    }

    // Individual spoiler buttons
    spoilerBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const spoilerWarning = this.closest('.spoiler-warning');
            const spoilerContent = spoilerWarning.nextElementSibling;

            spoilerWarning.style.display = 'none';
            spoilerContent.style.display = 'block';
        });
    });

    // Handle reaction clicks
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('reaction-btn') || 
            e.target.closest('.reaction-btn') ||
            e.target.classList.contains('reaction-option')) {
            
            const button = e.target.classList.contains('reaction-btn') ? 
                          e.target : 
                          (e.target.closest('.reaction-btn') || e.target);
            
            const commentId = button.dataset.commentId;
            const reaction = button.dataset.reaction;
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            fetch(`/comments/${commentId}/reaction/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    reaction: reaction
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update UI
                    updateReactionsUI(commentId, data);
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
        }
    });
    
    function updateReactionsUI(commentId, data) {
        const reactionsContainer = document.querySelector(`[data-comment-id="${commentId}"] .existing-reactions`);
        if (!reactionsContainer) return;
        
        // Clear existing reactions
        reactionsContainer.innerHTML = '';
        
        // Add updated reactions
        for (const [reaction, count] of Object.entries(data.counts)) {
            const button = document.createElement('button');
            button.className = 'btn btn-sm btn-outline-secondary reaction-btn me-1';
            if (data.action === 'added' && data.reaction === reaction) {
                button.classList.add('active');
            }
            button.dataset.commentId = commentId;
            button.dataset.reaction = reaction;
            button.innerHTML = `${reaction} <span class="reaction-count">${count}</span>`;
            reactionsContainer.appendChild(button);
        }
    }

    // Function to check and update spoilers
    function checkSpoilers() {
        const userProgress = parseFloat(document.querySelector('.progress-bar').getAttribute('aria-valuenow'));
        const username = document.getElementById('current-username').value;

        document.querySelectorAll('.comment-card').forEach(comment => {
            const commentProgress = parseFloat(comment.dataset.progress);
            const commentUser = comment.querySelector('.comment-user').textContent.trim();

            if (commentProgress > userProgress && commentUser !== username) {
                // This comment is ahead of user's progress
                comment.classList.add('spoiler-comment');

                // Make sure the comment has spoiler warning and hidden content
                if (!comment.querySelector('.spoiler-warning')) {
                    const cardBody = comment.querySelector('.card-body');
                    const commentText = cardBody.querySelector('.card-text');

                    // Create spoiler warning
                    const spoilerWarning = document.createElement('div');
                    spoilerWarning.className = 'spoiler-warning alert alert-warning';
                    spoilerWarning.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> This comment is from further in the book than you\'ve read. <button class="btn btn-sm btn-outline-secondary ms-2 show-spoiler-btn">Show Anyway</button>';

                    // Create spoiler content container
                    const spoilerContent = document.createElement('div');
                    spoilerContent.className = 'spoiler-content';
                    spoilerContent.style.display = 'none';

                    // Move the comment text into the spoiler content
                    spoilerContent.appendChild(commentText.cloneNode(true));
                    commentText.remove();
                    // Add the elements to the card
                    cardBody.appendChild(spoilerWarning);
                    cardBody.appendChild(spoilerContent);

                    // Add event listener to show button
                    spoilerWarning.querySelector('.show-spoiler-btn').addEventListener('click', function () {
                        spoilerWarning.style.display = 'none';
                        spoilerContent.style.display = 'block';
                    });
                }
            } else {
                // This comment is not ahead of user's progress
                comment.classList.remove('spoiler-comment');

                // If it had spoiler warning, remove it and show content
                const spoilerWarning = comment.querySelector('.spoiler-warning');
                const spoilerContent = comment.querySelector('.spoiler-content');

                if (spoilerWarning && spoilerContent) {
                    const cardBody = comment.querySelector('.card-body');
                    const commentText = spoilerContent.querySelector('.card-text');

                    // Move the comment text back into the card body
                    cardBody.appendChild(commentText);

                    // Remove spoiler elements
                    spoilerWarning.remove();
                    spoilerContent.remove();
                }
            }
        });
    }

    // Hardcover sync functionality
    if (syncButton) {
        syncButton.addEventListener('click', function (e) {
            e.preventDefault();

            // Initialize the modal if not already done
            if (!hardcoverModal) {
                hardcoverModal = new bootstrap.Modal(document.getElementById('hardcoverSyncModal'));
            }

            // Show the modal with loading state
            hardcoverModal.show();

            // Reset the apply button
            applyButton.disabled = true;
            modalBody.innerHTML = `
                <p>Fetching your reading progress from Hardcover...</p>
                <div class="d-flex justify-content-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;

            const bookId = document.getElementById('book-id').value;
            const hardcoverId = document.getElementById('hardcover-id').value;

            // Fetch reading progress from Hardcover
            fetch(`/api/hardcover-progress/${hardcoverId}/`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch progress data');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.error) {
                        modalBody.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                        return;
                    }

                    if (!data.progress || data.progress.length === 0) {
                        modalBody.innerHTML = `<div class="alert alert-info">No reading progress found for this book on Hardcover.</div>`;
                        return;
                    }

                    // Display the progress options
                    let html = '<p>Select progress to import:</p><div class="list-group">';

                    data.progress.forEach((item, index) => {
                        const status = item.finished_at ? 'Finished' : (item.started_at ? 'In Progress' : 'Not started');
                        const format = item.reading_format === 'audio' ? 'Audiobook' : 'Book';
                        const progress = item.progress || 0;

                        let details = '';
                        if (item.reading_format === 'audio' && item.current_position) {
                            const hours = Math.floor(item.current_position / 3600);
                            const minutes = Math.floor((item.current_position % 3600) / 60);
                            details = `${hours}h ${minutes}m`;

                            if (item.finished_at && item.edition.audio_seconds) {
                                const totalHours = Math.floor(item.edition.audio_seconds / 3600);
                                const totalMinutes = Math.floor((item.edition.audio_seconds % 3600) / 60);
                                details = `${totalHours}h ${totalMinutes}m (Complete)`;
                            }
                        } else if (item.current_page) {
                            details = `Page ${item.current_page}`;

                            if (item.finished_at && item.edition.pages) {
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
                    modalBody.innerHTML = html;

                    // Store the progress data for later use
                    window.hardcoverProgressData = data.progress;

                    // Add event listeners to the progress options
                    document.querySelectorAll('.list-group-item').forEach(item => {
                        item.addEventListener('click', function () {
                            document.querySelectorAll('.list-group-item').forEach(el => {
                                el.classList.remove('active');
                            });
                            this.classList.add('active');
                            selectedProgress = window.hardcoverProgressData[parseInt(this.dataset.index)];
                            applyButton.disabled = false;
                        });
                    });
                    
                    // Update last sync time in localStorage
                    localStorage.setItem(`${STORAGE_PREFIX}last_sync_${bookId}`, Date.now().toString());
                    if (lastSyncTime) {
                        lastSyncTime.textContent = new Date().toLocaleString();
                    }
                })
                .catch(error => {
                    modalBody.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
                });
        });
    }

    // Handle apply progress button for Hardcover sync
    if (applyButton) {
        applyButton.addEventListener('click', function () {
            if (!selectedProgress) return;

            // Prepare the data
            let progressType, progressValue;
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            const bookId = document.getElementById('book-id').value;

            // Set form values based on selected progress
            if (selectedProgress.reading_format === 'audio') {
                // For audiobooks
                progressType = 'audio';
                if (selectedProgress.current_position) {
                    const hours = Math.floor(selectedProgress.current_position / 3600);
                    const minutes = Math.floor((selectedProgress.current_position % 3600) / 60);
                    progressValue = `${hours}h ${minutes}m`;
                } else {
                    progressValue = selectedProgress.progress + '%';
                }
            } else {
                // For books
                if (selectedProgress.finished_at && selectedProgress.edition.pages) {
                    // For finished books, use the total page count
                    progressType = 'page';
                    progressValue = selectedProgress.edition.pages;
                } else if (selectedProgress.current_page) {
                    // For in-progress books with a page number
                    progressType = 'page';
                    progressValue = selectedProgress.current_page;
                } else {
                    // Default to percentage
                    progressType = 'percent';
                    progressValue = selectedProgress.progress;
                }
            }

            // Create a simplified object with the Hardcover data for saving
            const hardcoverData = {
                started_at: selectedProgress.started_at,
                finished_at: selectedProgress.finished_at,
                progress: selectedProgress.progress,
                current_page: selectedProgress.current_page,
                current_position: selectedProgress.current_position,
                reading_format: selectedProgress.reading_format,
                edition_id: selectedProgress.edition.id,
                edition_pages: selectedProgress.edition.pages,
                edition_audio_seconds: selectedProgress.edition.audio_seconds,
                edition_title: selectedProgress.edition.title,
                edition_format: selectedProgress.reading_format_id
            };

            // Update progress via API
            fetch(`/books/${bookId}/update-progress/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
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
                        // Refresh the page if edition info was updated
                        if (selectedProgress.edition && selectedProgress.edition.id) {
                            // Small delay to let the server process the edition update
                            setTimeout(() => {
                                window.location.reload();
                            }, 500);
                        } else {
                            // Update the UI without reloading
                            updateProgressUI(progressType, progressValue, data.progress, selectedProgress);
                            // Close the modal
                            hardcoverModal.hide();
                        }
                    } else {
                        alert('Error updating progress: ' + (data.error || 'Unknown error'));
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error updating progress. Please try again.');
                });
        });
    }
});