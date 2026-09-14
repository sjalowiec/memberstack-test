/**
 * Account My Courses initialization timing.
 *
 * Ownership mapping stays in accountMyCourses.ts. This module only decides
 * when to hydrate: the members dashboard may be inserted after Memberstack
 * authenticates, and an early member payload may omit planConnections.
 */
import { isMemberLoggedIn } from "../memberAccess";
import { memberstackPlanConnections } from "../sharedMemberAccessPublish";

export const ACCOUNT_MY_COURSES_ROOT_SELECTOR = "[data-kbm-my-courses]";

export type AccountMyCoursesMemberstack = {
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  onAuthChange?: (handler: (...args: unknown[]) => void) => unknown;
  onReady?: Promise<unknown>;
};

export type AccountMyCoursesObserver = {
  disconnect: () => void;
};

export type AccountMyCoursesInitDeps = {
  getRoot: () => HTMLElement | null;
  applyView: (root: HTMLElement, payload: unknown) => void;
  readPayload: () => Promise<unknown | null>;
  addWindowListener: (type: string, listener: () => void) => void;
  getMemberstack: () => AccountMyCoursesMemberstack | null | undefined;
  startObserver: (onMutate: () => void) => AccountMyCoursesObserver;
};

/**
 * True when the payload is finished enough to show or hide the panel.
 * A logged-in member missing `planConnections` is still loading — wait for
 * Memberstack / `auth:updated` instead of treating that as “no courses”.
 */
export function isAccountMyCoursesPayloadReady(payload: unknown): boolean {
  if (payload == null) return true;
  if (!isMemberLoggedIn(payload)) return true;
  return memberstackPlanConnections(payload) !== undefined;
}

export function findAccountMyCoursesRoot(
  root: Pick<ParentNode, "querySelector">,
): HTMLElement | null {
  const el = root.querySelector(ACCOUNT_MY_COURSES_ROOT_SELECTOR);
  return el instanceof HTMLElement ? el : null;
}

export function createAccountMyCoursesController(deps: AccountMyCoursesInitDeps) {
  let windowListenersBound = false;
  let memberstackListenersBound = false;
  let observer: AccountMyCoursesObserver | null = null;
  let syncGeneration = 0;

  function stopObserver(): void {
    observer?.disconnect();
    observer = null;
  }

  function ensureObserver(): void {
    if (observer || deps.getRoot()) return;
    observer = deps.startObserver(() => {
      if (!deps.getRoot()) return;
      stopObserver();
      void sync();
    });
  }

  function bindMemberstackListeners(): void {
    if (memberstackListenersBound) return;
    const ms = deps.getMemberstack();
    if (!ms) return;

    const onUpdate = () => {
      void sync();
    };

    if (typeof ms.on === "function") {
      ms.on("member.login", onUpdate);
      ms.on("member.logout", onUpdate);
      memberstackListenersBound = true;
    }

    if (typeof ms.onAuthChange === "function") {
      ms.onAuthChange(onUpdate);
      memberstackListenersBound = true;
    }

    if (!memberstackListenersBound && ms.onReady) {
      void ms.onReady.then(() => bindMemberstackListeners());
    }
  }

  function bindWindowListeners(): void {
    if (windowListenersBound) return;
    windowListenersBound = true;
    deps.addWindowListener("auth:updated", () => {
      void sync();
    });
  }

  async function sync(): Promise<void> {
    const generation = ++syncGeneration;
    bindMemberstackListeners();

    const root = deps.getRoot();
    if (!root) {
      ensureObserver();
      return;
    }
    stopObserver();

    const payload = await deps.readPayload();
    if (generation !== syncGeneration) return;

    bindMemberstackListeners();

    if (!isAccountMyCoursesPayloadReady(payload)) {
      return;
    }

    deps.applyView(root, isMemberLoggedIn(payload) ? payload : null);
  }

  function boot(): void {
    bindWindowListeners();
    bindMemberstackListeners();
    void sync();
  }

  return {
    boot,
    sync,
    get debug() {
      return {
        windowListenersBound,
        memberstackListenersBound,
        observing: observer != null,
      };
    },
  };
}
