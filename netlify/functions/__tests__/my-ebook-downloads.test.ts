import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/member-auth.js", () => ({
  requireMember: vi.fn(),
}));

vi.mock("../../../src/lib/legacy/legacyEbookOwnership", () => ({
  resolveLegacyEbookEntitlementsForEmail: vi.fn(),
}));

vi.mock("../../../src/lib/downloads/paidDownloadEntitlements", () => ({
  listPaidDownloadCustomerEntitlementsForEmail: vi.fn(),
}));

import handler from "../my-ebook-downloads";
import { requireMember } from "../lib/member-auth.js";
import { listPaidDownloadCustomerEntitlementsForEmail } from "../../../src/lib/downloads/paidDownloadEntitlements";
import { resolveLegacyEbookEntitlementsForEmail } from "../../../src/lib/legacy/legacyEbookOwnership";

const VERIFIED_ID = "mem_from_jwt";
const VERIFIED_EMAIL = "jwt@example.com";

function makeRequest(
  url = "https://example.com/.netlify/functions/my-ebook-downloads",
  init?: RequestInit,
) {
  return new Request(url, init);
}

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({
    ok: true,
    member: { id: VERIFIED_ID, email: VERIFIED_EMAIL },
    mode: "verified",
  });
  vi.mocked(resolveLegacyEbookEntitlementsForEmail).mockReturnValue([
    {
      itemId: "416",
      title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
      downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
    },
  ]);
  vi.mocked(listPaidDownloadCustomerEntitlementsForEmail).mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("my-ebook-downloads Netlify function", () => {
  it("returns 401 when logged out", async () => {
    vi.mocked(requireMember).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
    expect(resolveLegacyEbookEntitlementsForEmail).not.toHaveBeenCalled();
    expect(listPaidDownloadCustomerEntitlementsForEmail).not.toHaveBeenCalled();
  });

  it("lets a logged-in non-member retrieve download URLs (login only)", async () => {
    const res = await handler(
      makeRequest(undefined, {
        headers: { Authorization: "Bearer good-token" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ebooks).toEqual([
      {
        itemId: "416",
        title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
        downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
      },
    ]);
    expect(body.downloads).toEqual(body.ebooks);
    expect(resolveLegacyEbookEntitlementsForEmail).toHaveBeenCalledWith(
      VERIFIED_EMAIL,
    );
  });

  it("still returns legacy ebooks when the account has no paid-download entitlement", async () => {
    const res = await handler(makeRequest());
    const body = await res.json();
    expect(body.ebooks).toEqual([
      {
        itemId: "416",
        title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
        downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
      },
    ]);
    expect(listPaidDownloadCustomerEntitlementsForEmail).toHaveBeenCalledWith(
      VERIFIED_EMAIL,
    );
  });

  it("unions Charting Rulers with legacy ebooks for a matching entitlement email", async () => {
    vi.mocked(listPaidDownloadCustomerEntitlementsForEmail).mockResolvedValue([
      {
        itemId: "printable:charting-rulers",
        title: "Printable Gauge Rulers",
        downloadUrl: "/downloads/shop/gauge-rulers.pdf",
      },
    ]);

    const res = await handler(makeRequest());
    const body = await res.json();
    expect(body.ebooks).toEqual([
      {
        itemId: "416",
        title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
        downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
      },
      {
        itemId: "printable:charting-rulers",
        title: "Printable Gauge Rulers",
        downloadUrl: "/downloads/shop/gauge-rulers.pdf",
      },
    ]);
  });

  it("does not add Charting Rulers when paid-download lookup is for a different email", async () => {
    vi.mocked(listPaidDownloadCustomerEntitlementsForEmail).mockImplementation(
      async (email) => {
        if (email === VERIFIED_EMAIL) return [];
        return [
          {
            itemId: "printable:charting-rulers",
            title: "Printable Gauge Rulers",
            downloadUrl: "/downloads/shop/gauge-rulers.pdf",
          },
        ];
      },
    );

    const res = await handler(makeRequest());
    const body = await res.json();
    expect(body.ebooks).toEqual([
      {
        itemId: "416",
        title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
        downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
      },
    ]);
    expect(listPaidDownloadCustomerEntitlementsForEmail).toHaveBeenCalledWith(
      VERIFIED_EMAIL,
    );
  });

  it("ignores arbitrary email query parameters", async () => {
    const res = await handler(
      makeRequest(
        "https://example.com/.netlify/functions/my-ebook-downloads?email=spoof@example.com",
        { headers: { Authorization: "Bearer good-token" } },
      ),
    );
    expect(res.status).toBe(200);
    expect(resolveLegacyEbookEntitlementsForEmail).toHaveBeenCalledWith(
      VERIFIED_EMAIL,
    );
    expect(resolveLegacyEbookEntitlementsForEmail).not.toHaveBeenCalledWith(
      "spoof@example.com",
    );
    expect(listPaidDownloadCustomerEntitlementsForEmail).toHaveBeenCalledWith(
      VERIFIED_EMAIL,
    );
  });

  it("returns an empty list when the verified email has no purchases", async () => {
    vi.mocked(resolveLegacyEbookEntitlementsForEmail).mockReturnValue([]);
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ebooks).toEqual([]);
    expect(body.downloads).toEqual([]);
  });

  it("still returns legacy ebooks if paid-download storage fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listPaidDownloadCustomerEntitlementsForEmail).mockRejectedValue(
      new Error("blobs unavailable"),
    );

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ebooks).toEqual([
      {
        itemId: "416",
        title: "Cheat Sheets for Hand Manipulated Stitch Patterns",
        downloadUrl: "/downloads/shop/cheet_sheet_book2.pdf",
      },
    ]);
    errorSpy.mockRestore();
  });

  it("customer response contains no PII, price, transaction ID, or local path", async () => {
    const res = await handler(makeRequest());
    const body = await res.json();
    const payload = JSON.stringify(body);
    expect(payload).not.toMatch(/storageKey|PurchaseDate|PricePerItem/i);
    expect(payload).not.toMatch(/E:\\|backup_kin|public\\downloads/i);
    expect(body.ebooks[0].downloadUrl).toMatch(/^\/downloads\/shop\//);
  });
});
