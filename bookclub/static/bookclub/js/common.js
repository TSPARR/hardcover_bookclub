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
    
    // Register service worker for push notifications (available globally)
    initServiceWorker();

    // Initialize pull-to-refresh
    setupPullToRefresh();
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

// Helper function to get CSRF token
function getCsrfToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    
    return cookieValue;
}

// Helper function to check if push notifications are supported in browser
function arePushNotificationsSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Helper function to convert base64 to Uint8Array (for VAPID keys)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Initialize service worker for push notifications (runs on every page)
async function initServiceWorker() {
    // Don't proceed if push notifications aren't supported
    if (!arePushNotificationsSupported()) {
        console.log('Push notifications not supported in this browser');
        return;
    }
    
    try {
        // Check if service worker is already registered
        const existingRegistration = await navigator.serviceWorker.getRegistration('/push-service-worker.js');
        
        if (!existingRegistration) {
            // Register service worker if not already registered
            const registration = await navigator.serviceWorker.register('/push-service-worker.js');
            console.log('Service worker registered:', registration.scope);
        } else {
            console.log('Service worker already registered');
        }
    } catch (error) {
        console.error('Service worker registration failed:', error);
    }
}

// Check if push notifications are available on the server
async function checkPushNotificationsAvailable() {
    try {
        const response = await fetch('/api/push/vapid-public-key/');
        return response.ok;
    } catch (error) {
        console.error('Error checking push notifications availability:', error);
        return false;
    }
}

// Get the current push notification subscription if one exists
async function getCurrentPushSubscription() {
    if (!arePushNotificationsSupported()) {
        return null;
    }
    
    try {
        const registration = await navigator.serviceWorker.getRegistration('/push-service-worker.js');
        if (!registration) {
            return null;
        }
        
        const subscription = await registration.pushManager.getSubscription();
        return subscription;
    } catch (error) {
        console.error('Error getting push subscription:', error);
        return null;
    }
}

// Subscribe to push notifications
async function subscribeToPushNotifications() {
    if (!arePushNotificationsSupported()) {
        alert('Push notifications are not supported in your browser.');
        return null;
    }
    
    try {
        // Request permission if needed
        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('Notification permission denied. Please enable notifications in your browser settings.');
                return null;
            }
        }
        
        // Get service worker registration
        let registration = await navigator.serviceWorker.getRegistration('/push-service-worker.js');
        
        if (!registration) {
            registration = await navigator.serviceWorker.register('/push-service-worker.js');
            console.log('Service worker registered:', registration.scope);
        }
        
        // Get VAPID public key
        const response = await fetch('/api/push/vapid-public-key/');
        if (!response.ok) {
            throw new Error('Failed to get VAPID public key');
        }
        
        const vapidPublicKey = await response.text();
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        
        // Get existing subscription or create a new one
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
            
            console.log('Created new push subscription');
        }
        
        // Send subscription to server
        await sendSubscriptionToServer(subscription);
        
        return subscription;
    } catch (error) {
        console.error('Error subscribing to push notifications:', error);
        alert('Failed to subscribe to push notifications. Check console for details.');
        return null;
    }
}

// Unsubscribe from push notifications
async function unsubscribeFromPushNotifications() {
    try {
        const registration = await navigator.serviceWorker.getRegistration('/push-service-worker.js');
        if (!registration) {
            return true;
        }
        
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            return true;
        }
        
        // Store the endpoint for server unsubscription
        const endpoint = subscription.endpoint;
        
        // Unsubscribe locally
        await subscription.unsubscribe();
        console.log('Unsubscribed from push notifications locally');
        
        // Inform server
        await fetch('/api/push/unsubscribe/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCsrfToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ endpoint: endpoint })
        });
        
        return true;
    } catch (error) {
        console.error('Error unsubscribing from push notifications:', error);
        return false;
    }
}

// Send subscription to server
async function sendSubscriptionToServer(subscription) {
    try {
        const response = await fetch('/api/push/subscribe/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCsrfToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscription)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save subscription on server');
        }
        
        console.log('Subscription saved on server');
        return await response.json();
    } catch (error) {
        console.error('Error sending subscription to server:', error);
        throw error;
    }
}

// Make these functions available globally
window.getCsrfToken = getCsrfToken;
window.arePushNotificationsSupported = arePushNotificationsSupported;
window.urlBase64ToUint8Array = urlBase64ToUint8Array;
window.checkPushNotificationsAvailable = checkPushNotificationsAvailable;
window.getCurrentPushSubscription = getCurrentPushSubscription;
window.subscribeToPushNotifications = subscribeToPushNotifications;
window.unsubscribeFromPushNotifications = unsubscribeFromPushNotifications;
window.sendSubscriptionToServer = sendSubscriptionToServer;

function setupPullToRefresh() {
    // Only implement pull-to-refresh on touch-enabled devices
    if (!('ontouchstart' in window)) {
        return;
    }
    
    // Create refresh indicator element
    const refreshIndicator = document.createElement('div');
    refreshIndicator.id = 'pull-refresh-indicator';
    refreshIndicator.className = 'pull-refresh-indicator';
    refreshIndicator.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    document.body.appendChild(refreshIndicator);
    
    // Variables to track touch
    let startY = 0;
    let currentY = 0;
    let refreshing = false;
    let maxPullDistance = 150;
    let thresholdDistance = 100;
    
    // Add touch event listeners to document
    document.addEventListener('touchstart', function(e) {
        // Only trigger pull-to-refresh when at top of page
        if (window.scrollY !== 0) return;
        
        startY = e.touches[0].pageY;
    }, { passive: true });
    
    document.addEventListener('touchmove', function(e) {
        // Only process if started at top of page
        if (startY === 0 || window.scrollY !== 0 || refreshing) return;
        
        currentY = e.touches[0].pageY;
        let pullDistance = currentY - startY;
        
        // Only show indicator if pulling down
        if (pullDistance > 0) {
            // Calculate progress percentage
            let progress = Math.min(pullDistance / maxPullDistance, 1);
            
            // Update indicator
            refreshIndicator.style.transform = `translateY(${pullDistance * 0.5}px)`;
            refreshIndicator.style.opacity = progress;
            
            // Add rotation based on progress
            const rotation = progress * 360;
            refreshIndicator.querySelector('i').style.transform = `rotate(${rotation}deg)`;
        }
    }, { passive: true });
    
    document.addEventListener('touchend', function() {
        // Only process if we were tracking a touch
        if (startY === 0 || refreshing) {
            startY = 0;
            return;
        }
        
        const pullDistance = currentY - startY;
        
        // Reset indicator position and opacity with animation
        refreshIndicator.style.transition = 'transform 0.3s, opacity 0.3s';
        
        // If pulled enough, trigger refresh
        if (pullDistance > thresholdDistance) {
            refreshing = true;
            
            // Show loading state
            refreshIndicator.classList.add('refreshing');
            refreshIndicator.style.transform = 'translateY(40px)';
            refreshIndicator.style.opacity = '1';
            
            // Perform the actual refresh
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                // If we have an active service worker, use it to refresh content
                caches.keys().then(function(cacheNames) {
                    cacheNames.forEach(function(cacheName) {
                        caches.delete(cacheName);
                    });
                    // Reload the page after cache is cleared
                    window.location.reload();
                });
            } else {
                // If no service worker, just reload the page
                window.location.reload();
            }
        } else {
            // Reset to hidden state
            refreshIndicator.style.transform = 'translateY(0px)';
            refreshIndicator.style.opacity = '0';
        }
        
        // Reset tracking variables
        startY = 0;
        currentY = 0;
    }, { passive: true });
}