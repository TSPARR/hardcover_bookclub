// Push Notifications Module
import { getCsrfToken } from './utils.js';

// Helper function to convert base64 to Uint8Array (for VAPID keys)
export function urlBase64ToUint8Array(base64String) {
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

// Check if push notifications are supported in browser
export function arePushNotificationsSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Check if push notifications are available on the server
export async function checkPushNotificationsAvailable() {
    try {
        const response = await fetch('/api/push/vapid-public-key/');
        return response.ok;
    } catch (error) {
        console.error('Error checking push notifications availability:', error);
        return false;
    }
}

// Get the current push notification subscription if one exists
export async function getCurrentPushSubscription() {
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

// Send subscription to server
export async function sendSubscriptionToServer(subscription) {
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

// Subscribe to push notifications
export async function subscribeToPushNotifications() {
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
export async function unsubscribeFromPushNotifications() {
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

// Initialize service worker for push notifications
export async function initServiceWorker() {
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