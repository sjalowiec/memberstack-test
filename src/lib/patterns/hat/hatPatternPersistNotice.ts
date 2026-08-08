/**
 * Soft persist notice for the free finished Hat Pattern page.
 * Uses global ViewerAccessState — active members are not pitched membership.
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
 * Resolve persist notice copy + membership CTA from ViewerAccessState.
 * Active members keep the temporary-pattern message only (pattern is still not saved).
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
      membershipPitch: null,
      showMembershipCta: false,
      membershipCta: null,
    };
  }

  return {
    ...base,
    membershipPitch: HAT_PATTERN_PERSIST_MEMBERSHIP_PITCH,
    showMembershipCta: true,
    membershipCta: {
      href: HAT_PATTERN_MEMBERSHIP_CTA_HREF,
      label: HAT_PATTERN_MEMBERSHIP_CTA_LABEL,
      className: HAT_PATTERN_MEMBERSHIP_CTA_CLASS,
    },
  };
}

/** Show membership pitch + CTA only for non-members (logged-out / logged-in without access). */
export function applyHatPatternPersistNoticeMembership(
  root: ParentNode | null,
  state: ViewerAccessState,
): void {
  if (!root || typeof root.querySelector !== "function") return;
  const membership = root.querySelector("[data-hat-pattern-persist-membership]");
  if (!membership || !("hidden" in membership)) return;
  const presentation = resolveHatPatternPersistNotice(state);
  (membership as HTMLElement).hidden = !presentation.showMembershipCta;
}
