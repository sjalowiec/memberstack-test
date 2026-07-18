import {
  LESSON_MEMBER_BODY_MOUNT_ATTR,
  LESSON_MEMBER_BODY_TEMPLATE_ATTR,
} from "../lib/lessonMemberBodyGate";
import {
  getActivePlanIds,
  getViewerAccessState,
  isMemberLoggedIn,
  logMemberAccessDebug,
  type ViewerAccessState,
} from "../lib/memberAccess";
import { helpHubMemberLessonCtaSpec } from "../lib/helpHubMemberLessonCta";
import { openMemberstackLoginModal } from "../lib/memberstackLogin";
import { initGatedVimeoEmbeds } from "./gatedVimeoEmbedClient";
import { initLessonVideoModal } from "./lessonVideoModal";

console.log(
  "[KIN lesson gate] script loaded",
  typeof location !== "undefined" ? location.pathname : "(no location)",
);

export type KinMemberAccessDetail = {
  hasMemberAccess: boolean;
  viewerAccessState: ViewerAccessState;
};

declare global {
  interface Window {
    __KIN_MEMBER_ACCESS__?: KinMemberAccessDetail | null;
  }
}

/**
 * Wait for getAppAndMember only (never fall back to getCurrentMember).
 * Early getCurrentMember can return a logged-in member without planConnections.
 */
async function waitForMemberstackAppAndMember({
  attempts = 40,
  delayMs = 200,
} = {}): Promise<unknown> {
  for (let i = 0; i < attempts; i++) {
    try {
      const ms = window.$memberstackDom;
      const api = ms?.getAppAndMember;
      if (typeof api === "function") {
        const res = await api.call(ms);
        if (
          res &&
          isMemberLoggedIn(res) &&
          getActivePlanIds(res).length === 0 &&
          i < attempts - 1
        ) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        console.log("[KIN lesson gate] getAppAndMember resolved", {
          viewerAccessState: getViewerAccessState(res),
          activePlanIds: getActivePlanIds(res),
        });
        return res;
      }
    } catch {
      /* keep polling until getAppAndMember is ready */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  console.log("[KIN lesson gate] getAppAndMember timed out");
  return null;
}

export async function resolveHelpHubMemberLessonViewerState(
  gate: string,
): Promise<ViewerAccessState> {
  const res = await waitForMemberstackAppAndMember();
  logMemberAccessDebug(gate, res, {
    templateChildCount: getLessonBodyTemplate()?.content.childElementCount ?? null,
    mountChildCount: getLessonBodyMount()?.childElementCount ?? null,
    mountHidden: getLessonBodyMount()?.hasAttribute("hidden") ?? null,
    msLoggedIn: document.body.classList.contains("ms-logged-in"),
    persisted: window.__KIN_MEMBER_ACCESS__ ?? null,
  });
  return getViewerAccessState(res);
}

/** Render CTA content into each `[data-hh-lesson-cta]` mount. */
export function renderHelpHubMemberLessonCta(
  mount: HTMLElement,
  state: ViewerAccessState | null,
  lessonHref: string,
): void {
  mount.replaceChildren();
  const spec = helpHubMemberLessonCtaSpec(state, lessonHref);
  syncHelpHubMemberLessonNote(mount, spec.showMembershipNote);

  if (spec.lockedStatus) {
    const status = document.createElement("p");
    status.className = "help-hub-member-lessons__locked-status";
    status.textContent = spec.lockedStatus;
    mount.appendChild(status);
  }

  if (spec.lockedSupport) {
    const support = document.createElement("p");
    support.className = "help-hub-member-lessons__locked-support";
    support.textContent = spec.lockedSupport;
    mount.appendChild(support);
  }

  for (const button of spec.buttons) {
    const link = document.createElement("a");
    link.className =
      button.variant === "primary"
        ? "kbm-btn kbm-btn-accent help-hub-member-lessons__cta"
        : "kbm-btn kbm-btn-outline help-hub-member-lessons__cta help-hub-member-lessons__cta--secondary";
    link.href = button.href;
    link.textContent = button.text;

    if (button.action === "login") {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openMemberstackLoginModal();
      });
    }

    mount.appendChild(link);
  }
}

function syncHelpHubMemberLessonNote(mount: HTMLElement, show: boolean): void {
  const note = mount
    .closest(".help-hub-member-lessons__actions")
    ?.querySelector<HTMLElement>("[data-hh-lesson-note]");
  if (!note) return;
  note.toggleAttribute("hidden", !show);
}

/** Update every Help Hub Member Lesson CTA mount for the resolved viewer state. */
export function syncHelpHubMemberLessonCtas(state: ViewerAccessState): void {
  document.querySelectorAll<HTMLElement>("[data-hh-lesson-cta]").forEach((mount) => {
    const lessonHref = mount.dataset.lessonHref?.trim() || "/lessons";
    renderHelpHubMemberLessonCta(mount, state, lessonHref);
  });
}

/** Clear CTA mounts while viewer state is unresolved. */
export function clearHelpHubMemberLessonCtas(): void {
  document.querySelectorAll<HTMLElement>("[data-hh-lesson-cta]").forEach((mount) => {
    const lessonHref = mount.dataset.lessonHref?.trim() || "/lessons";
    renderHelpHubMemberLessonCta(mount, null, lessonHref);
  });
}

function getLessonBodyTemplate(): HTMLTemplateElement | null {
  return document.querySelector<HTMLTemplateElement>(`template[${LESSON_MEMBER_BODY_TEMPLATE_ATTR}]`);
}

function getLessonBodyMount(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${LESSON_MEMBER_BODY_MOUNT_ATTR}]`);
}

/** True when the mount already has cloned instructional children. */
export function lessonMemberBodyIsMounted(mount: HTMLElement | null = getLessonBodyMount()): boolean {
  return Boolean(mount && mount.dataset.lessonBodyMounted === "true" && mount.childElementCount > 0);
}

function revealLessonMemberBodyMount(mount: HTMLElement): void {
  mount.hidden = false;
  mount.removeAttribute("hidden");
  const style = mount.style;
  if (style?.display === "none") style.removeProperty("display");
  if (style?.visibility === "hidden") style.removeProperty("visibility");
}

/** Clone deferred lesson instructional markup into the live mount point (idempotent). */
export function mountLessonMemberBody(): void {
  const template = getLessonBodyTemplate();
  const mount = getLessonBodyMount();
  console.log("[KIN lesson gate] mount immediately before", {
    templateExists: Boolean(template),
    templateChildCount: template?.content.childElementCount ?? null,
    mountExists: Boolean(mount),
    mountChildCount: mount?.childElementCount ?? null,
    alreadyMounted: lessonMemberBodyIsMounted(mount),
  });
  if (!template || !mount) return;
  if (lessonMemberBodyIsMounted(mount)) {
    revealLessonMemberBodyMount(mount);
    return;
  }

  try {
    mount.replaceChildren(template.content.cloneNode(true));
    mount.dataset.lessonBodyMounted = "true";
    revealLessonMemberBodyMount(mount);
    initLessonVideoModal(mount);
    initGatedVimeoEmbeds(mount);
    console.log("[KIN lesson gate] mount immediately after", {
      templateChildCount: template.content.childElementCount,
      mountChildCount: mount.childElementCount,
      mountHidden: mount.hidden,
      mountDisplay:
        typeof getComputedStyle === "function" ? getComputedStyle(mount).display : null,
    });
  } catch (error) {
    console.error("[KIN lesson gate] mountFailed", error);
    mount.replaceChildren();
    mount.dataset.lessonBodyMounted = "false";
  }
}

/** Remove mounted instructional markup so protected media is not in the active DOM. */
export function unmountLessonMemberBody(): void {
  const mount = getLessonBodyMount();
  if (!mount) return;
  mount.replaceChildren();
  mount.dataset.lessonBodyMounted = "false";
  mount.hidden = true;
  mount.setAttribute("hidden", "");
}

/** Toggle lesson-page locked panel and deferred instructional body. */
export function syncLessonPageMemberGate(hasMemberAccess: boolean): void {
  console.log("[KIN lesson gate] syncLessonPageMemberGate entry", {
    hasMemberAccess,
    msLoggedIn: document.body.classList.contains("ms-logged-in"),
    persisted: window.__KIN_MEMBER_ACCESS__ ?? null,
  });

  document.querySelectorAll('[data-gated="locked"]').forEach((el) => {
    if (hasMemberAccess) {
      (el as HTMLElement).hidden = true;
      el.setAttribute("hidden", "");
    } else {
      (el as HTMLElement).hidden = false;
      el.removeAttribute("hidden");
    }
  });

  const mount = getLessonBodyMount();
  if (mount) {
    if (hasMemberAccess) {
      mountLessonMemberBody();
      revealLessonMemberBodyMount(mount);
    } else {
      unmountLessonMemberBody();
    }
    return;
  }

  document.querySelectorAll('[data-gated="content"]').forEach((el) => {
    if (hasMemberAccess) {
      (el as HTMLElement).hidden = false;
      el.removeAttribute("hidden");
    } else {
      (el as HTMLElement).hidden = true;
      el.setAttribute("hidden", "");
    }
  });
}

function wireLessonGateLoginButtons(): void {
  document.querySelectorAll<HTMLElement>("[data-lesson-gate-login]").forEach((btn) => {
    if (btn.dataset.lessonGateLoginBound === "true") return;
    btn.dataset.lessonGateLoginBound = "true";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      openMemberstackLoginModal();
    });
  });
}

let authListenersBound = false;
let memberstackListenersAttached = false;

function applyPersistedOrBodyAccess(): boolean {
  const persisted = window.__KIN_MEMBER_ACCESS__;
  if (persisted && typeof persisted.hasMemberAccess === "boolean") {
    console.log("[KIN lesson gate] init from persisted __KIN_MEMBER_ACCESS__", persisted);
    syncLessonPageMemberGate(persisted.hasMemberAccess);
    return persisted.hasMemberAccess;
  }
  if (document.body.classList.contains("ms-logged-in")) {
    console.log("[KIN lesson gate] init from body.ms-logged-in fallback");
    syncLessonPageMemberGate(true);
    return true;
  }
  return false;
}

function bindMemberLessonGateRefresh(onRefresh: () => void): void {
  console.log("[KIN lesson gate] before listener registration");
  if (authListenersBound) return;
  authListenersBound = true;

  window.addEventListener("auth:updated", () => {
    console.log("[KIN lesson gate] auth:updated received");
    onRefresh();
  });

  window.addEventListener("kin:member-access", ((event: Event) => {
    const detail = (event as CustomEvent<KinMemberAccessDetail>).detail;
    console.log("[KIN lesson gate] kin:member-access received", detail);
    if (detail && typeof detail.hasMemberAccess === "boolean") {
      window.__KIN_MEMBER_ACCESS__ = detail;
      syncLessonPageMemberGate(detail.hasMemberAccess);
      wireLessonGateLoginButtons();
      return;
    }
    onRefresh();
  }) as EventListener);

  const attachMemberstack = (): boolean => {
    if (memberstackListenersAttached) return true;
    const ms = window.$memberstackDom;
    if (!ms) return false;
    if (typeof ms.on === "function") {
      ms.on("member.login", onRefresh);
      ms.on("member.logout", onRefresh);
    }
    void ms.onReady?.then(() => {
      onRefresh();
    });
    memberstackListenersAttached = true;
    return true;
  };

  if (!attachMemberstack()) {
    void (async () => {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (attachMemberstack()) {
          onRefresh();
          return;
        }
      }
    })();
  }
}

export function runHelpHubMemberLessonCtaGate(): void {
  clearHelpHubMemberLessonCtas();

  async function refresh(): Promise<void> {
    const state = await resolveHelpHubMemberLessonViewerState("help-hub/[slug].memberLessonCta");
    syncHelpHubMemberLessonCtas(state);
  }

  void refresh();
  bindMemberLessonGateRefresh(() => {
    clearHelpHubMemberLessonCtas();
    void refresh();
  });
}

export function runLessonPageMemberGate(): void {
  async function refresh(): Promise<void> {
    const state = await resolveHelpHubMemberLessonViewerState("lessons/[slug].pageGate");
    syncLessonPageMemberGate(state === "memberAccess");
    wireLessonGateLoginButtons();
  }

  // If BaseLayout already resolved paid access before this module loaded, mount now.
  applyPersistedOrBodyAccess();
  wireLessonGateLoginButtons();

  // Always resolve via getAppAndMember as well (does not depend only on the event).
  void refresh();
  bindMemberLessonGateRefresh(() => {
    void refresh();
  });
}

export function bootHelpHubMemberLessonGates(): void {
  console.log("[KIN lesson gate] bootHelpHubMemberLessonGates", {
    hasHelpHubLessons: Boolean(document.querySelector("[data-help-hub-lessons]")),
    hasLessonMemberGate: Boolean(document.querySelector("[data-lesson-member-gate]")),
  });
  if (document.querySelector("[data-help-hub-lessons]")) {
    runHelpHubMemberLessonCtaGate();
  }
  if (document.querySelector("[data-lesson-member-gate]")) {
    runLessonPageMemberGate();
  }
}

export function bootLessonVideoModalForPublicLesson(): void {
  initLessonVideoModal();
}
