import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { stubLocalStorage } from "../test/stubLocalStorage";
import {
  HAT_DRAFT_STORAGE_KEY,
  LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY,
  LEGACY_HAT_SIZE_STORAGE_KEY,
  clearHatDraftStorage,
  createEmptyHatDraft,
  readHatDraft,
  writeHatDraft,
} from "./hatDraft";
import {
  applyHatNewSessionFromUrl,
  buildHatBuilderNewPatternHref,
  HAT_BUILDER_PATH,
  startFreshHatPattern,
  startNewHatPatternFromFinishedPage,
  startOverHatBuilderSession,
} from "./hatFreshStart";
import {
  applyHatPatternMyPatternsAccess,
  bindHatPatternMyPatternsDisabledGuard,
  HAT_PATTERN_MY_PATTERNS_DISABLED_TITLE,
  hatPatternMyPatternsIsActive,
} from "./hatPatternMyPatternsAccess";
import { initHatPatternNewPattern } from "./hatPatternNewPattern";
import {
  isEditingSavedHatProject,
  readHatActiveProjectId,
  writeHatActiveProjectId,
} from "./hatSavedProject";
import {
  HAT_LEGACY_ENTRY_HREF,
  HAT_PATTERN_BUILDER_HREF,
  HAT_PATTERN_HREF,
  HAT_SUMMARY_EDIT_FROM_BUILDER_HREF,
  HAT_SUMMARY_EDIT_FROM_PATTERN_HREF,
  HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL,
  buildHatLegacyEntryRedirect,
  buildHatSummaryEditFromPatternHref,
  hatSummaryCancelHref,
  hatSummaryPrimaryLabel,
  hatSummaryPrimarySuccessHref,
  resolveHatSummaryEntryPath,
  withHatSavedProjectQuery,
} from "./hatPatternNavigation";

const patternPage = readFileSync(resolve("src/pages/patterns/hat/pattern.astro"), "utf8");
const pageScript = readFileSync(resolve("src/scripts/hat-pattern-page.ts"), "utf8");
const builderScript = readFileSync(resolve("src/scripts/hat-builder-page.ts"), "utf8");
const sleevelessPatternPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe("legacy /patterns/hat entry redirect", () => {
  const legacyEntryPage = readFileSync(resolve("src/pages/patterns/hat.astro"), "utf8");
  const builderPage = readFileSync(resolve("src/pages/patterns/hat/builder.astro"), "utf8");
  const firstProjectPage = readFileSync(resolve("src/pages/first-project.astro"), "utf8");
  const patternsIndexPage = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");

  it("redirects /patterns/hat to the current Hat Builder and preserves query params", () => {
    expect(HAT_LEGACY_ENTRY_HREF).toBe("/patterns/hat");
    expect(HAT_PATTERN_BUILDER_HREF).toBe("/patterns/hat/builder");
    expect(buildHatLegacyEntryRedirect("https://example.com/patterns/hat")).toBe(
      "/patterns/hat/builder",
    );
    expect(buildHatLegacyEntryRedirect("https://example.com/patterns/hat?new=1")).toBe(
      "/patterns/hat/builder?new=1",
    );
    expect(legacyEntryPage).toContain("buildHatLegacyEntryRedirect");
    expect(legacyEntryPage).toContain("308");
  });

  it("does not render the legacy wizard ActionBar on /patterns/hat", () => {
    expect(legacyEntryPage).not.toContain("ActionBar");
    expect(legacyEntryPage).not.toContain("Edit / Regenerate");
    expect(legacyEntryPage).not.toContain("wizard-action-bar");
    expect(legacyEntryPage).not.toContain("button-edit-rebuild");
  });

  it("leaves the current builder and finished Hat workspace routes unchanged", () => {
    expect(HAT_PATTERN_BUILDER_HREF).toBe("/patterns/hat/builder");
    expect(HAT_PATTERN_HREF).toBe("/patterns/hat/pattern/");
    expect(builderPage).toContain("patternWorkspace={true}");
    expect(builderPage).not.toContain("ActionBar");
    expect(patternPage).toContain("patternWorkspace={true}");
    expect(patternPage).toContain("data-hat-pattern-page");
    expect(patternPage).not.toContain("ActionBar");
    expect(patternPage).not.toContain("Edit / Regenerate");
  });

  it("updates stale internal links away from the retired wizard URL", () => {
    expect(firstProjectPage).toContain('href="/patterns/hat/builder"');
    expect(firstProjectPage).not.toMatch(/href=["']\/patterns\/hat["']/);
    expect(patternsIndexPage).toContain("href: '/patterns/hat/builder?new=1'");
    expect(patternsIndexPage).not.toMatch(/href:\s*['"]\/patterns\/hat['"]/);
  });
});

describe("hat finished-pattern navigation markup", () => {
  it("removes Back to Builder from the action bar", () => {
    expect(patternPage).not.toContain("Back to Builder");
    expect(patternPage).not.toContain("hat-pattern-back-to-builder");
  });

  it("Edit Pattern navigates to the dedicated Summary/Edit page", () => {
    expect(patternPage).toContain("HAT_SUMMARY_EDIT_FROM_PATTERN_HREF");
    expect(patternPage).toContain('data-testid="button-edit-pattern"');
    expect(patternPage).not.toContain("data-hat-edit-drawer");
  });

  it("matches sweater My Patterns / New Pattern icons, classes, and test ids", () => {
    expect(patternPage).toContain('data-ms-content="members"');
    expect(patternPage).toContain("data-hat-pattern-my-patterns");
    expect(patternPage).toContain('data-testid="pattern-workspace-library-trigger"');
    expect(patternPage).toContain("fa-folder-open");
    expect(patternPage).toContain("> My Patterns");

    expect(patternPage).toContain("data-hat-pattern-new-pattern-trigger");
    expect(patternPage).toContain('data-testid="pattern-workspace-new-pattern-trigger"');
    expect(patternPage).toContain("fa-plus");
    expect(patternPage).toContain("> New Pattern");

    expect(patternPage).toContain('class="sleeveless-pattern-edit-action no-print');
    expect(sleevelessPatternPage).toContain("data-pattern-workspace-library-trigger");
    expect(sleevelessPatternPage).toContain("data-pattern-workspace-new-pattern-trigger");
  });

  it("keeps Edit Pattern and Print on the end group", () => {
    expect(patternPage).toContain("data-hat-edit-open");
    expect(patternPage).toContain('data-testid="button-edit-pattern"');
    expect(patternPage).toContain("HAT_SUMMARY_EDIT_FROM_PATTERN_HREF");
    expect(patternPage).toContain("pattern-action-bar__group--end");
    expect(pageScript).toContain("button-print");
    expect(pageScript).toContain("data-hat-edit-open");
    expect(pageScript).not.toContain("initHatPatternEditDrawer");
  });

  it("Edit Pattern href carries a saved project id when one is active", () => {
    expect(buildHatSummaryEditFromPatternHref()).toBe(HAT_SUMMARY_EDIT_FROM_PATTERN_HREF);
    expect(buildHatSummaryEditFromPatternHref("proj-hat-1")).toBe(
      "/patterns/hat/summary/?edit=1&project=proj-hat-1",
    );
    expect(withHatSavedProjectQuery(HAT_SUMMARY_EDIT_FROM_PATTERN_HREF, "proj-hat-1")).toContain(
      "project=proj-hat-1",
    );
    expect(hatSummaryPrimarySuccessHref("from-finished-pattern", "proj-hat-1")).toBe(
      "/patterns/hat/pattern/?project=proj-hat-1",
    );
    expect(pageScript).toContain("buildHatSummaryEditFromPatternHref");
    expect(pageScript).toContain("readHatActiveProjectId");
  });

  it("Summary/Edit and Builder hydrate from ?project= before reading the local draft", () => {
    const summaryScript = readFileSync(resolve("src/scripts/hat-pattern-summary-page.ts"), "utf8");
    expect(summaryScript).toContain("ensureUrlRequestedSavedPatternHydrated");
    expect(summaryScript.indexOf("ensureUrlRequestedSavedPatternHydrated")).toBeLessThan(
      summaryScript.indexOf("initHatPatternSummaryWorkspace"),
    );
    expect(builderScript).toContain("ensureUrlRequestedSavedPatternHydrated");
    const builderBoot = builderScript.indexOf("applyHatNewSessionFromUrl();");
    expect(builderBoot).toBeGreaterThan(-1);
    expect(builderScript.indexOf("ensureUrlRequestedSavedPatternHydrated", builderBoot)).toBeLessThan(
      builderScript.indexOf("ensureHatDraftMigrated();", builderBoot),
    );
  });

  it("builder Review My Pattern navigates to Summary/Edit with generated=1", () => {
    const builderPage = readFileSync(resolve("src/pages/patterns/hat/builder.astro"), "utf8");
    expect(builderPage).toContain("Review My Pattern");
    expect(builderScript).toContain("buildHatSummaryEditFromBuilderHref");
    expect(builderScript).toMatch(/location\.assign\(HAT_SUMMARY_FROM_BUILDER_HREF\)/);
    expect(builderScript).not.toMatch(/\/patterns\/hat\/pattern["'`]/);
  });

  it("reuses sweater generated/edit query flags for Summary/Edit entry paths", () => {
    expect(HAT_SUMMARY_EDIT_FROM_BUILDER_HREF).toBe("/patterns/hat/summary/?generated=1");
    expect(HAT_SUMMARY_EDIT_FROM_PATTERN_HREF).toBe("/patterns/hat/summary/?edit=1");
    expect(resolveHatSummaryEntryPath("?generated=1")).toBe("from-builder");
    expect(resolveHatSummaryEntryPath("?edit=1")).toBe("from-finished-pattern");
    expect(resolveHatSummaryEntryPath("")).toBe("from-finished-pattern");
    expect(hatSummaryCancelHref("from-builder")).toBe("/patterns/hat/builder");
    expect(hatSummaryCancelHref("from-finished-pattern")).toBe("/patterns/hat/pattern/");
    expect(hatSummaryCancelHref("from-finished-pattern", "proj-hat-1")).toBe(
      "/patterns/hat/pattern/?project=proj-hat-1",
    );
    expect(hatSummaryCancelHref("from-builder", "proj-hat-1")).toBe("/patterns/hat/builder");
    expect(hatSummaryPrimaryLabel("from-builder")).toBe(HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL);
    expect(hatSummaryPrimaryLabel("from-finished-pattern")).toBe("Update Pattern");
  });

  it("wires membership My Patterns + New Pattern on the hat pattern page script", () => {
    expect(pageScript).toContain("applyHatPatternWorkspaceChrome");
    expect(pageScript).toContain("bindHatPatternMyPatternsDisabledGuard");
    expect(pageScript).toContain("initHatPatternNewPattern");
    expect(builderScript).toContain("applyHatNewSessionFromUrl");
  });
});

describe("hat My Patterns membership gating", () => {
  beforeEach(() => {
    class FakeButton {}
    vi.stubGlobal("HTMLButtonElement", FakeButton);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeButton() {
    const attrs = new Map<string, string>();
    const classSet = new Set<string>(["sleeveless-pattern-edit-action", "is-disabled"]);
    const btn = Object.assign(new HTMLButtonElement(), {
      disabled: false,
      dataset: {} as Record<string, string>,
      classList: {
        toggle: (name: string, force?: boolean) => {
          if (force) classSet.add(name);
          else if (force === false) classSet.delete(name);
          else if (classSet.has(name)) classSet.delete(name);
          else classSet.add(name);
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
      addEventListener: vi.fn(),
    }) as unknown as HTMLButtonElement;
    attrs.set("aria-disabled", "true");
    attrs.set("title", HAT_PATTERN_MY_PATTERNS_DISABLED_TITLE);
    return { btn, attrs, classSet };
  }

  it("treats only memberAccess as active", () => {
    expect(hatPatternMyPatternsIsActive("memberAccess")).toBe(true);
    expect(hatPatternMyPatternsIsActive("loggedOut")).toBe(false);
    expect(hatPatternMyPatternsIsActive("loggedInNoAccess")).toBe(false);
  });

  it("enables My Patterns with the shared library trigger for active members", () => {
    const { btn, attrs, classSet } = makeButton();
    const root = {
      querySelector: (sel: string) =>
        sel === "[data-hat-pattern-my-patterns]" ? btn : null,
    } as unknown as ParentNode;

    applyHatPatternMyPatternsAccess(root, "memberAccess");

    expect(classSet.has("is-disabled")).toBe(false);
    expect(attrs.has("aria-disabled")).toBe(false);
    expect(attrs.has("title")).toBe(false);
    expect(attrs.get("data-pattern-workspace-library-trigger")).toBe("");
    expect(attrs.get("aria-controls")).toBe("pattern-workspace-library-drawer-panel");
  });

  it("disables My Patterns for logged-out users and non-members without library trigger", () => {
    for (const state of ["loggedOut", "loggedInNoAccess"] as const) {
      const { btn, attrs, classSet } = makeButton();
      attrs.set("data-pattern-workspace-library-trigger", "");
      const root = {
        querySelector: (sel: string) =>
          sel === "[data-hat-pattern-my-patterns]" ? btn : null,
      } as unknown as ParentNode;

      applyHatPatternMyPatternsAccess(root, state);

      expect(classSet.has("is-disabled")).toBe(true);
      expect(attrs.get("aria-disabled")).toBe("true");
      expect(attrs.get("title")).toBe(HAT_PATTERN_MY_PATTERNS_DISABLED_TITLE);
      expect(attrs.has("data-pattern-workspace-library-trigger")).toBe(false);
    }
  });

  it("blocks clicks while membership-locked", () => {
    const { btn, attrs, classSet } = makeButton();
    const root = {
      querySelector: (sel: string) =>
        sel === "[data-hat-pattern-my-patterns]" ? btn : null,
    } as unknown as ParentNode;

    bindHatPatternMyPatternsDisabledGuard(root);
    const handler = (btn.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === "click",
    )?.[1] as ((event: { preventDefault: () => void; stopPropagation: () => void }) => void) | undefined;
    expect(typeof handler).toBe("function");

    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    attrs.set("aria-disabled", "true");
    classSet.add("is-disabled");
    handler?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });
});

describe("hat New Pattern clears draft", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("buildHatBuilderNewPatternHref targets the hat builder with ?new=1", () => {
    expect(buildHatBuilderNewPatternHref()).toBe("/patterns/hat/builder?new=1");
    expect(HAT_BUILDER_PATH).toBe("/patterns/hat/builder");
  });

  it("startFreshHatPattern clears canonical and legacy draft keys", () => {
    const storage = memoryStorage({
      [HAT_DRAFT_STORAGE_KEY]: JSON.stringify(
        createEmptyHatDraft({ sizeSel: "adult_woman", brimType: "single" }),
      ),
      [LEGACY_HAT_SIZE_STORAGE_KEY]: JSON.stringify({ sel: "adult_woman" }),
      [LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY]: JSON.stringify({ brimType: "single" }),
      "kin:hat-pattern-lead-at": "1700000000000",
    });

    startFreshHatPattern(storage);
    expect(storage.getItem(HAT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_HAT_SIZE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY)).toBeNull();
    expect(readHatDraft(storage)).toBeNull();
    expect(storage.getItem("kin:hat-pattern-lead-at")).toBe("1700000000000");
  });

  it("builder Start Over uses startOverHatBuilderSession to drop saved-project identity", () => {
    expect(builderScript).toContain("startOverHatBuilderSession");
    expect(builderScript).toContain("hat-builder-start-over");
    writeHatDraft(
      createEmptyHatDraft({
        sizeSel: "adult_man",
        patternProject: { title: "Sue's Hiking Hat", notes: "", titleCustomized: true },
      }),
    );
    writeHatActiveProjectId("proj-hat-1", "Sue's Hiking Hat");

    const fresh = startOverHatBuilderSession({ unit: "inches", showTips: false });
    expect(fresh.sizeSel).toBe("");
    expect(fresh.patternProject).toBeUndefined();
    expect(readHatActiveProjectId()).toBe("");
    expect(isEditingSavedHatProject()).toBe(false);
    expect(readHatDraft()?.patternProject).toBeUndefined();
  });

  it("clearHatDraftStorage prevents legacy migration from restoring choices", () => {
    const storage = memoryStorage({
      [LEGACY_HAT_SIZE_STORAGE_KEY]: JSON.stringify({ sel: "adult_woman", circ: "" }),
      [LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY]: JSON.stringify({
        brimType: "folded",
        brimLength: "2",
        crownShaping: "gathered",
        fit: "watchcap",
      }),
    });
    clearHatDraftStorage(storage);
    expect(readHatDraft(storage)).toBeNull();
  });

  it("catalog Create your hat uses the same ?new=1 href as New Pattern", () => {
    const patternsIndexPage = readFileSync(resolve("src/pages/patterns/index.astro"), "utf8");
    expect(buildHatBuilderNewPatternHref()).toBe("/patterns/hat/builder?new=1");
    expect(patternsIndexPage).toContain(`href: '${buildHatBuilderNewPatternHref()}'`);
  });

  it("applyHatNewSessionFromUrl clears draft and strips ?new=1", () => {
    writeHatDraft(createEmptyHatDraft({ sizeSel: "adult_woman", brimType: "rolled" }));
    expect(readHatDraft()?.sizeSel).toBe("adult_woman");

    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: {
        href: "http://localhost/patterns/hat/builder?new=1",
        origin: "http://localhost",
      },
      history: { replaceState },
    });

    writeHatActiveProjectId("proj-stale", "Stale Local Hat");
    expect(applyHatNewSessionFromUrl("http://localhost/patterns/hat/builder?new=1")).toBe(true);
    expect(readHatDraft()).toBeNull();
    expect(readHatActiveProjectId()).toBe("");
    expect(replaceState).toHaveBeenCalledWith({}, "", "/patterns/hat/builder");
  });

  it("does not clear when ?new=1 is absent", () => {
    writeHatDraft(createEmptyHatDraft({ sizeSel: "adult_woman" }));
    vi.stubGlobal("window", {
      location: {
        href: "http://localhost/patterns/hat/builder",
        origin: "http://localhost",
      },
      history: { replaceState: vi.fn() },
    });
    expect(applyHatNewSessionFromUrl("http://localhost/patterns/hat/builder")).toBe(false);
    expect(readHatDraft()?.sizeSel).toBe("adult_woman");
  });

  it("finished-page New Pattern clears then navigates to the hat builder fresh URL", () => {
    writeHatDraft(createEmptyHatDraft({ sizeSel: "adult_woman", brimType: "single" }));
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    startNewHatPatternFromFinishedPage();

    expect(readHatDraft()).toBeNull();
    expect(assign).toHaveBeenCalledWith("/patterns/hat/builder?new=1");
  });

  it("initHatPatternNewPattern wires the finished-page trigger", async () => {
    const startSpy = vi
      .spyOn(await import("./hatFreshStart"), "startNewHatPatternFromFinishedPage")
      .mockImplementation(() => undefined);

    class FakeButton {}
    vi.stubGlobal("HTMLButtonElement", FakeButton);

    const trigger = new FakeButton() as HTMLButtonElement & {
      dataset: Record<string, string>;
      addEventListener: ReturnType<typeof vi.fn>;
    };
    trigger.dataset = {};
    trigger.addEventListener = vi.fn();

    const doc = {
      querySelector: (sel: string) =>
        sel === "[data-hat-pattern-new-pattern-trigger]" ? trigger : null,
    } as unknown as Document;

    initHatPatternNewPattern(doc);
    const clickHandler = trigger.addEventListener.mock.calls.find(([event]) => event === "click")?.[1];
    expect(typeof clickHandler).toBe("function");
    clickHandler?.();
    expect(startSpy).toHaveBeenCalled();
    startSpy.mockRestore();
  });
});
