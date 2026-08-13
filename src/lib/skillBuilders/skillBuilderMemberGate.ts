/**
 * Membership gate for member-only Skill Builders.
 *
 * Reuses `hasMemberAccess()` like the rest of the site. Protected instructional
 * markup stays in a `<template>` until access is confirmed, so worksheets,
 * checklists, generated instructions, and printable content are not in the live DOM.
 */
import { hasMemberAccess, logMemberAccessDebug } from "../memberAccess";
import { initGatedVimeoEmbeds } from "../../scripts/gatedVimeoEmbedClient";

export const SKILL_BUILDER_MEMBER_LOCK_ATTR = "data-sb-member-lock";
export const SKILL_BUILDER_MEMBER_BODY_TEMPLATE_ATTR = "data-sb-member-body-template";
export const SKILL_BUILDER_MEMBER_BODY_MOUNT_ATTR = "data-sb-member-body-mount";
export const SKILL_BUILDER_MEMBER_BODY_MOUNTED_EVENT = "sb:member-body-mounted";

export const SKILL_BUILDER_MEMBER_LOCK_TITLE = "Skill Builders are for members";
export const SKILL_BUILDER_MEMBER_LOCK_MESSAGE =
  "You'll need an active membership to use this Skill Builder.";
export const SKILL_BUILDER_MEMBER_LOCK_CTA = "Become a member";

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

function previewBypassIsOn(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.body.classList.contains("dev-member") ||
    document.body.classList.contains("dev-bypass-gating")
  );
}

function persistedMemberAccess(): boolean | null {
  const persisted = window.__KIN_MEMBER_ACCESS__;
  if (persisted && typeof persisted.hasMemberAccess === "boolean") {
    return persisted.hasMemberAccess;
  }
  return null;
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

function syncMemberLock(hasAccess: boolean): void {
  const lock = getMemberLock();
  if (!lock) return;
  if (hasAccess) {
    lock.hidden = true;
    lock.setAttribute("hidden", "");
  } else {
    lock.hidden = false;
    lock.removeAttribute("hidden");
  }
}

/** Toggle lock overlay and deferred instructional body. */
export function syncSkillBuilderMemberGate(hasAccess: boolean): void {
  syncMemberLock(hasAccess);
  if (hasAccess) {
    mountSkillBuilderMemberBody();
    return;
  }
  unmountSkillBuilderMemberBody();
}

export async function resolveSkillBuilderMemberAccess(): Promise<boolean> {
  if (previewBypassIsOn()) return true;

  const persisted = persistedMemberAccess();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) {
    return persisted === true || document.body.classList.contains("ms-logged-in");
  }

  try {
    const res = await ms.getCurrentMember();
    logMemberAccessDebug("skill-builders.memberGate", res);
    return hasMemberAccess(res);
  } catch {
    return persisted === true;
  }
}

let gateBound = false;

export function bindSkillBuilderMemberGate(): void {
  if (gateBound) return;
  if (!getMemberBodyTemplate() && !getMemberLock()) return;
  gateBound = true;

  async function refresh(): Promise<void> {
    const hasAccess = await resolveSkillBuilderMemberAccess();
    syncSkillBuilderMemberGate(hasAccess);
  }

  const persisted = persistedMemberAccess();
  if (persisted === true || document.body.classList.contains("ms-logged-in") || previewBypassIsOn()) {
    syncSkillBuilderMemberGate(true);
  }

  window.addEventListener("kin:member-access", ((event: Event) => {
    const detail = (event as CustomEvent<{ hasMemberAccess?: boolean }>).detail;
    if (detail && typeof detail.hasMemberAccess === "boolean") {
      syncSkillBuilderMemberGate(detail.hasMemberAccess);
      return;
    }
    void refresh();
  }) as EventListener);

  window.addEventListener("auth:updated", () => {
    void refresh();
  });

  const ms = window.$memberstackDom;
  if (ms?.on) {
    ms.on("member.login", () => void refresh());
    ms.on("member.logout", () => void refresh());
  }

  void refresh();
}

/** Reset the bind-once flag in tests. */
export function resetSkillBuilderMemberGateBindForTests(): void {
  gateBound = false;
}
