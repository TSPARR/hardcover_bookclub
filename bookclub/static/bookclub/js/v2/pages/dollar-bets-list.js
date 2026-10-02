let currentPendingForm = null;

const confirmationModal = document.getElementById('confirmationModal');
const confirmationModalClose = document.getElementById('confirmationModalClose');
const confirmationModalCancel = document.getElementById('confirmationModalCancel');
const confirmationModalConfirm = document.getElementById('confirmationModalConfirm');
const confirmationModalMessage = document.getElementById('confirmationModalMessage');

function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function closeConfirmationModal() {
    closeModal(confirmationModal);
    currentPendingForm = null;
}

if (confirmationModalClose) {
    confirmationModalClose.addEventListener('click', closeConfirmationModal);
}

if (confirmationModalCancel) {
    confirmationModalCancel.addEventListener('click', closeConfirmationModal);
}

if (confirmationModalConfirm) {
    confirmationModalConfirm.addEventListener('click', () => {
        if (currentPendingForm) {
            const submitButton = currentPendingForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Deleting...';
            }
            currentPendingForm.submit();
            currentPendingForm = null;
        }
        closeModal(confirmationModal);
    });
}

if (confirmationModal) {
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            closeConfirmationModal();
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmationModal && confirmationModal.classList.contains('active')) {
        closeConfirmationModal();
    }
});

function showConfirmation(message, form) {
    if (confirmationModalMessage) {
        confirmationModalMessage.textContent = message;
    }
    currentPendingForm = form;
    if (confirmationModal) {
        openModal(confirmationModal);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const actionLinks = document.querySelectorAll('.bet-actions a, .bet-card-actions a');

    actionLinks.forEach(link => {
        if (link.href && !link.href.includes('javascript:')) {
            link.addEventListener('click', function(e) {
                if (this.classList.contains('btn-danger') && this.textContent.includes('Delete')) {
                    return;
                }

                const icon = this.querySelector('i');
                if (icon) {
                    icon.className = 'bi bi-arrow-repeat';
                }
                this.style.opacity = '0.6';
                this.style.pointerEvents = 'none';
            });
        }
    });

    const deleteForms = document.querySelectorAll('.delete-form');

    deleteForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            showConfirmation('Are you sure you want to delete this bet? This action cannot be undone.', form);
        });
    });

    const resolveLinks = document.querySelectorAll('a[href*="resolve_dollar_bet"]');
    resolveLinks.forEach(link => {
        link.addEventListener('click', function() {
            this.innerHTML = '<i class="bi bi-arrow-repeat"></i> Loading...';
            this.style.opacity = '0.6';
            this.style.pointerEvents = 'none';
        });
    });

    const joinLinks = document.querySelectorAll('a[href*="join_dollar_bet"]');
    joinLinks.forEach(link => {
        link.addEventListener('click', function() {
            this.innerHTML = '<i class="bi bi-arrow-repeat"></i> Joining...';
            this.style.opacity = '0.6';
            this.style.pointerEvents = 'none';
        });
    });

    const acceptLinks = document.querySelectorAll('a[href*="accept_dollar_bet"]');
    acceptLinks.forEach(link => {
        link.addEventListener('click', function() {
            this.innerHTML = '<i class="bi bi-arrow-repeat"></i> Accepting...';
            this.style.opacity = '0.6';
            this.style.pointerEvents = 'none';
        });
    });

    const closeLinks = document.querySelectorAll('a[href*="close_betting"]');
    closeLinks.forEach(link => {
        link.addEventListener('click', function() {
            this.innerHTML = '<i class="bi bi-arrow-repeat"></i> Closing...';
            this.style.opacity = '0.6';
            this.style.pointerEvents = 'none';
        });
    });
});
