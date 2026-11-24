// Service Worker: macht die App installierbar und offline nutzbar.
// Online wird immer die aktuelle Version geladen, offline die zuletzt gespeicherte.
const CACHE = 'personen-app-v7';
const DATEIEN = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/util.js', './js/db.js', './js/store.js', './js/dialoge.js',
  './js/felder.js', './js/personen.js', './js/fotos.js', './js/import.js', './js/erkennung.js', './js/plattform.js', './js/orte.js', './js/daten.js',
  './js/config.js', './js/tresor.js', './js/drive.js', './js/sync.js', './js/syncui.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(antwort => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE).then(c => c.put(e.request, kopie));
        }
        return antwort;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))),
  );
});
