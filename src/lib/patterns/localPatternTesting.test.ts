import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAID_MEMBER_ACCESS_PLAN_IDS } from "../memberAccess";
import { PATTERN_SYSTEM_IDS } from "./patternSystemId";

vi.mock("./sleevelessPatternLoginGate", () => ({
  waitForMemberstackDom: vi.fn().mockResolvedValue(false),
  waitForMemberstackReady: vi.fn().mockResolvedValue(undefined),
  resolveCurrentMemberIdForDraftGuard: vi.fn().mockResolvedValue(null),
}));

vi.mock("./patternEditGateDebug", () => ({
  logPatternEditGateDebug: vi.fn(),
}));

import { ensurePatternBuilderAccount } from "./patternBuilderAccountGate";
import {
  isLocalPatternTestingEnabled,
  LOCAL_PATTERN_TESTING_ID,
  localPatternTestingAccess,
  localPatternTestingDraftOwnerId,
} from "./localPatternTesting";
import { enforceDraftOwnerForCurrentPage, resolvePatternMembershipGateDecision } from "./patternMembershipPageGate";
import { PATTERN_DRAFT_OWNER_KEY } from "./patternDraftOwnerGuard";
import { PATTERN_STORAGE_KEY } from "./patternStorage";
import { resolveCurrentMemberIdForDraftGuard } from "./sleevelessPatternLoginGate";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { hasPatternSystemAccess } from "./sleevelessPatternSystemAccess";
import {
  getSleevelessAccessDebug,
  invalidateSleevelessUserAccessCache,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";

const root = resolve(import.meta.dirname, "../../..");

const DEPLOYED_HOSTS = [
  "kin-dev.netlify.app",
  "deploy-preview-42--kin-dev.netlify.app",
  "knititnow.com",
  "www.knititnow.com",
];

function stubHostname(hostname: string): void {
  vi.stubGlobal("window", { location: { hostname } });
  invalidateSleevelessUserAccessCache();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  invalidateSleevelessUserAccessCache();
});

describe("isLocalPatternTestingEnabled", () => {
  it("is on for localhost and 127.0.0.1 in a dev build", () => {
    expect(
      isLocalPatternTestingEnabled({ isViteDev: true, hostname: "localhost" }),
    ).toBe(true);
    expect(
      isLocalPatternTestingEnabled({ isViteDev: true, hostname: "127.0.0.1" }),
    ).toBe(true);
    expect(
      isLocalPatternTestingEnabled({ isViteDev: true, hostname: " LocalHost " }),
    ).toBe(true);
  });

  it("stays off when there is no browser hostname, even in a dev build", () => {
    expect(isLocalPatternTestingEnabled({ isViteDev: true, hostname: "" })).toBe(false);
    expect(isLocalPatternTestingEnabled()).toBe(false);
  });

  it("stays off for other local-looking hosts", () => {
    for (const hostname of ["::1", "[::1]", "0.0.0.0", "localhost.example.com"]) {
      expect(isLocalPatternTestingEnabled({ isViteDev: true, hostname })).toBe(false);
    }
  });

  it("can be disabled explicitly on localhost", () => {
    expect(
      isLocalPatternTestingEnabled({
        isViteDev: true,
        hostname: "localhost",
        allowDevPatternUser: "false",
      }),
    ).toBe(false);
    expect(
      isLocalPatternTestingEnabled({
        isViteDev: true,
        hostname: "127.0.0.1",
        allowDevPatternUser: "false",
      }),
    ).toBe(false);
  });

  it("does not treat other flag values as a disable switch", () => {
    expect(
      isLocalPatternTestingEnabled({
        isViteDev: true,
        hostname: "localhost",
        allowDevPatternUser: "true",
      }),
    ).toBe(true);
    expect(
      isLocalPatternTestingEnabled({
        isViteDev: true,
        hostname: "localhost",
        allowDevPatternUser: undefined,
      }),
    ).toBe(true);
  });

  it("cannot turn on in a production build, including kin-dev and deploy previews", () => {
    expect(
      isLocalPatternTestingEnabled({ isViteDev: false, hostname: "localhost" }),
    ).toBe(false);
    expect(
      isLocalPatternTestingEnabled({ isViteDev: false, hostname: "127.0.0.1" }),
    ).toBe(false);
    for (const hostname of DEPLOYED_HOSTS) {
      expect(isLocalPatternTestingEnabled({ isViteDev: false, hostname })).toBe(false);
      expect(isLocalPatternTestingEnabled({ isViteDev: true, hostname })).toBe(false);
    }
  });
});

describe("localPatternTestingAccess", () => {
  it("is an explicit local identity with no membership plan ids", () => {
    const access = localPatternTestingAccess();
    expect(access.memberId).toBe(LOCAL_PATTERN_TESTING_ID);
    expect(access.memberId?.startsWith("mem_")).toBe(false);
    expect(access.loggedIn).toBe(true);
    expect(access.hasSystemAccess).toBe(true);
    expect(access.activePlanIds).toBeUndefined();
    const serialized = JSON.stringify(access);
    for (const planId of PAID_MEMBER_ACCESS_PLAN_IDS) {
      expect(serialized).not.toContain(planId);
    }
  });

  it("satisfies the existing pattern-system check for every builder", () => {
    const access = localPatternTestingAccess();
    for (const systemId of PATTERN_SYSTEM_IDS) {
      expect(hasPatternSystemAccess(access, systemId)).toBe(true);
    }
  });
});

describe("client resolvers", () => {
  it("resolveSleevelessUserAccess returns the local testing identity on localhost", async () => {
    stubHostname("localhost");
    const access = await resolveSleevelessUserAccess();
    expect(access).toEqual(localPatternTestingAccess());
    expect(getSleevelessAccessDebug()?.source).toBe("local-pattern-testing");
    expect(getSleevelessAccessDebug()?.planIds).toEqual([]);
  });

  it("resolvePatternMembershipGateDecision unlocks on 127.0.0.1 through the existing decision", async () => {
    stubHostname("127.0.0.1");
    const decision = await resolvePatternMembershipGateDecision();
    expect(decision.state).toBe("member");
    expect(decision.access).toEqual(localPatternTestingAccess());
  });

  it("hasPatternBuilderMembershipAccess allows the blanket gate on localhost", async () => {
    stubHostname("localhost");
    const openAccountPrompt = vi.fn();
    await expect(ensurePatternBuilderAccount({ openAccountPrompt })).resolves.toBe(true);
    expect(openAccountPrompt).not.toHaveBeenCalled();
  });

  it("keeps all three resolvers locked on a deployed Netlify host", async () => {
    stubHostname("kin-dev.netlify.app");
    const openAccountPrompt = vi.fn();

    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: false,
      hasSystemAccess: false,
    });
    await expect(resolvePatternMembershipGateDecision()).resolves.toMatchObject({
      state: "locked",
    });
    await expect(ensurePatternBuilderAccount({ openAccountPrompt })).resolves.toBe(false);
    expect(openAccountPrompt).toHaveBeenCalledTimes(1);
  });

  it("stays locked on a deploy preview even if the dev flag is set in the environment", async () => {
    vi.stubEnv("PUBLIC_ALLOW_DEV_PATTERN_USER", "true");
    stubHostname("deploy-preview-7--site.netlify.app");
    await expect(resolvePatternMembershipGateDecision()).resolves.toMatchObject({
      state: "locked",
    });
  });

  it("stays locked on localhost when PUBLIC_ALLOW_DEV_PATTERN_USER is false", async () => {
    vi.stubEnv("PUBLIC_ALLOW_DEV_PATTERN_USER", "false");
    stubHostname("localhost");
    const openAccountPrompt = vi.fn();

    await expect(resolveSleevelessUserAccess()).resolves.toMatchObject({
      loggedIn: false,
      hasSystemAccess: false,
    });
    await expect(resolvePatternMembershipGateDecision()).resolves.toMatchObject({
      state: "locked",
    });
    await expect(ensurePatternBuilderAccount({ openAccountPrompt })).resolves.toBe(false);
    expect(openAccountPrompt).toHaveBeenCalledTimes(1);
  });
});

describe("local draft ownership", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("keeps browser edits on localhost when a Memberstack member is also signed in", async () => {
    const edited = JSON.stringify({ id: "pattern-1", edited: "chestBust=41" });
    localStorage.setItem(PATTERN_DRAFT_OWNER_KEY, LOCAL_PATTERN_TESTING_ID);
    localStorage.setItem(PATTERN_STORAGE_KEY, edited);
    vi.mocked(resolveCurrentMemberIdForDraftGuard).mockResolvedValue("mem_sb_signed_in");
    stubHostname("localhost");

    await enforceDraftOwnerForCurrentPage();

    expect(localPatternTestingDraftOwnerId()).toBe(LOCAL_PATTERN_TESTING_ID);
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toBe(edited);
    expect(localStorage.getItem(PATTERN_DRAFT_OWNER_KEY)).toBe(LOCAL_PATTERN_TESTING_ID);
  });

  it("still clears another member's draft on production", async () => {
    localStorage.setItem(PATTERN_DRAFT_OWNER_KEY, "mem_sb_other");
    localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify({ edited: "chestBust=41" }));
    vi.mocked(resolveCurrentMemberIdForDraftGuard).mockResolvedValue("mem_sb_signed_in");
    stubHostname("knititnow.com");

    await enforceDraftOwnerForCurrentPage();

    expect(localPatternTestingDraftOwnerId()).toBeNull();
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PATTERN_DRAFT_OWNER_KEY)).toBe("mem_sb_signed_in");
  });

  it("does not use the local testing owner on hosted DEV", async () => {
    const edited = JSON.stringify({ id: "pattern-1", edited: "chestBust=41" });
    localStorage.setItem(PATTERN_DRAFT_OWNER_KEY, "kin-dev-set-in-sleeve-testing");
    localStorage.setItem(PATTERN_STORAGE_KEY, edited);
    vi.mocked(resolveCurrentMemberIdForDraftGuard).mockResolvedValue("mem_sb_signed_in");
    vi.stubGlobal("window", {
      location: {
        hostname: "kin-dev.netlify.app",
        pathname: "/patterns/set-in-sleeve/builder",
      },
    });

    await enforceDraftOwnerForCurrentPage();

    expect(localPatternTestingDraftOwnerId()).toBeNull();
    expect(localStorage.getItem(PATTERN_STORAGE_KEY)).toBe(edited);
    expect(localStorage.getItem(PATTERN_DRAFT_OWNER_KEY)).toBe("kin-dev-set-in-sleeve-testing");
  });
});

describe("production call sites", () => {
  it("resolvers call the guard with no overrides, so a production build cannot opt in", () => {
    const files = [
      "src/lib/patterns/sleevelessPatternSystemAccessClient.ts",
      "src/lib/patterns/patternMembershipPageGate.ts",
      "src/lib/patterns/patternBuilderAccountGate.ts",
    ];
    for (const rel of files) {
      const source = readFileSync(resolve(root, rel), "utf8");
      expect(source).toContain("isLocalPatternTestingEnabled()");
      expect(source).not.toMatch(/isLocalPatternTestingEnabled\(\s*\{/);
    }
    const helper = readFileSync(
      resolve(root, "src/lib/patterns/localPatternTesting.ts"),
      "utf8",
    );
    expect(helper).toContain("import.meta.env.DEV");
    expect(helper).toContain('allowDevPatternUserFlag(options) === "false"');
  });
});
