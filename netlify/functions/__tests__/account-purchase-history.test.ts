import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/member-auth.js", () => ({
  requireMember: vi.fn(),
}));

vi.mock("../../../src/lib/account/accountPurchaseHistory", () => ({
  loadAccountPurchaseHistory: vi.fn(),
}));

import handler from "../account-purchase-history";
import { requireMember } from "../lib/member-auth.js";
import { loadAccountPurchaseHistory } from "../../../src/lib/account/accountPurchaseHistory";

const VERIFIED_EMAIL = "jwt@example.com";

function makeRequest(url = "https://example.com/.netlify/functions/account-purchase-history", init?: RequestInit) {
  return new Request(url, init);
}

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({
    ok: true,
    member: { id: "mem_from_jwt", email: VERIFIED_EMAIL },
    mode: "verified",
  });
  vi.mocked(loadAccountPurchaseHistory).mockResolvedValue({
    orders: [
      {
        orderNumber: "#1502",
        orderDate: "Oct 2, 2026",
        paymentStatus: "Paid",
        fulfillmentStatus: "Fulfilled",
        items: [{ title: "Standard Gauge Knitting Machine", quantity: "1" }],
        trackingLinks: [],
      },
    ],
    syncNote: "New shop orders can take up to 6 hours to appear.",
    legacyNote: null,
    emailNote: "Guest checkout purchases appear when they use this account email.",
    legacyLink: "none",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("account-purchase-history Netlify function", () => {
  it("returns 401 when no token", async () => {
    vi.mocked(requireMember).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
    expect(loadAccountPurchaseHistory).not.toHaveBeenCalled();
  });

  it("uses the verified session email and ignores a spoofed customer", async () => {
    const res = await handler(
      makeRequest(
        "https://example.com/.netlify/functions/account-purchase-history?email=other-customer@example.com&memberId=mem_spoof&orderId=999",
        {
          headers: { Authorization: "Bearer good-token" },
        },
      ),
    );
    expect(res.status).toBe(200);
    expect(loadAccountPurchaseHistory).toHaveBeenCalledTimes(1);
    expect(loadAccountPurchaseHistory).toHaveBeenCalledWith(VERIFIED_EMAIL);
    expect(loadAccountPurchaseHistory).not.toHaveBeenCalledWith("other-customer@example.com");

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orders[0]?.items[0]?.title).toBe("Standard Gauge Knitting Machine");
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("memberId");
    expect(JSON.stringify(body)).not.toContain("other-customer@example.com");
    expect(JSON.stringify(body)).not.toContain("mem_spoof");
    expect(JSON.stringify(body)).not.toContain("/watson/");
  });

  it("rejects non-GET methods", async () => {
    const res = await handler(
      makeRequest("https://example.com/.netlify/functions/account-purchase-history", {
        method: "POST",
        headers: { Authorization: "Bearer good-token" },
        body: JSON.stringify({ email: "other-customer@example.com" }),
      }),
    );
    expect(res.status).toBe(405);
    expect(loadAccountPurchaseHistory).not.toHaveBeenCalled();
  });

  it("does not invent purchases when the loader fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(loadAccountPurchaseHistory).mockRejectedValue(new Error("boom"));
    const res = await handler(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.orders).toBeUndefined();
    spy.mockRestore();
  });
});
