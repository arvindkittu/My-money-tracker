const C = "my-money-v5";
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
const F = ["./", "./index.html", "./app.js", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(async c => { await c.addAll(F); try { await c.put(CDN, await fetch(CDN, { mode: "no-cors" })); } catch (_) {} })); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))));
  self.clients.claim();
});
// Network-first with a 3 s timeout, then cache, so a weak connection never hangs the app
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.hostname === "cdn.jsdelivr.net") { // pinned library: cache-first so the app starts offline
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); return res; })));
    return;
  }
  if (u.origin !== location.origin) return;
  const net = fetch(r, { cache: "no-store" }).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); }
    return res;
  });
  const wait = new Promise((_, rej) => setTimeout(rej, 3000));
  e.respondWith(Promise.race([net, wait]).catch(async () =>
    (await caches.match(r, { ignoreSearch: true })) || (r.mode === "navigate" && (await caches.match("./index.html"))) || net));
});
