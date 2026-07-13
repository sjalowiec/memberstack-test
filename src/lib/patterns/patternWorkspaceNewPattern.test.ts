import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initPatternWorkspaceNewPattern } from "./patternWorkspaceNewPattern";
import {
  createStartNewCustomPatternWorkflowDeps,
  navigateToFreshPatternForPage,
  runStartNewCustomPatternWorkflow,
} from "./startNewCustomPatternWorkflow";
import { testAccess } from "./patternAccessTestFixtures";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";
import { stubLocalStorage } from "./test/stubLocalStorage";

vi.mock("./sleevelessNewPatternAccessGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sleevelessNewPatternAccessGuard")>();
  return {
    ...actual,
    resolveCanStartNewPatternForSystem: vi.fn(),
    showSleevelessNewPatternLockedScreen: vi.fn(),
  };
});

import {
  resolveCanStartNewPatternForSystem,
  showSleevelessNewPatternLockedScreen,
} from "./sleevelessNewPatternAccessGuard";

const member: SleevelessUserAccess = testAccess({
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
});

const betaMember: SleevelessUserAccess = testAccess({
  loggedIn: true,
  memberId: "ms_beta",
  hasSystemAccess: true,
});

const freeUnclaimed: SleevelessUserAccess = testAccess({
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: false,
});

const freeClaimed: SleevelessUserAccess = testAccess({
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  freeClaimed: true,
  freeClaimedPatternId: "pat_1",
});

const loggedOut: SleevelessUserAccess = testAccess({
  loggedIn: false,
  hasSystemAccess: false,
  freeClaimed: false,
});

function makeFinishedPatternDoc(pathname: string): Document {
  const doc = {
    defaultView: { location: { pathname } },
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  vi.stubGlobal("document", doc);
  return doc as unknown as Document;
}

function workspaceDepsFor(pathname: string, navigate = vi.fn()) {
  const doc = makeFinishedPatternDoc(pathname);
  return {
    doc,
    navigate,
    deps: {
      ...createStartNewCustomPatternWorkflowDeps({
        onAfterFreshSession: navigate,
        deferEntitlementGateToBuilder: true,
        root: doc,
      }),
      applyFreshSession: vi.fn(),
      hasUnsaved: () => false,
    },
  };
}

describe("finished-pattern New Pattern navigation", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(resolveCanStartNewPatternForSystem).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["paid member", member, "/patterns/sleeveless-express?new=1"],
    ["beta member", betaMember, "/patterns/sleeveless-express?new=1"],
    ["free unclaimed", freeUnclaimed, "/patterns/sleeveless-express?new=1"],
    ["free claimed", freeClaimed, "/patterns/sleeveless-express?new=1"],
    ["logged out", loggedOut, "/patterns/sleeveless-express?new=1"],
  ])(
    "%s navigates to the builder instead of blocking locally on the finished pattern page",
    async (_label, _access, expectedHref) => {
      const assign = vi.fn();
      vi.stubGlobal("window", { location: { assign } });
      const { doc, deps } = workspaceDepsFor("/patterns/sleeveless/pattern/");
      deps.navigate = () => navigateToFreshPatternForPage(doc);

      const result = await runStartNewCustomPatternWorkflow(deps);

      expect(result).toBe("started");
      expect(assign).toHaveBeenCalledWith(expectedHref);
      expect(resolveCanStartNewPatternForSystem).not.toHaveBeenCalled();
      expect(showSleevelessNewPatternLockedScreen).not.toHaveBeenCalled();
    },
  );

  it("routes drop-shoulder finished-pattern New Pattern to the drop-shoulder builder href", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    const { doc, deps } = workspaceDepsFor("/patterns/drop-shoulder/pattern/");
    deps.navigate = () => navigateToFreshPatternForPage(doc);

    const result = await runStartNewCustomPatternWorkflow(deps);

    expect(result).toBe("started");
    expect(assign).toHaveBeenCalledWith("/patterns/drop-shoulder/builder?new=1");
    expect(showSleevelessNewPatternLockedScreen).not.toHaveBeenCalled();
  });

  it("startNewCustomPatternFromWorkspace defers entitlement to the builder", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "startNewCustomPatternWorkflow.ts"), "utf-8");

    expect(src).toContain("deferEntitlementGateToBuilder: true");
    expect(src).toMatch(
      /startNewCustomPatternFromWorkspace[\s\S]*?deferEntitlementGateToBuilder:\s*true/,
    );
  });

  it("does not silently no-op when a free claimed user clicks New Pattern on the finished page", async () => {
    const startSpy = vi
      .spyOn(
        await import("./startNewCustomPatternWorkflow"),
        "startNewCustomPatternFromWorkspace",
      )
      .mockResolvedValue("started");

    class FakeButton {}
    vi.stubGlobal("HTMLButtonElement", FakeButton);

    const trigger = new FakeButton() as HTMLButtonElement & {
      hidden: boolean;
      addEventListener: ReturnType<typeof vi.fn>;
    };
    trigger.hidden = false;
    trigger.addEventListener = vi.fn();

    const doc = {
      querySelector: (sel: string) =>
        sel === "[data-pattern-workspace-new-pattern-trigger]" ? trigger : null,
    } as unknown as Document;

    initPatternWorkspaceNewPattern(doc);

    expect(trigger.hidden).not.toBe(true);
    const clickHandler = trigger.addEventListener.mock.calls.find(([event]) => event === "click")?.[1];
    expect(typeof clickHandler).toBe("function");
    await clickHandler?.();
    expect(startSpy).toHaveBeenCalledWith(doc);

    startSpy.mockRestore();
  });

  it("keeps the Express in-page Start Over gate on the builder", () => {
    const deps = createStartNewCustomPatternWorkflowDeps({
      onAfterFreshSession: vi.fn(),
      root: makeFinishedPatternDoc("/patterns/sleeveless-express/"),
    });

    expect(deps.canStartNew).toBeDefined();
    expect(deps.onBlocked).toBeDefined();
  });

  it("defers entitlement to the builder for workspace navigation", () => {
    const deps = createStartNewCustomPatternWorkflowDeps({
      onAfterFreshSession: vi.fn(),
      deferEntitlementGateToBuilder: true,
      root: makeFinishedPatternDoc("/patterns/sleeveless/pattern/"),
    });

    expect(deps.canStartNew).toBeUndefined();
    expect(deps.onBlocked).toBeUndefined();
  });

  it("does not hide the finished-pattern New Pattern trigger for claimed free users", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "patternWorkspaceNewPattern.ts"), "utf-8");

    expect(src).not.toContain("canCreatePatternForSystem");
    expect(src).not.toContain("resolveSleevelessUserAccess");
    expect(src).not.toContain("trigger.hidden = true");
  });
});
