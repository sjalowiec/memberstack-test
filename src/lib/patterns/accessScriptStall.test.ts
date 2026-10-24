import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCESS_SCRIPT_READY_ATTR,
  ACCESS_SCRIPT_STALL_MS,
  ACCESS_STALL_CHECKING_ATTR,
  ACCESS_STALL_NOTICE_ATTR,
  ACCESS_STALL_ROOT_ATTR,
  accessScriptStallWatchSource,
  markAccessScriptReady,
} from "./accessScriptStall";

type FakeEl = {
  hidden: boolean;
  attrs: Set<string>;
  children: FakeEl[];
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  querySelectorAll(selector: string): FakeEl[];
};

function attrOf(selector: string): string {
  const match = selector.match(/^\[([^\]]+)\]$/);
  if (!match) throw new Error(`unsupported selector ${selector}`);
  return match[1];
}

function el(attrs: string[], children: FakeEl[] = [], hidden = false): FakeEl {
  const node: FakeEl = {
    hidden,
    attrs: new Set(attrs),
    children,
    hasAttribute: (name) => node.attrs.has(name),
    setAttribute: (name) => {
      node.attrs.add(name);
    },
    querySelectorAll: (selector) => {
      const name = attrOf(selector);
      const out: FakeEl[] = [];
      const walk = (n: FakeEl) => {
        for (const c of n.children) {
          if (c.attrs.has(name)) out.push(c);
          walk(c);
        }
      };
      walk(node);
      return out;
    },
  };
  return node;
}

/** A gate/landing root in its server-rendered state. */
function stallRoot() {
  const checking = el([ACCESS_STALL_CHECKING_ATTR]);
  const notice = el([ACCESS_STALL_NOTICE_ATTR], [], true);
  const root = el([ACCESS_STALL_ROOT_ATTR], [checking, notice]);
  return { root, checking, notice };
}

/** Runs the inline watcher source against a fake page and fires its timer. */
function runWatcher(roots: FakeEl[], win: Record<string, unknown> = {}) {
  const page = el([], roots);
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const fakeSetTimeout = (fn: () => void, ms: number) => {
    timers.push({ fn, ms });
    return timers.length;
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function("window", "document", "setTimeout", accessScriptStallWatchSource())(
    win,
    page,
    fakeSetTimeout,
  );
  return {
    timers,
    fire: () => timers.forEach((t) => t.fn()),
  };
}

describe("access script stall watcher (inline fallback)", () => {
  it("reveals a reload notice when the access script never started", () => {
    const { root, checking, notice } = stallRoot();
    const watcher = runWatcher([root]);
    expect(watcher.timers).toHaveLength(1);
    expect(watcher.timers[0].ms).toBe(ACCESS_SCRIPT_STALL_MS);
    watcher.fire();
    expect(notice.hidden).toBe(false);
    expect(checking.hidden).toBe(true);
  });

  it("leaves a page alone when the access script started", () => {
    const { root, checking, notice } = stallRoot();
    root.setAttribute(ACCESS_SCRIPT_READY_ATTR, "");
    runWatcher([root]).fire();
    expect(notice.hidden).toBe(true);
    expect(checking.hidden).toBe(false);
  });

  it("only flags the roots that did not start", () => {
    const stuck = stallRoot();
    const ok = stallRoot();
    ok.root.setAttribute(ACCESS_SCRIPT_READY_ATTR, "");
    runWatcher([stuck.root, ok.root]).fire();
    expect(stuck.notice.hidden).toBe(false);
    expect(ok.notice.hidden).toBe(true);
  });

  it("installs one timer even when included twice on a page", () => {
    const win: Record<string, unknown> = {};
    const { root } = stallRoot();
    expect(runWatcher([root], win).timers).toHaveLength(1);
    expect(runWatcher([root], win).timers).toHaveLength(0);
  });

  it("is plain ES5 so it runs where the module scripts cannot", () => {
    const source = accessScriptStallWatchSource();
    expect(source).not.toMatch(/=>|\bconst\b|\blet\b|`|\?\.|\?\?|\bclass\b|\bimport\b/);
  });

  it("markAccessScriptReady hides a notice shown before a late load", () => {
    const { root, notice } = stallRoot();
    notice.hidden = false;
    markAccessScriptReady(root as unknown as HTMLElement);
    expect(root.hasAttribute(ACCESS_SCRIPT_READY_ATTR)).toBe(true);
    expect(notice.hidden).toBe(true);
  });
});

describe("pattern pages wire the stall fallback", () => {
  const read = (p: string) => readFileSync(resolve(p), "utf8");
  const gate = read("src/components/patterns/SleevelessPatternMemberGate.astro");
  const landingPage = read("src/components/patterns/PatternBuilderLandingPage.astro");
  const hero = read("src/components/patterns/PatternBuilderLandingHero.astro");
  const gateScript = read("src/lib/patterns/patternMembershipPageGate.ts");
  const landingScript = read("src/lib/patterns/patternBuilderLandingCta.ts");

  it("pattern gate has a watched root, checking text, reload notice, and watcher", () => {
    expect(gate).toContain(ACCESS_STALL_ROOT_ATTR);
    expect(gate).toContain(ACCESS_STALL_CHECKING_ATTR);
    expect(gate).toMatch(/data-access-stall-notice[^>]*hidden/);
    expect(gate).toContain("Reload page");
    expect(gate).toContain("<AccessScriptStallWatch />");
    // The notice must not use the __signin class, which is hidden while pending.
    expect(gate).toMatch(/class="sleeveless-pattern-gate__stalled" data-access-stall-notice/);
  });

  it("landing page has a watched root, checking text, reload notice, and watcher", () => {
    expect(landingPage).toContain(ACCESS_STALL_ROOT_ATTR);
    expect(landingPage).toContain("<AccessScriptStallWatch />");
    expect(hero).toContain(ACCESS_STALL_CHECKING_ATTR);
    expect(hero).toMatch(/data-access-stall-notice[^>]*hidden/);
    expect(hero).toContain("Reload page");
  });

  it("gate and landing scripts mark themselves ready before anything else", () => {
    expect(gateScript).toMatch(
      /initPatternMembershipPageGate\(root: HTMLElement\): Promise<void> \{\s*markAccessScriptReady\(root\);/,
    );
    expect(landingScript).toMatch(
      /initPatternBuilderLandingCta\(root: HTMLElement\): Promise<void> \{\s*markAccessScriptReady\(root\);/,
    );
  });
});
