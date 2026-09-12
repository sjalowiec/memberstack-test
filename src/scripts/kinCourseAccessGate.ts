/**
 * KIN player access gate.
 *
 * Unpublished-course `?preview=true` is granted only after the server verifies
 * an allowlisted admin via `requireAdminForRequest`. The layout then sets
 * `data-admin-preview="true"`, which unlocks membership gating so Watson
 * Save → Preview works without a course plan. The query string alone never
 * unlocks content.
 *
 * Viewer copy uses `isMemberLoggedIn` (not a truthy Memberstack payload).
 * Unresolved Memberstack is not a denial: keep the lesson hidden and do not
 * show the unauthorized card until auth/plans have finished loading.
 * A confirmed course-access result is reused during lesson navigation.
 * `onAuthChange` / `auth:updated` re-run the gate so a restored or newly
 * completed session unlocks without a second full reload. Login uses the
 * shared Memberstack modal helper (same completion path as BaseLayout).
 */
import { canAccessCourse, normalizeCourseAccessLevel } from "../lib/courseAccess";
import {
  KIN_COURSE_ACCESS_SESSION_KEY,
  clearConfirmedKinCourseAccessSlug,
  isKinCourseMemberstackResolved,
  kinCourseGatePaint,
  memberIdForKinCourseAccess,
  writeConfirmedKinCourseAccess,
  type KinCourseGatePaint,
} from "../lib/kinCourse/accessGateState";
import { clearKinCourseCachePaint } from "../lib/kinCourseCacheAccess";
import { isMemberLoggedIn, logMemberAccessDebug } from "../lib/memberAccess";
import { ensureLegacyPaidThroughContext } from "../lib/memberAccessClient";
import { videoDevBypass } from "../lib/devBypass";
import { openMemberstackLoginModal } from "../lib/memberstackLogin";

export type KinCourseGateViewer = "open" | "loggedInNoAccess" | "loggedOut";

/** Locked-card copy: logged-out vs signed-in-without-access. */
export function kinCourseGateViewer(
  unlocked: boolean,
  memberOrPayload: unknown,
): KinCourseGateViewer {
  if (unlocked) return "open";
  return isMemberLoggedIn(memberOrPayload) ? "loggedInNoAccess" : "loggedOut";
}

type MemberstackWaitResult =
  | { ready: true; payload: unknown }
  | { ready: false; payload: unknown };

async function waitForMemberstackReady({
  attempts = 30,
  delayMs = 200,
} = {}): Promise<MemberstackWaitResult> {
  let lastPayload: unknown = null;
  let waitedForReady = false;
  for (let i = 0; i < attempts; i++) {
    try {
      const ms = window.$memberstackDom;
      const api = ms?.getAppAndMember;
      if (typeof api === "function") {
        if (!waitedForReady && ms.onReady) {
          waitedForReady = true;
          await Promise.race([
            Promise.resolve(ms.onReady).catch(() => undefined),
            new Promise<void>((resolve) => setTimeout(resolve, 4000)),
          ]);
        }
        const payload = await api.call(ms);
        lastPayload = payload;
        if (isKinCourseMemberstackResolved(payload)) {
          return { ready: true, payload };
        }
      }
    } catch {
      /* keep polling until Memberstack is ready */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ready: false, payload: lastPayload };
}

function courseAccessStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function rememberGateAccess(gate: HTMLElement, unlocked: boolean, memberOrPayload: unknown): void {
  const storage = courseAccessStorage();
  if (!storage) return;
  const courseSlug = gate.dataset.courseSlug?.trim() ?? "";
  const memberId = memberIdForKinCourseAccess(memberOrPayload);
  if (!courseSlug) return;
  if (!isMemberLoggedIn(memberOrPayload) || !memberId) {
    storage.setItem(
      KIN_COURSE_ACCESS_SESSION_KEY,
      clearConfirmedKinCourseAccessSlug(storage.getItem(KIN_COURSE_ACCESS_SESSION_KEY), courseSlug),
    );
    return;
  }
  storage.setItem(
    KIN_COURSE_ACCESS_SESSION_KEY,
    writeConfirmedKinCourseAccess(storage.getItem(KIN_COURSE_ACCESS_SESSION_KEY), courseSlug, {
      memberId,
      unlocked,
    }),
  );
}

function clearRememberedGateAccess(): void {
  courseAccessStorage()?.removeItem(KIN_COURSE_ACCESS_SESSION_KEY);
}

export function applyKinCourseGatePaint(
  gate: HTMLElement,
  paint: KinCourseGatePaint,
  viewer: KinCourseGateViewer = "loggedOut",
): void {
  const pending = paint === "pending";
  if (pending) {
    gate.setAttribute("data-gate-pending", "");
    gate.setAttribute("aria-busy", "true");
  } else {
    clearKinCourseCachePaint();
    gate.removeAttribute("data-gate-pending");
    gate.removeAttribute("aria-busy");
    gate.dataset.viewer = viewer;
  }

  gate.querySelectorAll('[data-gated="pending"]').forEach((el) => {
    if (paint === "pending") el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  });
  gate.querySelectorAll('[data-gated="content"]').forEach((el) => {
    if (paint === "open") el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  });
  gate.querySelectorAll('[data-gated="locked"]').forEach((el) => {
    if (paint === "locked") el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  });

  if (paint !== "locked") return;
  const loggedOut = gate.querySelector<HTMLElement>('[data-gate-copy="loggedOut"]');
  const loggedIn = gate.querySelector<HTMLElement>('[data-gate-copy="loggedInNoAccess"]');
  if (!loggedOut || !loggedIn) return;
  const loggedInNoAccess = viewer === "loggedInNoAccess";
  loggedOut.hidden = loggedInNoAccess;
  loggedIn.hidden = !loggedInNoAccess;
}

function previewUnlockAllowed(gate: HTMLElement): boolean {
  return gate.dataset.adminPreview === "true";
}

async function resolveGate(gate: HTMLElement): Promise<void> {
  const access = normalizeCourseAccessLevel(gate.dataset.courseAccess, "member");
  const courseSlug = gate.dataset.courseSlug ?? null;

  if (access === "free" || previewUnlockAllowed(gate) || videoDevBypass) {
    applyKinCourseGatePaint(gate, "open", "open");
    return;
  }

  const res = await waitForMemberstackReady();
  if (!res.ready) {
    applyKinCourseGatePaint(gate, kinCourseGatePaint({ memberstackReady: false, unlocked: false }));
    return;
  }

  await ensureLegacyPaidThroughContext(res.payload);
  const unlocked = canAccessCourse(access, res.payload, { courseSlug });
  const viewer = kinCourseGateViewer(unlocked, res.payload);

  logMemberAccessDebug("kinCourse.gate", res.payload, {
    courseAccess: access,
    courseSlug,
    unlocked,
    memberstackReady: true,
  });

  applyKinCourseGatePaint(gate, kinCourseGatePaint({ memberstackReady: true, unlocked }), viewer);
  rememberGateAccess(gate, unlocked, res.payload);
}

const boundGates = new WeakSet<HTMLElement>();

function bindAuthRefresh(gate: HTMLElement): void {
  if (boundGates.has(gate)) return;
  const ms = window.$memberstackDom;
  if (typeof ms?.onAuthChange !== "function") return;
  boundGates.add(gate);
  ms.onAuthChange(() => void resolveGate(gate));
}

let loginButtonsBound = false;

function bindLoginButtons(): void {
  if (loginButtonsBound) return;
  loginButtonsBound = true;
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-course-111-login]")) {
      event.preventDefault();
      openMemberstackLoginModal();
      return;
    }
    if (target.closest("[data-course-111-logout]")) {
      event.preventDefault();
      clearRememberedGateAccess();
      void Promise.resolve(window.$memberstackDom?.logout?.()).finally(() => {
        window.dispatchEvent(new Event("auth:updated"));
      });
    }
  });
}

function initKinCourseAccessGates(root: ParentNode = document): void {
  bindLoginButtons();
  root.querySelectorAll<HTMLElement>("[data-kin-course-gate]").forEach((gate) => {
    void resolveGate(gate);
    bindAuthRefresh(gate);
    window.addEventListener("auth:updated", () => void resolveGate(gate));
    let attempts = 0;
    const poll = window.setInterval(() => {
      attempts += 1;
      bindAuthRefresh(gate);
      if (boundGates.has(gate) || attempts >= 50) {
        window.clearInterval(poll);
      }
    }, 200);
  });
}

export function runKinCourseAccessGateBoot(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initKinCourseAccessGates());
  } else {
    initKinCourseAccessGates();
  }
}
