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
