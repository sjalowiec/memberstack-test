/**
 * KIN player access gate.
 *
 * `?preview=true` unlocks content on non-production hosts so Watson
 * Save → Preview works without a membership session. Membership still
 * gates the same routes on production and when preview is off.
 *
 * Viewer copy uses `isMemberLoggedIn` (not a truthy Memberstack payload).
 * `onAuthChange` / `auth:updated` re-run the gate so a restored or newly
 * completed session unlocks without a second full reload. Login uses the
 * shared Memberstack modal helper (same completion path as BaseLayout).
 */
import { canAccessCourse, normalizeCourseAccessLevel } from "../lib/courseAccess";
import { isMemberLoggedIn, logMemberAccessDebug } from "../lib/memberAccess";
import { videoDevBypass } from "../lib/devBypass";
import { detectSiteEnvironment } from "../lib/env/siteEnvironment";
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

async function waitForMemberstackReady({ attempts = 30, delayMs = 200 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const api = window.$memberstackDom?.getAppAndMember;
      if (typeof api === "function") return await api();
    } catch {
      /* keep polling until Memberstack is ready */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

function setGateAccess(gate: HTMLElement, unlocked: boolean): void {
  gate.removeAttribute("data-gate-pending");
  gate.removeAttribute("aria-busy");
  gate.querySelectorAll('[data-gated="pending"]').forEach((el) => {
    el.setAttribute("hidden", "");
  });
  gate.querySelectorAll('[data-gated="content"]').forEach((el) => {
    if (unlocked) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  });
  gate.querySelectorAll('[data-gated="locked"]').forEach((el) => {
    if (unlocked) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  });

  const loggedOut = gate.querySelector<HTMLElement>('[data-gate-copy="loggedOut"]');
  const loggedIn = gate.querySelector<HTMLElement>('[data-gate-copy="loggedInNoAccess"]');
  if (unlocked || !loggedOut || !loggedIn) return;
  const loggedInNoAccess = gate.dataset.viewer === "loggedInNoAccess";
  loggedOut.hidden = loggedInNoAccess;
  loggedIn.hidden = !loggedInNoAccess;
}

function previewUnlockAllowed(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") !== "true") return false;
  return (
    detectSiteEnvironment(window.location.hostname, {
      isViteDev: Boolean(import.meta.env?.DEV),
    }) !== "production"
  );
}

async function resolveGate(gate: HTMLElement): Promise<void> {
  const access = normalizeCourseAccessLevel(gate.dataset.courseAccess, "member");
  const courseSlug = gate.dataset.courseSlug ?? null;

  if (access === "free" || previewUnlockAllowed() || videoDevBypass) {
    setGateAccess(gate, true);
    return;
  }

  const res = await waitForMemberstackReady();
  const unlocked = canAccessCourse(access, res, { courseSlug });
  gate.dataset.viewer = kinCourseGateViewer(unlocked, res);

  logMemberAccessDebug("kinCourse.gate", res, {
    courseAccess: access,
    courseSlug,
    unlocked,
  });

  setGateAccess(gate, unlocked);
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
