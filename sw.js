// Service Worker for Expense Tracker Pro
const CACHE_NAME = 'expense-tracker-v2.1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Install Event - Cache essential files
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((err) => {
                console.log('[SW] Cache failed:', err);
            })
    );
    self.skipWaiting();
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip Supabase API calls (always fetch from network)
    if (event.request.url.includes('supabase.co')) return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version and update in background
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return networkResponse;
                    }).catch(() => {
                        // Network failed, but we have cache
                        return null;
                    });
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(event.request).then((networkResponse) => {
                    // Cache the new resource
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Offline fallback for HTML pages
                    if (event.request.destination === 'document') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});

// Push Notification (for future use)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Expense Tracker';
    const options = {
        body: data.body || 'You have a new notification',
        icon: data.icon || './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || './' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || './';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let client of windowClients) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
