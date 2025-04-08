/**
 * Profile Settings JavaScript
 * Handles functionality for the profile settings page
 */

// Function to clear JS/CSS cache
function clearBrowserCache() {
    console.log('Attempting to clear browser cache...');
    
    // Create query strings with timestamps to force reload of assets
    const timestamp = new Date().getTime();
    const csrfToken = window.getCsrfToken();
    
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize push notification UI elements
    await initNotificationUI();
});

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
    if (!window.arePushNotificationsSupported()) {
        console.log('Browser does not support push notifications');
        notificationCheckbox.disabled = true;
        notificationCheckbox.checked = false;
        notificationCheckbox.closest('.form-check').style.display = 'none';
        testContainer.style.display = 'none';
        return;
    }
    
    // Check if push notifications are available on the server
    const pushAvailable = await window.checkPushNotificationsAvailable();
    if (!pushAvailable) {
        console.log('Push notifications not available on server');
        notificationCheckbox.closest('.form-check').style.display = 'none';
        testContainer.style.display = 'none';
        return;
    }
    
    // Check current subscription status
    const subscription = await window.getCurrentPushSubscription();
    notificationCheckbox.checked = !!subscription;
    
    // Update test button visibility based on checkbox state
    testContainer.style.display = notificationCheckbox.checked ? 'block' : 'none';
    
    // Toggle subscription when checkbox changes
    notificationCheckbox.addEventListener('change', async function() {
        if (this.checked) {
            const success = await window.subscribeToPushNotifications();
            this.checked = !!success;
            testContainer.style.display = this.checked ? 'block' : 'none';
        } else {
            await window.unsubscribeFromPushNotifications();
            testContainer.style.display = 'none';
        }
    });
    
    // Add test notification button handler
    testButton.addEventListener('click', async function() {
        const button = this;
        const originalText = button.innerHTML;
        
        // Disable button and show loading state
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
        
        try {
            const response = await fetch('/api/push/test/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': window.getCsrfToken(),
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
}