// Makes the game installable and playable offline. Pages and code try the network first (so updates arrive),
// pictures are kept after the first visit.
const CACHE = 'skyforge-reef-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const fresh = r.mode === 'navigate' || /\.(js|html)$/.test(new URL(r.url).pathname);
  const put = res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(r, c)); } return res; };
  e.respondWith(fresh ? fetch(r).then(put).catch(() => caches.match(r)) : caches.match(r).then(m => m || fetch(r).then(put)));
});
