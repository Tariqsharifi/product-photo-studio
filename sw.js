// سرویس‌ورکر «استودیو محصول»
// نسخه کش را هنگام هر تغییر در فایل‌های اصلی برنامه افزایش بده تا کش قدیمی پاک شود.
const APP_CACHE = 'studio-app-v1';
const MODEL_CACHE = 'studio-model-v1';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './bg-removal.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_CACHE && key !== MODEL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // فایل‌های خود برنامه: اول کش، بعد شبکه (برای کارکرد سریع و آفلاین)
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(APP_CACHE).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached);
      })
    );
  } else {
    // فایل‌های مدل هوش مصنوعی حذف پس‌زمینه (از CDN خارجی):
    // اول کش (برای آفلاین شدن بعد از اولین دانلود)، در غیر این صورت از شبکه بگیر و کش کن
    event.respondWith(
      caches.open(MODEL_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return cached || Promise.reject(err);
        }
      })
    );
  }
});
