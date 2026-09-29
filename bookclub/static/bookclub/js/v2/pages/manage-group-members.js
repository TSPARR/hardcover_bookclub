function initializePage() {
    const modal = document.getElementById('confirmationModal');
    const modalOverlay = modal.querySelector('.modal-overlay');
    const modalClose = modal.querySelector('.modal-close');
    const modalCancel = modal.querySelector('.modal-cancel');
    const modalConfirm = modal.querySelector('.modal-confirm');
    const confirmationMessage = document.getElementById('confirmationMessage');

    let pendingForm = null;

    function openModal(message, form) {
        confirmationMessage.textContent = message;
        pendingForm = form;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        pendingForm = null;
    }

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    if (modalCancel) {
        modalCancel.addEventListener('click', closeModal);
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeModal);
    }

    if (modalConfirm) {
        modalConfirm.addEventListener('click', function() {
            if (pendingForm) {
                pendingForm.submit();
            }
            closeModal();
        });
    }

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });

    const confirmButtons = document.querySelectorAll('.confirm-action');
    confirmButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const confirmMessage = this.getAttribute('data-confirm');
            const form = this.closest('form');

            if (confirmMessage && form) {
                openModal(confirmMessage, form);
            }
        });
    });

    const rows = document.querySelectorAll('.members-table tbody tr');
    rows.forEach((row, index) => {
        row.style.opacity = '0';
        row.style.transform = 'translateY(10px)';
        setTimeout(() => {
            row.style.transition = 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, 100 + (index * 30));
    });

    const mobileCards = document.querySelectorAll('.member-mobile-card');
    mobileCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100 + (index * 30));
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
