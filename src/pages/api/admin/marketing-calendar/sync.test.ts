import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());
const runMarketingCalendarSync = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/admin/requireAdminRequest", () => ({
  requireAdminForRequest,
  adminAuthErrorBody: (auth: { error: string }) => ({ ok: false, error: auth.error }),
}));

vi.mock("../../../../lib/marketingCalendar/runSync", () => ({
  runMarketingCalendarSync,
}));

import { handleMarketingCalendarAdminSync } from "./sync";

const cookies = { get: () => undefined };

describe("marketing calendar admin sync", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
    runMarketingCalendarSync.mockReset();
  });

  it("rejects a request that is not the site owner before any sync", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });
    const response = await handleMarketingCalendarAdminSync(
      new Request("https://example.test/api/admin/marketing-calendar/sync", { method: "POST" }),
      cookies,
    );
    expect(response.status).toBe(401);
    expect(runMarketingCalendarSync).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ ok: false, error: "Sign in required." });
  });

  it("returns the sync result without credentials", async () => {
    requireAdminForRequest.mockResolvedValue({
      ok: true,
      member: { id: "mem_owner", email: "owner@example.test" },
      mode: "verified",
    });
    runMarketingCalendarSync.mockResolvedValue({
      ok: true,
      dryRun: false,
      created: 1,
      updated: 0,
      deleted: 0,
      writesPerformed: 1,
      calendar: { summary: "KIN marketing", timeZone: "America/Los_Angeles" },
      changes: [
        {
          action: "create",
          campaignId: "50",
          title: "October note",
          date: "2026-10-20",
          status: "scheduled",
          eventAt: "2026-10-20T09:00:00-07:00",
        },
      ],
      proposedDeletions: [],
      skippedConflicts: [],
    });
    const response = await handleMarketingCalendarAdminSync(
      new Request("https://example.test/api/admin/marketing-calendar/sync", { method: "POST" }),
      cookies,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, created: 1, updated: 0, deleted: 0 });
    expect(JSON.stringify(body)).not.toContain("private_key");
    expect(JSON.stringify(body)).not.toContain("Api-Token");
    expect(runMarketingCalendarSync).toHaveBeenCalledWith({ env: process.env, dryRun: false });
  });
});
