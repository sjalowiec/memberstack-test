/**
 * Show/hide course catalog card locks from Memberstack + course access rules.
 * Markup uses the shared `.kbm-lock-overlay` pattern (see videos catalog / global.css).
 *
 * Also applies free-first catalog ordering for visitors without member access:
 * sections that contain free courses rise above member-only sections, and free
 * cards rise within each section. Active members restore stamped catalog order.
 */
import {
  canAccessCourse,
  normalizeCourseAccessLevel,
} from "../lib/courseAccess";
import {
  applyCourseCatalogDomOrder,
  preferCourseCatalogFreeFirst,
} from "../lib/coursesCatalogFreeFirst";
import { logMemberAccessDebug } from "../lib/memberAccess";
import { videoDevBypass } from "../lib/devBypass";

async function waitForMemberstackReady({ attempts = 30, delayMs = 200 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const api = window.$memberstackDom?.getAppAndMember;
      if (typeof api === "function") return await api();
    } catch {
      /* keep polling */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

function isForceUnlock(): boolean {
  return (
    videoDevBypass ||
    new URLSearchParams(window.location.search).get("mode") === "full"
  );
}

function applyCatalogOrder(memberOrPayload: unknown): void {
  // Missing/delayed Memberstack => non-member ordering (never assume member).
  const preferFreeFirst = preferCourseCatalogFreeFirst(memberOrPayload);
  applyCourseCatalogDomOrder(document, preferFreeFirst);
}

function applyLocks(memberOrPayload: unknown): void {
  const forceUnlock = isForceUnlock();

  document
    .querySelectorAll<HTMLElement>("[data-course-catalog-card]")
    .forEach((card) => {
      const access = normalizeCourseAccessLevel(card.dataset.courseAccess);
      const lock = card.querySelector<HTMLElement>(
        "[data-course-catalog-lock]",
      );
      if (!lock) return;

      // Free courses never render a lock; keep this defensive.
      if (access === "free") {
        setLockVisible(lock, false);
        return;
      }

      const courseSlug = card.dataset.courseSlug ?? null;
      const unlocked =
        forceUnlock || canAccessCourse(access, memberOrPayload, { courseSlug });
      setLockVisible(lock, !unlocked);
    });

  applyCatalogOrder(memberOrPayload);
}

/** Prefer style over [hidden]: `.kbm-lock-overlay { display:flex }` can override [hidden]. */
function setLockVisible(lock: HTMLElement, visible: boolean): void {
  lock.hidden = !visible;
  lock.style.display = visible ? "" : "none";
  lock.setAttribute("aria-hidden", visible ? "false" : "true");
}

async function resolveLocks(): Promise<void> {
  // Default immediately to non-member ordering + guest locks (SSR is also free-first).
  applyLocks(null);

  const res = await waitForMemberstackReady();
  logMemberAccessDebug("courses.catalogLocks", res, {
    preferFreeFirst: preferCourseCatalogFreeFirst(res),
  });
  applyLocks(res);
}

function bindAuthRefresh(): void {
  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    ms.on("member.login", () => void resolveLocks());
    ms.on("member.logout", () => void resolveLocks());
  }
  window.addEventListener("auth:updated", () => void resolveLocks());
}

export function runCourseCatalogLocksBoot(): void {
  const boot = () => {
    void resolveLocks();
    bindAuthRefresh();
    void window.$memberstackDom?.onReady?.then(() => bindAuthRefresh());
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
