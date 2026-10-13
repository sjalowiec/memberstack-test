import { describe, expect, it } from "vitest";

import { listCampaigns } from "./activeCampaignCampaigns";
import { MarketingCalendarError } from "./errors";

const config = { apiKey: "test-key", baseUrl: "https://example.test" };

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ActiveCampaign campaign list", () => {
  it("stops when a page ends before the reported total", async () => {
    await expect(
      listCampaigns(config, {
        sleep: async () => undefined,
        fetchImpl: async () =>
          json({
            meta: { total: "100" },
            campaigns: [{ id: "1", type: "single", status: "0", name: "Only" }],
          }),
      }),
    ).rejects.toBeInstanceOf(MarketingCalendarError);
  });

  it("reads a short final page", async () => {
    const campaigns = await listCampaigns(config, {
      sleep: async () => undefined,
      fetchImpl: async () =>
        json({
          meta: { total: "1" },
          campaigns: [{ id: "1", type: "single", status: "1", name: "One", scheduleddate: null }],
        }),
    });
    expect(campaigns).toHaveLength(1);
  });
});
