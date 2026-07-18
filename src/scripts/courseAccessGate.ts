/**
 * Client-side soft gate for course content.
 *
 * Mirrors the site-wide soft-gating pattern (see `videos/[id].astro` and
 * `gatedVimeoEmbedClient.ts`): the server renders both a locked teaser
 * (`[data-gated="locked"]`) and the real content (`[data-gated="content"]`,
 * hidden), and this script flips them once Memberstack resolves.
 *
 * Access uses the PREMIUM-only rule from `courseAccess` (`canAccessCourse`), so
 * Beta/Premium/legacy Premium unlock courses while Basic/legacy Basic/logged-out
 * stay locked.
 * "purchase" courses are handled server-side (locked placeholder, no content
 * rendered) and never appear as a `[data-course-gate]` needing a flip.
 */
import { canAccessCourse, normalizeCourseAccessLevel } from "../lib/courseAccess";
import { logMemberAccessDebug } from "../lib/memberAccess";
import { videoDevBypass } from "../lib/devBypass";

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
  gate.querySelectorAll('[data-gated="content"]').forEach((el) => {
    if (unlocked) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  });
  gate.querySelectorAll('[data-gated="locked"]').forEach((el) => {
    if (unlocked) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  });
}

async function resolveGate(gate: HTMLElement): Promise<void> {
  const access = normalizeCourseAccessLevel(gate.dataset.courseAccess);

  if (access === "free") {
    setGateAccess(gate, true);
    return;
  }

  // Default to locked while we resolve membership.
  setGateAccess(gate, false);

  if (access === "purchase") {
    // Reserved tier � never unlockable yet.
    return;
  }

  if (videoDevBypass) {
    setGateAccess(gate, true);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "full") {
    setGateAccess(gate, true);
    return;
  }

  const res = await waitForMemberstackReady();
  const unlocked = canAccessCourse(access, res);

  logMemberAccessDebug("courses.gate", res, {
    courseAccess: access,
    courseSlug: gate.dataset.courseSlug ?? null,
    unlocked,
  });

  setGateAccess(gate, unlocked);
}

const boundGates = new WeakSet<HTMLElement>();

function bindAuthRefresh(gate: HTMLElement): void {
  if (boundGates.has(gate)) return;
  const ms = window.$memberstackDom;
  if (!ms || typeof ms.on !== "function") return;
  boundGates.add(gate);
  ms.on("member.login", () => void resolveGate(gate));
  ms.on("member.logout", () => void resolveGate(gate));
}

/** Initialize all course access gates under `root`. */
export function initCourseAccessGates(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-course-gate]").forEach((gate) => {
    void resolveGate(gate);
    bindAuthRefresh(gate);
    void window.$memberstackDom?.onReady?.then(() => bindAuthRefresh(gate));
    window.addEventListener("auth:updated", () => void resolveGate(gate));
  });
}

export function runCourseAccessGateBoot(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initCourseAccessGates());
  } else {
    initCourseAccessGates();
  }
}
