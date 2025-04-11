// Import modules
import { setupDarkMode, preventModeFlash } from './common/dark-mode.js';
import { 
    initServiceWorker, 
    subscribeToPushNotifications, 
    unsubscribeFromPushNotifications,
    getCurrentPushSubscription,
    checkPushNotificationsAvailable
} from './common/push-notifications.js';
import { copyInviteLink } from './common/utils.js';
import { setupPullToRefresh } from './common/pull-to-refresh.js';

// Safely initialize elements
function safeInitElement(selector, callback) {
    const element = document.querySelector(selector);
    if (element) {
        callback(element);
    }
}

// DOMContentLoaded event listener for initializing features
document.addEventListener('DOMContentLoaded', function() {
    // Prevent mode flash
    preventModeFlash();

    // Initialize tooltips (only if Bootstrap is available)
    if (window.bootstrap && window.bootstrap.Tooltip) {
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl)
        });
    }

    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    alerts.forEach(alert => {
        setTimeout(() => {
            if (window.bootstrap && window.bootstrap.Alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            } else {
                alert.remove();
            }
        }, 5000);
    });
    
    // Add active class to current nav item based on URL
    const currentPath = window.location.pathname;
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // ===== Starting Points Modal =====
    safeInitElement('#setStartingPointModal', (modal) => {
        modal.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget;
            const memberId = button.getAttribute('data-member-id');
            const memberName = button.getAttribute('data-member-name');
            
            // Update the modal content
            const memberIdInput = document.getElementById('memberIdInput');
            const memberNameDisplay = document.getElementById('memberNameDisplay');
            
            if (memberIdInput) memberIdInput.value = memberId;
            if (memberNameDisplay) memberNameDisplay.textContent = memberName;
        });
    });
    
    // ===== Comment Progress Type Selection =====
    safeInitElement('#comment_progress_type', (progressType) => {
        progressType.addEventListener('change', function() {
            const helpText = document.getElementById('commentProgressHelp');
            const selectedType = this.value;

            if (helpText) {
                if (selectedType === 'page') {
                    helpText.textContent = 'Enter the page number you\'re commenting about.';
                } else if (selectedType === 'audio') {
                    helpText.textContent = 'Enter the timestamp (e.g., "2h 30m").';
                } else {
                    helpText.textContent = 'Enter a percentage (e.g., "75").';
                }
            }
        });
    });

    // Initialize dark mode
    setupDarkMode();
    
    // Register service worker for push notifications
    initServiceWorker();

    // Initialize pull-to-refresh
    setupPullToRefresh();
});

// Expose utility functions globally
window.copyInviteLink = copyInviteLink;
window.subscribeToPushNotifications = subscribeToPushNotifications;
window.unsubscribeFromPushNotifications = unsubscribeFromPushNotifications;
window.getCurrentPushSubscription = getCurrentPushSubscription;
window.checkPushNotificationsAvailable = checkPushNotificationsAvailable;