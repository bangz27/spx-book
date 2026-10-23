// SPX Book service worker
const CACHE = 'spx-book-v16';
const SHELL = [
  './', './index.html', './style.css', './app.js', './config.js', './pwa.js', './donate.js', './theme.js', './img/promptpay.jpg', './sounds/success.mp3', './fonts/EkkamaiVibe-Regular.woff2', './fonts/EkkamaiVibe-Bold.woff2', './fonts/EkkamaiVibe-Heavy.woff2',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('spx-book-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;              // audio range requests: straight to network (Safari)                  // non-GET: straight to network
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;  // Supabase API/auth: never cached
  if (url.origin !== self.location.origin) return;   // CDN/fonts: browser default

  const networkFirst = req.mode === 'navigate' || /\.(html|js)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (networkFirst) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
  } else {
    e.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
