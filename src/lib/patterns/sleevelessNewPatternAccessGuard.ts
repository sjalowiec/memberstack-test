/**
 * Gate for STARTING a brand-new pattern in a pattern system.
 */
import {
  canCreatePatternForSystem,
  resolvePatternSystemAlreadyClaimedCopy,
  resolvePatternSystemSaveLoggedOutCopy,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";
import {
  resolvePatternSystemForBuilderGate,
  patternSystemDisplayName,
  type PatternSystemId,
} from "./patternSystemId";
import { logPatternEditGateDebug } from "./patternEditGateDebug";

/** @deprecated Use {@link resolveSaveAlreadyClaimedCopy} from cloud save module. */
export {
  SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
  SLEEVELESS_SAVE_LOGGED_OUT_COPY,
} from "./sleevelessPatternProjectCloudSave";

export const SLEEVELESS_NEW_PATTERN_LOCKED_SCREEN_SELECTOR =
  "[data-sleeveless-new-pattern-locked]";

export function canStartNewPatternForSystem(
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
): boolean {
  return canCreatePatternForSystem(access, systemId);
}

function resolveNewPatternGateSystem(
  systemId?: PatternSystemId,
  doc?: Document,
): PatternSystemId {
  return systemId ?? resolvePatternSystemForBuilderGate(doc);
}

/** @deprecated Use {@link canStartNewPatternForSystem}. */
export function canStartNewSleevelessPattern(
  access: SleevelessUserAccess,
  systemId?: PatternSystemId,
  doc?: Document,
): boolean {
  const system = resolveNewPatternGateSystem(systemId, doc);
  logPatternEditGateDebug("canStartNewSleevelessPattern", {
    patternSystem: system,
    hasSystemAccess: access.hasSystemAccess,
    freeClaimsBySystem: access.freeClaimsBySystem,
    extra: { canStartNew: canStartNewPatternForSystem(access, system) },
  });
  return canStartNewPatternForSystem(access, system);
}

export function resolveNewPatternBlockedCopy(
  access: SleevelessUserAccess,
  systemId?: PatternSystemId,
  doc?: Document,
): string {
  const system = resolveNewPatternGateSystem(systemId, doc);
  return access.loggedIn
    ? resolvePatternSystemAlreadyClaimedCopy(system)
    : resolvePatternSystemSaveLoggedOutCopy(system);
}

/** @deprecated Use {@link resolveNewPatternBlockedCopy}. */
export function resolveSleevelessNewPatternBlockedCopy(
  access: SleevelessUserAccess,
  systemId?: PatternSystemId,
  doc?: Document,
): string {
  return resolveNewPatternBlockedCopy(access, systemId, doc);
}

export async function resolveCanStartNewPatternForSystem(
  systemId?: PatternSystemId,
  doc?: Document,
): Promise<boolean> {
  const system = resolveNewPatternGateSystem(systemId, doc);
  const access = await resolveSleevelessUserAccess();
  logPatternEditGateDebug("resolveCanStartNewPatternForSystem", {
    patternSystem: system,
    hasSystemAccess: access.hasSystemAccess,
    freeClaimsBySystem: access.freeClaimsBySystem,
    extra: { canStartNew: canStartNewPatternForSystem(access, system) },
  });
  return canStartNewPatternForSystem(access, system);
}

/** @deprecated Use {@link resolveCanStartNewPatternForSystem}. */
export async function resolveCanStartNewSleevelessPattern(doc?: Document): Promise<boolean> {
  return resolveCanStartNewPatternForSystem(undefined, doc);
}

function isElementLike(el: unknown): el is HTMLElement {
  return (
    typeof el === "object" &&
    el !== null &&
    "setAttribute" in el &&
    typeof (el as HTMLElement).setAttribute === "function"
  );
}

function hideEl(el: unknown): void {
  if (isElementLike(el)) el.hidden = true;
}

function resolveDocFromRoot(root: ParentNode): Document | undefined {
  if (typeof Document !== "undefined" && root instanceof Document) return root;
  if (typeof HTMLElement !== "undefined" && root instanceof HTMLElement && root.ownerDocument) {
    return root.ownerDocument;
  }
  return typeof document !== "undefined" ? document : undefined;
}

export function showSleevelessNewPatternLockedScreen(
  root: ParentNode | null = typeof document !== "undefined" ? document : null,
  copy?: string,
  systemId?: PatternSystemId,
): HTMLElement | null {
  if (!root || typeof document === "undefined") return null;

  const doc = resolveDocFromRoot(root);
  const system = resolveNewPatternGateSystem(systemId, doc);
  const resolvedCopy = copy ?? resolvePatternSystemAlreadyClaimedCopy(system);
  logPatternEditGateDebug("showSleevelessNewPatternLockedScreen", {
    patternSystem: system,
    extra: { titleSystemName: patternSystemDisplayName(system) },
  });
  const systemName = patternSystemDisplayName(system);

  const builder = root.querySelector?.("[data-express-builder]");
  if (!isElementLike(builder)) return null;

  hideEl(builder);
  hideEl(root.querySelector(".express-builder-nav-row"));
  hideEl(root.querySelector(".sg-builder-nav-row"));
  hideEl(root.querySelector("[data-express-editing-bar]"));
  hideEl(root.querySelector(".pattern-subtext"));
  hideEl(root.querySelector("[data-cb-editing-banner-host]"));

  const panel = root.querySelector(".express-panel");
  const host = isElementLike(panel) ? panel : builder.parentElement;
  if (!isElementLike(host)) return null;

  let notice = host.querySelector<HTMLElement>(SLEEVELESS_NEW_PATTERN_LOCKED_SCREEN_SELECTOR);
  if (!notice) {
    notice = document.createElement("section");
    notice.setAttribute("data-sleeveless-new-pattern-locked", "");
    notice.className = "sleeveless-new-pattern-locked";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    host.insertBefore(notice, host.firstChild);
  }
  notice.replaceChildren();
  notice.hidden = false;

  const title = document.createElement("h2");
  title.className = "sleeveless-new-pattern-locked__title";
  title.textContent = `Create another ${systemName} pattern with membership`;
  notice.appendChild(title);

  const body = document.createElement("p");
  body.className = "sleeveless-new-pattern-locked__body";
  body.textContent = resolvedCopy;
  notice.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "sleeveless-new-pattern-locked__actions";

  const memberLink = document.createElement("a");
  memberLink.className =
    "kbm-btn kbm-btn-primary sleeveless-new-pattern-locked__btn sleeveless-new-pattern-locked__btn--primary";
  memberLink.href = "/membership";
  memberLink.target = "_blank";
  memberLink.rel = "noopener noreferrer";
  memberLink.textContent = "See membership options";
  actions.appendChild(memberLink);

  const viewLink = document.createElement("a");
  viewLink.className =
    "kbm-btn sleeveless-new-pattern-locked__btn sleeveless-new-pattern-locked__btn--secondary";
  viewLink.href = "/account#my-patterns";
  viewLink.textContent = "Open your saved patterns";
  actions.appendChild(viewLink);

  notice.appendChild(actions);

  return notice;
}
