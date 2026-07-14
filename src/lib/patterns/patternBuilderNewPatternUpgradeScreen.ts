/**
 * DOM for the logged-in "create another pattern" upgrade screen (Pattern Builder).
 */
import { startPatternBuilderLifetimeCheckout } from "./patternBuilderLifetimeCheckout";
import {
  resolvePatternBuilderNewPatternUpgradeUiMode,
  type PatternBuilderNewPatternUpgradeUiMode,
} from "./patternBuilderNewPatternUpgrade";
import {
  formatPatternBuilderLifetimePrice,
  PATTERN_BUILDER_MEMBERSHIP_OPTION_COPY,
  PATTERN_BUILDER_MEMBERSHIP_OPTION_CTA,
  PATTERN_BUILDER_MEMBERSHIP_OPTION_HREF,
  PATTERN_BUILDER_MEMBERSHIP_OPTION_TITLE,
  PATTERN_BUILDER_SAVED_PATTERNS_CTA,
  PATTERN_BUILDER_SAVED_PATTERNS_HEADING,
  PATTERN_BUILDER_SAVED_PATTERNS_HREF,
  resolvePatternBuilderUpgradeConfig,
  type PatternBuilderUpgradeConfig,
} from "./patternBuilderUpgradeConfig";
import {
  resolvePatternSystemAlreadyClaimedCopy,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { patternSystemDisplayName, type PatternSystemId } from "./patternSystemId";

export const PATTERN_BUILDER_NEW_PATTERN_LOCKED_SCREEN_SELECTOR =
  "[data-sleeveless-new-pattern-locked]";

/** @deprecated Use {@link PATTERN_BUILDER_NEW_PATTERN_LOCKED_SCREEN_SELECTOR}. */
export const SLEEVELESS_NEW_PATTERN_LOCKED_SCREEN_SELECTOR =
  PATTERN_BUILDER_NEW_PATTERN_LOCKED_SCREEN_SELECTOR;

export const PATTERN_BUILDER_LIFETIME_CHECKOUT_BUTTON_SELECTOR =
  "[data-pattern-builder-lifetime-checkout]";

/** @deprecated Use {@link PATTERN_BUILDER_LIFETIME_CHECKOUT_BUTTON_SELECTOR}. */
export const SLEEVELESS_LIFETIME_CHECKOUT_BUTTON_SELECTOR =
  PATTERN_BUILDER_LIFETIME_CHECKOUT_BUTTON_SELECTOR;

const pendingUpgradeCheckoutErrors = new Map<string, string>();

export function setPendingUpgradeCheckoutError(
  message: string | null,
  builderKey?: string,
): void {
  const key = builderKey ?? "__global__";
  if (message === null) {
    pendingUpgradeCheckoutErrors.delete(key);
    return;
  }
  pendingUpgradeCheckoutErrors.set(key, message);
}

export function consumePendingUpgradeCheckoutError(builderKey?: string): string | null {
  const key = builderKey ?? "__global__";
  const message = pendingUpgradeCheckoutErrors.get(key) ?? pendingUpgradeCheckoutErrors.get("__global__") ?? null;
  pendingUpgradeCheckoutErrors.delete(key);
  pendingUpgradeCheckoutErrors.delete("__global__");
  return message;
}

export const PATTERN_BUILDER_UPGRADE_STATUS_SELECTOR = "[data-sleeveless-upgrade-status]";

/** @deprecated Use {@link PATTERN_BUILDER_UPGRADE_STATUS_SELECTOR}. */
export const SLEEVELESS_UPGRADE_STATUS_SELECTOR = PATTERN_BUILDER_UPGRADE_STATUS_SELECTOR;

const BOUND_ATTR = "data-sleeveless-upgrade-bound";

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

function setUpgradeStatus(notice: HTMLElement, message: string, tone: "info" | "error"): void {
  const status = notice.querySelector<HTMLElement>(PATTERN_BUILDER_UPGRADE_STATUS_SELECTOR);
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
  status.className = `sleeveless-new-pattern-locked__status sleeveless-new-pattern-locked__status--${tone}`;
}

export function clearUpgradeStatus(notice: HTMLElement): void {
  const status = notice.querySelector<HTMLElement>(PATTERN_BUILDER_UPGRADE_STATUS_SELECTOR);
  if (!status) return;
  status.hidden = true;
  status.textContent = "";
  status.className = "sleeveless-new-pattern-locked__status";
}

function createMembershipCard(mode: PatternBuilderNewPatternUpgradeUiMode): HTMLElement {
  const card = document.createElement("article");
  card.className = "sleeveless-new-pattern-locked__card";
  if (mode === "membership-and-lifetime") {
    card.className += " sleeveless-new-pattern-locked__card--featured";
    const badge = document.createElement("p");
    badge.className = "sleeveless-new-pattern-locked__badge";
    badge.textContent = "Recommended";
    card.appendChild(badge);
  }

  const title = document.createElement("h3");
  title.className = "sleeveless-new-pattern-locked__card-title";
  title.textContent = PATTERN_BUILDER_MEMBERSHIP_OPTION_TITLE;
  card.appendChild(title);

  const body = document.createElement("p");
  body.className = "sleeveless-new-pattern-locked__card-body";
  body.textContent = PATTERN_BUILDER_MEMBERSHIP_OPTION_COPY;
  card.appendChild(body);

  const ctaWrap = document.createElement("div");
  ctaWrap.className = "sleeveless-new-pattern-locked__card-cta";
  const memberLink = document.createElement("a");
  memberLink.className = "kbm-btn kbm-btn-primary sleeveless-new-pattern-locked__btn";
  memberLink.href = PATTERN_BUILDER_MEMBERSHIP_OPTION_HREF;
  memberLink.target = "_blank";
  memberLink.rel = "noopener noreferrer";
  memberLink.textContent = PATTERN_BUILDER_MEMBERSHIP_OPTION_CTA;
  ctaWrap.appendChild(memberLink);
  card.appendChild(ctaWrap);

  return card;
}

function createLifetimeCard(config: PatternBuilderUpgradeConfig): HTMLElement {
  const card = document.createElement("article");
  card.className = "sleeveless-new-pattern-locked__card";

  const title = document.createElement("h3");
  title.className = "sleeveless-new-pattern-locked__card-title";
  title.textContent = config.lifetimeCardTitle;
  card.appendChild(title);

  const price = document.createElement("p");
  price.className = "sleeveless-new-pattern-locked__price";
  price.textContent = formatPatternBuilderLifetimePrice(config.builderKey);
  card.appendChild(price);

  const body = document.createElement("p");
  body.className = "sleeveless-new-pattern-locked__card-body";
  body.textContent = config.lifetimeCardCopy;
  card.appendChild(body);

  const ctaWrap = document.createElement("div");
  ctaWrap.className = "sleeveless-new-pattern-locked__card-cta";
  const buyBtn = document.createElement("button");
  buyBtn.type = "button";
  buyBtn.className = "kbm-btn kbm-btn-outline sleeveless-new-pattern-locked__btn";
  buyBtn.setAttribute("data-pattern-builder-lifetime-checkout", "");
  buyBtn.setAttribute("data-sleeveless-lifetime-checkout", "");
  buyBtn.setAttribute("data-builder-key", config.builderKey);
  buyBtn.textContent = config.lifetimePurchaseCta;
  ctaWrap.appendChild(buyBtn);
  card.appendChild(ctaWrap);

  return card;
}

function renderUpgradeContent(
  notice: HTMLElement,
  mode: PatternBuilderNewPatternUpgradeUiMode,
  systemId: PatternSystemId,
  legacyBodyCopy?: string,
): void {
  notice.replaceChildren();
  clearUpgradeStatus(notice);

  const config = resolvePatternBuilderUpgradeConfig(systemId);

  const title = document.createElement("h2");
  title.className = "sleeveless-new-pattern-locked__title";
  title.textContent =
    mode === "membership-and-lifetime" && config
      ? config.heading
      : `Create another ${patternSystemDisplayName(systemId)} pattern with membership`;
  notice.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "sleeveless-new-pattern-locked__body";
  intro.textContent =
    mode === "membership-and-lifetime" && config
      ? config.intro
      : (legacyBodyCopy ?? resolvePatternSystemAlreadyClaimedCopy(systemId));
  notice.appendChild(intro);

  const options = document.createElement("div");
  options.className = "sleeveless-new-pattern-locked__options";
  options.appendChild(createMembershipCard(mode));
  if (mode === "membership-and-lifetime" && config) {
    options.appendChild(createLifetimeCard(config));
  }
  notice.appendChild(options);

  const status = document.createElement("p");
  status.className = "sleeveless-new-pattern-locked__status";
  status.setAttribute("data-sleeveless-upgrade-status", "");
  status.hidden = true;
  notice.appendChild(status);

  const savedSection = document.createElement("section");
  savedSection.className = "sleeveless-new-pattern-locked__saved-patterns";

  const savedHeading = document.createElement("h3");
  savedHeading.className = "sleeveless-new-pattern-locked__saved-patterns-heading";
  savedHeading.textContent = PATTERN_BUILDER_SAVED_PATTERNS_HEADING;
  savedSection.appendChild(savedHeading);

  const savedLink = document.createElement("a");
  savedLink.className = "sleeveless-new-pattern-locked__saved-patterns-link";
  savedLink.href = PATTERN_BUILDER_SAVED_PATTERNS_HREF;
  savedLink.textContent = PATTERN_BUILDER_SAVED_PATTERNS_CTA;
  savedSection.appendChild(savedLink);

  notice.appendChild(savedSection);
}

export function wirePatternBuilderNewPatternUpgradeScreen(notice: HTMLElement): void {
  if (notice.getAttribute(BOUND_ATTR) === "true") return;
  notice.setAttribute(BOUND_ATTR, "true");

  notice
    .querySelectorAll<HTMLButtonElement>(PATTERN_BUILDER_LIFETIME_CHECKOUT_BUTTON_SELECTOR)
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        void (async () => {
          const builderKey = btn.getAttribute("data-builder-key")?.trim();
          if (!builderKey) return;

          btn.disabled = true;
          btn.setAttribute("aria-busy", "true");
          clearUpgradeStatus(notice);
          setUpgradeStatus(notice, "Opening checkout…", "info");
          const result = await startPatternBuilderLifetimeCheckout(builderKey);
          if (!result.ok) {
            setUpgradeStatus(notice, result.message, "error");
            btn.disabled = false;
            btn.removeAttribute("aria-busy");
          }
        })();
      });
    });
}

/** @deprecated Use {@link wirePatternBuilderNewPatternUpgradeScreen}. */
export function wireSleevelessNewPatternUpgradeScreen(notice: HTMLElement): void {
  wirePatternBuilderNewPatternUpgradeScreen(notice);
}

export function renderPatternBuilderNewPatternUpgradeScreen(
  notice: HTMLElement,
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
  legacyBodyCopy?: string,
): PatternBuilderNewPatternUpgradeUiMode {
  const mode = resolvePatternBuilderNewPatternUpgradeUiMode(access, systemId);
  renderUpgradeContent(notice, mode, systemId, legacyBodyCopy);
  if (mode === "membership-and-lifetime") {
    wirePatternBuilderNewPatternUpgradeScreen(notice);
  }
  return mode;
}

/** @deprecated Use {@link renderPatternBuilderNewPatternUpgradeScreen}. */
export function renderSleevelessNewPatternUpgradeScreen(
  notice: HTMLElement,
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
  legacyBodyCopy?: string,
): PatternBuilderNewPatternUpgradeUiMode {
  return renderPatternBuilderNewPatternUpgradeScreen(notice, access, systemId, legacyBodyCopy);
}

export function mountPatternBuilderNewPatternUpgradeScreen(
  root: ParentNode,
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
  legacyBodyCopy?: string,
): HTMLElement | null {
  if (typeof document === "undefined") return null;

  hideEl(root.querySelector?.("[data-express-builder]"));
  hideEl(root.querySelector(".express-builder-nav-row"));
  hideEl(root.querySelector(".sg-builder-nav-row"));
  hideEl(root.querySelector("[data-express-editing-bar]"));
  hideEl(root.querySelector(".pattern-subtext"));
  hideEl(root.querySelector("[data-cb-editing-banner-host]"));

  const panel = root.querySelector(".express-panel");
  const builder = root.querySelector("[data-express-builder]");
  const host = isElementLike(panel) ? panel : isElementLike(builder) ? builder.parentElement : null;
  if (!isElementLike(host)) return null;

  let notice = host.querySelector<HTMLElement>(PATTERN_BUILDER_NEW_PATTERN_LOCKED_SCREEN_SELECTOR);
  if (!notice) {
    notice = document.createElement("section");
    notice.setAttribute("data-sleeveless-new-pattern-locked", "");
    notice.className = "sleeveless-new-pattern-locked";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    host.insertBefore(notice, host.firstChild);
  }
  notice.hidden = false;
  renderPatternBuilderNewPatternUpgradeScreen(notice, access, systemId, legacyBodyCopy);
  const config = resolvePatternBuilderUpgradeConfig(systemId);
  const pendingError = consumePendingUpgradeCheckoutError(config?.builderKey);
  if (pendingError) {
    setUpgradeStatus(notice, pendingError, "error");
  }
  return notice;
}

/** @deprecated Use {@link mountPatternBuilderNewPatternUpgradeScreen}. */
export function mountSleevelessNewPatternUpgradeScreen(
  root: ParentNode,
  access: SleevelessUserAccess,
  systemId: PatternSystemId,
  legacyBodyCopy?: string,
): HTMLElement | null {
  return mountPatternBuilderNewPatternUpgradeScreen(root, access, systemId, legacyBodyCopy);
}

export function showPatternBuilderUnlockedConfirmation(
  root: ParentNode,
  title: string,
  message: string,
): void {
  if (typeof document === "undefined") return;
  const scope = isElementLike(root) ? root : document.body;
  let banner = scope.querySelector<HTMLElement>("[data-sleeveless-lifetime-unlocked]");
  if (!banner) {
    banner = document.createElement("section");
    banner.setAttribute("data-sleeveless-lifetime-unlocked", "");
    banner.className = "sleeveless-lifetime-unlocked-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    scope.insertBefore(banner, scope.firstChild);
  }
  banner.replaceChildren();
  const heading = document.createElement("h2");
  heading.className = "sleeveless-lifetime-unlocked-banner__title";
  heading.textContent = title;
  banner.appendChild(heading);
  const body = document.createElement("p");
  body.className = "sleeveless-lifetime-unlocked-banner__body";
  body.textContent = message;
  banner.appendChild(body);
  banner.hidden = false;
}

/** @deprecated Use {@link showPatternBuilderUnlockedConfirmation}. */
export function showSleevelessLifetimeUnlockedConfirmation(
  root: ParentNode,
  title: string,
  message: string,
): void {
  showPatternBuilderUnlockedConfirmation(root, title, message);
}

export { hideEl as hideExpressBuilderChromeForUpgradeScreen };
