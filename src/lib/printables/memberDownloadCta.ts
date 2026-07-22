import type { ViewerAccessState } from "../memberAccess";

export type MemberDownloadCtaAction = "download" | "login" | "membership";

export type MemberDownloadCtaVariant = "primary" | "secondary";

export type MemberDownloadCtaButton = {
  href: string;
  text: string;
  action: MemberDownloadCtaAction;
  variant: MemberDownloadCtaVariant;
};

export type MemberDownloadCtaSpec = {
  buttons: MemberDownloadCtaButton[];
  lockedStatus?: string;
  lockedSupport?: string;
};

export const PRINTABLE_DOWNLOAD_LOCKED_STATUS =
  "This download is for Knit It Now members.";

export const PRINTABLE_DOWNLOAD_LOCKED_SUPPORT =
  "Become a member to download printable resources included with your membership.";

const MEMBERSHIP_URL = "/membership";

/** Resolved CTA content for one member-gated printable download card. */
export function memberDownloadCtaSpec(
  state: ViewerAccessState | null,
  downloadHref: string,
  downloadLabel: string,
): MemberDownloadCtaSpec {
  const fileUrl = downloadHref.trim();
  const label = downloadLabel.trim() || "Download (PDF)";

  if (state === null) {
    return { buttons: [] };
  }

  if (state === "memberAccess") {
    return {
      buttons: [
        {
          href: fileUrl,
          text: label,
          action: "download",
          variant: "primary",
        },
      ],
    };
  }

  if (state === "loggedOut") {
    return {
      lockedStatus: PRINTABLE_DOWNLOAD_LOCKED_STATUS,
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
    };
  }

  return {
    lockedStatus: PRINTABLE_DOWNLOAD_LOCKED_STATUS,
    lockedSupport: PRINTABLE_DOWNLOAD_LOCKED_SUPPORT,
    buttons: [
      {
        href: MEMBERSHIP_URL,
        text: "Become a Member",
        action: "membership",
        variant: "primary",
      },
    ],
  };
}
