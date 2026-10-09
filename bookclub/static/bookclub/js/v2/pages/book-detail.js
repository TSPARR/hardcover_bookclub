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

function initCommentForm() {
    const commentForm = document.getElementById('commentForm');
    if (!commentForm) return;

    const submitButton = commentForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;

    commentForm.addEventListener('submit', (e) => {
        if (submitButton.disabled) {
            e.preventDefault();
            return;
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
        }
    });
}

function initProgressTracking() {
    const bookId = document.getElementById('book-id')?.value;
    const saveProgressBtn = document.getElementById('saveProgressBtn');
    const progressModal = document.getElementById('progressUpdateModal');

    if (!bookId || !saveProgressBtn) return;

    saveProgressBtn.addEventListener('click', () => {
        const progressType = document.getElementById('progressType')?.value;
        const progressValue = document.getElementById('progressValue')?.value;

        if (!progressValue) {
            alert('Please enter a progress value');
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

    if (!bookId || !hardcoverId || !syncButton || !hardcoverModal || !modalBody) return;

    let selectedProgress = null;

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
            })
            .catch(error => {
                modalBody.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
            });
    });

    applyButton.addEventListener('click', () => {
        if (!selectedProgress) return;

        let progressType, progressValue;

        if (selectedProgress.reading_format === 'audio') {
            progressType = 'audio';
            if (selectedProgress.current_position) {
                const hours = Math.floor(selectedProgress.current_position / 3600);
                const minutes = Math.floor((selectedProgress.current_position % 3600) / 60);
                progressValue = `${hours}h ${minutes}m`;
            } else {
                progressValue = parseFloat(selectedProgress.progress || 0).toFixed(2) + '%';
            }
        } else {
            if (selectedProgress.current_page) {
                progressType = 'page';
                progressValue = selectedProgress.current_page;
            } else {
                progressType = 'percent';
                progressValue = parseFloat(selectedProgress.progress || 0).toFixed(2);
            }
        }

        const hardcoverData = {
            started_at: selectedProgress.started_at,
            finished_at: selectedProgress.finished_at,
            progress: parseFloat(selectedProgress.progress || 0).toFixed(2),
            current_page: selectedProgress.current_page,
            current_position: selectedProgress.current_position,
            reading_format: selectedProgress.reading_format,
            edition_id: selectedProgress.edition?.id,
            rating: selectedProgress.rating,
            user_book_id: selectedProgress.read_id
        };

        applyButton.disabled = true;
        applyButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Applying...';

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
                window.location.reload();
            } else {
                alert('Error updating progress: ' + (data.error || 'Unknown error'));
                applyButton.disabled = false;
                applyButton.innerHTML = 'Apply Progress';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error updating progress. Please try again.');
            applyButton.disabled = false;
            applyButton.innerHTML = 'Apply Progress';
        });
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
