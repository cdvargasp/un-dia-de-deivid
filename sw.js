const CACHE = 'uddd-luxury-theme-v4'; // nueva versión para limpiar caché
const ASSETS = [
  './','./index.html','./styles.css','./app.js',
  './manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET') return;
  e.respondWith(
    caches.match(req).then(r=> r || fetch(req).then(resp=>{
      const copy = resp.clone();
      caches.open(CACHE).then(c=> c.put(req, copy));
      return resp;
    }).catch(()=> caches.match('./index.html')))
  );
});
