const NETWORK_ONLY_PREFIXES = [
  "/api/v1/demo-session",
  "/api/v1/searches",
  "/api/v1/entitlements",
  "/api/v1/billing",
  "/api/v1/webhooks",
] as const;

export function isNetworkOnlyPath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return true;
  if (NETWORK_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  return /^\/api\/v1\/products\/[^/]+\/nutrition(?:\/|$)/u.test(pathname);
}
