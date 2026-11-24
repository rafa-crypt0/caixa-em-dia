/* Guarda o app no celular para abrir sem internet. Os dados ficam com o Firebase ou neste aparelho. */
const VERSION = '1.0.0';
const CACHE = `caixa-em-dia-v${VERSION}`;
const SHELL = [
  './', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './src/main.js', './src/state.js', './src/calc.js', './src/db.js', './src/import.js',
  './src/ui/index.js', './src/ui/utils.js', './src/ui/forms.js',
  './src/ui/vResumo.js', './src/ui/vMes.js', './src/ui/vLanc.js',
  './src/ui/vRel.js', './src/ui/vMais.js', './src/ui/vContas.js',
  './src/ui/vRed.js', './src/ui/vAjustes.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const mine = url.origin === location.origin,
    lib = url.hostname === 'www.gstatic.com' || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!mine && !lib) return; // Firebase (banco e login) passa direto
  e.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: mine }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
    )
  );
});
