// Service worker for Bookclub PWA
const CACHE_NAME = 'bookclub-v3';  // Increment version to force update
const urlsToCache = [
  '/static/bookclub/css/light-mode/light-mode.css',
  '/static/bookclub/css/dark-mode/dark-mode.css',
  '/static/bookclub/js/common.js',
  '/static/bookclub/images/icon-192.png',
  '/static/bookclub/images/icon-512.png'
];

// Special handling for root URL and auth redirects
const ROOT_URL = self.location.origin + '/';
const HOME_URL = self.location.origin + '/home/';

// Install event - cache resources
self.addEventListener('install', function(event) {
  // Activate the new service worker immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        // Only cache static assets, not HTML pages
        return Promise.allSettled(
          urlsToCache.map(url => 
            fetch(url, { redirect: 'follow' })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to cache ${url}`);
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

// Fetch event - with special handling for root URL
self.addEventListener('fetch', function(event) {
  const requestUrl = new URL(event.request.url);
  
  // Special handling for root URL which redirects to login or home
  if (requestUrl.href === ROOT_URL || requestUrl.pathname === '/') {
    event.respondWith(
      fetch(event.request.url, {
        redirect: 'follow',
        credentials: 'include'
      })
    );
    return;
  }
  
  // Don't cache non-GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request, { redirect: 'follow', credentials: 'include' })
    );
    return;
  }
  
  // Don't cache authentication, admin, or API endpoints
  if (requestUrl.pathname.startsWith('/accounts/') || 
      requestUrl.pathname.startsWith('/admin/') || 
      requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request, { redirect: 'follow', credentials: 'include' })
    );
    return;
  }
  
  // For navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { 
        redirect: 'follow',
        credentials: 'include'
      })
      .catch(() => {
        return caches.match(HOME_URL) || caches.match('/');
      })
    );
    return;
  }
  
  // For static assets (CSS, JS, images)
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest, { 
          redirect: 'follow',
          credentials: 'include'
        })
        .then(function(response) {
          // Don't cache non-successful responses
          if (!response || !response.ok || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          // Only cache static assets
          if (requestUrl.pathname.startsWith('/static/')) {
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        });
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', function(event) {
  const cacheWhitelist = [CACHE_NAME];
  
  // Take control of all clients
  event.waitUntil(clients.claim());
  
  // Clean up old caches
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