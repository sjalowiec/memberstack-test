import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldShowHatTemporaryPatternNotice } from "./hatPatternPersistNotice";
import { initHatPatternNewPattern } from "./hatPatternNewPattern";
import {
  executeHatPatternLeave,
  HAT_PATTERN_LEAVE_WARNING_EMPHASIS,
  HAT_PATTERN_LEAVE_WARNING_LEAD,
  HAT_PATTERN_LEAVE_WARNING_LEAVE_LABEL,
  HAT_PATTERN_LEAVE_WARNING_PRINT_LABEL,
  HAT_PATTERN_LEAVE_WARNING_PRINT_SELECTOR,
  HAT_PATTERN_LEAVE_WARNING_LEAVE_SELECTOR,
  HAT_PATTERN_LEAVE_WARNING_CLOSE_SELECTOR,
  HAT_PATTERN_LEAVE_WARNING_SELECTOR,
  HAT_PATTERN_LEAVE_WARNING_TITLE,
  initHatPatternLeaveWarning,
  isHatFinishedPatternVisible,
  isHatPatternLeaveHref,
  isHatPatternWorkflowHref,
  requestHatPatternLeave,
  resolveHatPatternLeaveClick,
  shouldWarnOnHatPatternLeave,
  type HatPatternLeaveWarningSession,
} from "./hatPatternLeaveWarning";

const CURRENT_URL = "https://knititnow.example/patterns/hat/pattern/";

const patternPageSource = readFileSync(
  resolve("src/pages/patterns/hat/pattern.astro"),
  "utf8",
);
const hatPatternPageScript = readFileSync(
  resolve("src/scripts/hat-pattern-page.ts"),
  "utf8",
);
const leaveWarningAstro = readFileSync(
  resolve("src/components/patterns/HatPatternLeaveWarning.astro"),
  "utf8",
);
const sleevelessPatternPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderPatternPage = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);

type FakeNode = {
  closest: (selector: string) => FakeNode | null;
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
};

function fakeNode(opts: {
  inLeaveWarning?: boolean;
  stayMarkers?: string[];
  isNewPattern?: boolean;
  anchor?: { href: string; target?: string; download?: boolean };
}): FakeNode {
  const node: FakeNode = {
    closest(selector: string) {
      if (opts.inLeaveWarning && selector === HAT_PATTERN_LEAVE_WARNING_SELECTOR) {
        return node;
      }
      if (opts.stayMarkers?.some((marker) => selector.includes(marker))) return node;
      if (
        opts.isNewPattern &&
        selector.includes("data-hat-pattern-new-pattern-trigger")
      ) {
        return node;
      }
      if (opts.anchor && selector === "a[href]") return node;
      return null;
    },
    getAttribute(name: string) {
      if (!opts.anchor) return null;
      if (name === "href") return opts.anchor.href;
      if (name === "target") return opts.anchor.target ?? null;
      if (name === "download") return opts.anchor.download ? "" : null;
      return null;
    },
    hasAttribute(name: string) {
      return node.getAttribute(name) !== null;
    },
  };
  return node;
}

describe("shouldWarnOnHatPatternLeave", () => {
  it("uses the same temporary-pattern rule as the SAVE YOUR PATTERN notice", () => {
    expect(shouldWarnOnHatPatternLeave({ viewerAccessState: "loggedOut" })).toBe(
      shouldShowHatTemporaryPatternNotice("loggedOut"),
    );
    expect(
      shouldWarnOnHatPatternLeave({ viewerAccessState: "loggedInNoAccess" }),
    ).toBe(shouldShowHatTemporaryPatternNotice("loggedInNoAccess"));
    expect(shouldWarnOnHatPatternLeave({ viewerAccessState: "memberAccess" })).toBe(
      shouldShowHatTemporaryPatternNotice("memberAccess"),
    );
    expect(
      shouldWarnOnHatPatternLeave({
        viewerAccessState: "loggedOut",
        isEditingSavedProject: true,
      }),
    ).toBe(shouldShowHatTemporaryPatternNotice("loggedOut", true));
  });

  it("does not warn for a member saved/retrievable pattern", () => {
    expect(
      shouldWarnOnHatPatternLeave({
        viewerAccessState: "memberAccess",
        isEditingSavedProject: true,
        isPatternVisible: true,
      }),
    ).toBe(false);
    expect(
      shouldWarnOnHatPatternLeave({
        viewerAccessState: "memberAccess",
        isPatternVisible: true,
      }),
    ).toBe(false);
  });

  it("does not warn when the finished pattern is not visible or Leave Anyway is in progress", () => {
    expect(
      shouldWarnOnHatPatternLeave({
        viewerAccessState: "loggedOut",
        isPatternVisible: false,
      }),
    ).toBe(false);
    expect(
      shouldWarnOnHatPatternLeave({
        viewerAccessState: "loggedOut",
        isPatternVisible: true,
        bypass: true,
      }),
    ).toBe(false);
  });
});

describe("isHatFinishedPatternVisible", () => {
  it("is true only when the results shell is present and not hidden", () => {
    expect(isHatFinishedPatternVisible(null)).toBe(false);
    const hidden = { hidden: true };
    const visible = { hidden: false };
    expect(
      isHatFinishedPatternVisible({
        querySelector: (sel: string) =>
          sel === "[data-hat-pattern-results]" ? hidden : null,
      } as unknown as ParentNode),
    ).toBe(false);
    expect(
      isHatFinishedPatternVisible({
        querySelector: (sel: string) =>
          sel === "[data-hat-pattern-results]" ? visible : null,
      } as unknown as ParentNode),
    ).toBe(true);
  });
});

describe("isHatPatternLeaveHref", () => {
  it("treats Knit It Now nav as leaving and Edit Pattern / same-page as staying", () => {
    expect(isHatPatternLeaveHref("/tools", CURRENT_URL)).toBe(true);
    expect(isHatPatternLeaveHref("/membership", CURRENT_URL)).toBe(true);
    expect(isHatPatternLeaveHref("/patterns/hat/builder", CURRENT_URL)).toBe(true);
    expect(isHatPatternLeaveHref("/patterns/hat/summary/?edit=1", CURRENT_URL)).toBe(
      false,
    );
    expect(isHatPatternLeaveHref("/patterns/hat/summary/", CURRENT_URL)).toBe(false);
    expect(isHatPatternLeaveHref("#diagram-content", CURRENT_URL)).toBe(false);
    expect(isHatPatternLeaveHref("/patterns/hat/pattern/", CURRENT_URL)).toBe(false);
    expect(isHatPatternLeaveHref("mailto:help@example.com", CURRENT_URL)).toBe(false);
  });
});

describe("isHatPatternWorkflowHref", () => {
  it("recognizes Edit Pattern / Summary destinations as in-workflow navigation", () => {
    expect(isHatPatternWorkflowHref("/patterns/hat/summary/?edit=1", CURRENT_URL)).toBe(
      true,
    );
    expect(isHatPatternWorkflowHref("/patterns/hat/summary/", CURRENT_URL)).toBe(true);
    expect(isHatPatternWorkflowHref("/tools", CURRENT_URL)).toBe(false);
    expect(isHatPatternWorkflowHref("/patterns/hat/builder", CURRENT_URL)).toBe(false);
  });
});

describe("resolveHatPatternLeaveClick", () => {
  it("warns for New Pattern and internal navigation, not Print/PDF or Edit Pattern", () => {
    expect(
      resolveHatPatternLeaveClick(
        fakeNode({ isNewPattern: true }),
        CURRENT_URL,
      ),
    ).toEqual({ action: "warn-new-pattern" });

    expect(
      resolveHatPatternLeaveClick(
        fakeNode({ anchor: { href: "/tools" } }),
        CURRENT_URL,
      ),
    ).toEqual({
      action: "warn-href",
      href: "https://knititnow.example/tools",
    });

    expect(
      resolveHatPatternLeaveClick(
        fakeNode({ stayMarkers: ["#print-btn"] }),
        CURRENT_URL,
      ),
    ).toEqual({ action: "stay" });

    expect(
      resolveHatPatternLeaveClick(
        fakeNode({ stayMarkers: ["[data-hat-pattern-print-link]"] }),
        CURRENT_URL,
      ),
    ).toEqual({ action: "stay" });

    expect(
      resolveHatPatternLeaveClick(
        fakeNode({
          stayMarkers: ["[data-hat-edit-open]"],
          anchor: { href: "/patterns/hat/summary/?edit=1" },
        }),
        CURRENT_URL,
      ),
    ).toEqual({ action: "allow-workflow-nav" });

    expect(
      resolveHatPatternLeaveClick(
        fakeNode({ anchor: { href: "/patterns/hat/summary/?edit=1" } }),
        CURRENT_URL,
      ),
    ).toEqual({ action: "allow-workflow-nav" });

    expect(
      resolveHatPatternLeaveClick(
        fakeNode({ stayMarkers: ["[data-hat-yarn-open]"] }),
        CURRENT_URL,
      ),
    ).toEqual({ action: "stay" });

    expect(
      resolveHatPatternLeaveClick(
        fakeNode({ stayMarkers: ["[data-pattern-tips-host]"] }),
        CURRENT_URL,
      ),
    ).toEqual({ action: "stay" });

    expect(
      resolveHatPatternLeaveClick(
        fakeNode({ anchor: { href: "/membership", target: "_blank" } }),
        CURRENT_URL,
      ),
    ).toEqual({ action: "stay" });
  });
});

describe("executeHatPatternLeave", () => {
  it("runs New Pattern or the original href destination", () => {
    const onNewPattern = vi.fn();
    const assignLocation = vi.fn();
    executeHatPatternLeave({ kind: "new-pattern" }, { onNewPattern, assignLocation });
    expect(onNewPattern).toHaveBeenCalledTimes(1);
    expect(assignLocation).not.toHaveBeenCalled();

    executeHatPatternLeave(
      { kind: "href", href: "https://knititnow.example/tools" },
      { onNewPattern, assignLocation },
    );
    expect(assignLocation).toHaveBeenCalledWith("https://knititnow.example/tools");
  });
});

type DialogButton = {
  addEventListener: ReturnType<typeof vi.fn>;
  handlers: Record<string, Array<() => void>>;
};

function buttonStub(): DialogButton {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    handlers,
    addEventListener: vi.fn((type: string, fn: () => void) => {
      handlers[type] ??= [];
      handlers[type].push(fn);
    }),
  };
}

function createFakeDialog() {
  const attrs: Record<string, string> = {};
  const print = buttonStub();
  const leave = buttonStub();
  const close = buttonStub();
  const dialogListeners: Record<string, Array<(event: { target?: unknown; preventDefault?: () => void }) => void>> =
    {};
  const dialog = {
    open: false,
    showModal() {
      dialog.open = true;
    },
    close() {
      dialog.open = false;
    },
    getAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
    querySelectorAll(selector: string) {
      if (selector === HAT_PATTERN_LEAVE_WARNING_PRINT_SELECTOR) return [print];
      if (selector === HAT_PATTERN_LEAVE_WARNING_LEAVE_SELECTOR) return [leave];
      if (selector === HAT_PATTERN_LEAVE_WARNING_CLOSE_SELECTOR) return [close];
      return [];
    },
    addEventListener(
      type: string,
      fn: (event: { target?: unknown; preventDefault?: () => void }) => void,
    ) {
      dialogListeners[type] ??= [];
      dialogListeners[type].push(fn);
    },
  };
  return { dialog, print, leave, close, dialogListeners };
}

function createListenOn() {
  const handlers: Record<string, Array<(event: Record<string, unknown>) => void>> = {};
  return {
    handlers,
    addEventListener: vi.fn(
      (type: string, fn: (event: Record<string, unknown>) => void) => {
        handlers[type] ??= [];
        handlers[type].push(fn);
      },
    ),
    removeEventListener: vi.fn(),
  };
}

function mountLeaveWarning(args?: {
  viewerAccessState?: "loggedOut" | "loggedInNoAccess" | "memberAccess";
  isEditingSavedProject?: boolean;
  isPatternVisible?: boolean;
}) {
  const { dialog, print, leave, close, dialogListeners } = createFakeDialog();
  const listenOn = createListenOn();
  const beforeUnloadListenOn = createListenOn();
  const onPrint = vi.fn();
  const onNewPattern = vi.fn();
  const assignLocation = vi.fn();
  const session = initHatPatternLeaveWarning({
    root: {
      querySelector: (sel: string) =>
        sel === HAT_PATTERN_LEAVE_WARNING_SELECTOR ? dialog : null,
    } as unknown as ParentNode,
    getViewerAccessState: () => args?.viewerAccessState ?? "loggedOut",
    isEditingSavedProject: () => args?.isEditingSavedProject === true,
    isPatternVisible: () => args?.isPatternVisible !== false,
    onPrint,
    onNewPattern,
    assignLocation,
    currentUrl: () => CURRENT_URL,
    listenOn,
    beforeUnloadListenOn,
  });
  return {
    session: session as HatPatternLeaveWarningSession,
    dialog,
    print,
    leave,
    close,
    dialogListeners,
    listenOn,
    beforeUnloadListenOn,
    onPrint,
    onNewPattern,
    assignLocation,
  };
}

function beforeUnloadEvent() {
  return {
    preventDefault: vi.fn(),
    returnValue: "",
  };
}

function clickEvent(target: FakeNode) {
  return {
    target,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  };
}

describe("initHatPatternLeaveWarning", () => {
  let session: HatPatternLeaveWarningSession | null = null;

  afterEach(() => {
    session?.dispose();
    session = null;
    vi.unstubAllGlobals();
  });

  it("does not open a modal when the finished pattern first loads", () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
    expect(mounted.dialog.open).toBe(false);
    expect(mounted.session.isOpen()).toBe(false);
    expect(mounted.session.pending()).toBeNull();
  });

  it("warns for temporary pattern + New Pattern, then Leave Anyway proceeds", () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
    const click = mounted.listenOn.handlers.click?.[0];
    expect(typeof click).toBe("function");

    const event = clickEvent(fakeNode({ isNewPattern: true }));
    click?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(true);
    expect(mounted.session.pending()).toEqual({ kind: "new-pattern" });
    expect(mounted.onNewPattern).not.toHaveBeenCalled();

    mounted.leave.handlers.click?.[0]?.();
    expect(mounted.onNewPattern).toHaveBeenCalledTimes(1);
    expect(mounted.dialog.open).toBe(false);
    expect(requestHatPatternLeave({ kind: "new-pattern" })).toBe(false);
  });

  it("Leave Anyway proceeds to the original internal destination", () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
    const click = mounted.listenOn.handlers.click?.[0];
    click?.(clickEvent(fakeNode({ anchor: { href: "/tools" } })));
    expect(mounted.dialog.open).toBe(true);

    mounted.leave.handlers.click?.[0]?.();
    expect(mounted.assignLocation).toHaveBeenCalledWith("https://knititnow.example/tools");
    expect(mounted.dialog.open).toBe(false);
    expect(requestHatPatternLeave({ kind: "href", href: "/membership" })).toBe(false);
  });

  it("warns for temporary pattern + internal navigation, then cancel stays on the pattern", () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
    const click = mounted.listenOn.handlers.click?.[0];
    const event = clickEvent(fakeNode({ anchor: { href: "/learn/skill-builders" } }));
    click?.(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(true);
    expect(mounted.session.pending()?.kind).toBe("href");

    mounted.close.handlers.click?.[0]?.();
    expect(mounted.assignLocation).not.toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(false);
    expect(mounted.session.pending()).toBeNull();
  });

  it("does not warn for temporary pattern + Print/PDF or Edit Pattern", () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
    const click = mounted.listenOn.handlers.click?.[0];

    const printEvent = clickEvent(fakeNode({ stayMarkers: ["#print-btn"] }));
    click?.(printEvent);
    expect(printEvent.preventDefault).not.toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(false);

    const pdfEvent = clickEvent(
      fakeNode({ stayMarkers: ["[data-hat-pattern-print-link]"] }),
    );
    click?.(pdfEvent);
    expect(pdfEvent.preventDefault).not.toHaveBeenCalled();

    const editEvent = clickEvent(
      fakeNode({
        stayMarkers: ["[data-hat-edit-open]"],
        anchor: { href: "/patterns/hat/summary/?edit=1" },
      }),
    );
    click?.(editEvent);
    expect(editEvent.preventDefault).not.toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(false);
  });

  it("Edit Pattern does not trigger the custom leave warning or beforeunload", () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
    const fireBeforeUnload = mounted.beforeUnloadListenOn.handlers.beforeunload?.[0];
    expect(typeof fireBeforeUnload).toBe("function");

    const armed = beforeUnloadEvent();
    fireBeforeUnload?.(armed);
    expect(armed.preventDefault).toHaveBeenCalled();
    expect(mounted.session.shouldWarn()).toBe(true);

    const click = mounted.listenOn.handlers.click?.[0];
    const editEvent = clickEvent(
      fakeNode({
        stayMarkers: ["[data-hat-edit-open]"],
        anchor: { href: "/patterns/hat/summary/?edit=1" },
      }),
    );
    click?.(editEvent);

    expect(editEvent.preventDefault).not.toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(false);
    expect(mounted.session.pending()).toBeNull();
    expect(mounted.session.shouldWarn()).toBe(false);

    const afterEdit = beforeUnloadEvent();
    fireBeforeUnload?.(afterEdit);
    expect(afterEdit.preventDefault).not.toHaveBeenCalled();
  });

  it("Print stays on the page without disarming beforeunload for true browser exits", () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
    const click = mounted.listenOn.handlers.click?.[0];
    click?.(clickEvent(fakeNode({ stayMarkers: ["#print-btn"] })));
    expect(mounted.dialog.open).toBe(false);
    expect(mounted.session.shouldWarn()).toBe(true);

    const armed = beforeUnloadEvent();
    mounted.beforeUnloadListenOn.handlers.beforeunload?.[0]?.(armed);
    expect(armed.preventDefault).toHaveBeenCalled();
  });

  it("Print / Download Pattern cancels navigation and reuses the existing print action", () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
    mounted.session.requestLeave({
      kind: "href",
      href: "https://knititnow.example/tools",
    });
    expect(mounted.dialog.open).toBe(true);

    mounted.print.handlers.click?.[0]?.();
    expect(mounted.onPrint).toHaveBeenCalledTimes(1);
    expect(mounted.assignLocation).not.toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(false);
    expect(mounted.session.pending()).toBeNull();
  });

  it("Escape / backdrop cancel leave the knitter on the current pattern", () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
    mounted.session.requestLeave({ kind: "new-pattern" });
    expect(mounted.dialog.open).toBe(true);

    const cancel = mounted.dialogListeners.cancel?.[0];
    cancel?.({ preventDefault: vi.fn() });
    expect(mounted.onNewPattern).not.toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(false);

    mounted.session.requestLeave({
      kind: "href",
      href: "https://knititnow.example/membership",
    });
    const backdrop = mounted.dialogListeners.click?.[0];
    backdrop?.({ target: mounted.dialog });
    expect(mounted.assignLocation).not.toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(false);
  });

  it("does not warn for a saved member pattern", () => {
    const mounted = mountLeaveWarning({
      viewerAccessState: "memberAccess",
      isEditingSavedProject: true,
    });
    session = mounted.session;
    const click = mounted.listenOn.handlers.click?.[0];
    const event = clickEvent(fakeNode({ isNewPattern: true }));
    click?.(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(mounted.dialog.open).toBe(false);
    expect(mounted.session.requestLeave({ kind: "new-pattern" })).toBe(false);
  });

  it("New Pattern shouldProceed is false while the warning is shown", async () => {
    const mounted = mountLeaveWarning();
    session = mounted.session;
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

    initHatPatternNewPattern(doc, {
      shouldProceed: () => !requestHatPatternLeave({ kind: "new-pattern" }),
    });
    const handler = trigger.addEventListener.mock.calls.find(
      ([event]) => event === "click",
    )?.[1] as (() => void) | undefined;

    handler?.();
    expect(mounted.dialog.open).toBe(true);
    expect(startSpy).not.toHaveBeenCalled();
    startSpy.mockRestore();
  });
});

describe("Hat Pattern leave-warning page wiring", () => {
  it("keeps the SAVE YOUR PATTERN persist notice and adds the leave modal only on Hat", () => {
    expect(patternPageSource).toContain("hat-pattern-persist-notice");
    expect(patternPageSource).toContain("HAT_PATTERN_PERSIST_NOTICE_TITLE");
    expect(patternPageSource).toContain("HAT_PATTERN_PERSIST_WARNING_LEAD");
    expect(patternPageSource).toContain("HatPatternLeaveWarning");
    expect(leaveWarningAstro).toContain("HAT_PATTERN_LEAVE_WARNING_TITLE");
    expect(leaveWarningAstro).toContain("HAT_PATTERN_LEAVE_WARNING_LEAD");
    expect(leaveWarningAstro).toContain("HAT_PATTERN_LEAVE_WARNING_EMPHASIS");
    expect(leaveWarningAstro).toContain("HAT_PATTERN_LEAVE_WARNING_PRINT_LABEL");
    expect(leaveWarningAstro).toContain("HAT_PATTERN_LEAVE_WARNING_LEAVE_LABEL");
    expect(HAT_PATTERN_LEAVE_WARNING_TITLE).toBe("Before You Go...");
    expect(HAT_PATTERN_LEAVE_WARNING_LEAD).toBe(
      "Your pattern is temporary and cannot be retrieved later.",
    );
    expect(HAT_PATTERN_LEAVE_WARNING_EMPHASIS).toBe(
      "Print or download your pattern before leaving so you don't lose it.",
    );
    expect(HAT_PATTERN_LEAVE_WARNING_PRINT_LABEL).toBe("Print / Download Pattern");
    expect(HAT_PATTERN_LEAVE_WARNING_LEAVE_LABEL).toBe("Leave Anyway");
    expect(hatPatternPageScript).toContain("initHatPatternLeaveWarning");
    expect(hatPatternPageScript).toContain("requestHatPatternLeave");
    expect(hatPatternPageScript).toContain("runHatPatternPrint");
    expect(hatPatternPageScript).toContain("isEditingSavedHatProject");
    expect(sleevelessPatternPage).not.toContain("HatPatternLeaveWarning");
    expect(dropShoulderPatternPage).not.toContain("HatPatternLeaveWarning");
  });

  it("does not open the leave warning from the persist notice itself", () => {
    expect(patternPageSource).toContain("data-hat-pattern-persist-notice");
    expect(leaveWarningAstro).not.toContain("showModal");
    expect(hatPatternPageScript).not.toMatch(
      /initHatPatternLeaveWarning[\s\S]{0,200}showModal/,
    );
  });
});
