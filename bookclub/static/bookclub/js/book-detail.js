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

    let hardcoverModal;
    let progressModal;
    let selectedProgress = null;

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

                            // Update the hidden fields for comments
                            document.getElementById('comment_progress_type').value = progressType;
                            document.getElementById('comment_progress_value').value = progressValue;

                            // Add status badge if needed
                            const cardBody = document.querySelector('.card-body');
                            if (selectedProgress.finished_at && !cardBody.querySelector('.badge.bg-success')) {
                                // Remove in progress badge if it exists
                                const inProgressBadge = cardBody.querySelector('.badge.bg-primary');
                                if (inProgressBadge) inProgressBadge.remove();

                                // Add finished badge
                                const finishedBadge = document.createElement('div');
                                finishedBadge.className = 'badge bg-success w-100 p-2 mt-2';
                                finishedBadge.textContent = 'Finished';
                                cardBody.appendChild(finishedBadge);
                            } else if (selectedProgress.started_at && !cardBody.querySelector('.badge.bg-primary') && !cardBody.querySelector('.badge.bg-success')) {
                                // Add in progress badge
                                const inProgressBadge = document.createElement('div');
                                inProgressBadge.className = 'badge bg-primary w-100 p-2 mt-2';
                                inProgressBadge.textContent = 'In Progress';
                                cardBody.appendChild(inProgressBadge);
                            }

                            // Close the modal
                            hardcoverModal.hide();

                            // Refresh spoilers
                            checkSpoilers();
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