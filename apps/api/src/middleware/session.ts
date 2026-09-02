import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

function digest(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signDemoSession(userId: string, secret: string, issuedAt = Date.now()): string {
  const payload = `${userId}.${issuedAt}`;
  return `${payload}.${digest(payload, secret)}`;
}

export function verifyDemoSession(value: string | undefined, secret: string, maxAgeMs = 30 * 24 * 60 * 60 * 1000): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedAtText, signature] = parts;
  if (!userId || !issuedAtText || !signature || !/^\d+$/u.test(issuedAtText)) return null;
  const issuedAt = Number(issuedAtText);
  if (!Number.isSafeInteger(issuedAt) || Date.now() - issuedAt > maxAgeMs || issuedAt - Date.now() > 60_000) return null;
  const expected = digest(`${userId}.${issuedAtText}`, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return userId;
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function serializeSessionCookie(name: string, value: string, secure: boolean): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
