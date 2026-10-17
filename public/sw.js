// Minimal service worker: makes the site installable. It caches nothing, so job text and AI results never touch it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // network only
