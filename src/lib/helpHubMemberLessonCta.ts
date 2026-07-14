import type { ViewerAccessState } from "./memberAccess";

export type HelpHubMemberLessonCtaAction = "lesson" | "login" | "membership";

export type HelpHubMemberLessonCtaVariant = "primary" | "secondary";

export type HelpHubMemberLessonCtaButton = {
  href: string;
  text: string;
  action: HelpHubMemberLessonCtaAction;
  variant: HelpHubMemberLessonCtaVariant;
};

export type HelpHubMemberLessonCtaSpec = {
  buttons: HelpHubMemberLessonCtaButton[];
  /** Shown above CTAs for logged-out and logged-in-no-access viewers. */
  lockedStatus?: string;
  /** Extra locked-state detail for logged-in-no-access viewers. */
  lockedSupport?: string;
  /** Whether to show the static “Included with membership” note below the mount. */
  showMembershipNote: boolean;
};

export const HELP_HUB_MEMBER_LESSON_LOCKED_STATUS =
  "This full lesson is for Knit It Now members.";

export const HELP_HUB_MEMBER_LESSON_LOCKED_SUPPORT =
  "Become a member to watch the lesson and access the complete member library.";

const MEMBERSHIP_URL = "/membership";

/** Resolved CTA content for one Help Hub Member Lesson card. `null` state = no CTA. */
export function helpHubMemberLessonCtaSpec(
  state: ViewerAccessState | null,
  lessonHref: string,
): HelpHubMemberLessonCtaSpec {
  const lessonUrl = lessonHref.trim() || "/lessons";

  if (state === null) {
    return { buttons: [], showMembershipNote: false };
  }

  if (state === "memberAccess") {
    return {
      buttons: [
        {
          href: lessonUrl,
          text: "Watch the full lesson",
          action: "lesson",
          variant: "primary",
        },
      ],
      showMembershipNote: true,
    };
  }

  if (state === "loggedOut") {
    return {
      lockedStatus: HELP_HUB_MEMBER_LESSON_LOCKED_STATUS,
      buttons: [
        {
          href: MEMBERSHIP_URL,
          text: "Become a Member",
          action: "membership",
          variant: "primary",
        },
        {
          href: "#",
          text: "Already a member? Log in",
          action: "login",
          variant: "secondary",
        },
      ],
      showMembershipNote: false,
    };
  }

  return {
    lockedStatus: HELP_HUB_MEMBER_LESSON_LOCKED_STATUS,
    lockedSupport: HELP_HUB_MEMBER_LESSON_LOCKED_SUPPORT,
    buttons: [
      {
        href: MEMBERSHIP_URL,
        text: "Become a Member",
        action: "membership",
        variant: "primary",
      },
    ],
    showMembershipNote: false,
  };
}
