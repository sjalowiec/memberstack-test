import {
  getViewerAccessState,
  logMemberAccessDebug,
  type ViewerAccessState,
} from "../lib/memberAccess";
import { helpHubMemberLessonCtaSpec } from "../lib/helpHubMemberLessonCta";
import { openMemberstackLoginModal } from "../lib/memberstackLogin";

async function waitForMemberstackReady({ attempts = 30, delayMs = 200 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const ms = window.$memberstackDom;
      const api = ms?.getAppAndMember ?? ms?.getCurrentMember;
      if (typeof api === "function") return await api.call(ms);
    } catch {
      /* keep polling until Memberstack is ready */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export async function resolveHelpHubMemberLessonViewerState(
  gate: string,
): Promise<ViewerAccessState> {
  const res = await waitForMemberstackReady();
  logMemberAccessDebug(gate, res);
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

let authListenersBound = false;

function bindMemberLessonGateRefresh(onRefresh: () => void): void {
  if (authListenersBound) return;
  authListenersBound = true;
  window.addEventListener("auth:updated", onRefresh);
  const ms = window.$memberstackDom;
  if (ms?.on) {
    ms.on("member.login", onRefresh);
    ms.on("member.logout", onRefresh);
  }
  void ms?.onReady?.then(() => {
    onRefresh();
  });
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

export function bootHelpHubMemberLessonGates(): void {
  if (document.querySelector("[data-help-hub-lessons]")) {
    runHelpHubMemberLessonCtaGate();
  }
}
