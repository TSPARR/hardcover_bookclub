function showNotification(message, type = 'success') {
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }

    const notificationId = 'notification-' + Date.now();
    const notification = document.createElement('div');
    notification.id = notificationId;
    notification.className = `notification ${type}`;

    const iconClass = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';

    notification.innerHTML = `
        <i class="bi ${iconClass} notification-icon ${type}"></i>
        <span class="notification-message">${message}</span>
        <i class="bi bi-x notification-close"></i>
    `;

    notificationContainer.appendChild(notification);

    notification.addEventListener('click', () => {
        dismissNotification(notification);
    });

    setTimeout(() => {
        dismissNotification(notification);
    }, 4000);
}

function dismissNotification(notification) {
    if (!notification || !notification.parentNode) return;

    notification.classList.add('notification-exit');

    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

function copyInviteLink(link) {
    if (!navigator.clipboard) {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
            showNotification('Invitation link copied to clipboard!', 'success');
        } catch (err) {
            showNotification('Failed to copy invitation link. Please try again.', 'error');
        }

        document.body.removeChild(textArea);
        return;
    }

    navigator.clipboard.writeText(link)
        .then(() => {
            showNotification('Invitation link copied to clipboard!', 'success');
        })
        .catch(() => {
            showNotification('Failed to copy invitation link. Please try again.', 'error');
        });
}

function initializeRevokeConfirmations() {
    const revokeForms = document.querySelectorAll('form[data-revoke-form]');

    revokeForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            if (!confirm('Are you sure you want to revoke this invitation? This action cannot be undone.')) {
                e.preventDefault();
            }
        });
    });
}

function animateTableRows() {
    const rows = document.querySelectorAll('.invitations-table tbody tr');

    rows.forEach((row, index) => {
        row.style.opacity = '0';
        row.style.transform = 'translateY(20px)';

        setTimeout(() => {
            row.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, index * 50);
    });
}

function animateMobileCards() {
    const cards = document.querySelectorAll('.invitation-mobile-card');

    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

function initializePage() {
    initializeRevokeConfirmations();

    if (window.innerWidth > 767) {
        animateTableRows();
    } else {
        animateMobileCards();
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 767) {
                animateTableRows();
            } else {
                animateMobileCards();
            }
        }, 250);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

window.copyInviteLink = copyInviteLink;
window.showNotification = showNotification;
