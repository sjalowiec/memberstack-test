import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../config/memberships";
import {
  decideHeaderAuthPublish,
  decideSharedMemberAccessPublish,
  isSharedMemberstackPayloadResolved,
  memberstackPlanConnections,
} from "./sharedMemberAccessPublish";

const PAID = MEMBERSHIPS.membership.memberstackPlanId;

const granted = {
  hasMemberAccess: true,
  viewerAccessState: "memberAccess" as const,
};

const deniedGuest = {
  hasMemberAccess: false,
  viewerAccessState: "loggedOut" as const,
};

function paidMember(id = "mem_1") {
  return {
    data: {
      id,
      auth: { email: "member@knititnow.com" },
      planConnections: [{ planId: PAID, status: "ACTIVE" }],
    },
  };
}

function loggedInWithoutPlans(id = "mem_1") {
  return {
    data: {
      id,
      auth: { email: "member@knititnow.com" },
    },
  };
}

function confirmedGuest() {
  return { data: { member: null } };
}

const baseLayout = readFileSync(resolve("src/layouts/BaseLayout.astro"), "utf8");
const header = readFileSync(resolve("src/components/Header.astro"), "utf8");

describe("isSharedMemberstackPayloadResolved", () => {
  it("treats null as pending even after the SDK is ready", () => {
    expect(isSharedMemberstackPayloadResolved(null, true)).toBe(false);
    expect(isSharedMemberstackPayloadResolved(undefined, true)).toBe(false);
  });

  it("does not treat a confirmed-looking guest payload as resolved until the SDK is ready", () => {
    expect(isSharedMemberstackPayloadResolved(confirmedGuest(), false)).toBe(false);
    expect(isSharedMemberstackPayloadResolved(confirmedGuest(), true)).toBe(true);
  });

  it("treats a logged-in member missing planConnections as incomplete", () => {
    expect(memberstackPlanConnections(loggedInWithoutPlans())).toBeUndefined();
    expect(isSharedMemberstackPayloadResolved(loggedInWithoutPlans(), true)).toBe(false);
  });

  it("treats a logged-in member with an empty planConnections array as resolved", () => {
    const payload = { data: { id: "mem_1", planConnections: [] } };
    expect(memberstackPlanConnections(payload)).toEqual([]);
    expect(isSharedMemberstackPayloadResolved(payload, true)).toBe(true);
  });
});

describe("decideSharedMemberAccessPublish", () => {
  it("does not publish loggedOut from an empty or incomplete result", () => {
    expect(
      decideSharedMemberAccessPublish({
        payload: null,
        memberstackReady: false,
      }),
    ).toEqual({ action: "pending" });
    expect(
      decideSharedMemberAccessPublish({
        payload: null,
        memberstackReady: true,
      }),
    ).toEqual({ action: "pending" });
    expect(
      decideSharedMemberAccessPublish({
        payload: confirmedGuest(),
        memberstackReady: false,
      }),
    ).toEqual({ action: "pending" });
    expect(
      decideSharedMemberAccessPublish({
        payload: loggedInWithoutPlans(),
        memberstackReady: true,
      }),
    ).toEqual({ action: "pending" });
  });

  it("publishes loggedOut for a genuine guest after Memberstack is ready", () => {
    expect(
      decideSharedMemberAccessPublish({
        payload: confirmedGuest(),
        memberstackReady: true,
      }),
    ).toEqual({
      action: "publish",
      snapshot: deniedGuest,
    });
  });

  it("publishes loggedInNoAccess for a resolved logged-in member with no valid plan", () => {
    expect(
      decideSharedMemberAccessPublish({
        payload: { data: { id: "mem_free", planConnections: [] } },
        memberstackReady: true,
      }),
    ).toEqual({
      action: "publish",
      snapshot: {
        hasMemberAccess: false,
        viewerAccessState: "loggedInNoAccess",
      },
    });
  });

  it("publishes member access for a paid member", () => {
    expect(
      decideSharedMemberAccessPublish({
        payload: paidMember(),
        memberstackReady: true,
      }),
    ).toEqual({
      action: "publish",
      snapshot: granted,
    });
  });

  it("does not downgrade a confirmed grant because of a later empty result", () => {
    expect(
      decideSharedMemberAccessPublish({
        payload: null,
        memberstackReady: true,
        currentSnapshot: granted,
      }),
    ).toEqual({ action: "pending" });
    expect(
      decideSharedMemberAccessPublish({
        payload: confirmedGuest(),
        memberstackReady: true,
        currentSnapshot: granted,
      }),
    ).toEqual({ action: "pending" });
  });

  it("does not downgrade a confirmed grant when planConnections are missing", () => {
    expect(
      decideSharedMemberAccessPublish({
        payload: loggedInWithoutPlans(),
        memberstackReady: true,
        currentSnapshot: granted,
      }),
    ).toEqual({ action: "pending" });
  });

  it("stays granted across repeated refresh events that still have access", () => {
    const first = decideSharedMemberAccessPublish({
      payload: paidMember(),
      memberstackReady: true,
    });
    expect(first).toEqual({ action: "publish", snapshot: granted });
    const again = decideSharedMemberAccessPublish({
      payload: paidMember(),
      memberstackReady: true,
      currentSnapshot: granted,
    });
    expect(again).toEqual({ action: "publish", snapshot: granted });
    const emptyRefresh = decideSharedMemberAccessPublish({
      payload: null,
      memberstackReady: true,
      currentSnapshot: granted,
    });
    expect(emptyRefresh).toEqual({ action: "pending" });
  });

  it("publishes loggedOut on an explicit logout event unless preview bypass is on", () => {
    expect(
      decideSharedMemberAccessPublish({
        payload: null,
        memberstackReady: true,
        currentSnapshot: granted,
        logoutEvent: true,
      }),
    ).toEqual({
      action: "publish",
      snapshot: deniedGuest,
    });
    expect(
      decideSharedMemberAccessPublish({
        payload: null,
        memberstackReady: true,
        currentSnapshot: granted,
        logoutEvent: true,
        bypassOn: true,
      }),
    ).toEqual({
      action: "publish",
      snapshot: granted,
    });
  });

  it("still publishes the localhost preview grant while Memberstack is pending", () => {
    expect(
      decideSharedMemberAccessPublish({
        payload: null,
        memberstackReady: false,
        bypassOn: true,
      }),
    ).toEqual({
      action: "publish",
      snapshot: granted,
    });
  });
});

describe("decideHeaderAuthPublish", () => {
  it("does not override a BaseLayout grant with a false guest state", () => {
    expect(
      decideHeaderAuthPublish({
        payload: null,
        snapshot: granted,
      }),
    ).toEqual({
      applyWindowState: false,
      windowState: null,
      label: "keep",
      dispatchAuthUpdated: false,
    });
    expect(
      decideHeaderAuthPublish({
        payload: confirmedGuest(),
        snapshot: granted,
      }),
    ).toEqual({
      applyWindowState: false,
      windowState: null,
      label: "keep",
      dispatchAuthUpdated: false,
    });
    expect(
      decideHeaderAuthPublish({
        payload: loggedInWithoutPlans(),
        snapshot: granted,
      }),
    ).toEqual({
      applyWindowState: false,
      windowState: null,
      label: "keep",
      dispatchAuthUpdated: false,
    });
  });

  it("does not dispatch auth:updated from a null or incomplete getCurrentMember result", () => {
    expect(
      decideHeaderAuthPublish({ payload: null, snapshot: null }).dispatchAuthUpdated,
    ).toBe(false);
    expect(
      decideHeaderAuthPublish({
        payload: confirmedGuest(),
        snapshot: null,
      }).dispatchAuthUpdated,
    ).toBe(false);
    expect(
      decideHeaderAuthPublish({
        payload: loggedInWithoutPlans(),
        snapshot: null,
      }).dispatchAuthUpdated,
    ).toBe(false);
  });

  it("dispatches auth:updated for a resolved logged-in member", () => {
    const next = decideHeaderAuthPublish({
      payload: paidMember("mem_sue"),
      snapshot: granted,
    });
    expect(next.dispatchAuthUpdated).toBe(true);
    expect(next.applyWindowState).toBe(true);
    expect(next.windowState).toEqual({
      loggedIn: true,
      member: true,
      memberId: "mem_sue",
    });
    expect(next.label).toBe("loggedIn");
  });

  it("syncs guest chrome from a confirmed BaseLayout logged-out snapshot without dispatching", () => {
    const next = decideHeaderAuthPublish({
      payload: confirmedGuest(),
      snapshot: deniedGuest,
    });
    expect(next.dispatchAuthUpdated).toBe(false);
    expect(next.applyWindowState).toBe(true);
    expect(next.windowState).toEqual({
      loggedIn: false,
      member: false,
      memberId: null,
    });
    expect(next.label).toBe("guest");
  });
});

describe("shared publishers stay wired to the helper", () => {
  it("makes BaseLayout the snapshot publisher and skips a second Memberstack init", () => {
    expect(baseLayout).toContain("decideSharedMemberAccessPublish");
    expect(baseLayout).toContain("isSharedMemberstackPayloadResolved");
    expect(baseLayout).toContain('new CustomEvent("kin:member-access"');
    expect(baseLayout).not.toContain(
      "window.$memberstackDom?.init?.(window.memberstackConfig)",
    );
    expect(baseLayout).toMatch(
      /addEventListener\("pageshow"[\s\S]{0,80}refreshMemberAccess/,
    );
  });

  it("stops Header from publishing a guest auth:updated on its own", () => {
    expect(header).toContain("decideHeaderAuthPublish");
    expect(header).toContain("dispatchAuthUpdated");
    expect(header).toContain("window.__KIN_MEMBER_ACCESS__");
  });
});
