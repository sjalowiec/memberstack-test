/**
 * Simple in-memory IP rate limiter (same approach as netlify/functions/contact.js).
 * Good enough for a small site; resets when the serverless instance recycles.
 */

export type IpRateLimitStore = Map<string, { count: number; resetAt: number }>;

declare global {
  // Shared with netlify/functions/contact.js rate-limit store.
  var __kbmRateLimit: IpRateLimitStore | undefined;
}

export type IpRateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "rate_limited" };

export type CheckIpRateLimitOptions = {
  ip: string;
  windowMs?: number;
  maxPerWindow?: number;
  now?: number;
  store?: IpRateLimitStore;
};

/** Default: 5 submissions per IP per minute (matches contact form). */
export function checkIpRateLimit(
  options: CheckIpRateLimitOptions,
): IpRateLimitResult {
  const windowMs = options.windowMs ?? 60_000;
  const maxPerWindow = options.maxPerWindow ?? 5;
  const now = options.now ?? Date.now();
  const store =
    options.store ?? (globalThis.__kbmRateLimit ??= new Map());

  const key = options.ip.trim() || "unknown";
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  entry.count += 1;
  store.set(key, entry);

  if (entry.count > maxPerWindow) {
    return { allowed: false, reason: "rate_limited" };
  }

  return { allowed: true };
}

/** Prefer Netlify's client IP header, then first X-Forwarded-For hop. */
export function getClientIpFromHeaders(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
