// push-service-worker.js
// Minimal service worker for handling push notifications

// Only handle push events - no caching or intercepting requests
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: data.icon || '/static/bookclub/images/icon-192.png',
      badge: '/static/bookclub/images/icon-192.png',
      data: {
        url: data.url || '/'
      },
      requireInteraction: true
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  // When clicked, open the specific URL
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Simple install and activate handlers
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Immediately take control of all clients
  event.waitUntil(clients.claim());
});