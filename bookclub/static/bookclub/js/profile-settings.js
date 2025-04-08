/**
 * Profile Settings JavaScript
 * Handles functionality for the profile settings page
 */

// Function to clear JS/CSS cache
function clearBrowserCache() {
    console.log('Attempting to clear browser cache...');
    
    // Create query strings with timestamps to force reload of assets
    const timestamp = new Date().getTime();
    
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
    
    // Show feedback to user
    alert('Cache cleared! Page will now reload.');
    
    // Force reload of the current page
    window.location.reload(true);
    
    console.log('Cache clearing initiated');
}

// Initialize notification test button visibility
function initNotificationControls() {
    const notificationCheckbox = document.getElementById('id_enable_notifications');
    const testContainer = document.getElementById('notification-test-container');
    
    if (!notificationCheckbox || !testContainer) return;
    
    function updateTestButtonVisibility() {
        testContainer.style.display = notificationCheckbox.checked ? 'block' : 'none';
    }
    
    // Set initial state
    updateTestButtonVisibility();
    
    // Add event listener for changes
    notificationCheckbox.addEventListener('change', updateTestButtonVisibility);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initNotificationControls();
    
    // Add test notification button event listener
    const testButton = document.getElementById('test-notification-button');
    if (testButton) {
        testButton.addEventListener('click', function() {
            alert('This is a test notification from your book club app!');
        });
    }
});