/**
 * Help Hub Member Lesson video dialog.
 *
 * Custom dialog rather than <dialog>.showModal(), matching the related-tool
 * modal: Memberstack login renders outside the page, and a native modal would
 * mark that login inert. The player URL is loaded only after the existing
 * member-access check, from the catalog embed endpoint. It is never written
 * into the Help Hub HTML.
 */
import type { ViewerAccessState } from "../memberAccess";
import { getMembershipStatusAuthHeaders } from "../membership/membershipStatusClient";
import { CATALOG_VIDEO_EMBED_API_PATH } from "../../scripts/gatedVimeoEmbedClient";
import {
  lockHelpHubToolPageScroll,
  trapHelpHubToolFocus,
  unlockHelpHubToolPageScroll,
} from "./helpHubToolModal";

export const HELP_HUB_LESSONS_SELECTOR = "[data-help-hub-lessons]";
export const HELP_HUB_LESSON_OPEN_SELECTOR = "[data-help-hub-lesson-open]";
export const HELP_HUB_LESSON_MODAL_SELECTOR = "[data-help-hub-lesson-modal]";
export const HELP_HUB_LESSON_CLOSE_SELECTOR = "[data-help-hub-lesson-close]";
export const HELP_HUB_LESSON_PLAYER_SELECTOR = "[data-help-hub-lesson-player]";
export const HELP_HUB_LESSON_STATUS_SELECTOR = "[data-help-hub-lesson-status]";
export const HELP_HUB_LESSON_TITLE_SELECTOR = "[data-help-hub-lesson-modal-title]";
export const HELP_HUB_LESSON_GATE_SELECTOR = "[data-hh-lesson-gate]";

const BOUND_ATTR = "data-help-hub-lesson-bound";
const INERT_ATTR = "data-help-hub-lesson-made-inert";
const MEMBERSTACK_HOST = "MEMBERSTACK-PREBUILT-UI";

type Session = {
  opener: HTMLElement | null;
  scrollY: number;
  observer: MutationObserver | null;
  loadGeneration: number;
};

const sessions = new WeakMap<HTMLElement, Session>();
let activeDialog: HTMLElement | null = null;
let keydownBound = false;

/** What selecting a lesson title may do. Unresolved access never loads a video. */
export function helpHubLessonSelectionAction(
  state: ViewerAccessState | null | undefined,
): "video" | "gate" | "wait" {
  if (state === "memberAccess") return "video";
  if (state === "loggedOut" || state === "loggedInNoAccess") return "gate";
  return "wait";
}

/** Accept only the catalog Vimeo player URL, and start playback. */
export function helpHubLessonPlayerSrc(iframeSrc: unknown): string {
  if (typeof iframeSrc !== "string") return "";
  let url: URL;
  try {
    url = new URL(iframeSrc.trim());
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || url.hostname !== "player.vimeo.com") return "";
  if (!url.pathname.startsWith("/video/")) return "";
  url.searchParams.set("autoplay", "1");
  return url.toString();
}

export async function fetchHelpHubLessonPlayerSrc(contentId: string): Promise<string> {
  const id = contentId.trim();
  if (!/^\d+$/.test(id)) return "";
  const headers = await getMembershipStatusAuthHeaders();
  const params = new URLSearchParams({ contentId: id });
  let response: Response;
  try {
    response = await fetch(`${CATALOG_VIDEO_EMBED_API_PATH}?${params.toString()}`, {
      method: "GET",
      headers,
      credentials: "same-origin",
    });
  } catch {
    return "";
  }
  if (!response.ok) return "";
  let body: { ok?: boolean; iframeSrc?: unknown } | null = null;
  try {
    body = (await response.json()) as { ok?: boolean; iframeSrc?: unknown };
  } catch {
    return "";
  }
  if (!body || body.ok === false) return "";
  return helpHubLessonPlayerSrc(body.iframeSrc);
}

function isMemberstackHost(el: Element): boolean {
  return el.tagName === MEMBERSTACK_HOST || el.id === "kbm-ms-login-proxy";
}

function focusWithoutScroll(el: HTMLElement): void {
  if (typeof el.focus !== "function") return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

function memberstackHasFocus(): boolean {
  return document.activeElement?.tagName === MEMBERSTACK_HOST;
}

function raiseMemberstackHosts(): void {
  document.querySelectorAll(MEMBERSTACK_HOST).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.dataset.helpHubLessonMsRaised === "true") return;
    el.dataset.helpHubLessonMsRaised = "true";
    el.dataset.helpHubLessonMsPosition = el.style.position;
    el.dataset.helpHubLessonMsZ = el.style.zIndex;
    el.style.position = "relative";
    el.style.zIndex = "100000";
  });
}

function restoreMemberstackHosts(): void {
  document.querySelectorAll(MEMBERSTACK_HOST).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.dataset.helpHubLessonMsRaised !== "true") return;
    el.style.position = el.dataset.helpHubLessonMsPosition ?? "";
    el.style.zIndex = el.dataset.helpHubLessonMsZ ?? "";
    delete el.dataset.helpHubLessonMsRaised;
    delete el.dataset.helpHubLessonMsPosition;
    delete el.dataset.helpHubLessonMsZ;
  });
}

function inertBackground(dialog: HTMLElement): void {
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === dialog || isMemberstackHost(child)) {
      if (child.hasAttribute(INERT_ATTR)) {
        child.removeAttribute("inert");
        child.removeAttribute(INERT_ATTR);
      }
      continue;
    }
    if (child.hasAttribute(INERT_ATTR) || child.hasAttribute("inert")) continue;
    child.setAttribute("inert", "");
    child.setAttribute(INERT_ATTR, "");
  }
}

function restoreBackground(): void {
  document.querySelectorAll(`[${INERT_ATTR}]`).forEach((el) => {
    el.removeAttribute("inert");
    el.removeAttribute(INERT_ATTR);
  });
}

function lessonTitle(opener: HTMLElement): string {
  const fromData = opener.dataset.lessonTitle?.trim() || "";
  if (fromData) return fromData;
  return opener.textContent?.trim() || "Lesson";
}

function clearPlayer(dialog: HTMLElement): void {
  const player = dialog.querySelector(HELP_HUB_LESSON_PLAYER_SELECTOR);
  player?.querySelectorAll("iframe").forEach((frame) => frame.remove());
}

function setStatus(dialog: HTMLElement, message: string): void {
  const status = dialog.querySelector(HELP_HUB_LESSON_STATUS_SELECTOR);
  if (status) status.textContent = message;
}

function mountPlayer(dialog: HTMLElement, src: string, title: string): void {
  const player = dialog.querySelector(HELP_HUB_LESSON_PLAYER_SELECTOR);
  if (!player) return;
  clearPlayer(dialog);
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = title;
  iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
  iframe.setAttribute("allowfullscreen", "");
  iframe.tabIndex = 0;
  iframe.setAttribute("frameborder", "0");
  iframe.style.position = "absolute";
  iframe.style.inset = "0";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  player.appendChild(iframe);
}

function closeHelpHubLessonModal(dialog: HTMLElement): void {
  if (activeDialog !== dialog) return;
  const session = sessions.get(dialog);
  if (session) session.loadGeneration += 1;
  activeDialog = null;
  dialog.setAttribute("hidden", "");
  clearPlayer(dialog);
  setStatus(dialog, "");
  session?.observer?.disconnect();
  restoreBackground();
  restoreMemberstackHosts();
  const scrollY = session?.scrollY ?? 0;
  const opener = session?.opener ?? null;
  if (opener) opener.setAttribute("aria-expanded", "false");
  unlockHelpHubToolPageScroll(scrollY);
  const restoreFocus = () => {
    window.scrollTo(0, scrollY);
    if (opener && typeof opener.focus === "function" && document.contains(opener)) {
      focusWithoutScroll(opener);
    }
  };
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(restoreFocus);
  } else {
    restoreFocus();
  }
}

export function closeActiveHelpHubLessonModal(): void {
  if (activeDialog) closeHelpHubLessonModal(activeDialog);
}

async function loadPlayer(dialog: HTMLElement, opener: HTMLElement, generation: number): Promise<void> {
  const title = lessonTitle(opener);
  const titleEl = dialog.querySelector(HELP_HUB_LESSON_TITLE_SELECTOR);
  if (titleEl) titleEl.textContent = title;
  const contentId = opener.dataset.contentId?.trim() || "";
  setStatus(dialog, "Loading lesson video…");
  dialog.setAttribute("aria-busy", "true");
  const src = await fetchHelpHubLessonPlayerSrc(contentId);
  const session = sessions.get(dialog);
  if (!session || session.loadGeneration !== generation || activeDialog !== dialog) return;
  dialog.removeAttribute("aria-busy");
  if (!src) {
    setStatus(dialog, "This lesson video isn’t available right now.");
    return;
  }
  setStatus(dialog, "");
  mountPlayer(dialog, src, title);
}

function openHelpHubLessonModal(dialog: HTMLElement, opener: HTMLElement): void {
  if (activeDialog) return;
  const scrollY = lockHelpHubToolPageScroll();
  if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
  const observer = new MutationObserver(() => {
    inertBackground(dialog);
    raiseMemberstackHosts();
  });
  const session: Session = { opener, scrollY, observer, loadGeneration: 1 };
  sessions.set(dialog, session);
  activeDialog = dialog;
  clearPlayer(dialog);
  const titleEl = dialog.querySelector(HELP_HUB_LESSON_TITLE_SELECTOR);
  if (titleEl) titleEl.textContent = lessonTitle(opener);
  dialog.removeAttribute("hidden");
  inertBackground(dialog);
  raiseMemberstackHosts();
  observer.observe(document.body, { childList: true });
  opener.setAttribute("aria-expanded", "true");
  const closeBtn = dialog.querySelector<HTMLElement>(HELP_HUB_LESSON_CLOSE_SELECTOR);
  focusWithoutScroll(closeBtn ?? dialog);
  void loadPlayer(dialog, opener, session.loadGeneration);
}

function revealLessonGate(opener: HTMLElement): void {
  const section = opener.closest(HELP_HUB_LESSONS_SELECTOR);
  const item = opener.closest("li");
  section?.querySelectorAll<HTMLElement>(HELP_HUB_LESSON_OPEN_SELECTOR).forEach((button) => {
    button.setAttribute("aria-expanded", button === opener ? "true" : "false");
  });
  section?.querySelectorAll<HTMLElement>(HELP_HUB_LESSON_GATE_SELECTOR).forEach((gate) => {
    const show = gate.closest("li") === item;
    gate.toggleAttribute("hidden", !show);
  });
  const focusTarget = item?.querySelector<HTMLElement>(
    `${HELP_HUB_LESSON_GATE_SELECTOR} a, ${HELP_HUB_LESSON_GATE_SELECTOR} button`,
  );
  if (focusTarget) focusWithoutScroll(focusTarget);
}

function hideLessonGates(section: ParentNode): void {
  section.querySelectorAll<HTMLElement>(HELP_HUB_LESSON_GATE_SELECTOR).forEach((gate) => {
    gate.hidden = true;
    gate.setAttribute("hidden", "");
  });
  section.querySelectorAll<HTMLElement>(HELP_HUB_LESSON_OPEN_SELECTOR).forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

function accessState(section: HTMLElement): ViewerAccessState | null {
  const value = section.dataset.helpHubLessonAccess;
  if (value === "memberAccess" || value === "loggedOut" || value === "loggedInNoAccess") return value;
  return null;
}

function onDocumentKeydown(event: KeyboardEvent): void {
  const dialog = activeDialog;
  if (!dialog) return;
  if (memberstackHasFocus()) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeHelpHubLessonModal(dialog);
    return;
  }
  trapHelpHubToolFocus(event, dialog);
}

function ensureKeydown(): void {
  if (keydownBound) return;
  keydownBound = true;
  document.addEventListener("keydown", onDocumentKeydown);
}

export function initHelpHubLessonModals(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(HELP_HUB_LESSONS_SELECTOR).forEach((section) => {
    if (section.getAttribute(BOUND_ATTR) === "true") return;
    const dialog = section.querySelector<HTMLElement>(HELP_HUB_LESSON_MODAL_SELECTOR);
    if (!dialog) return;
    section.setAttribute(BOUND_ATTR, "true");
    if (!dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;

    section.querySelectorAll<HTMLElement>(HELP_HUB_LESSON_OPEN_SELECTOR).forEach((opener) => {
      opener.addEventListener("click", (event) => {
        event.preventDefault();
        const action = helpHubLessonSelectionAction(accessState(section));
        if (action === "wait") return;
        if (action === "gate") {
          revealLessonGate(opener);
          return;
        }
        hideLessonGates(section);
        openHelpHubLessonModal(dialog, opener);
      });
    });

    dialog.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(HELP_HUB_LESSON_CLOSE_SELECTOR)) {
        event.preventDefault();
        closeHelpHubLessonModal(dialog);
        return;
      }
      if (target === dialog) closeHelpHubLessonModal(dialog);
    });
  });

  ensureKeydown();
}
