import { describe, expect, it, vi } from "vitest";

import { COMPLIMENTARY_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import {
  COMPLIMENTARY_PLAN_ID,
  decideComplimentaryPlanAction,
  runComplimentaryExpiry,
} from "./complimentaryExpiry";
import type { MemberstackMember } from "../membership/membershipSummary";

const COMPLIMENTARY = COMPLIMENTARY_MEMBERSHIPS.complimentaryMembership.memberstackPlanId;
const PAID = MEMBERSHIPS.membership.memberstackPlanId;
const TODAY = "2026-07-22";

function member(planIds: string[]): MemberstackMember {
  return {
    id: "mem_comp",
    auth: { email: "comp@example.com" },
    planConnections: planIds.map((planId) => ({
      planId,
      status: "ACTIVE",
      active: true,
    })),
  };
}

describe("complimentary expiry cleanup", () => {
  it("removes only the complimentary plan id", () => {
    expect(COMPLIMENTARY_PLAN_ID).toBe(COMPLIMENTARY);
    expect(decideComplimentaryPlanAction(member([COMPLIMENTARY, PAID]))).toBe("remove");
    expect(decideComplimentaryPlanAction(member([PAID]))).toBe("already_removed");
  });

  it("keeps the access-through day and removes the plan the next day", async () => {
    const removeComplimentaryPlan = vi.fn(async () => undefined);
    const kept = await runComplimentaryExpiry({
      dryRun: false,
      now: new Date("2026-07-22T19:00:00.000Z"),
      loadExpiredRows: async (today) => {
        expect(today).toBe(TODAY);
        return [];
      },
      loadMember: async () => member([COMPLIMENTARY]),
      removeComplimentaryPlan,
    });
    expect(kept.complimentaryPlansRemoved).toBe(0);
    expect(removeComplimentaryPlan).not.toHaveBeenCalled();

    const removed = await runComplimentaryExpiry({
      dryRun: false,
      now: new Date("2026-07-22T19:00:00.000Z"),
      loadExpiredRows: async () => [
        { memberstack_id: "mem_comp", access_through: "2026-07-21" },
      ],
      loadMember: async () => member([COMPLIMENTARY, PAID]),
      removeComplimentaryPlan,
    });
    expect(removed.complimentaryPlansRemoved).toBe(1);
    expect(removeComplimentaryPlan).toHaveBeenCalledTimes(1);
    expect(removeComplimentaryPlan).toHaveBeenCalledWith("mem_comp", COMPLIMENTARY);
  });
});
