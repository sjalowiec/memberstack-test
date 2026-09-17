import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/member-auth.js", () => ({
  requireMember: vi.fn(),
}));

vi.mock("../lib/memberstack-admin.js", () => ({
  getMemberstackAdminClient: vi.fn(),
}));

vi.mock("../../../src/lib/account/accountEmailSubscription", () => ({
  checkAccountEmailSubscription: vi.fn(),
  resubscribeAccountEmailSubscription: vi.fn(),
  namesFromMemberstackRecord: vi.fn(),
  toPublicAccountEmailSubscriptionStatus: vi.fn((result) => result),
  toPublicAccountEmailSubscriptionResubscribe: vi.fn((result) => result),
}));

import handler from "../account-email-subscription";
import { requireMember } from "../lib/member-auth.js";
import { getMemberstackAdminClient } from "../lib/memberstack-admin.js";
import {
  checkAccountEmailSubscription,
  namesFromMemberstackRecord,
  resubscribeAccountEmailSubscription,
} from "../../../src/lib/account/accountEmailSubscription";

const VERIFIED_ID = "mem_from_jwt";
const VERIFIED_EMAIL = "jwt@example.com";

function makeRequest(
  url = "https://example.com/.netlify/functions/account-email-subscription",
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
  vi.mocked(getMemberstackAdminClient).mockReturnValue({
    getMember: vi.fn(async () => ({
      customFields: { "first-name": "Ada", "last-name": "Lovelace" },
    })),
  });
  vi.mocked(namesFromMemberstackRecord).mockReturnValue({
    firstName: "Ada",
    lastName: "Lovelace",
  });
  vi.mocked(checkAccountEmailSubscription).mockResolvedValue({
    ok: true,
    status: 200,
    state: "unsubscribed",
    canResubscribe: true,
  });
  vi.mocked(resubscribeAccountEmailSubscription).mockResolvedValue({
    ok: true,
    status: 200,
    state: "active",
    message: "You’re now subscribed to Knit It Now emails.",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("account-email-subscription Netlify function", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireMember).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
    expect(checkAccountEmailSubscription).not.toHaveBeenCalled();
    expect(resubscribeAccountEmailSubscription).not.toHaveBeenCalled();
  });

  it("GET uses the verified session email and ignores a spoofed query email", async () => {
    const res = await handler(
      makeRequest(
        "https://example.com/.netlify/functions/account-email-subscription?email=spoof@example.com",
        { headers: { Authorization: "Bearer good-token" } },
      ),
    );
    expect(res.status).toBe(200);
    expect(checkAccountEmailSubscription).toHaveBeenCalledTimes(1);
    expect(checkAccountEmailSubscription).toHaveBeenCalledWith(VERIFIED_EMAIL);
    expect(checkAccountEmailSubscription).not.toHaveBeenCalledWith("spoof@example.com");
    expect(resubscribeAccountEmailSubscription).not.toHaveBeenCalled();
  });

  it("POST uses the verified session email and ignores a body email", async () => {
    const res = await handler(
      makeRequest("https://example.com/.netlify/functions/account-email-subscription", {
        method: "POST",
        headers: {
          Authorization: "Bearer good-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "spoof@example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(resubscribeAccountEmailSubscription).toHaveBeenCalledTimes(1);
    expect(resubscribeAccountEmailSubscription).toHaveBeenCalledWith(VERIFIED_EMAIL, {
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(resubscribeAccountEmailSubscription).not.toHaveBeenCalledWith(
      "spoof@example.com",
      expect.anything(),
    );
  });

  it("does not auto-resubscribe on GET", async () => {
    await handler(makeRequest());
    expect(resubscribeAccountEmailSubscription).not.toHaveBeenCalled();
  });
});
