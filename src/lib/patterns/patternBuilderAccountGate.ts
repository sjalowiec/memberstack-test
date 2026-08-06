/**
 * Membership gate for the Blanket pattern builder (and any other builders that
 * opt in). Hat is free and does not use this module.
 *
 * Gated builders require active Knit it Now membership via {@link hasMemberAccess}.
 * Login alone never grants generate/print access.
 *
 * Customer-facing UI offers Become a Member + Log In (or View Membership when
 * already signed in without access). No free-account signup path.
 */
import { getViewerAccessState, hasMemberAccess, type ViewerAccessState } from "../memberAccess";
import { openMemberstackLoginModal } from "../memberstackLogin";
import { waitForMemberstackDom, waitForMemberstackReady } from "./sleevelessPatternLoginGate";

export const PATTERN_BUILDER_ACCOUNT_GATE_TITLE = "Available with Knit it Now membership";
export const PATTERN_BUILDER_ACCOUNT_GATE_BODY =
  "Dynamic Patterns are included with an active Knit it Now membership. Become a member to build and print custom blanket patterns.";
export const PATTERN_BUILDER_ACCOUNT_GATE_PRIMARY_LABEL = "Become a Member";
export const PATTERN_BUILDER_ACCOUNT_GATE_PRIMARY_HREF = "/membership";
export const PATTERN_BUILDER_ACCOUNT_GATE_LOGIN_LABEL = "Already a Member? Log In";
export const PATTERN_BUILDER_ACCOUNT_GATE_NO_ACCESS_BODY =
  "You're signed in, but Dynamic Patterns need an active Knit it Now membership.";
export const PATTERN_BUILDER_ACCOUNT_GATE_VIEW_MEMBERSHIP_LABEL = "View Membership";
export const PATTERN_BUILDER_ACCOUNT_GATE_VIEW_MEMBERSHIP_HREF = "/account#membership";

const MODAL_SELECTOR = "[data-pattern-builder-account-gate]";
const BOUND_ATTR = "data-pattern-builder-account-gate-bound";

export interface EnsurePatternBuilderAccountDeps {
  /** Resolves membership access. Defaults to Memberstack + {@link hasMemberAccess}. */
  hasAccess?: () => Promise<boolean>;
  /** @deprecated Use hasAccess. Kept so older tests that stub isLoggedIn still compile. */
  isLoggedIn?: () => Promise<boolean>;
  /** Shows the membership prompt when access is denied. */
  openAccountPrompt?: () => void;
}

async function resolveViewerAccessState(): Promise<ViewerAccessState> {
  if (typeof window === "undefined") return "loggedOut";
  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return "loggedOut";
  try {
    await waitForMemberstackReady(ms);
    const res = await ms.getCurrentMember();
    return getViewerAccessState(res);
  } catch {
    return "loggedOut";
  }
}

async function hasPatternBuilderMembershipAccess(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return false;
  try {
    await waitForMemberstackReady(ms);
    const res = await ms.getCurrentMember();
    return hasMemberAccess(res);
  } catch {
    return false;
  }
}

/**
 * Returns `true` when the visitor may generate/view a pattern (active membership).
 * When denied, opens the membership prompt and returns `false`.
 */
export async function ensurePatternBuilderAccount(
  deps: EnsurePatternBuilderAccountDeps = {},
): Promise<boolean> {
  const hasAccess =
    deps.hasAccess ??
    deps.isLoggedIn ??
    hasPatternBuilderMembershipAccess;
  const openAccountPrompt = deps.openAccountPrompt ?? (() => void showPatternBuilderAccountGate());

  let allowed = false;
  try {
    allowed = await hasAccess();
  } catch {
    allowed = false;
  }

  if (import.meta.env?.DEV) {
    console.debug("[pattern-builder-account-gate] membership check resolved:", allowed);
  }

  if (allowed) return true;

  await Promise.resolve(openAccountPrompt());
  return false;
}

/**
 * Upfront membership nudge before building. Fail closed while Memberstack initializes.
 */
export async function promptPatternBuilderAccountOnLoad(
  deps: EnsurePatternBuilderAccountDeps = {},
): Promise<boolean> {
  await waitForMemberstackDom();
  return ensurePatternBuilderAccount(deps);
}

const BUILDER_LOCK_CLASS = "pattern-builder-locked";
const BUILDER_LOCK_OUT_CLASS = "pattern-builder-locked--out";
const BUILDER_LOCK_OVERLAY_CLASS = "pattern-builder-lock-overlay";
const BUILDER_LOCK_FOCUS_HANDLER = "__kbmBuilderLockFocusIn";

function applyBuilderLock(container: HTMLElement, openPrompt: () => void): void {
  container.classList.add(BUILDER_LOCK_CLASS);

  if (!container.querySelector(`.${BUILDER_LOCK_OVERLAY_CLASS}`)) {
    const overlay = document.createElement("div");
    overlay.className = BUILDER_LOCK_OVERLAY_CLASS;
    overlay.setAttribute("role", "button");
    overlay.setAttribute("tabindex", "0");
    overlay.setAttribute("aria-label", PATTERN_BUILDER_ACCOUNT_GATE_TITLE);
    const trigger = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      openPrompt();
    };
    overlay.addEventListener("click", trigger);
    overlay.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Enter" || key === " " || key === "Spacebar") trigger(event);
    });
    container.appendChild(overlay);
  }

  if (!(container as unknown as Record<string, unknown>)[BUILDER_LOCK_FOCUS_HANDLER]) {
    const onFocusIn = (event: FocusEvent): void => {
      if (!container.classList.contains(BUILDER_LOCK_CLASS)) return;
      const target = event.target as HTMLElement | null;
      if (!target || target.classList?.contains(BUILDER_LOCK_OVERLAY_CLASS)) return;
      target.blur?.();
      openPrompt();
    };
    container.addEventListener("focusin", onFocusIn, true);
    (container as unknown as Record<string, unknown>)[BUILDER_LOCK_FOCUS_HANDLER] = onFocusIn;
  }
}

function releaseBuilderLock(container: HTMLElement): void {
  container.classList.remove(BUILDER_LOCK_CLASS, BUILDER_LOCK_OUT_CLASS);
  container.querySelector(`.${BUILDER_LOCK_OVERLAY_CLASS}`)?.remove();
  const store = container as unknown as Record<string, unknown>;
  const handler = store[BUILDER_LOCK_FOCUS_HANDLER] as EventListener | undefined;
  if (handler) {
    container.removeEventListener("focusin", handler, true);
    delete store[BUILDER_LOCK_FOCUS_HANDLER];
  }
}

export interface LockPatternBuilderDeps extends EnsurePatternBuilderAccountDeps {
  hasAccess?: () => Promise<boolean>;
  isLoggedIn?: () => Promise<boolean>;
}

/**
 * Fail-closed builder lock until active membership is confirmed.
 */
export async function lockPatternBuilderForLoggedOut(
  container: HTMLElement | null,
  deps: LockPatternBuilderDeps = {},
): Promise<boolean> {
  if (typeof window === "undefined" || !container) {
    return promptPatternBuilderAccountOnLoad(deps);
  }

  const openPrompt = deps.openAccountPrompt ?? (() => void showPatternBuilderAccountGate());
  const hasAccess =
    deps.hasAccess ??
    deps.isLoggedIn ??
    hasPatternBuilderMembershipAccess;

  applyBuilderLock(container, openPrompt);

  let allowed = false;
  try {
    allowed = await hasAccess();
  } catch {
    allowed = false;
  }

  if (import.meta.env?.DEV) {
    console.debug("[pattern-builder-account-gate] builder lock membership check:", allowed);
  }

  if (allowed) {
    releaseBuilderLock(container);
    return true;
  }

  container.classList.add(BUILDER_LOCK_OUT_CLASS);
  openPrompt();

  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    try {
      ms.on("member.login", () => {
        void hasPatternBuilderMembershipAccess().then((ok) => {
          if (ok) releaseBuilderLock(container);
        });
      });
    } catch {
      /* memberstack event wiring is best-effort */
    }
  }
  return false;
}

function isDialogElement(el: Element | null): el is HTMLDialogElement {
  return (
    !!el &&
    typeof (el as HTMLDialogElement).showModal === "function" &&
    typeof (el as HTMLDialogElement).close === "function"
  );
}

function getDialog(root?: ParentNode): HTMLDialogElement | null {
  if (typeof document === "undefined" && !root) return null;
  const scopes: ParentNode[] = [];
  if (root && typeof root.querySelector === "function") scopes.push(root);
  if (typeof document !== "undefined" && typeof document.querySelector === "function") {
    scopes.push(document);
  }
  for (const scope of scopes) {
    const el = scope.querySelector(MODAL_SELECTOR);
    if (isDialogElement(el)) return el;
  }
  return null;
}

/** Shows the membership gate modal. Returns true when the modal was shown. */
export async function showPatternBuilderAccountGate(options?: {
  root?: ParentNode;
}): Promise<boolean> {
  const dialog = getDialog(options?.root);
  if (!dialog || typeof dialog.showModal !== "function") return false;

  const viewer = await resolveViewerAccessState();
  if (typeof dialog.querySelector === "function") {
    const bodyEl = dialog.querySelector("[data-account-gate-body]");
    const loginBtn = dialog.querySelector("[data-account-gate-login]");
    const viewMembership = dialog.querySelector("[data-account-gate-view-membership]");
    const becomeMember = dialog.querySelector("[data-account-gate-membership]");

    if (bodyEl) {
      bodyEl.textContent =
        viewer === "loggedInNoAccess"
          ? PATTERN_BUILDER_ACCOUNT_GATE_NO_ACCESS_BODY
          : PATTERN_BUILDER_ACCOUNT_GATE_BODY;
    }
    if (loginBtn instanceof HTMLElement) {
      loginBtn.hidden = viewer === "loggedInNoAccess";
    }
    if (viewMembership instanceof HTMLElement) {
      viewMembership.hidden = viewer !== "loggedInNoAccess";
    }
    if (becomeMember instanceof HTMLElement) {
      becomeMember.hidden = false;
    }
  }

  if (!dialog.open) dialog.showModal();
  return true;
}

export interface PatternBuilderAccountGateModalDeps {
  openLogin?: (returnPath?: string) => void;
}

/**
 * Wires the membership gate modal CTAs once per dialog instance.
 */
export function initPatternBuilderAccountGate(
  root: ParentNode = typeof document !== "undefined" ? document : ({} as ParentNode),
  deps: PatternBuilderAccountGateModalDeps = {},
): void {
  const dialog = getDialog(root);
  if (!dialog || dialog.getAttribute(BOUND_ATTR) === "true") return;
  dialog.setAttribute(BOUND_ATTR, "true");

  const openLogin = deps.openLogin ?? openMemberstackLoginModal;

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  dialog.querySelectorAll("[data-account-gate-login]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      close();
      openLogin();
    });
  });

  dialog.querySelectorAll("[data-account-gate-dismiss]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      close();
    });
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
}

/**
 * Installs the membership-gate globals for inline builder scripts.
 */
export function installPatternBuilderAccountGate(): void {
  if (typeof window === "undefined") return;
  window.kbmEnsurePatternBuilderAccountGate = () => ensurePatternBuilderAccount();
  window.kbmOpenPatternBuilderAccountPrompt = () => {
    void showPatternBuilderAccountGate();
  };
}
