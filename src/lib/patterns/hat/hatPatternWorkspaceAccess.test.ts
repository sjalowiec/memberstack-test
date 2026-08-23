import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIPS } from "../../../config/memberships";
import { getViewerAccessState } from "../../memberAccess";
import { decidePatternMembershipGate } from "../patternMembershipPageGate";
import { LOGGED_OUT_SLEEVELESS_ACCESS } from "../sleevelessPatternSystemAccess";
import { hatPatternMyPatternsIsActive } from "./hatPatternMyPatternsAccess";
import {
  resolveHatPatternPersistNotice,
  shouldShowHatTemporaryPatternNotice,
} from "./hatPatternPersistNotice";
import {
  applyHatPatternWorkspaceChrome,
  decideHatPatternViewerAccessState,
  hatPatternHasMemberSavedProjectPrivileges,
  resolveHatPatternWorkspaceAccess,
  waitForHatPatternMemberstackPayload,
} from "./hatPatternWorkspaceAccess";

const hatPatternPageScript = readFileSync(resolve("src/scripts/hat-pattern-page.ts"), "utf8");
const hatWorkspaceAccessSource = readFileSync(
  resolve("src/lib/patterns/hat/hatPatternWorkspaceAccess.ts"),
  "utf8",
);
const hatPatternPage = readFileSync(resolve("src/pages/patterns/hat/pattern.astro"), "utf8");
const sleevelessPatternPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderPatternPage = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);
const hatSummaryPage = readFileSync(resolve("src/pages/patterns/hat/summary/index.astro"), "utf8");
const hatSummaryScript = readFileSync(resolve("src/scripts/hat-pattern-summary-page.ts"), "utf8");

function memberPayload(planId: string) {
  return {
    data: {
      id: "ms_member",
      planConnections: [{ planId, status: "ACTIVE", active: true }],
    },
  };
}

function loggedInNoPlansPayload() {
  return {
    data: {
      id: "ms_member",
      planConnections: [],
    },
  };
}

function chromeRoot() {
  const notice = { hidden: false };
  const membership = { hidden: false };
  const attrs = new Map<string, string>([
    ["aria-disabled", "true"],
    ["title", "Saving patterns is available with membership."],
  ]);
  const classSet = new Set<string>(["is-disabled"]);
  const btn = Object.assign(new HTMLButtonElement(), {
    disabled: false,
    dataset: {} as Record<string, string>,
    classList: {
      toggle: (name: string, force?: boolean) => {
        if (force) classSet.add(name);
        else if (force === false) classSet.delete(name);
        return classSet.has(name);
      },
      contains: (name: string) => classSet.has(name),
    },
    setAttribute: (k: string, v: string) => {
      attrs.set(k, v);
    },
    getAttribute: (k: string) => (attrs.has(k) ? attrs.get(k)! : null),
    removeAttribute: (k: string) => {
      attrs.delete(k);
    },
    hasAttribute: (k: string) => attrs.has(k),
  });
  const root = {
    querySelector(selector: string) {
      if (selector === "[data-hat-pattern-persist-notice]") return notice;
      if (selector === "[data-hat-pattern-persist-membership]") return membership;
      if (selector === "[data-hat-pattern-my-patterns]") return btn;
      return null;
    },
  };
  return {
    root: root as unknown as ParentNode,
    notice,
    membership,
    classSet,
    attrs,
  };
}

describe("Hat finished-pattern workspace access (free view vs member save)", () => {
  it("keeps free Hat viewable for logged-out visitors while showing the temporary-pattern upsell", () => {
    const access = resolveHatPatternWorkspaceAccess("loggedOut");
    expect(access.canViewPattern).toBe(true);
    expect(access.hasMemberSavedProjectPrivileges).toBe(false);
    expect(shouldShowHatTemporaryPatternNotice("loggedOut")).toBe(true);
    expect(hatPatternMyPatternsIsActive("loggedOut")).toBe(false);

    const notice = resolveHatPatternPersistNotice("loggedOut");
    expect(notice.showNotice).toBe(true);
    expect(notice.showMembershipCta).toBe(true);
    expect(notice.membershipPitch).toMatch(/Members can save/);
  });

  it("does not treat a free Hat as a non-member workspace for logged-in members", () => {
    const access = resolveHatPatternWorkspaceAccess("memberAccess");
    expect(access.canViewPattern).toBe(true);
    expect(access.hasMemberSavedProjectPrivileges).toBe(true);
    expect(shouldShowHatTemporaryPatternNotice("memberAccess")).toBe(false);
    expect(shouldShowHatTemporaryPatternNotice("memberAccess", false)).toBe(false);
    expect(hatPatternHasMemberSavedProjectPrivileges("memberAccess")).toBe(true);

    const notice = resolveHatPatternPersistNotice("memberAccess");
    expect(notice.showNotice).toBe(false);
    expect(notice.showMembershipCta).toBe(false);
    expect(notice.membershipPitch).toBeNull();
  });

  it("applies guest chrome: temporary notice + disabled My Patterns", () => {
    class FakeButton {}
    vi.stubGlobal("HTMLButtonElement", FakeButton);
    const { root, notice, membership, classSet, attrs } = chromeRoot();

    applyHatPatternWorkspaceChrome(root, "loggedOut");

    expect(notice.hidden).toBe(false);
    expect(membership.hidden).toBe(false);
    expect(classSet.has("is-disabled")).toBe(true);
    expect(attrs.get("aria-disabled")).toBe("true");
    expect(attrs.has("data-pattern-workspace-library-trigger")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("applies member chrome: hides upsell and enables saved-project controls", () => {
    class FakeButton {}
    vi.stubGlobal("HTMLButtonElement", FakeButton);
    const { root, notice, membership, classSet, attrs } = chromeRoot();

    applyHatPatternWorkspaceChrome(root, "memberAccess");

    expect(notice.hidden).toBe(true);
    expect(membership.hidden).toBe(true);
    expect(classSet.has("is-disabled")).toBe(false);
    expect(attrs.has("aria-disabled")).toBe(false);
    expect(attrs.get("data-pattern-workspace-library-trigger")).toBe("");
    vi.unstubAllGlobals();
  });

  it("keeps Hat rename available for a saved Hat project (not gated by free-pattern view)", () => {
    expect(hatSummaryPage).toContain("data-hat-edit-title");
    expect(hatSummaryScript).toContain("persistHatPatternProject");
    expect(hatSummaryScript).toContain("titleField.hidden = !showProjectDetails");
    expect(hatSummaryScript).toContain("hatSummaryShouldShowProjectDetails");
    expect(hatSummaryScript).not.toContain("shouldShowHatTemporaryPatternNotice");
    expect(hatSummaryScript).not.toContain("resolveHatPatternPersistNotice");
  });
});

describe("Hat member resolution does not use getCurrentMember plan-less snapshots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers getAppAndMember over a plan-less getCurrentMember payload", async () => {
    const getCurrentMember = vi.fn().mockResolvedValue(loggedInNoPlansPayload());
    const getAppAndMember = vi.fn().mockResolvedValue(
      memberPayload(MEMBERSHIPS.membership.memberstackPlanId),
    );
    vi.stubGlobal("window", {
      ...globalThis.window,
      $memberstackDom: { getCurrentMember, getAppAndMember },
      __KIN_MEMBER_ACCESS__: undefined,
    });

    const payload = await waitForHatPatternMemberstackPayload({ attempts: 2, delayMs: 0 });
    expect(getAppAndMember).toHaveBeenCalled();
    expect(getCurrentMember).not.toHaveBeenCalled();
    expect(getViewerAccessState(payload)).toBe("memberAccess");
  });

  it("retries getAppAndMember when the first payload is logged in without planConnections", async () => {
    const getAppAndMember = vi
      .fn()
      .mockResolvedValueOnce(loggedInNoPlansPayload())
      .mockResolvedValueOnce(memberPayload(MEMBERSHIPS.membership.memberstackPlanId));
    vi.stubGlobal("window", {
      ...globalThis.window,
      $memberstackDom: { getAppAndMember },
    });

    const payload = await waitForHatPatternMemberstackPayload({ attempts: 3, delayMs: 0 });
    expect(getAppAndMember).toHaveBeenCalledTimes(2);
    expect(getViewerAccessState(payload)).toBe("memberAccess");
  });

  it("does not let a plan-less getAppAndMember payload downgrade a memberAccess snapshot", () => {
    expect(
      decideHatPatternViewerAccessState({
        memberPayload: loggedInNoPlansPayload(),
        persistedSnapshot: { hasMemberAccess: true, viewerAccessState: "memberAccess" },
      }),
    ).toBe("memberAccess");
  });

  it("trusts a real persisted memberAccess snapshot and prefers Memberstack payloads", () => {
    expect(
      decideHatPatternViewerAccessState({
        persistedSnapshot: { hasMemberAccess: true, viewerAccessState: "memberAccess" },
      }),
    ).toBe("memberAccess");

    expect(
      decideHatPatternViewerAccessState({
        persistedSnapshot: { hasMemberAccess: false, viewerAccessState: "loggedOut" },
      }),
    ).toBe("loggedOut");

    expect(
      decideHatPatternViewerAccessState({
        memberPayload: memberPayload(MEMBERSHIPS.membership.memberstackPlanId),
        persistedSnapshot: { hasMemberAccess: false, viewerAccessState: "loggedOut" },
      }),
    ).toBe("memberAccess");
  });

  it("page wiring binds the shared access lifecycle and does not classify via getCurrentMember", () => {
    expect(hatPatternPageScript).toContain("bindHatPatternWorkspaceAccessLifecycle");
    expect(hatPatternPageScript).toContain("applyHatPatternWorkspaceChrome");
    expect(hatPatternPageScript).not.toContain("Confirm with getAppAndMember");
    expect(hatPatternPageScript).not.toContain("getCurrentMember");
    expect(hatWorkspaceAccessSource).toContain("kin:member-access");
    expect(hatWorkspaceAccessSource).toContain("auth:updated");
    expect(hatWorkspaceAccessSource).toContain("getAppAndMember");
    expect(hatWorkspaceAccessSource).toContain("getCurrentMember can return");
    expect(hatWorkspaceAccessSource).not.toMatch(/ms\?\.getCurrentMember/);
    expect(hatWorkspaceAccessSource).not.toContain("localMemberPreviewBypass");
  });
});

describe("sweater member behavior remains unchanged", () => {
  it("Sleeveless and Drop Shoulder finished pages stay membership-gated", () => {
    expect(sleevelessPatternPage).toContain("SleevelessPatternMemberGate");
    expect(dropShoulderPatternPage).toContain("SleevelessPatternMemberGate");
    expect(hatPatternPage).not.toContain("SleevelessPatternMemberGate");
    expect(hatPatternPage).not.toContain("PatternBuilderAccountGate");
    expect(hatPatternPage).not.toContain("initPatternMembershipPageGate");
    expect(hatPatternPage).toMatch(/free\s*\/\s*ungated/i);
    expect(hatSummaryPage).not.toContain("SleevelessPatternMemberGate");
    expect(hatSummaryPage).not.toContain("PatternBuilderAccountGate");
    expect(hatSummaryScript).not.toContain("SleevelessPatternMemberGate");
    expect(hatSummaryScript).toContain("resolveHatPatternLeadContinue");
  });

  it("sweater membership gate still unlocks logged-in members", () => {
    expect(
      decidePatternMembershipGate(
        { ...LOGGED_OUT_SLEEVELESS_ACCESS, loggedIn: true, hasSystemAccess: true },
        "memberAccess",
      ).state,
    ).toBe("member");
    expect(decidePatternMembershipGate(LOGGED_OUT_SLEEVELESS_ACCESS, "loggedOut").state).toBe(
      "locked",
    );
  });
});
