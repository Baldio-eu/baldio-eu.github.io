// Service worker da app do Baldio: depois da primeira visita, a app abre sem rede.
//
//   casca (HTML, CSS, JS, mapa base)   pré-carregada na instalação, servida da cache
//   dados (data/projectos.json)        não passam por aqui: a app guarda-os e só os pede outra vez
//                                      no botão de actualizar (ver fetchData em assets/app.js)
//   imagens                            cache primeiro; a app pré-carrega capas e logótipos
//
// Mudar um ficheiro da casca exige subir a versão de SHELL e o ?v= desse ficheiro (aqui e no index.html),
// senão os telemóveis ficam com a antiga.
const SHELL = 'baldio-app-shell-v5';
const IMG = 'baldio-app-img';

// relativos a este ficheiro: a app funciona em /app/ ou em qualquer outra pasta
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/styles.css?v=5',
  './assets/app.js?v=5',
  './assets/icon.png',
  './assets/icon-512.png',
  './vendor/d3.min.js',
  './vendor/topojson-client.min.js',
  '../assets/projection.js?v=5',
  '../data/base.topo.json',
];

self.addEventListener('install', (event) => {
  // um a um: um 404 não deve deixar a app sem service worker nenhum
  event.waitUntil(caches.open(SHELL).then(cache => Promise.all(SHELL_ASSETS.map(asset => cache.add(asset).catch((e) => {
    console.warn('não foi possível pôr em cache', asset, e);
  })))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith('baldio-app-shell-') && name !== SHELL).map(name => caches.delete(name))
  )));
  self.clients.claim();
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // opaque (imagens do baldio.eu sem CORS) também serve: o <img> mostra-a na mesma
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.endsWith('/projectos.json')) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then(cached => cached || fetch(request)));
  } else if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMG));
  } else {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
