import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const assets = (await readdir('dist/assets')).map(name => `assets/${name}`);
const html = await readFile('dist/index.html');
const version = createHash('sha256').update(html).digest('hex').slice(0, 12);
await writeFile('dist/sw.js', `
const CACHE = 'chonk-${version}';
const ROOT = new URL('./', self.location).href;
const FILES = ${JSON.stringify(['./', 'index.html', 'icon.svg', 'manifest.webmanifest', ...assets])};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new URL(file, ROOT).href))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('chonk-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(ROOT)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => response.ok ? response : caches.match(ROOT)).catch(() => caches.match(ROOT)));
  } else {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
`);
