import { afterEach, describe, expect, it, vi } from "vitest";
import { applyHatPatternWorkspaceChrome } from "./hatPatternWorkspaceAccess";
import { bindHatPatternWorkspaceAccessLifecycle } from "./hatPatternWorkspaceAccess";
import type { ViewerAccessState } from "../../memberAccess";

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

describe("Hat finished-pattern member-access lifecycle", () => {
  let unbind: (() => void) | undefined;

  afterEach(() => {
    unbind?.();
    unbind = undefined;
    vi.unstubAllGlobals();
  });

  it("starts as guest, then switches to member when kin:member-access arrives later", () => {
    class FakeButton {}
    vi.stubGlobal("HTMLButtonElement", FakeButton);

    const host = new EventTarget();
    const fakeWindow = Object.assign(host, {
      __KIN_MEMBER_ACCESS__: null as {
        hasMemberAccess: boolean;
        viewerAccessState: ViewerAccessState;
      } | null,
      $memberstackDom: undefined,
    });
    vi.stubGlobal("window", fakeWindow);

    const { root, notice, membership, classSet, attrs } = chromeRoot();
    const applied: ViewerAccessState[] = [];

    unbind = bindHatPatternWorkspaceAccessLifecycle({
      apply: (state) => {
        applied.push(state);
        applyHatPatternWorkspaceChrome(root, state);
      },
      resolve: () => new Promise(() => {}),
    });

    expect(applied[0]).toBe("loggedOut");
    expect(notice.hidden).toBe(false);
    expect(membership.hidden).toBe(false);
    expect(classSet.has("is-disabled")).toBe(true);
    expect(attrs.has("data-pattern-workspace-library-trigger")).toBe(false);

    fakeWindow.dispatchEvent(
      new CustomEvent("kin:member-access", {
        detail: { hasMemberAccess: true, viewerAccessState: "memberAccess" },
      }),
    );

    expect(applied.at(-1)).toBe("memberAccess");
    expect(notice.hidden).toBe(true);
    expect(membership.hidden).toBe(true);
    expect(classSet.has("is-disabled")).toBe(false);
    expect(attrs.get("data-pattern-workspace-library-trigger")).toBe("");
  });

  it("does not let a late plan-less Memberstack resolve overwrite member chrome", async () => {
    class FakeButton {}
    vi.stubGlobal("HTMLButtonElement", FakeButton);

    const host = new EventTarget();
    const fakeWindow = Object.assign(host, {
      __KIN_MEMBER_ACCESS__: null as {
        hasMemberAccess: boolean;
        viewerAccessState: ViewerAccessState;
      } | null,
      $memberstackDom: undefined,
    });
    vi.stubGlobal("window", fakeWindow);

    const { root, notice, classSet } = chromeRoot();
    const applied: ViewerAccessState[] = [];
    let resolveLater!: (state: ViewerAccessState) => void;
    const pendingResolve = new Promise<ViewerAccessState>((resolve) => {
      resolveLater = resolve;
    });

    unbind = bindHatPatternWorkspaceAccessLifecycle({
      apply: (state) => {
        applied.push(state);
        applyHatPatternWorkspaceChrome(root, state);
      },
      resolve: () => pendingResolve,
    });

    fakeWindow.dispatchEvent(
      new CustomEvent("kin:member-access", {
        detail: { hasMemberAccess: true, viewerAccessState: "memberAccess" },
      }),
    );
    expect(applied.at(-1)).toBe("memberAccess");
    expect(notice.hidden).toBe(true);

    resolveLater("loggedInNoAccess");
    await pendingResolve;
    await Promise.resolve();

    expect(applied.at(-1)).toBe("memberAccess");
    expect(notice.hidden).toBe(true);
    expect(classSet.has("is-disabled")).toBe(false);
  });

  it("applies an existing BaseLayout snapshot immediately if Hat mounts after the event", () => {
    class FakeButton {}
    vi.stubGlobal("HTMLButtonElement", FakeButton);

    const host = new EventTarget();
    const fakeWindow = Object.assign(host, {
      __KIN_MEMBER_ACCESS__: {
        hasMemberAccess: true,
        viewerAccessState: "memberAccess" as const,
      },
      $memberstackDom: undefined,
    });
    vi.stubGlobal("window", fakeWindow);

    const { root, notice, membership, classSet } = chromeRoot();

    unbind = bindHatPatternWorkspaceAccessLifecycle({
      apply: (state) => applyHatPatternWorkspaceChrome(root, state),
      resolve: () => new Promise(() => {}),
    });

    expect(notice.hidden).toBe(true);
    expect(membership.hidden).toBe(true);
    expect(classSet.has("is-disabled")).toBe(false);
  });
});
