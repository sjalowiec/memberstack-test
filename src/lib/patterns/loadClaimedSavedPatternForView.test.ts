import { describe, expect, it, vi } from "vitest";
import { ensureClaimedSavedPatternHydratedForView } from "./loadClaimedSavedPatternForView";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

import { testAccess } from "./patternAccessTestFixtures";

const CLAIMED_ID = "67f872ca-a330-409a-a13c-ce973bc72a12";

const FREE_CLAIMED_ACCESS = testAccess({
  loggedIn: true,
  memberId: "mem_free",
  hasSystemAccess: false,
  freeClaimed: true,
  freeClaimedPatternId: CLAIMED_ID,
});

function deps(overrides: Parameters<typeof ensureClaimedSavedPatternHydratedForView>[0] = {}) {
  return {
    isEditing: () => false,
    waitForMemberstack: vi.fn(async () => true),
    resolveAccess: vi.fn(async () => FREE_CLAIMED_ACCESS),
    loadProject: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}

describe("ensureClaimedSavedPatternHydratedForView", () => {
  it("loads the claimed pattern by id when no saved project is linked (the bug scenario)", async () => {
    // logged-in, no plan, freeClaimed, claimedPatternId present, active edit session cleared.
    const loadProject = vi.fn(async () => ({ ok: true }));
    const d = deps({ isEditing: () => false, loadProject });

    const result = await ensureClaimedSavedPatternHydratedForView(d);

    expect(result).toBe("loaded");
    // It must load the claimedPatternId from the access snapshot — never a stale local active id.
    expect(loadProject).toHaveBeenCalledTimes(1);
    expect(loadProject).toHaveBeenCalledWith(CLAIMED_ID);
  });

  it("waits for Memberstack before resolving access (no false logged-out at boot)", async () => {
    const order: string[] = [];
    const waitForMemberstack = vi.fn(async () => {
      order.push("wait");
      return true;
    });
    const resolveAccess = vi.fn(async () => {
      order.push("resolve");
      return FREE_CLAIMED_ACCESS;
    });

    await ensureClaimedSavedPatternHydratedForView(
      deps({ waitForMemberstack, resolveAccess }),
    );

    expect(order).toEqual(["wait", "resolve"]);
  });

  it("does nothing when a saved project is already linked (normal View/Open flow)", async () => {
    const resolveAccess = vi.fn(async () => FREE_CLAIMED_ACCESS);
    const loadProject = vi.fn(async () => ({ ok: true }));

    const result = await ensureClaimedSavedPatternHydratedForView(
      deps({ isEditing: () => true, resolveAccess, loadProject }),
    );

    expect(result).toBe("active-project-present");
    // No access read and no reload — the active project already drives the render.
    expect(resolveAccess).not.toHaveBeenCalled();
    expect(loadProject).not.toHaveBeenCalled();
  });

  it("does not reload for members / system-access users (paid behaviour unchanged)", async () => {
    const loadProject = vi.fn(async () => ({ ok: true }));
    const result = await ensureClaimedSavedPatternHydratedForView(
      deps({
        resolveAccess: async () =>
          testAccess({
            loggedIn: true,
            memberId: "mem_paid",
            hasSystemAccess: true,
            freeClaimed: true,
            freeClaimedPatternId: CLAIMED_ID,
          }),
        loadProject,
      }),
    );

    expect(result).toBe("has-system-access");
    expect(loadProject).not.toHaveBeenCalled();
  });

  it("does nothing for logged-out visitors", async () => {
    const loadProject = vi.fn(async () => ({ ok: true }));
    const result = await ensureClaimedSavedPatternHydratedForView(
      deps({
        resolveAccess: async () =>
          testAccess({ loggedIn: false, hasSystemAccess: false, freeClaimed: false }),
        loadProject,
      }),
    );

    expect(result).toBe("logged-out");
    expect(loadProject).not.toHaveBeenCalled();
  });

  it("does nothing when the account has no claimed pattern id (e.g. building their first pattern)", async () => {
    const loadProject = vi.fn(async () => ({ ok: true }));
    const result = await ensureClaimedSavedPatternHydratedForView(
      deps({
        resolveAccess: async () =>
          testAccess({
            loggedIn: true,
            memberId: "mem_free",
            hasSystemAccess: false,
            freeClaimed: false,
          }),
        loadProject,
      }),
    );

    expect(result).toBe("no-claimed-pattern");
    expect(loadProject).not.toHaveBeenCalled();
  });

  it("reports load-failed when the by-id reload fails (view shows an error, not infinite loading)", async () => {
    const result = await ensureClaimedSavedPatternHydratedForView(
      deps({ loadProject: async () => ({ ok: false }) }),
    );

    expect(result).toBe("load-failed");
  });

  it("loads only the claimed pattern for the requested pattern system", async () => {
    const loadProject = vi.fn(async () => ({ ok: true }));
    const dropShoulderClaimed = testAccess({
      loggedIn: true,
      memberId: "mem_free",
      hasSystemAccess: false,
      claimedSystem: "drop-shoulder",
      freeClaimed: true,
      freeClaimedPatternId: "pat_ds",
    });

    const result = await ensureClaimedSavedPatternHydratedForView(
      deps({
        patternSystem: "sleeveless",
        resolveAccess: async () => dropShoulderClaimed,
        loadProject,
      }),
    );

    expect(result).toBe("no-claimed-pattern");
    expect(loadProject).not.toHaveBeenCalled();
  });

  it("does not enable starting a second pattern — it only reloads the existing claimed pattern", async () => {
    // The guard's only network action is loading the ALREADY-claimed pattern by id; it never creates
    // a new project. Assert it is called exactly once with the claimed id and returns "loaded".
    const loadProject = vi.fn(async () => ({ ok: true }));
    const result = await ensureClaimedSavedPatternHydratedForView(deps({ loadProject }));

    expect(result).toBe("loaded");
    expect(loadProject).toHaveBeenCalledTimes(1);
    expect(loadProject).toHaveBeenCalledWith(CLAIMED_ID);
  });
});
