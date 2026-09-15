/**
 * Membership gate for member-only Skill Builders.
 *
 * Shared BaseLayout snapshot/events (`__KIN_MEMBER_ACCESS__` / `kin:member-access`)
 * are the source of truth. Unresolved auth stays pending and must not paint the
 * non-member card. Protected instructional markup stays in a `<template>` until
 * access is confirmed.
 */
import { initGatedVimeoEmbeds } from "../../scripts/gatedVimeoEmbedClient";
import type { SharedMemberAccessSnapshot } from "../localMemberPreviewBypass";

export const SKILL_BUILDER_MEMBER_LOCK_ATTR = "data-sb-member-lock";
export const SKILL_BUILDER_MEMBER_LOCKED_ATTR = "data-sb-member-locked";
export const SKILL_BUILDER_MEMBER_PENDING_ATTR = "data-sb-member-pending";
export const SKILL_BUILDER_MEMBER_BODY_TEMPLATE_ATTR = "data-sb-member-body-template";
export const SKILL_BUILDER_MEMBER_BODY_MOUNT_ATTR = "data-sb-member-body-mount";
export const SKILL_BUILDER_MEMBER_BODY_MOUNTED_EVENT = "sb:member-body-mounted";

export const SKILL_BUILDER_MEMBER_LOCK_TITLE = "Skill Builders are for members";
export const SKILL_BUILDER_MEMBER_LOCK_MESSAGE =
  "You'll need an active membership to use this Skill Builder.";
export const SKILL_BUILDER_MEMBER_LOCK_CTA = "Become a member";
export const SKILL_BUILDER_MEMBER_PENDING_COPY = "Checking membership…";

export type SkillBuilderMemberGatePaint = "pending" | "member" | "locked";

export type SkillBuilderMemberAccessSnapshot = {
  hasMemberAccess?: boolean;
  viewerAccessState?: string;
} | null | undefined;

function getMemberBodyTemplate(): HTMLTemplateElement | null {
  return document.querySelector<HTMLTemplateElement>(
    `template[${SKILL_BUILDER_MEMBER_BODY_TEMPLATE_ATTR}]`,
  );
}

function getMemberBodyMount(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SKILL_BUILDER_MEMBER_BODY_MOUNT_ATTR}]`);
}

function getMemberLock(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SKILL_BUILDER_MEMBER_LOCK_ATTR}]`);
}

function getMemberPending(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SKILL_BUILDER_MEMBER_PENDING_ATTR}]`);
}

function getMemberLockedCard(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SKILL_BUILDER_MEMBER_LOCKED_ATTR}]`);
}

function previewBypassIsOn(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.body.classList.contains("dev-member") ||
    document.body.classList.contains("dev-bypass-gating")
  );
}

function readSharedMemberAccessSnapshot(): SharedMemberAccessSnapshot | null {
  if (typeof window === "undefined") return null;
  const persisted = window.__KIN_MEMBER_ACCESS__;
  if (persisted && typeof persisted.hasMemberAccess === "boolean") {
    return persisted;
  }
  return null;
}

/**
 * Unpublished / incomplete snapshots are pending, never a non-member card.
 * A confirmed member grant is not replaced by a later empty event.
 */
export function decideSkillBuilderMemberGatePaint(input: {
  snapshot?: SkillBuilderMemberAccessSnapshot;
  previewBypass?: boolean;
  confirmedMember?: boolean;
}): SkillBuilderMemberGatePaint {
  if (input.previewBypass) return "member";

  const snapshot = input.snapshot ?? null;
  const granted =
    snapshot?.hasMemberAccess === true || snapshot?.viewerAccessState === "memberAccess";
  const denied =
    snapshot?.hasMemberAccess === false ||
    snapshot?.viewerAccessState === "loggedOut" ||
    snapshot?.viewerAccessState === "loggedInNoAccess";

  if (granted) return "member";
  if (input.confirmedMember && !denied) return "member";
  if (denied) return "locked";
  return "pending";
}

function setHidden(el: HTMLElement | null, hidden: boolean): void {
  if (!el) return;
  el.hidden = hidden;
  if (hidden) el.setAttribute("hidden", "");
  else el.removeAttribute("hidden");
}

export function skillBuilderMemberBodyIsMounted(
  mount: HTMLElement | null = getMemberBodyMount(),
): boolean {
  return Boolean(mount && mount.dataset.sbMemberBodyMounted === "true" && mount.childElementCount > 0);
}

function revealMemberBodyMount(mount: HTMLElement): void {
  mount.hidden = false;
  mount.removeAttribute("hidden");
}

function rerunInlineScripts(root: ParentNode): void {
  root.querySelectorAll("script").forEach((old) => {
    const next = document.createElement("script");
    for (const attr of old.attributes) {
      next.setAttribute(attr.name, attr.value);
    }
    next.textContent = old.textContent;
    old.replaceWith(next);
  });
}

/** Clone deferred Skill Builder markup into the live mount (idempotent). */
export function mountSkillBuilderMemberBody(): HTMLElement | null {
  const template = getMemberBodyTemplate();
  const mount = getMemberBodyMount();
  if (!template || !mount) return null;
  if (skillBuilderMemberBodyIsMounted(mount)) {
    revealMemberBodyMount(mount);
    return mount;
  }

  mount.replaceChildren(template.content.cloneNode(true));
  mount.dataset.sbMemberBodyMounted = "true";
  revealMemberBodyMount(mount);
  initGatedVimeoEmbeds(mount);
  rerunInlineScripts(mount);
  window.dispatchEvent(new Event(SKILL_BUILDER_MEMBER_BODY_MOUNTED_EVENT));
  return mount;
}

/** Remove mounted instructional markup so it is not in the active DOM. */
export function unmountSkillBuilderMemberBody(): void {
  const mount = getMemberBodyMount();
  if (!mount) return;
  mount.replaceChildren();
  mount.dataset.sbMemberBodyMounted = "false";
  mount.hidden = true;
  mount.setAttribute("hidden", "");
}

/** Apply a confirmed pending / member / locked paint. */
export function applySkillBuilderMemberGatePaint(paint: SkillBuilderMemberGatePaint): void {
  const lock = getMemberLock();
  const pending = getMemberPending();
  const lockedCard = getMemberLockedCard();

  if (lock) {
    if (paint === "member") {
      setHidden(lock, true);
      lock.removeAttribute("data-gate-pending");
      lock.setAttribute("data-gated", "content");
    } else if (paint === "pending") {
      setHidden(lock, false);
      lock.setAttribute("data-gate-pending", "");
      lock.setAttribute("data-gated", "pending");
    } else {
      setHidden(lock, false);
      lock.removeAttribute("data-gate-pending");
      lock.setAttribute("data-gated", "locked");
    }
  }

  setHidden(pending, paint !== "pending");
  setHidden(lockedCard, paint !== "locked");
  if (lockedCard) {
    lockedCard.setAttribute("aria-hidden", paint === "locked" ? "false" : "true");
  }

  if (paint === "member") {
    mountSkillBuilderMemberBody();
    return;
  }
  unmountSkillBuilderMemberBody();
}

/** Toggle lock overlay and deferred instructional body after access is confirmed. */
export function syncSkillBuilderMemberGate(hasAccess: boolean): void {
  applySkillBuilderMemberGatePaint(hasAccess ? "member" : "locked");
}

let gateBound = false;

export function bindSkillBuilderMemberGate(): void {
  if (gateBound) return;
  if (!getMemberBodyTemplate() && !getMemberLock()) return;
  gateBound = true;

  let confirmedMember = false;

  function applyFromSnapshot(snapshot: SkillBuilderMemberAccessSnapshot): void {
    const paint = decideSkillBuilderMemberGatePaint({
      snapshot,
      previewBypass: previewBypassIsOn(),
      confirmedMember,
    });
    if (paint === "member") confirmedMember = true;
    if (paint === "locked") confirmedMember = false;
    applySkillBuilderMemberGatePaint(paint);
  }

  applyFromSnapshot(readSharedMemberAccessSnapshot());

  window.addEventListener("kin:member-access", ((event: Event) => {
    const detail = (event as CustomEvent<SkillBuilderMemberAccessSnapshot>).detail;
    applyFromSnapshot(detail ?? readSharedMemberAccessSnapshot());
  }) as EventListener);

  window.addEventListener("auth:updated", () => {
    applyFromSnapshot(readSharedMemberAccessSnapshot());
  });
}

/** Reset the bind-once flag in tests. */
export function resetSkillBuilderMemberGateBindForTests(): void {
  gateBound = false;
}
