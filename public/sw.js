// Progressive Web App Service Worker for SRMA 24
const CACHE_NAME = 'srma24-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/logo.svg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching system assets');
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('[SW] Soft caching warning during installation:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Clearing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Offline-First with Network fallbacks)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  
  // Skip non-HTTP assets (like chrome-extension://, firestore websocket connection etc.)
  if (!url.startsWith('http')) return;

  // Ignore firestore, real-time auth, FCM endpoint, and developer HMR websockets
  if (
    url.includes('firestore.googleapis.com') || 
    url.includes('/api/') || 
    url.includes('identitytoolkit') || 
    url.includes('firebaseapp') ||
    url.includes('__vite_ping') ||
    url.includes('sandbox')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Silent catch */});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // If HTML offline fallback is needed
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
    })
  );
});

// Push Event listener to display native OS notification from Background
self.addEventListener('push', (event) => {
  let data = { title: 'Pemberitahuan Baru', body: 'Ada pesan dari Sistem SRMA 24 Kediri.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Pemberitahuan Baru', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/logo.svg',
    badge: '/logo.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let targetUrl = '/';
  
  if (event.notification.data) {
    if (event.notification.data.url) {
      targetUrl = event.notification.data.url;
    } else if (event.notification.data.link === 'walkie_talkie') {
      targetUrl = '/#walkie_talkie';
    } else if (event.notification.data.link) {
      targetUrl = `/#${event.notification.data.link}`;
    }
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          client.focus();
          return client.navigate(targetUrl);
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
