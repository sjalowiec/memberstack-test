/**
 * KIN player access gate.
 *
 * `?preview=true` unlocks content on non-production hosts so Watson
 * Save → Preview works without a membership session. Membership still
 * gates the same routes on production and when preview is off.
 */
import { canAccessCourse, normalizeCourseAccessLevel } from "../lib/courseAccess";
import { logMemberAccessDebug } from "../lib/memberAccess";
import { videoDevBypass } from "../lib/devBypass";
import { localMemberPreviewBypassIsOn } from "../lib/localMemberPreviewBypass";
import { detectSiteEnvironment } from "../lib/env/siteEnvironment";

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

  if (access === "free" || previewUnlockAllowed() || videoDevBypass || localMemberPreviewBypassIsOn()) {
    setGateAccess(gate, true);
    return;
  }

  const res = await waitForMemberstackReady();
  const unlocked = canAccessCourse(access, res, { courseSlug });
  gate.dataset.viewer = unlocked ? "open" : res ? "loggedInNoAccess" : "loggedOut";

  logMemberAccessDebug("kinCourse.gate", res, {
    courseAccess: access,
    courseSlug,
    unlocked,
  });

  setGateAccess(gate, unlocked);
}

function bindLoginButtons(): void {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-course-111-login]")) {
      event.preventDefault();
      document.getElementById("kin-ms-login-proxy")?.click();
    }
    if (target.closest("[data-course-111-logout]")) {
      event.preventDefault();
      void window.$memberstackDom?.logout();
    }
  });
}

export function runKinCourseAccessGateBoot(): void {
  const boot = () => {
    bindLoginButtons();
    document.querySelectorAll<HTMLElement>("[data-kin-course-gate]").forEach((gate) => {
      void resolveGate(gate);
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
