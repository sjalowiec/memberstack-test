import { describe, expect, it } from "vitest";

import {
  carrierTrackingUrl,
  cleanTrackingNumber,
  mapShopifyFulfillmentTracking,
  parseStoredTrackingLinks,
  sanitizeTrackingUrl,
} from "./orderTrackingLinks";

describe("order tracking links", () => {
  it("keeps https tracking links and drops unsafe urls", () => {
    expect(sanitizeTrackingUrl("https://www.ups.com/track?tracknum=1Z999AA10123456784")).toContain(
      "ups.com",
    );
    expect(sanitizeTrackingUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeTrackingUrl("data:text/html,hi")).toBeNull();
    expect(sanitizeTrackingUrl("https://user:pass@ups.com/track")).toBeNull();
    expect(cleanTrackingNumber("not an email@example.com")).toBeNull();
  });

  it("maps Shopify tracking without keeping a destination address", () => {
    const links = mapShopifyFulfillmentTracking([
      {
        status: "success",
        tracking_company: "UPS",
        tracking_number: "1Z999AA10123456784",
        tracking_url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
      },
      {
        status: "cancelled",
        tracking_number: "1Z999AA10123456785",
        tracking_url: "https://www.ups.com/track?tracknum=cancelled",
      },
    ]);

    expect(links).toEqual([
      {
        label: "Track with UPS",
        url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
        trackingNumber: "1Z999AA10123456784",
      },
    ]);
    expect(JSON.stringify(links)).not.toContain("Main Street");
    expect(carrierTrackingUrl("FedEx", "123456789012")).toContain("fedex.com");
    expect(carrierTrackingUrl("Local courier", "123456789012")).toBeNull();
  });

  it("re-sanitizes stored links before they are shown", () => {
    expect(
      parseStoredTrackingLinks([
        { label: "Track package", url: "javascript:alert(1)", trackingNumber: "1Z999AA10123456784" },
        { label: "Track package", url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428490", trackingNumber: "9400111899223197428490" },
      ]).map((link) => link.url),
    ).toEqual([
      null,
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428490",
    ]);
  });
});
