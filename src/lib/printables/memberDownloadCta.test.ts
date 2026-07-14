import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { getViewerAccessState } from "../memberAccess";
import {
  PRINTABLE_DOWNLOAD_LOCKED_STATUS,
  PRINTABLE_DOWNLOAD_LOCKED_SUPPORT,
  memberDownloadCtaSpec,
} from "./memberDownloadCta";

const DOWNLOAD_HREF = "/downloads/shop/placeholder-machine-technique-reference-cards.pdf";
const DOWNLOAD_LABEL = "Machine Technique Reference Cards (PDF)";

function viewerStateForPlan(planId: string | null) {
  const payload =
    planId === null
      ? { data: null }
      : {
          data: {
            id: "ms_test",
            planConnections: [{ planId, status: "ACTIVE", active: true }],
          },
        };
  return getViewerAccessState(payload);
}

describe("memberDownloadCtaSpec", () => {
  it("unresolved state has no CTA or locked copy", () => {
    expect(memberDownloadCtaSpec(null, DOWNLOAD_HREF, DOWNLOAD_LABEL)).toEqual({
      buttons: [],
    });
  });

  it("memberAccess shows the download button only", () => {
    const state = viewerStateForPlan(MEMBERSHIPS.premium.memberstackPlanId);
    expect(state).toBe("memberAccess");

    expect(memberDownloadCtaSpec(state, DOWNLOAD_HREF, DOWNLOAD_LABEL)).toEqual({
      buttons: [
        {
          href: DOWNLOAD_HREF,
          text: DOWNLOAD_LABEL,
          action: "download",
          variant: "primary",
        },
      ],
    });
  });

  it("loggedOut shows login as the primary CTA and membership as secondary", () => {
    const state = viewerStateForPlan(null);
    expect(state).toBe("loggedOut");

    const spec = memberDownloadCtaSpec(state, DOWNLOAD_HREF, DOWNLOAD_LABEL);
    expect(spec.lockedStatus).toBe(PRINTABLE_DOWNLOAD_LOCKED_STATUS);
    expect(spec.buttons).toEqual([
      {
        href: "#",
        text: "Log in to download",
        action: "login",
        variant: "primary",
      },
      {
        href: "/membership",
        text: "Become a Member",
        action: "membership",
        variant: "secondary",
      },
    ]);
  });

  it("loggedInNoAccess shows membership CTA only", () => {
    const state = getViewerAccessState({
      data: {
        id: "ms_test",
        planConnections: [],
      },
    });
    expect(state).toBe("loggedInNoAccess");

    const spec = memberDownloadCtaSpec(state, DOWNLOAD_HREF, DOWNLOAD_LABEL);
    expect(spec.lockedStatus).toBe(PRINTABLE_DOWNLOAD_LOCKED_STATUS);
    expect(spec.lockedSupport).toBe(PRINTABLE_DOWNLOAD_LOCKED_SUPPORT);
    expect(spec.buttons).toEqual([
      {
        href: "/membership",
        text: "Become a Member",
        action: "membership",
        variant: "primary",
      },
    ]);
  });
});
