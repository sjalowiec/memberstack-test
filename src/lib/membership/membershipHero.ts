/**
 * /membership hero heading personalization for active / canceling paid members.
 */

import { memberFirstNameFromMemberstackPayload } from "../patterns/memberstackMember";

export const MEMBERSHIP_HERO_HEADING_DEFAULT = "Knit it Now Membership";

/**
 * Personalized welcome for active/canceling members.
 * Uses only the Memberstack first name (trimmed). Never email or username.
 */
export function membershipHeroWelcomeHeading(payload: unknown): string {
  const firstName = memberFirstNameFromMemberstackPayload(payload);
  if (!firstName) return "Welcome back!";
  return `Welcome back, ${firstName}!`;
}

export function applyMembershipHeroHeading(
  mode: "welcome" | "default",
  root: ParentNode = document,
  payload: unknown | null = null,
): void {
  const heading = root.querySelector<HTMLElement>("#membership-hero-heading");
  if (!heading) return;

  if (mode === "welcome") {
    heading.textContent = membershipHeroWelcomeHeading(payload);
    heading.setAttribute("data-membership-hero-heading", "welcome");
    return;
  }

  heading.textContent = MEMBERSHIP_HERO_HEADING_DEFAULT;
  heading.setAttribute("data-membership-hero-heading", "default");
}
