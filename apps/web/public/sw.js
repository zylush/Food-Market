const SHELL_CACHE = "foodiesfeed-shell-v1";
const SHELL_ASSETS = [
  "/en",
  "/nl",
  "/de",
  "/fr",
  "/offline/en.html",
  "/offline/nl.html",
  "/offline/de.html",
  "/offline/fr.html",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/manifest.webmanifest",
];
const NETWORK_ONLY_PREFIXES = [
  "/api/v1/demo-session",
  "/api/v1/searches",
  "/api/v1/entitlements",
  "/api/v1/billing",
  "/api/v1/webhooks",
];

function isNetworkOnly(pathname) {
  if (pathname.startsWith("/api/")) return true;
  return NETWORK_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    /^\/api\/v1\/products\/[^/]+\/nutrition(?:\/|$)/u.test(pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset)))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || isNetworkOnly(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const locale = ["en", "nl", "de", "fr"].find((candidate) =>
            url.pathname === `/${candidate}` || url.pathname.startsWith(`/${candidate}/`),
          ) ?? "en";
          return (await caches.match(request)) ?? (await caches.match(`/offline/${locale}.html`)) ?? Response.error();
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      const copy = response.clone();
      void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      return response;
    })));
  }
});
