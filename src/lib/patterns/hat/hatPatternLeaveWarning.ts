/**
 * Leave-page warning for temporary / free Hat Patterns.
 *
 * Complements the on-page SAVE YOUR PATTERN persist notice. Do not show on load —
 * only when the knitter is about to navigate away from a temporary pattern.
 *
 * Who sees it: the same rule as the persist notice
 * ({@link shouldShowHatTemporaryPatternNotice}). Members and leftover saved-project
 * sessions do not get this warning.
 */
import type { ViewerAccessState } from "../../memberAccess";
import { startNewHatPatternFromFinishedPage } from "./hatFreshStart";
import { HAT_SUMMARY_EDIT_HREF } from "./hatPatternNavigation";
import { shouldShowHatTemporaryPatternNotice } from "./hatPatternPersistNotice";

export const HAT_PATTERN_LEAVE_WARNING_TITLE = "Before You Go...";

export const HAT_PATTERN_LEAVE_WARNING_LEAD =
  "Your pattern is temporary and cannot be retrieved later.";

export const HAT_PATTERN_LEAVE_WARNING_EMPHASIS =
  "Print or download your pattern before leaving so you don't lose it.";

export const HAT_PATTERN_LEAVE_WARNING_PRINT_LABEL = "Print / Download Pattern";

export const HAT_PATTERN_LEAVE_WARNING_LEAVE_LABEL = "Leave Anyway";

export const HAT_PATTERN_LEAVE_WARNING_SELECTOR = "[data-hat-pattern-leave-warning]";
export const HAT_PATTERN_LEAVE_WARNING_PRINT_SELECTOR =
  "[data-hat-pattern-leave-warning-print]";
export const HAT_PATTERN_LEAVE_WARNING_LEAVE_SELECTOR =
  "[data-hat-pattern-leave-warning-leave]";
export const HAT_PATTERN_LEAVE_WARNING_CLOSE_SELECTOR =
  "[data-hat-pattern-leave-warning-close]";

const BOUND_ATTR = "data-hat-pattern-leave-warning-bound";
const INTERCEPTS_BOUND_ATTR = "data-hat-pattern-leave-intercepts-bound";

const STAY_CONTROL_SELECTOR = [
  "#print-btn",
  "[data-hat-pattern-print-link]",
  "[data-hat-yarn-open]",
  "[data-hat-yarn-drawer]",
  "[data-pattern-tips-host]",
  ".pattern-tip",
  "[data-hat-pattern-leave-warning]",
  "[data-ms-modal]",
].join(",");

const WORKFLOW_NAV_SELECTOR = "[data-hat-edit-open]";

export type HatPatternLeavePending =
  | { kind: "href"; href: string }
  | { kind: "new-pattern" };

export type HatPatternLeaveClickResult =
  | { action: "stay" }
  | { action: "allow-workflow-nav" }
  | { action: "warn-new-pattern" }
  | { action: "warn-href"; href: string };

export type HatPatternLeaveWarningGate = {
  viewerAccessState: ViewerAccessState;
  isEditingSavedProject?: boolean;
  isPatternVisible?: boolean;
  bypass?: boolean;
};

/** Same membership / saved-project rule as the SAVE YOUR PATTERN notice. */
export function shouldWarnOnHatPatternLeave(gate: HatPatternLeaveWarningGate): boolean {
  if (gate.bypass) return false;
  if (gate.isPatternVisible === false) return false;
  return shouldShowHatTemporaryPatternNotice(
    gate.viewerAccessState,
    gate.isEditingSavedProject === true,
  );
}

export function isHatFinishedPatternVisible(root: ParentNode | null): boolean {
  if (!root || typeof root.querySelector !== "function") return false;
  const results = root.querySelector("[data-hat-pattern-results]");
  if (!results || !("hidden" in results)) return false;
  return (results as HTMLElement).hidden !== true;
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function hatSummaryPathname(): string {
  return normalizePathname(new URL(HAT_SUMMARY_EDIT_HREF, "https://knititnow.example").pathname);
}

/** Edit Pattern / Summary — still in the Hat workflow, not a leave. */
export function isHatPatternWorkflowHref(href: string, currentUrl: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) return false;
  try {
    const current = new URL(currentUrl);
    const next = new URL(trimmed, current);
    return (
      next.origin === current.origin &&
      normalizePathname(next.pathname) === hatSummaryPathname()
    );
  } catch {
    return false;
  }
}

/**
 * True when following this href would leave the finished Hat Pattern page.
 * Same-page hashes, Edit Pattern / Summary, and non-navigation protocols stay.
 */
export function isHatPatternLeaveHref(href: string, currentUrl: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) return false;
  if (/^(mailto:|tel:|javascript:|sms:)/i.test(trimmed)) return false;
  if (isHatPatternWorkflowHref(trimmed, currentUrl)) return false;

  try {
    const current = new URL(currentUrl);
    const next = new URL(trimmed, current);
    if (next.origin === current.origin) {
      const nextPath = normalizePathname(next.pathname);
      if (nextPath === normalizePathname(current.pathname)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function resolveHatPatternLeaveHref(href: string, currentUrl: string): string {
  try {
    return new URL(href, currentUrl).href;
  } catch {
    return href;
  }
}

type ClosestNode = {
  closest: (selector: string) => ClosestNode | null;
  getAttribute?: (name: string) => string | null;
  hasAttribute?: (name: string) => boolean;
};

function hasAttr(el: ClosestNode | null, name: string): boolean {
  if (!el) return false;
  if (typeof el.hasAttribute === "function") return el.hasAttribute(name);
  return Boolean(el.getAttribute?.(name));
}

/**
 * Classify a click: stay on the pattern, warn for New Pattern, or warn for a leaving link.
 */
export function resolveHatPatternLeaveClick(
  target: ClosestNode | null,
  currentUrl: string,
): HatPatternLeaveClickResult {
  if (!target || typeof target.closest !== "function") return { action: "stay" };
  if (target.closest(HAT_PATTERN_LEAVE_WARNING_SELECTOR)) return { action: "stay" };
  if (target.closest(WORKFLOW_NAV_SELECTOR)) return { action: "allow-workflow-nav" };
  if (target.closest(STAY_CONTROL_SELECTOR)) return { action: "stay" };
  if (target.closest("[data-hat-pattern-new-pattern-trigger]")) {
    return { action: "warn-new-pattern" };
  }

  const anchor = target.closest("a[href]");
  if (!anchor) return { action: "stay" };
  if (hasAttr(anchor, "download")) return { action: "stay" };
  const targetAttr = (anchor.getAttribute?.("target") ?? "").trim().toLowerCase();
  if (targetAttr === "_blank") return { action: "stay" };

  const href = anchor.getAttribute?.("href") ?? "";
  if (isHatPatternWorkflowHref(href, currentUrl)) return { action: "allow-workflow-nav" };
  if (!isHatPatternLeaveHref(href, currentUrl)) return { action: "stay" };
  return { action: "warn-href", href: resolveHatPatternLeaveHref(href, currentUrl) };
}

export function executeHatPatternLeave(
  pending: HatPatternLeavePending,
  deps: {
    onNewPattern?: () => void;
    assignLocation?: (href: string) => void;
  } = {},
): void {
  if (pending.kind === "new-pattern") {
    (deps.onNewPattern ?? startNewHatPatternFromFinishedPage)();
    return;
  }
  const assign =
    deps.assignLocation ??
    ((href: string) => {
      if (typeof window !== "undefined") window.location.assign(href);
    });
  assign(pending.href);
}

export type HatPatternLeaveWarningSession = {
  requestLeave: (pending: HatPatternLeavePending) => boolean;
  stayAndPrint: () => void;
  confirmLeave: () => void;
  cancel: () => void;
  isOpen: () => boolean;
  pending: () => HatPatternLeavePending | null;
  /** True when the native beforeunload prompt is still armed. */
  shouldWarn: () => boolean;
  dispose: () => void;
};

type EventListenTarget = {
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
};

export type InitHatPatternLeaveWarningOptions = {
  root?: ParentNode;
  getViewerAccessState: () => ViewerAccessState;
  isEditingSavedProject?: () => boolean;
  isPatternVisible?: () => boolean;
  onPrint: () => void;
  onNewPattern?: () => void;
  assignLocation?: (href: string) => void;
  currentUrl?: () => string;
  listenOn?: EventListenTarget;
  /** Defaults to `window`. Injected in tests so beforeunload can be asserted. */
  beforeUnloadListenOn?: EventListenTarget;
};

type LeaveWarningRuntime = HatPatternLeaveWarningSession & {
  shouldWarn: () => boolean;
};

let runtime: LeaveWarningRuntime | null = null;

function isDialogElement(el: Element | null): el is HTMLDialogElement {
  return (
    !!el &&
    typeof (el as HTMLDialogElement).showModal === "function" &&
    typeof (el as HTMLDialogElement).close === "function"
  );
}

function getDialog(root?: ParentNode): HTMLDialogElement | null {
  const scopes: ParentNode[] = [];
  if (root && typeof root.querySelector === "function") scopes.push(root);
  if (typeof document !== "undefined" && typeof document.querySelector === "function") {
    scopes.push(document);
  }
  for (const scope of scopes) {
    const el = scope.querySelector(HAT_PATTERN_LEAVE_WARNING_SELECTOR);
    if (isDialogElement(el)) return el;
  }
  return null;
}

function readCurrentUrl(options: InitHatPatternLeaveWarningOptions): string {
  if (options.currentUrl) return options.currentUrl();
  if (typeof window !== "undefined" && window.location?.href) return window.location.href;
  return "https://knititnow.example/patterns/hat/pattern/";
}

/**
 * Ask to leave. Returns true when the warning was shown and navigation should stop.
 */
export function requestHatPatternLeave(pending: HatPatternLeavePending): boolean {
  return runtime?.requestLeave(pending) === true;
}

export function initHatPatternLeaveWarning(
  options: InitHatPatternLeaveWarningOptions,
): HatPatternLeaveWarningSession | null {
  const root = options.root ?? (typeof document !== "undefined" ? document : null);
  const dialog = getDialog(root ?? undefined);
  if (!dialog) return null;

  let pending: HatPatternLeavePending | null = null;
  let bypass = false;
  let disposed = false;

  const shouldWarn = (): boolean =>
    shouldWarnOnHatPatternLeave({
      viewerAccessState: options.getViewerAccessState(),
      isEditingSavedProject: options.isEditingSavedProject?.() === true,
      isPatternVisible:
        options.isPatternVisible?.() ?? isHatFinishedPatternVisible(root),
      bypass,
    });

  const closeDialog = (): void => {
    if (dialog.open) dialog.close();
  };

  const showDialog = (): boolean => {
    if (typeof dialog.showModal !== "function") return false;
    if (!dialog.open) dialog.showModal();
    return true;
  };

  const cancel = (): void => {
    pending = null;
    closeDialog();
  };

  const stayAndPrint = (): void => {
    pending = null;
    closeDialog();
    options.onPrint();
  };

  const confirmLeave = (): void => {
    const next = pending;
    pending = null;
    bypass = true;
    closeDialog();
    if (!next) return;
    executeHatPatternLeave(next, {
      onNewPattern: options.onNewPattern,
      assignLocation: options.assignLocation,
    });
  };

  const requestLeave = (next: HatPatternLeavePending): boolean => {
    if (disposed || !shouldWarn()) return false;
    pending = next;
    return showDialog();
  };

  const session: LeaveWarningRuntime = {
    requestLeave,
    stayAndPrint,
    confirmLeave,
    cancel,
    isOpen: () => dialog.open === true,
    pending: () => pending,
    shouldWarn,
    dispose: () => {
      disposed = true;
      if (runtime === session) runtime = null;
    },
  };

  if (dialog.getAttribute(BOUND_ATTR) !== "true") {
    dialog.setAttribute(BOUND_ATTR, "true");

    dialog.querySelectorAll(HAT_PATTERN_LEAVE_WARNING_PRINT_SELECTOR).forEach((el) => {
      el.addEventListener("click", () => stayAndPrint());
    });
    dialog.querySelectorAll(HAT_PATTERN_LEAVE_WARNING_LEAVE_SELECTOR).forEach((el) => {
      el.addEventListener("click", () => confirmLeave());
    });
    dialog.querySelectorAll(HAT_PATTERN_LEAVE_WARNING_CLOSE_SELECTOR).forEach((el) => {
      el.addEventListener("click", () => cancel());
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) cancel();
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      cancel();
    });
  }

  const listenOn =
    options.listenOn ?? (typeof document !== "undefined" ? document : null);
  const ElementCtor = typeof Element !== "undefined" ? Element : undefined;
  const listenEl = ElementCtor && listenOn instanceof ElementCtor ? listenOn : null;
  if (listenOn && (!listenEl || listenEl.getAttribute(INTERCEPTS_BOUND_ATTR) !== "true")) {
    if (listenEl) {
      listenEl.setAttribute(INTERCEPTS_BOUND_ATTR, "true");
    } else if (typeof document !== "undefined" && listenOn === document) {
      document.documentElement.setAttribute(INTERCEPTS_BOUND_ATTR, "true");
    }

    const onClick = (event: Event): void => {
      if (disposed || bypass) return;
      const mouse = event as MouseEvent;
      if (typeof mouse.button === "number" && mouse.button !== 0) return;
      if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;
      const target = event.target;
      if (!target || typeof (target as ClosestNode).closest !== "function") return;

      const result = resolveHatPatternLeaveClick(target as ClosestNode, readCurrentUrl(options));
      if (result.action === "allow-workflow-nav") {
        bypass = true;
        return;
      }
      if (result.action === "stay") return;
      if (!shouldWarn()) return;

      if (typeof mouse.preventDefault === "function") mouse.preventDefault();
      if (typeof mouse.stopPropagation === "function") mouse.stopPropagation();
      if (typeof mouse.stopImmediatePropagation === "function") {
        mouse.stopImmediatePropagation();
      }

      if (result.action === "warn-new-pattern") {
        requestLeave({ kind: "new-pattern" });
        return;
      }
      requestLeave({ kind: "href", href: result.href });
    };

    listenOn.addEventListener("click", onClick, true);

    const onSubmit = (event: Event): void => {
      if (disposed || bypass || !shouldWarn()) return;
      const form = event.target;
      const FormCtor = typeof HTMLFormElement !== "undefined" ? HTMLFormElement : undefined;
      if (!FormCtor || !(form instanceof FormCtor)) return;
      const action = form.getAttribute("action") ?? "";
      if (!action || !isHatPatternLeaveHref(action, readCurrentUrl(options))) return;
      event.preventDefault();
      requestLeave({
        kind: "href",
        href: resolveHatPatternLeaveHref(action, readCurrentUrl(options)),
      });
    };
    listenOn.addEventListener("submit", onSubmit, true);
  }

  const onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (disposed || !shouldWarn()) return;
    event.preventDefault();
    event.returnValue = "";
  };
  const beforeUnloadTarget =
    options.beforeUnloadListenOn ??
    (typeof window !== "undefined" ? window : null);
  if (beforeUnloadTarget) {
    beforeUnloadTarget.addEventListener("beforeunload", onBeforeUnload);
  }

  runtime = session;
  const originalDispose = session.dispose;
  session.dispose = () => {
    originalDispose();
    beforeUnloadTarget?.removeEventListener("beforeunload", onBeforeUnload);
  };
  return session;
}
