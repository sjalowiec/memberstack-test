import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../membership/membershipStatusClient", () => ({
  getMembershipStatusAuthHeaders: vi.fn(),
}));

import { getMembershipStatusAuthHeaders } from "../membership/membershipStatusClient";
import {
  ACCOUNT_EMAIL_SUBSCRIPTION_API_PATH,
  fetchAccountEmailSubscriptionStatus,
  resubscribeAccountEmailUpdates,
} from "./accountEmailSubscriptionClient";

describe("accountEmailSubscriptionClient", () => {
  const fetchImpl = vi.fn();

  beforeEach(() => {
    vi.mocked(getMembershipStatusAuthHeaders).mockResolvedValue({
      Authorization: "Bearer session-token",
    });
    vi.stubGlobal("fetch", fetchImpl);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("checks status with the session token and no email parameter", async () => {
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, state: "active", canResubscribe: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchAccountEmailSubscriptionStatus();
    expect(result.state).toBe("active");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_API_PATH);
    expect(url).not.toMatch(/email=/i);
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ Authorization: "Bearer session-token" });
    expect(JSON.stringify(init)).not.toMatch(/spoof|@example\.com/i);
  });

  it("posts an empty JSON body and cannot substitute another email address", async () => {
    fetchImpl.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          state: "active",
          message: "You’re now subscribed to Knit It Now emails.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await resubscribeAccountEmailUpdates();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_API_PATH);
    expect(url).not.toMatch(/email=/i);
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(String(init.body)).not.toMatch(/email/i);
  });
});
