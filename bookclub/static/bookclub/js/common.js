document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });

    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
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
    const setStartingPointModal = document.getElementById('setStartingPointModal');
    if (setStartingPointModal) {
        setStartingPointModal.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget;
            const memberId = button.getAttribute('data-member-id');
            const memberName = button.getAttribute('data-member-name');
            
            // Update the modal content
            document.getElementById('memberIdInput').value = memberId;
            document.getElementById('memberNameDisplay').textContent = memberName;
        });
    }
    
    // ===== Comment Progress Type Selection =====
    const commentProgressType = document.getElementById('comment_progress_type');
    if (commentProgressType) {
        commentProgressType.addEventListener('change', function() {
            const helpText = document.getElementById('commentProgressHelp');
            const selectedType = this.value;

            if (selectedType === 'page') {
                helpText.textContent = 'Enter the page number you\'re commenting about.';
            } else if (selectedType === 'audio') {
                helpText.textContent = 'Enter the timestamp (e.g., "2h 30m").';
            } else {
                helpText.textContent = 'Enter a percentage (e.g., "75").';
            }
        });
    }

    // Dark Mode Implementation
    setupDarkMode();

    // Push Mode Implementation
    setupPushNotifications();
});

function setupDarkMode() {    
    // Get reference to the dark mode stylesheet
    const darkModeStylesheet = document.querySelector('link[href*="dark-mode.css"]');
    
    if (!darkModeStylesheet) {
        console.error('Dark mode stylesheet not found');
        return;
    }
    
    // Find the dark mode toggle button
    let darkModeToggle = document.getElementById('dark-mode-toggle');
    
    if (!darkModeToggle) {
        console.error('Dark mode toggle button not found');
        return;
    }
    
    // Check user preference from localStorage
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    // Apply dark mode immediately if it's the saved preference
    if (isDarkMode) {
        enableDarkMode();
    } else {
        disableDarkMode();
    }
    
    // Toggle button click handler
    darkModeToggle.addEventListener('click', function() {
        if (document.documentElement.classList.contains('dark-mode')) {
            disableDarkMode();
        } else {
            enableDarkMode();
        }
    });

    // Functions to handle mode switching
    function enableDarkMode() {
        // Update document classes
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
        
        // Update the media attribute to always load the dark stylesheet
        darkModeStylesheet.setAttribute('media', 'all');
        
        // Update button icon
        darkModeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
        darkModeToggle.classList.remove('btn-dark');
        darkModeToggle.classList.add('btn-light');
        
        // Save preference
        localStorage.setItem('darkMode', 'true');    
    }

    function disableDarkMode() {
        // Update document classes
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        
        // Update the media attribute to never load the dark stylesheet
        darkModeStylesheet.setAttribute('media', 'not all');
        
        // Update button icon
        darkModeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
        darkModeToggle.classList.remove('btn-light');
        darkModeToggle.classList.add('btn-dark');
        
        // Save preference
        localStorage.setItem('darkMode', 'false');
    }

    // Listen for system preference changes
    if (window.matchMedia) {
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Apply system preference if no saved preference
        if (localStorage.getItem('darkMode') === null) {
            if (prefersDarkScheme.matches) {
                enableDarkMode();
            }
        }
        
        // Listen for changes
        prefersDarkScheme.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (localStorage.getItem('darkMode') === null) {
                if (e.matches) {
                    enableDarkMode();
                } else {
                    disableDarkMode();
                }
            }
        });
    }
}

// ===== Copy Invitation Link function =====
function copyInviteLink(link) {
    navigator.clipboard.writeText(link).then(function() {
        alert('Invitation link copied to clipboard!');
    }, function() {
        alert('Failed to copy invitation link.');
    });
}

// Make the function available globally
window.copyInviteLink = copyInviteLink;

// Add this function to common.js

// Service Worker and Push Notification Setup
function setupPushNotifications() {    
    const notificationToggle = document.getElementById('id_enable_notifications');
    if (!notificationToggle) {
        // Not on the settings page, no need to continue
        return;
    }
    
    // Check if Push API is supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        notificationToggle.disabled = true;
        notificationToggle.checked = false;
        const helpText = document.querySelector('[for="id_enable_notifications"] + .form-text');
        if (helpText) {
            helpText.textContent = 'Push notifications are not supported in your browser.';
            helpText.classList.add('text-danger');
        }
        return;
    }
    
    // Check permission state
    const currentPermission = Notification.permission;
    if (currentPermission === 'denied') {
        notificationToggle.disabled = true;
        notificationToggle.checked = false;
        const helpText = document.querySelector('[for="id_enable_notifications"] + .form-text');
        if (helpText) {
            helpText.textContent = 'Notifications are blocked in your browser settings.';
            helpText.classList.add('text-danger');
        }
        return;
    }
    
    // Register minimal service worker
    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/push-service-worker.js', {
                scope: '/push/'
            });
            return registration;
        } catch (error) {
            console.error('Service worker registration failed:', error);
            return null;
        }
    }
    
    // Convert base64 to Uint8Array for the VAPID key
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
          .replace(/-/g, '+')
          .replace(/_/g, '/');
      
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
      
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      }
    
    // Subscribe to push notifications
    async function subscribeToPush() {
        try {
            // Get service worker registration
            let registration = await navigator.serviceWorker.getRegistration('/push/');
            if (!registration) {
                registration = await registerServiceWorker();
            }
            
            if (!registration) {
                throw new Error('Failed to register service worker');
            }
            
            // Get the server's public key
            const response = await fetch('/api/push/vapid-public-key/');
            if (!response.ok) {
                throw new Error('Failed to get VAPID public key');
            }
            
            const vapidPublicKey = await response.text();
            const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
            
            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });
            
            // Send the subscription to the server
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            const sendResult = await fetch('/api/push/subscribe/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(subscription)
            });
            
            if (!sendResult.ok) {
                throw new Error('Failed to save subscription on server');
            }
            
            return true;
        } catch (error) {
            console.error('Subscription error:', error);
            return false;
        }
    }
    
    // Unsubscribe from push notifications
    async function unsubscribeFromPush() {
        try {
            const registration = await navigator.serviceWorker.getRegistration('/push/');
            if (!registration) {
                return true; // Nothing to unsubscribe from
            }
            
            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                return true; // Nothing to unsubscribe from
            }
            
            // Unsubscribe from browser
            await subscription.unsubscribe();
            
            // Tell the server to remove the subscription
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            await fetch('/api/push/unsubscribe/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({endpoint: subscription.endpoint})
            });
            
            return true;
        } catch (error) {
            console.error('Unsubscribe error:', error);
            return false;
        }
    }
    
    // Check existing subscription
    async function checkExistingSubscription() {
        try {
            const registration = await navigator.serviceWorker.getRegistration('/push/');
            if (!registration) {
                return false;
            }
            
            const subscription = await registration.pushManager.getSubscription();
            return !!subscription;
        } catch (error) {
            console.error('Error checking subscription:', error);
            return false;
        }
    }
    
    // Initialize toggle state
    checkExistingSubscription().then(isSubscribed => {
        notificationToggle.checked = isSubscribed;
    });
    
    // Handle toggle changes
    notificationToggle.addEventListener('change', async event => {
        if (event.target.checked) {
            // Request permission if needed
            if (Notification.permission !== 'granted') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    event.target.checked = false;
                    return;
                }
            }
            
            // Subscribe
            const success = await subscribeToPush();
            event.target.checked = success;
            
            if (success) {
                const helpText = document.querySelector('[for="id_enable_notifications"] + .form-text');
                if (helpText && helpText.classList.contains('text-danger')) {
                    helpText.classList.remove('text-danger');
                    helpText.textContent = 'Receive notifications for new comments, book progress updates, and group activities.';
                }
            }
        } else {
            // Unsubscribe
            await unsubscribeFromPush();
        }
    });

    // Handle test notification button
    const testButton = document.getElementById('test-notification-button');
    const testContainer = document.getElementById('notification-test-container');

    if (testButton && testContainer) {
        // Show test button only when notifications are enabled
        function updateTestButtonVisibility() {
            if (notificationToggle.checked) {
                testContainer.style.display = 'block';
            } else {
                testContainer.style.display = 'none';
            }
        }
        
        // Initial visibility check
        updateTestButtonVisibility();
        
        // Update visibility when toggle changes
        notificationToggle.addEventListener('change', updateTestButtonVisibility);
        
        // Send test notification when button is clicked
        testButton.addEventListener('click', async () => {
            testButton.disabled = true;
            testButton.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Sending...';
            
            try {
                const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
                const response = await fetch('/api/push/test/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({})
                });
                
                if (response.ok) {
                    testButton.innerHTML = '<i class="bi bi-check-circle me-1"></i> Notification Sent!';
                    setTimeout(() => {
                        testButton.innerHTML = '<i class="bi bi-bell me-1"></i> Test Notifications';
                        testButton.disabled = false;
                    }, 3000);
                } else {
                    const data = await response.json();
                    testButton.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i> Failed';
                    console.error('Test notification failed:', data.message);
                    setTimeout(() => {
                        testButton.innerHTML = '<i class="bi bi-bell me-1"></i> Test Notifications';
                        testButton.disabled = false;
                    }, 3000);
                }
            } catch (error) {
                console.error('Error sending test notification:', error);
                testButton.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i> Error';
                setTimeout(() => {
                    testButton.innerHTML = '<i class="bi bi-bell me-1"></i> Test Notifications';
                    testButton.disabled = false;
                }, 3000);
            }
        });
    }
}