/* Service worker de IXClocK.
   Objetivo: que la app abra y se vea BIEN aunque no haya internet.
   - El armazón (index.html, tailwind.css, iconos) se guarda al instalar.
   - Las tipografías y librerías externas se guardan la primera vez que se usan.
   - Nunca se tocan las funciones de Netlify ni las peticiones de datos en vivo
     (clima, radio, proxies): esas deben ir siempre a la red. */
const VERSION = 'ixclock-v1';
const CORE = VERSION + '-core';
const RUNTIME = VERSION + '-runtime';

const CORE_ASSETS = [
  './',
  './index.html',
  './tailwind.css',
  './manifest.webmanifest',
  './favicon.svg',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './screenshot-wide.png',
  './screenshot-narrow.png',
];

// Orígenes externos que sí conviene guardar (tipografías e iconos).
const CACHEABLE_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CORE)
      // addAll falla entero si un archivo falla; se añaden de uno en uno.
      .then((c) => Promise.all(CORE_ASSETS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CORE && k !== RUNTIME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Datos en vivo y funciones del servidor: siempre a la red, sin guardar.
  if (url.pathname.startsWith('/.netlify/')) return;

  const sameOrigin = url.origin === self.location.origin;

  // Navegación: red primero (para ver cambios), con el armazón guardado de red de seguridad.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CORE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  const cacheable = sameOrigin || CACHEABLE_HOSTS.indexOf(url.hostname) !== -1;
  if (!cacheable) return; // el resto (clima, vídeos, proxies) va directo a la red

  // Guardado primero + refresco en segundo plano: rápido y funciona sin conexión.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(sameOrigin ? CORE : RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
