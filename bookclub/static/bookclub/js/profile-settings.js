/**
 * Profile Settings JavaScript
 * Handles functionality for the profile settings page
 */

// Import necessary functions from modules
import { getCsrfToken } from './common/utils.js';
import { 
    arePushNotificationsSupported, 
    checkPushNotificationsAvailable, 
    getCurrentPushSubscription,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications
} from './common/push-notifications.js';

// Function to clear JS/CSS cache
function clearBrowserCache() {
    console.log('Attempting to clear browser cache...');
    
    // Create query strings with timestamps to force reload of assets
    const timestamp = new Date().getTime();
    const csrfToken = getCsrfToken();
    
    // Show loading indicator
    const button = document.querySelector('button.btn-warning');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Clearing...';
    
    // Get all stylesheets and add/update timestamp parameter
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        if (link.href) {
            try {
                const url = new URL(link.href);
                url.searchParams.set('v', timestamp);
                link.href = url.toString();
            } catch (e) {
                console.error('Error updating stylesheet URL:', e);
            }
        }
    });
    
    // Get all scripts and add/update timestamp parameter
    document.querySelectorAll('script[src]').forEach(script => {
        if (script.src) {
            try {
                const url = new URL(script.src);
                url.searchParams.set('v', timestamp);
                script.src = url.toString();
            } catch (e) {
                console.error('Error updating script URL:', e);
            }
        }
    });
    
    // Create an iframe to load a special clear-cache page
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `/clear-cache/?t=${timestamp}&csrftoken=${csrfToken}`;
    document.body.appendChild(iframe);
    
    // Show feedback to user
    alert('Cache cleared! Page will now reload.');
    
    // Reload the page after a short delay
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
    
    console.log('Cache clearing initiated');
}

// Expose clearBrowserCache globally
window.clearBrowserCache = clearBrowserCache;

// Function to toggle notification options visibility
function toggleNotificationOptions(enabled) {
    const optionsDiv = document.getElementById('notification-options');
    const testContainer = document.getElementById('notification-test-container');
    
    if (optionsDiv) {
        optionsDiv.style.display = enabled ? 'block' : 'none';
    }
    
    if (testContainer) {
        testContainer.style.display = enabled ? 'block' : 'none';
    }
    
    // If notifications are disabled, uncheck all option checkboxes
    if (!enabled) {
        document.querySelectorAll('#notification-options input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    }
}

// Initialize push notification UI elements
async function initNotificationUI() {
    const notificationCheckbox = document.getElementById('id_enable_notifications');
    const testContainer = document.getElementById('notification-test-container');
    const testButton = document.getElementById('test-notification-button');
    
    // If elements don't exist, exit early
    if (!notificationCheckbox || !testContainer || !testButton) {
        return;
    }
    
    // Check if browser supports push notifications
    if (!arePushNotificationsSupported()) {
        console.log('Browser does not support push notifications');
        notificationCheckbox.disabled = true;
        notificationCheckbox.checked = false;
        notificationCheckbox.closest('.form-check').style.display = 'none';
        testContainer.style.display = 'none';
        
        // Also hide notification options
        const notificationOptions = document.getElementById('notification-options');
        if (notificationOptions) {
            notificationOptions.style.display = 'none';
        }
        return;
    }
    
    // Check if push notifications are available on the server
    const pushAvailable = await checkPushNotificationsAvailable();
    if (!pushAvailable) {
        console.log('Push notifications not available on server');
        notificationCheckbox.closest('.form-check').style.display = 'none';
        testContainer.style.display = 'none';
        
        // Also hide notification options
        const notificationOptions = document.getElementById('notification-options');
        if (notificationOptions) {
            notificationOptions.style.display = 'none';
        }
        return;
    }
    
    // Check current subscription status
    const subscription = await getCurrentPushSubscription();
    notificationCheckbox.checked = !!subscription;
    
    // Update visibility based on checkbox state
    toggleNotificationOptions(notificationCheckbox.checked);
    
    // Remove any existing listeners to prevent duplicates
    const newNotificationCheckbox = notificationCheckbox.cloneNode(true);
    notificationCheckbox.parentNode.replaceChild(newNotificationCheckbox, notificationCheckbox);
    
    // Get reference to the new element
    const updatedNotificationCheckbox = document.getElementById('id_enable_notifications');
    
    // Toggle subscription when checkbox changes
    updatedNotificationCheckbox.addEventListener('change', async function() {
        if (this.checked) {
            const success = await subscribeToPushNotifications();
            this.checked = !!success;
            toggleNotificationOptions(this.checked);
        } else {
            await unsubscribeFromPushNotifications();
            toggleNotificationOptions(false);
        }
    });
    
    // Remove any existing listeners to prevent duplicates
    const newTestButton = testButton.cloneNode(true);
    testButton.parentNode.replaceChild(newTestButton, testButton);
    
    // Get reference to the new button
    const updatedTestButton = document.getElementById('test-notification-button');
    
    // Add test notification button handler (only once)
    updatedTestButton.addEventListener('click', async function() {
        const button = this;
        const originalText = button.innerHTML;
        
        // Disable button to prevent multiple clicks
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
        
        try {
            const response = await fetch('/api/push/test/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCsrfToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Notification sent! Check your device.');
            } else {
                alert(`Error: ${data.message || 'Could not send notification'}`);
            }
        } catch (error) {
            console.error('Error sending test notification:', error);
            alert('Failed to send test notification. Check console for details.');
        } finally {
            // Restore button state
            button.disabled = false;
            button.innerHTML = originalText;
        }
    });
    
    console.log('Notification UI initialized successfully');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Ensure this initialization only happens once
    if (window.notificationUIInitialized) {
        console.log('Notification UI already initialized, skipping...');
        return;
    }
    
    // Set flag to prevent duplicate initialization
    window.notificationUIInitialized = true;
    
    // Initialize notification UI
    await initNotificationUI();
    
    // Initialize the notification options toggle function
    initNotificationOptions();
});

// Initialize notification options toggle
function initNotificationOptions() {
    const notificationCheckbox = document.getElementById('id_enable_notifications');
    const notificationOptions = document.getElementById('notification-options');
    const testContainer = document.getElementById('notification-test-container');
    
    if (notificationCheckbox && notificationOptions && testContainer) {
        // Ensure initial state is correct
        toggleNotificationOptions(notificationCheckbox.checked);
        
        // Toggle notification options when main checkbox changes
        notificationCheckbox.addEventListener('change', function() {
            toggleNotificationOptions(this.checked);
        });
    }
}

// Expose functions globally
window.toggleNotificationOptions = toggleNotificationOptions;
window.initNotificationUI = initNotificationUI;
window.initNotificationOptions = initNotificationOptions;

// Export functions if needed
export { 
    clearBrowserCache, 
    toggleNotificationOptions,
    initNotificationUI,
    initNotificationOptions
};