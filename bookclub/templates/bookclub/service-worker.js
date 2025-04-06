// Minimal Service Worker for Bookclub PWA
const CACHE_NAME = 'bookclub-v4';

// Install event
self.addEventListener('install', function(event) {
  // Skip waiting and activate immediately
  self.skipWaiting();
  console.log('Service worker installed');
});

// Simple fetch event handler that just passes through all requests to the network
self.addEventListener('fetch', function(event) {
  const requestUrl = new URL(event.request.url);
  
  console.log('Fetch event for:', requestUrl.pathname);
  
  // For root URL or any navigation requests, use this specific approach
  if (requestUrl.pathname === '/' || event.request.mode === 'navigate') {
    console.log('Handling navigation request for:', requestUrl.pathname);
    
    // Handle it by creating a new request with redirect mode explicitly set to follow
    const newRequest = new Request(event.request, {
      redirect: 'follow',
      // Preserve other request properties
      method: event.request.method,
      headers: event.request.headers,
      credentials: 'include',
      cache: 'no-store' // Bypass cache completely
    });
    
    // Respond with the modified request
    event.respondWith(fetch(newRequest));
    return;
  }
  
  // For all other requests, just pass through to the network
  event.respondWith(fetch(event.request));
});

// Activate event
self.addEventListener('activate', function(event) {
  console.log('Service worker activated');
  
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
  
  // Clear all caches to start fresh
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});