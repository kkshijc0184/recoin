// Service worker minimo: no cachea nada (la app necesita internet para
// conectarse a Supabase), solo existe para cumplir el requisito de Chrome
// en Android que permite instalar el sitio como app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
