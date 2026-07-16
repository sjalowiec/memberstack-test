/**
 * Behavior wiring for the floating membership corner CTA.
 *
 * The visual pill lives in MembershipCornerCta.astro. This module only
 * attaches the click action so later phases can swap in real membership
 * logic without redesigning the UI.
 */

import { openMembershipPlansPlaceholderModal } from "./membershipPlansPlaceholderModal";

/** Temporary hardcoded label until dynamic copy is wired. */
export const MEMBERSHIP_CORNER_CTA_LABEL = "Become a Member";

export type MembershipCornerAction = () => void;

/**
 * Bind the corner CTA. Defaults to opening the placeholder plans modal.
 * Pass `onAction` later to replace that with real membership flow.
 */
export function initMembershipCornerControl(
  options: { onAction?: MembershipCornerAction } = {},
): void {
  const cta = document.querySelector<HTMLButtonElement>("[data-membership-corner-cta]");
  if (!cta) return;

  const onAction = options.onAction ?? openMembershipPlansPlaceholderModal;
  cta.addEventListener("click", () => onAction());
}
