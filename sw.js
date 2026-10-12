/* Natário Advocacia — cache do app para abrir rápido (dados sempre vêm do servidor) */
const VERSAO = "natario-v1";
const ARQUIVOS = ["./", "index.html", "style.css", "config.js", "calc-logica.js", "app.js", "ferramentas.js", "importar.js",
  "logo.png", "logo-claro.png", "manifest.webmanifest", "icones/icon-192.png", "icones/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // API e CDNs: direto na rede
  // rede primeiro (pega atualizações), cache se estiver sem internet
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(VERSAO).then((x) => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});
