/**
 * Customer-safe tracking links from Shopify fulfillments and legacy item rows.
 * Shopify destination addresses are never read or stored.
 */

export interface OrderTrackingLink {
  label: string;
  url: string | null;
  trackingNumber: string | null;
}

export interface ShopifyFulfillmentTrackingSource {
  status?: string | null;
  tracking_company?: string | null;
  tracking_number?: string | null;
  tracking_numbers?: Array<string | null> | null;
  tracking_url?: string | null;
  tracking_urls?: Array<string | null> | null;
}

const HIDDEN_FULFILLMENT_STATUSES = new Set(["cancelled", "canceled", "failure", "error"]);

function cleanText(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

/** Tracking numbers are carrier codes, not emails or free-form notes. */
export function cleanTrackingNumber(value: string | null | undefined): string | null {
  const cleaned = cleanText(value, 40);
  if (!cleaned) return null;
  if (cleaned.includes("@") || /\s/.test(cleaned)) return null;
  if (!/^[A-Za-z0-9-]+$/.test(cleaned)) return null;
  if (!/\d/.test(cleaned) || cleaned.length < 6) return null;
  return cleaned;
}

/** Accept only ordinary http(s) links. Reject scriptable or credentialed URLs. */
export function sanitizeTrackingUrl(value: string | null | undefined): string | null {
  const raw = cleanText(value, 500);
  if (!raw || raw.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

export function carrierTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const number = cleanTrackingNumber(trackingNumber);
  const company = cleanText(carrier, 80);
  if (!number || !company) return null;
  const encoded = encodeURIComponent(number);
  if (/\bups\b/i.test(company)) {
    return `https://www.ups.com/track?tracknum=${encoded}`;
  }
  if (/\bfedex\b/i.test(company)) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
  }
  if (/\busps\b|united states postal/i.test(company)) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
  }
  if (/\bdhl\b/i.test(company)) {
    return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encoded}`;
  }
  return null;
}

function trackingLabel(carrier: string | null, hasUrl: boolean): string {
  if (carrier) return `Track with ${carrier}`;
  return hasUrl ? "Track package" : "Tracking number";
}

function rememberLink(
  links: OrderTrackingLink[],
  seen: Set<string>,
  link: OrderTrackingLink,
): void {
  const key = (link.url ?? `num:${link.trackingNumber ?? ""}`).toLowerCase();
  if (!key || seen.has(key)) return;
  seen.add(key);
  links.push(link);
}

export function mapShopifyFulfillmentTracking(
  fulfillments: ShopifyFulfillmentTrackingSource[] | null | undefined,
): OrderTrackingLink[] {
  const links: OrderTrackingLink[] = [];
  const seen = new Set<string>();
  for (const fulfillment of fulfillments ?? []) {
    const status = cleanText(fulfillment.status, 40)?.toLowerCase() ?? "";
    if (status && HIDDEN_FULFILLMENT_STATUSES.has(status)) continue;
    const carrier = cleanText(fulfillment.tracking_company, 80);
    const numbers = [fulfillment.tracking_number, ...(fulfillment.tracking_numbers ?? [])]
      .map((value) => cleanTrackingNumber(value))
      .filter((value): value is string => Boolean(value));
    const urls = [fulfillment.tracking_url, ...(fulfillment.tracking_urls ?? [])]
      .map((value) => sanitizeTrackingUrl(value))
      .filter((value): value is string => Boolean(value));

    if (urls.length > 0) {
      urls.forEach((url, index) => {
        rememberLink(links, seen, {
          url,
          label: trackingLabel(carrier, true),
          trackingNumber: numbers[index] ?? numbers[0] ?? null,
        });
      });
      continue;
    }

    for (const number of numbers) {
      const url = carrierTrackingUrl(carrier, number);
      rememberLink(links, seen, {
        url,
        label: trackingLabel(carrier, Boolean(url)),
        trackingNumber: number,
      });
    }
  }
  return links;
}

export function legacyItemTrackingLink(input: {
  trackingNumber?: string | null;
  carrier?: string | null;
}): OrderTrackingLink | null {
  const trackingNumber = cleanTrackingNumber(input.trackingNumber);
  if (!trackingNumber) return null;
  const carrier = cleanText(input.carrier, 80);
  const url = carrierTrackingUrl(carrier, trackingNumber);
  return {
    url,
    label: trackingLabel(carrier, Boolean(url)),
    trackingNumber,
  };
}

export function dedupeTrackingLinks(links: Array<OrderTrackingLink | null | undefined>): OrderTrackingLink[] {
  const kept: OrderTrackingLink[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (!link) continue;
    const url = sanitizeTrackingUrl(link.url);
    const trackingNumber = cleanTrackingNumber(link.trackingNumber);
    if (!url && !trackingNumber) continue;
    rememberLink(kept, seen, {
      url,
      label: cleanText(link.label, 80) ?? trackingLabel(null, Boolean(url)),
      trackingNumber,
    });
  }
  return kept;
}

export function parseStoredTrackingLinks(value: unknown): OrderTrackingLink[] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return dedupeTrackingLinks(
    parsed.map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      return {
        label: typeof record.label === "string" ? record.label : "Track package",
        url: typeof record.url === "string" ? record.url : null,
        trackingNumber: typeof record.trackingNumber === "string" ? record.trackingNumber : null,
      };
    }),
  );
}
