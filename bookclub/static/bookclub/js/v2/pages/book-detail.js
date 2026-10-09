function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const targetContent = document.querySelector(`[data-tab-content="${targetTab}"]`);
            if (targetContent) {
                targetContent.classList.add('active');
            }

            const url = new URL(window.location);
            url.searchParams.set('tab', targetTab);
            window.history.pushState({}, '', url);
        });
    });

    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
        const targetButton = document.querySelector(`[data-tab="${tabParam}"]`);
        if (targetButton) {
            targetButton.click();
        }
    }
}

function initModals() {
    const modals = document.querySelectorAll('.modal-overlay');

    modals.forEach(modal => {
        const closeButtons = modal.querySelectorAll('.modal-close, .modal-cancel');

        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.remove('active');
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modals.forEach(modal => {
                if (modal.classList.contains('active')) {
                    modal.classList.remove('active');
                }
            });
        }
    });

    const progressUpdateBtn = document.getElementById('updateProgressBtn');
    const progressModal = document.getElementById('progressUpdateModal');
    if (progressUpdateBtn && progressModal) {
        progressUpdateBtn.addEventListener('click', () => {
            progressModal.classList.add('active');
        });
    }

    const syncHardcoverBtn = document.getElementById('syncHardcoverProgress');
    const hardcoverModal = document.getElementById('hardcoverSyncModal');
    if (syncHardcoverBtn && hardcoverModal) {
        syncHardcoverBtn.addEventListener('click', () => {
            hardcoverModal.classList.add('active');
        });
    }
}

function initDropdowns() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.dropdown-trigger');

        if (trigger) {
            e.preventDefault();
            e.stopPropagation();

            const dropdown = trigger.closest('.comment-actions-dropdown, .sort-dropdown');
            if (!dropdown) return;

            const menu = dropdown.querySelector('.dropdown-menu, .sort-menu');
            if (!menu) return;

            const isActive = menu.classList.contains('active');

            document.querySelectorAll('.dropdown-menu, .sort-menu').forEach(m => {
                m.classList.remove('active');
            });

            if (!isActive) {
                menu.classList.add('active');
            }
        } else {
            document.querySelectorAll('.dropdown-menu, .sort-menu').forEach(menu => {
                menu.classList.remove('active');
            });
        }
    });

    document.querySelectorAll('.dropdown-item, .sort-option').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu, .sort-menu').forEach(menu => {
                menu.classList.remove('active');
            });
        });
    });
}

function initSpoilerButtons() {
    document.querySelectorAll('.show-spoiler-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const warning = button.closest('.spoiler-warning');
            const content = warning.nextElementSibling;

            if (warning && content && content.classList.contains('spoiler-content')) {
                warning.style.display = 'none';
                content.style.display = 'block';
            }
        });
    });
}

function initReactionPanels() {
    document.querySelectorAll('.add-reaction-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = button.nextElementSibling;

            if (panel && panel.classList.contains('reaction-panel')) {
                const isVisible = panel.style.display === 'flex';

                document.querySelectorAll('.reaction-panel').forEach(p => {
                    p.style.display = 'none';
                });

                if (!isVisible) {
                    panel.style.display = 'flex';
                }
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.add-reaction')) {
            document.querySelectorAll('.reaction-panel').forEach(panel => {
                panel.style.display = 'none';
            });
        }
    });
}

function initProgressTypeHelp() {
    const progressType = document.getElementById('comment_progress_type') || document.getElementById('progressType');
    const progressHelp = document.getElementById('commentProgressHelp') || document.getElementById('progressHelp');

    if (progressType && progressHelp) {
        progressType.addEventListener('change', () => {
            const type = progressType.value;

            if (type === 'page') {
                progressHelp.textContent = 'Enter the page number you\'re commenting about.';
            } else if (type === 'audio') {
                progressHelp.textContent = 'Enter the timestamp (e.g., "2h 30m").';
            } else {
                progressHelp.textContent = 'Enter a percentage (e.g., "75").';
            }
        });
    }
}

function initDetailsAnimations() {
    document.querySelectorAll('details').forEach(details => {
        const summary = details.querySelector('summary');
        if (summary) {
            summary.addEventListener('click', (e) => {
                if (details.hasAttribute('open')) {
                    e.preventDefault();
                    details.style.overflow = 'hidden';

                    const content = Array.from(details.children).find(child => child !== summary);
                    if (content) {
                        const height = content.scrollHeight;
                        content.style.height = height + 'px';

                        requestAnimationFrame(() => {
                            content.style.transition = 'height 0.3s ease';
                            content.style.height = '0';

                            setTimeout(() => {
                                details.removeAttribute('open');
                                content.style.height = '';
                                content.style.transition = '';
                                details.style.overflow = '';
                            }, 300);
                        });
                    }
                }
            });
        }
    });
}

function initSpoilerToggle() {
    const spoilerToggle = document.getElementById('showSpoilersToggle');
    if (!spoilerToggle) return;

    spoilerToggle.addEventListener('change', () => {
        const spoilerComments = document.querySelectorAll('.spoiler-comment');

        if (spoilerToggle.checked) {
            spoilerComments.forEach(comment => {
                const warning = comment.querySelector('.spoiler-warning');
                const content = comment.querySelector('.spoiler-content');
                if (warning) warning.style.display = 'none';
                if (content) content.style.display = 'block';
            });
        } else {
            spoilerComments.forEach(comment => {
                const warning = comment.querySelector('.spoiler-warning');
                const content = comment.querySelector('.spoiler-content');
                if (warning) warning.style.display = 'flex';
                if (content) content.style.display = 'none';
            });
        }
    });
}

function initDeleteCommentModal() {
    const deleteModal = document.getElementById('deleteCommentModal');
    if (!deleteModal) return;

    const deleteConfirmBtn = document.getElementById('deleteCommentConfirm');
    const deleteCommentForm = document.getElementById('deleteCommentForm');
    const deleteButtons = document.querySelectorAll('.delete-comment-btn');

    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();

            const commentUser = button.getAttribute('data-comment-user');
            const commentDate = button.getAttribute('data-comment-date');
            const commentProgress = button.getAttribute('data-comment-progress');
            const commentText = button.getAttribute('data-comment-text');
            const deleteUrl = button.getAttribute('data-delete-url');

            document.getElementById('deleteModalCommentUser').textContent = commentUser;
            document.getElementById('deleteModalCommentDate').textContent = commentDate;
            document.getElementById('deleteModalCommentProgress').innerHTML = `<i class="bi bi-book"></i> ${commentProgress}`;
            document.getElementById('deleteModalCommentText').textContent = commentText;

            if (deleteCommentForm) {
                deleteCommentForm.action = deleteUrl;
            }

            deleteModal.classList.add('active');
            document.querySelectorAll('.dropdown-menu, .sort-menu').forEach(menu => {
                menu.classList.remove('active');
            });
        });
    });

    if (deleteConfirmBtn && deleteCommentForm) {
        deleteConfirmBtn.addEventListener('click', () => {
            deleteConfirmBtn.disabled = true;
            deleteConfirmBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Deleting...';
            deleteCommentForm.submit();
        });
    }
}

function getCsrfToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
}

const Storage = {
    save(key, value) {
        localStorage.setItem(`bookclub_${key}`, JSON.stringify(value));
    },

    get(key, defaultValue = null) {
        const value = localStorage.getItem(`bookclub_${key}`);
        if (value === null) return defaultValue;
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    },

    remove(key) {
        localStorage.removeItem(`bookclub_${key}`);
    },

    updateLastSyncTime(bookId) {
        this.save(`last_sync_${bookId}`, Date.now().toString());
    },

    getLastSyncTimeFormatted(bookId) {
        const lastSync = this.get(`last_sync_${bookId}`);
        if (!lastSync) return "Never";
        return new Date(parseInt(lastSync)).toLocaleString();
    }
};

const ProgressValidator = {
    validate(type, value, bookData = {}) {
        if (!value || value.trim() === '') {
            return { isValid: false, message: 'Progress value is required' };
        }

        switch (type) {
            case 'percent':
                return this.validatePercentage(value);
            case 'page':
                return this.validatePageNumber(value, bookData);
            case 'audio':
                return this.validateAudioTimestamp(value, bookData);
            default:
                return { isValid: false, message: 'Unknown progress type' };
        }
    },

    validatePercentage(value) {
        value = value.replace('%', '').trim();

        if (!/^\d+$/.test(value)) {
            return { isValid: false, message: 'Percentage must be a whole number' };
        }

        const percent = parseInt(value);
        if (percent < 0 || percent > 100) {
            return { isValid: false, message: 'Percentage must be between 0 and 100' };
        }

        return { isValid: true, value: percent };
    },

    validatePageNumber(value, bookData = {}) {
        if (!/^\d+$/.test(value.trim())) {
            return { isValid: false, message: 'Page number must be a whole number' };
        }

        const page = parseInt(value);
        if (page < 1) {
            return { isValid: false, message: 'Page number must be at least 1' };
        }

        const maxPages = this._getMaxPages(bookData);
        if (maxPages && page > maxPages) {
            return { isValid: false, message: `Page number cannot exceed ${maxPages}` };
        }

        return { isValid: true, value: page };
    },

    validateAudioTimestamp(value, bookData = {}) {
        const colonFormat = /^(\d+):([0-5]?\d):([0-5]?\d)$/;
        const colonMatch = value.match(colonFormat);

        if (colonMatch) {
            const hours = parseInt(colonMatch[1]);
            const minutes = parseInt(colonMatch[2]);
            const seconds = parseInt(colonMatch[3]);
            const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;

            const maxSeconds = this._getMaxAudioSeconds(bookData);
            if (maxSeconds && totalSeconds > maxSeconds) {
                const maxHours = Math.floor(maxSeconds / 3600);
                const maxMinutes = Math.floor((maxSeconds % 3600) / 60);
                const maxSecondsRem = maxSeconds % 60;

                return {
                    isValid: false,
                    message: `Timestamp cannot exceed ${maxHours}:${maxMinutes.toString().padStart(2, '0')}:${maxSecondsRem.toString().padStart(2, '0')}`
                };
            }

            return { isValid: true, value: value, seconds: totalSeconds };
        }

        const timeFormat = /^(?:(\d+)h\s*)?(?:(\d+)m)?$/;
        const timeMatch = value.match(timeFormat);

        if (timeMatch && (timeMatch[1] || timeMatch[2])) {
            const hours = parseInt(timeMatch[1] || 0);
            const minutes = parseInt(timeMatch[2] || 0);

            if (minutes >= 60) {
                return { isValid: false, message: 'Minutes must be less than 60' };
            }

            const totalSeconds = (hours * 3600) + (minutes * 60);
            const maxSeconds = this._getMaxAudioSeconds(bookData);

            if (maxSeconds && totalSeconds > maxSeconds) {
                const maxHours = Math.floor(maxSeconds / 3600);
                const maxMinutes = Math.floor((maxSeconds % 3600) / 60);

                return {
                    isValid: false,
                    message: `Timestamp cannot exceed ${maxHours}h ${maxMinutes}m`
                };
            }

            return { isValid: true, value: `${hours}h ${minutes}m`, seconds: totalSeconds };
        }

        return {
            isValid: false,
            message: 'Audio timestamp must be in format "HH:MM:SS" or "Xh Ym"'
        };
    },

    _getMaxPages(bookData = {}) {
        if (bookData.edition && bookData.edition.pages) {
            return bookData.edition.pages;
        }

        const kavitaPages = parseInt(document.querySelector('meta[name="kavita-edition-pages"]')?.content);
        if (kavitaPages) return kavitaPages;

        const bookPages = parseInt(document.querySelector('meta[name="book-pages"]')?.content);
        if (bookPages) return bookPages;

        return null;
    },

    _getMaxAudioSeconds(bookData = {}) {
        if (bookData.edition && bookData.edition.audio_seconds) {
            return bookData.edition.audio_seconds;
        }

        const plexAudioSeconds = parseInt(document.querySelector('meta[name="plex-edition-audio-seconds"]')?.content);
        if (plexAudioSeconds) return plexAudioSeconds;

        const bookAudioSeconds = parseInt(document.querySelector('meta[name="book-audio-seconds"]')?.content);
        if (bookAudioSeconds) return bookAudioSeconds;

        return null;
    }
};

function initCommentForm() {
    const commentForm = document.getElementById('commentForm');
    if (!commentForm) return;

    const submitButton = commentForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    const commentProgressType = document.getElementById('comment_progress_type');
    const commentProgressValue = document.getElementById('comment_progress_value');

    let validationMessageEl = null;

    function showCommentValidationError(message) {
        removeCommentValidationError();
        validationMessageEl = document.createElement('div');
        validationMessageEl.className = 'alert alert-danger';
        validationMessageEl.style.marginTop = '10px';
        validationMessageEl.textContent = message;
        commentProgressValue.parentNode.appendChild(validationMessageEl);
        commentProgressValue.classList.add('is-invalid');
    }

    function removeCommentValidationError() {
        if (validationMessageEl) {
            validationMessageEl.remove();
            validationMessageEl = null;
        }
        commentProgressValue?.classList.remove('is-invalid');
    }

    if (commentProgressValue) {
        commentProgressValue.addEventListener('input', removeCommentValidationError);
    }

    if (commentProgressType) {
        commentProgressType.addEventListener('change', removeCommentValidationError);
    }

    commentForm.addEventListener('submit', (e) => {
        if (submitButton.disabled) {
            e.preventDefault();
            return;
        }

        removeCommentValidationError();

        if (commentProgressType && commentProgressValue && commentProgressValue.value.trim()) {
            const validation = ProgressValidator.validate(
                commentProgressType.value,
                commentProgressValue.value,
                {}
            );

            if (!validation.isValid) {
                e.preventDefault();
                showCommentValidationError(validation.message);
                return;
            }
        }

        submitButton.disabled = true;
        submitButton.classList.add('submitting');
        submitButton.innerHTML = '<span class="btn-spinner"></span><span>Posting...</span>';
        commentForm.classList.add('form-submitting');
    });

    window.addEventListener('pageshow', (event) => {
        if (event.persisted || performance.navigation.type === 2) {
            submitButton.disabled = false;
            submitButton.classList.remove('submitting');
            submitButton.innerHTML = originalButtonText;
            commentForm.classList.remove('form-submitting');
            removeCommentValidationError();
        }
    });
}

function initProgressTracking() {
    const bookId = document.getElementById('book-id')?.value;
    const saveProgressBtn = document.getElementById('saveProgressBtn');
    const progressModal = document.getElementById('progressUpdateModal');
    const progressValueInput = document.getElementById('progressValue');
    const progressTypeSelect = document.getElementById('progressType');

    if (!bookId || !saveProgressBtn) return;

    let validationMessageEl = null;

    function showValidationError(message) {
        removeValidationError();
        validationMessageEl = document.createElement('div');
        validationMessageEl.className = 'alert alert-danger';
        validationMessageEl.style.marginTop = '10px';
        validationMessageEl.textContent = message;
        progressValueInput.parentNode.appendChild(validationMessageEl);
        progressValueInput.classList.add('is-invalid');
    }

    function removeValidationError() {
        if (validationMessageEl) {
            validationMessageEl.remove();
            validationMessageEl = null;
        }
        progressValueInput?.classList.remove('is-invalid');
    }

    if (progressValueInput) {
        progressValueInput.addEventListener('input', removeValidationError);
    }

    if (progressTypeSelect) {
        progressTypeSelect.addEventListener('change', removeValidationError);
    }

    saveProgressBtn.addEventListener('click', () => {
        const progressType = progressTypeSelect?.value;
        const progressValue = progressValueInput?.value;

        removeValidationError();

        const validation = ProgressValidator.validate(progressType, progressValue, {});

        if (!validation.isValid) {
            showValidationError(validation.message);
            return;
        }

        saveProgressBtn.disabled = true;
        saveProgressBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Saving...';

        fetch(`/books/${bookId}/update-progress/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                progress_type: progressType,
                progress_value: progressValue
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.reload();
            } else {
                alert('Error updating progress: ' + (data.error || 'Unknown error'));
                saveProgressBtn.disabled = false;
                saveProgressBtn.innerHTML = 'Save Progress';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error updating progress. Please try again.');
            saveProgressBtn.disabled = false;
            saveProgressBtn.innerHTML = 'Save Progress';
        });
    });
}

function initRatingStars() {
    const bookId = document.getElementById('book-id')?.value;
    const ratingStars = document.querySelectorAll('.rating-star');
    const clearRatingBtn = document.getElementById('clearRating');
    const interactiveStarsContainer = document.getElementById('ratingStars');

    if (!bookId || !ratingStars.length || !interactiveStarsContainer) return;

    const currentRating = parseFloat(interactiveStarsContainer.dataset.localRating) || 0;
    updateStarsDisplay(ratingStars, currentRating);

    ratingStars.forEach(star => {
        star.addEventListener('mousemove', (e) => {
            const rect = star.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const isHalfStar = mouseX < rect.width / 2;
            const fullRating = parseInt(star.dataset.rating);
            const hoverRating = isHalfStar ? fullRating - 0.5 : fullRating;

            highlightStarsWithHalf(ratingStars, hoverRating);

            ratingStars.forEach(s => s.classList.remove('half-target'));
            if (isHalfStar) {
                star.classList.add('half-target');
            }
        });

        star.addEventListener('click', (e) => {
            const rect = star.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const fullRating = parseInt(star.dataset.rating);
            const isHalfStar = mouseX < rect.width / 2;
            const newRating = isHalfStar ? fullRating - 0.5 : fullRating;

            saveRating(bookId, newRating, ratingStars, interactiveStarsContainer);
        });
    });

    interactiveStarsContainer.addEventListener('mouseleave', () => {
        const currentRating = parseFloat(interactiveStarsContainer.dataset.localRating) || 0;
        highlightStarsWithHalf(ratingStars, currentRating);
        ratingStars.forEach(s => s.classList.remove('half-target'));
    });

    if (clearRatingBtn) {
        clearRatingBtn.addEventListener('click', () => {
            saveRating(bookId, null, ratingStars, interactiveStarsContainer);
        });
    }
}

function highlightStarsWithHalf(stars, rating) {
    stars.forEach(star => {
        const starRating = parseInt(star.dataset.rating);
        star.classList.remove('bi-star-fill', 'bi-star-half', 'bi-star');

        if (starRating <= Math.floor(rating)) {
            star.classList.add('bi-star-fill');
        } else if (starRating === Math.ceil(rating) && rating % 1 !== 0) {
            star.classList.add('bi-star-half');
        } else {
            star.classList.add('bi-star');
        }
    });
}

function updateStarsDisplay(stars, rating) {
    highlightStarsWithHalf(stars, rating);
}

function saveRating(bookId, rating, stars, container) {
    fetch(`/books/${bookId}/update-rating/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
        body: JSON.stringify({ rating: rating })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            container.dataset.localRating = data.rating || "0";
            updateStarsDisplay(stars, parseFloat(data.rating || 0));
        } else {
            console.error('Error saving rating:', data.error);
            alert(`Error saving rating: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error saving rating. Please try again.');
    });
}

function initHardcoverSync() {
    const bookId = document.getElementById('book-id')?.value;
    const hardcoverId = document.getElementById('hardcover-id')?.value;
    const syncButton = document.getElementById('syncHardcoverProgress');
    const hardcoverModal = document.getElementById('hardcoverSyncModal');
    const modalBody = document.getElementById('hardcoverSyncModalBody');
    const applyButton = document.getElementById('applyProgressBtn');
    const autoSyncToggle = document.getElementById('autoSyncToggle');
    const lastSyncTimeEl = document.getElementById('lastSyncTime');
    const clearSyncButton = document.getElementById('clearSyncButton');

    if (!bookId || !hardcoverId) return;

    let selectedProgress = null;

    if (lastSyncTimeEl) {
        lastSyncTimeEl.textContent = Storage.getLastSyncTimeFormatted(bookId);
    }

    if (autoSyncToggle) {
        const autoSyncEnabled = Storage.get(`auto_sync_${bookId}`, false);
        autoSyncToggle.checked = autoSyncEnabled;

        autoSyncToggle.addEventListener('change', () => {
            const enabled = autoSyncToggle.checked;
            Storage.save(`auto_sync_${bookId}`, enabled);

            if (enabled) {
                fetchAndApplyProgressAutomatically(bookId, hardcoverId, lastSyncTimeEl);
            }
        });
    }

    if (clearSyncButton) {
        clearSyncButton.addEventListener('click', (e) => {
            e.preventDefault();
            Storage.remove(`last_sync_${bookId}`);

            if (lastSyncTimeEl) {
                lastSyncTimeEl.textContent = "Never";
            }

            if (autoSyncToggle && autoSyncToggle.checked) {
                setTimeout(() => {
                    fetchAndApplyProgressAutomatically(bookId, hardcoverId, lastSyncTimeEl);
                }, 500);
            }
        });
    }

    if (!syncButton || !hardcoverModal || !modalBody) return;

    syncButton.addEventListener('click', () => {
        selectedProgress = null;
        applyButton.disabled = true;

        modalBody.innerHTML = `
            <p>Fetching your reading progress from Hardcover...</p>
            <div class="loading-spinner">
                <i class="bi bi-arrow-repeat"></i>
            </div>
        `;

        hardcoverModal.classList.add('active');

        fetch(`/api/hardcover-progress/${hardcoverId}/`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    modalBody.innerHTML = `<div class="alert alert-warning">${data.error}</div>`;
                    return;
                }

                if (!data.progress || data.progress.length === 0) {
                    modalBody.innerHTML = '<div class="alert alert-info">No reading progress found for this book on Hardcover.</div>';
                    return;
                }

                displayProgressOptions(data.progress, modalBody, applyButton, (progress) => {
                    selectedProgress = progress;
                });

                Storage.updateLastSyncTime(bookId);
                if (lastSyncTimeEl) {
                    lastSyncTimeEl.textContent = new Date().toLocaleString();
                }
            })
            .catch(error => {
                modalBody.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
            });
    });

    applyButton.addEventListener('click', () => {
        if (!selectedProgress) return;

        applyButton.disabled = true;
        applyButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Applying...';

        applyProgressData(bookId, selectedProgress, lastSyncTimeEl);
    });
}

function fetchAndApplyProgressAutomatically(bookId, hardcoverId, lastSyncTimeEl) {
    fetch(`/api/hardcover-progress/${hardcoverId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.error || !data.progress || data.progress.length === 0) {
                console.log('Auto-sync: No progress found');
                return;
            }

            let mostRecentProgress = data.progress[0];
            if (data.progress.length > 1) {
                data.progress.sort((a, b) => (b.progress || 0) - (a.progress || 0));
                mostRecentProgress = data.progress[0];
            }

            applyProgressData(bookId, mostRecentProgress, lastSyncTimeEl);
        })
        .catch(error => {
            console.error('Auto-sync error:', error);
        });
}

function applyProgressData(bookId, progressData, lastSyncTimeEl) {
    let progressType, progressValue;

    if (progressData.reading_format === 'audio') {
        progressType = 'audio';
        if (progressData.current_position) {
            const hours = Math.floor(progressData.current_position / 3600);
            const minutes = Math.floor((progressData.current_position % 3600) / 60);
            progressValue = `${hours}h ${minutes}m`;
        } else {
            progressValue = parseFloat(progressData.progress || 0).toFixed(2) + '%';
        }
    } else {
        if (progressData.current_page) {
            progressType = 'page';
            progressValue = progressData.current_page;
        } else {
            progressType = 'percent';
            progressValue = parseFloat(progressData.progress || 0).toFixed(2);
        }
    }

    const hardcoverData = {
        started_at: progressData.started_at,
        finished_at: progressData.finished_at,
        progress: parseFloat(progressData.progress || 0).toFixed(2),
        current_page: progressData.current_page,
        current_position: progressData.current_position,
        reading_format: progressData.reading_format,
        edition_id: progressData.edition?.id,
        rating: progressData.rating,
        user_book_id: progressData.read_id
    };

    fetch(`/books/${bookId}/update-progress/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
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
            Storage.updateLastSyncTime(bookId);
            if (lastSyncTimeEl) {
                lastSyncTimeEl.textContent = new Date().toLocaleString();
            }

            if (progressData.rating) {
                fetch(`/books/${bookId}/update-rating/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({
                        rating: progressData.rating,
                        hardcover_read_id: progressData.read_id
                    })
                })
                .then(response => response.json())
                .then(ratingData => {
                    if (ratingData.success) {
                        const ratingStars = document.querySelectorAll('.rating-star');
                        const interactiveStarsContainer = document.getElementById('ratingStars');
                        if (ratingStars.length && interactiveStarsContainer) {
                            interactiveStarsContainer.dataset.localRating = progressData.rating.toString();
                            updateStarsDisplay(ratingStars, parseFloat(progressData.rating));
                        }
                    }
                    window.location.reload();
                })
                .catch(() => {
                    window.location.reload();
                });
            } else {
                window.location.reload();
            }
        }
    })
    .catch(error => {
        console.error('Error applying progress:', error);
    });
}

function displayProgressOptions(progressData, modalBody, applyButton, onSelect) {
    let html = '<p>Select progress to import:</p><div class="progress-option-container">';

    progressData.forEach((item, index) => {
        const status = item.finished_at ? 'Finished' : (item.started_at ? 'In Progress' : 'Not started');
        const format = item.reading_format === 'audio' ? 'Audiobook' : 'Book';
        const progress = item.progress || 0;
        const formattedProgress = parseFloat(progress).toFixed(2);

        let details = '';
        if (item.reading_format === 'audio' && item.current_position) {
            const hours = Math.floor(item.current_position / 3600);
            const minutes = Math.floor((item.current_position % 3600) / 60);
            details = `${hours}h ${minutes}m`;
        } else if (item.current_page) {
            details = `Page ${item.current_page}`;
        } else {
            details = `${formattedProgress}% complete`;
        }

        html += `
            <div class="progress-option" data-index="${index}">
                <div class="progress-option-header">
                    <div>
                        <h5>${format}</h5>
                        <div class="progress-details">${details}</div>
                    </div>
                    <span class="badge ${item.finished_at ? 'badge-success' : 'badge-primary'}">${status}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    modalBody.innerHTML = html;

    document.querySelectorAll('.progress-option').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.progress-option').forEach(el => {
                el.classList.remove('selected');
            });
            item.classList.add('selected');
            onSelect(progressData[parseInt(item.dataset.index)]);
            applyButton.disabled = false;
        });
    });
}

function initSortPreference() {
    const bookId = document.getElementById('book-id')?.value;
    if (!bookId) return;

    const sortOptions = document.querySelectorAll('.sort-option[data-sort-option]');

    sortOptions.forEach(option => {
        option.addEventListener('click', () => {
            const sortOption = option.dataset.sortOption;
            const validOptions = ['date_desc', 'date_asc', 'progress_desc', 'progress_asc'];

            if (validOptions.includes(sortOption)) {
                localStorage.setItem(`book_sort_option_${bookId}`, sortOption);
            }
        });
    });

    const url = new URL(window.location.href);
    const tabParam = url.searchParams.get('tab');
    const sortParam = url.searchParams.get('sort');

    if (tabParam === 'discussion' && !sortParam) {
        const savedSort = localStorage.getItem(`book_sort_option_${bookId}`);
        if (savedSort) {
            url.searchParams.set('sort', savedSort);
            url.searchParams.set('tab', 'discussion');
            window.location.href = url.toString();
        }
    }
}

function initAccessibility() {
    const modals = document.querySelectorAll('.modal-overlay');

    modals.forEach(modal => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isActive = modal.classList.contains('active');

                    if (isActive) {
                        const focusableElements = modal.querySelectorAll(
                            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                        );

                        if (focusableElements.length > 0) {
                            setTimeout(() => {
                                focusableElements[0].focus();
                            }, 100);
                        }

                        modal.setAttribute('role', 'dialog');
                        modal.setAttribute('aria-modal', 'true');
                    }
                }
            });
        });

        observer.observe(modal, { attributes: true });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initModals();
    initDropdowns();
    initSpoilerButtons();
    initSpoilerToggle();
    initReactionPanels();
    initProgressTypeHelp();
    initDetailsAnimations();
    initDeleteCommentModal();
    initCommentForm();
    initProgressTracking();
    initRatingStars();
    initHardcoverSync();
    initSortPreference();
    initAccessibility();

    document.querySelectorAll('.comment-card, .reply-card').forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100 * index);
    });
});
