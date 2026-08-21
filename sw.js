const CACHE_NAME = 'purify-cashier-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

// Proses Install: Menyimpan file ke cache (penyimpanan offline)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Proses Fetch: Mengambil data dari cache jika offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Gunakan file offline
        }
        return fetch(event.request); // Ambil dari internet jika ada
      })
  );
});