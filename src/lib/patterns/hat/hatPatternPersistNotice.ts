/**
 * Soft persist notice for the free finished Hat Pattern page.
 *
 * Shown only when the visitor does not have member saved-project privileges.
 * Free Hat view/build stays ungated; members keep save / My Patterns / rename
 * and must not see the temporary-pattern / Explore Membership upsell.
 */

import type { ViewerAccessState } from "../../memberAccess";
import { PATTERN_BUILDER_ACCOUNT_GATE_PRIMARY_HREF } from "../patternBuilderAccountGate";

export const HAT_PATTERN_PERSIST_NOTICE_TITLE = "SAVE YOUR PATTERN";

export const HAT_PATTERN_PERSIST_WARNING_LEAD =
  "This pattern is temporary and isn’t saved to your account.";

/** Emphasized preserve instruction (also the inline print/PDF control label). */
export const HAT_PATTERN_PERSIST_WARNING_EMPHASIS =
  "Print it or download the PDF before leaving this page.";

export const HAT_PATTERN_PERSIST_MEMBERSHIP_PITCH =
  "Members can save patterns and return to them anytime.";

/** Canonical membership destination (same as pattern builder / gate CTAs). */
export const HAT_PATTERN_MEMBERSHIP_CTA_HREF = PATTERN_BUILDER_ACCOUNT_GATE_PRIMARY_HREF;

export const HAT_PATTERN_MEMBERSHIP_CTA_LABEL = "Explore Membership";

export const HAT_PATTERN_MEMBERSHIP_CTA_CLASS = "kbm-btn kbm-btn-primary";

export type HatPatternPersistNoticePresentation = {
  title: typeof HAT_PATTERN_PERSIST_NOTICE_TITLE;
  warningLead: typeof HAT_PATTERN_PERSIST_WARNING_LEAD;
  warningEmphasis: typeof HAT_PATTERN_PERSIST_WARNING_EMPHASIS;
  /** Full temporary-pattern warning (lead + emphasized preserve sentence). */
  warningText: string;
  /** Whether the temporary-pattern notice should render at all. */
  showNotice: boolean;
  /** Membership benefit line; null for active members. */
  membershipPitch: string | null;
  showMembershipCta: boolean;
  membershipCta: {
    href: typeof HAT_PATTERN_MEMBERSHIP_CTA_HREF;
    label: typeof HAT_PATTERN_MEMBERSHIP_CTA_LABEL;
    className: typeof HAT_PATTERN_MEMBERSHIP_CTA_CLASS;
  } | null;
};

function warningText(): string {
  return `${HAT_PATTERN_PERSIST_WARNING_LEAD} ${HAT_PATTERN_PERSIST_WARNING_EMPHASIS}`;
}

/**
 * Temporary-pattern / Explore Membership notice is for non-members only.
 * Members never see it — including on an unsaved free Hat — because they have
 * saved-project privileges. A leftover local saved-project link also hides it.
 */
export function shouldShowHatTemporaryPatternNotice(
  state: ViewerAccessState,
  isEditingSavedProject = false,
): boolean {
  if (state === "memberAccess") return false;
  if (isEditingSavedProject) return false;
  return true;
}

/**
 * Resolve persist notice copy + membership CTA from ViewerAccessState.
 * Active members do not see the temporary-pattern / membership upsell.
 */
export function resolveHatPatternPersistNotice(
  state: ViewerAccessState,
): HatPatternPersistNoticePresentation {
  const base = {
    title: HAT_PATTERN_PERSIST_NOTICE_TITLE,
    warningLead: HAT_PATTERN_PERSIST_WARNING_LEAD,
    warningEmphasis: HAT_PATTERN_PERSIST_WARNING_EMPHASIS,
    warningText: warningText(),
  } as const;

  if (state === "memberAccess") {
    return {
      ...base,
      showNotice: false,
      membershipPitch: null,
      showMembershipCta: false,
      membershipCta: null,
    };
  }

  return {
    ...base,
    showNotice: true,
    membershipPitch: HAT_PATTERN_PERSIST_MEMBERSHIP_PITCH,
    showMembershipCta: true,
    membershipCta: {
      href: HAT_PATTERN_MEMBERSHIP_CTA_HREF,
      label: HAT_PATTERN_MEMBERSHIP_CTA_LABEL,
      className: HAT_PATTERN_MEMBERSHIP_CTA_CLASS,
    },
  };
}

export type ApplyHatPatternPersistNoticeOptions = {
  isEditingSavedProject?: boolean;
};

/** Hide/show the whole persist notice and membership pitch from ViewerAccessState. */
export function applyHatPatternPersistNotice(
  root: ParentNode | null,
  state: ViewerAccessState,
  options: ApplyHatPatternPersistNoticeOptions = {},
): void {
  if (!root || typeof root.querySelector !== "function") return;
  const presentation = resolveHatPatternPersistNotice(state);
  const showNotice = shouldShowHatTemporaryPatternNotice(
    state,
    options.isEditingSavedProject === true,
  );

  const notice = root.querySelector("[data-hat-pattern-persist-notice]");
  if (notice && "hidden" in notice) {
    (notice as HTMLElement).hidden = !showNotice;
  }

  const membership = root.querySelector("[data-hat-pattern-persist-membership]");
  if (membership && "hidden" in membership) {
    (membership as HTMLElement).hidden = !presentation.showMembershipCta;
  }
}

/** @deprecated Use {@link applyHatPatternPersistNotice}. */
export function applyHatPatternPersistNoticeMembership(
  root: ParentNode | null,
  state: ViewerAccessState,
  options: ApplyHatPatternPersistNoticeOptions = {},
): void {
  applyHatPatternPersistNotice(root, state, options);
}
