// Service worker for Bookclub PWA
const CACHE_NAME = 'bookclub-v2';  // Increment version to force update
const urlsToCache = [
  '/static/bookclub/css/light-mode/light-mode.css',
  '/static/bookclub/css/dark-mode/dark-mode.css',
  '/static/bookclub/js/common.js',
  '/static/bookclub/images/icon-192.png',
  '/static/bookclub/images/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
  // Activate the new service worker immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        // Use more robust Promise.allSettled to continue even if some resources fail
        return Promise.allSettled(
          urlsToCache.map(url => 
            fetch(url, { redirect: 'follow' })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to cache ${url}: ${response.status} ${response.statusText}`);
                }
                return cache.put(url, response);
              })
              .catch(error => {
                console.error(`Failed to cache ${url}:`, error);
              })
          )
        );
      })
  );
});

// Fetch event - more selective caching strategy
self.addEventListener('fetch', function(event) {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return event.respondWith(fetch(event.request, { redirect: 'follow' }));
  }
  
  // Don't cache authentication or API endpoints
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/accounts/') || 
      url.pathname.startsWith('/admin/') || 
      url.pathname.startsWith('/api/')) {
    return event.respondWith(fetch(event.request, { redirect: 'follow' }));
  }
  
  // For navigation requests (HTML pages), use a network-first approach
  if (event.request.mode === 'navigate') {
    return event.respondWith(
      fetch(event.request, { redirect: 'follow' })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If no cached version, try the offline fallback
              return caches.match('/');
            });
        })
    );
  }
  
  // For other resources (CSS, JS, images), use a cache-first approach
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request because it's a one-time use
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest, { redirect: 'follow' })
          .then(function(response) {
            // Don't cache non-successful responses, redirects, or non-basic responses
            if (!response || !response.ok || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response because it's a one-time use
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          });
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', function(event) {
  const cacheWhitelist = [CACHE_NAME];
  
  // Take control of all clients as soon as it activates
  event.waitUntil(clients.claim());
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});