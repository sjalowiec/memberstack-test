import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../../config/memberships";
import { getViewerAccessState } from "../../memberAccess";
import { PATTERN_BUILDER_ACCOUNT_GATE_PRIMARY_HREF } from "../patternBuilderAccountGate";
import {
  HAT_PATTERN_MEMBERSHIP_CTA_CLASS,
  HAT_PATTERN_MEMBERSHIP_CTA_HREF,
  HAT_PATTERN_MEMBERSHIP_CTA_LABEL,
  HAT_PATTERN_PERSIST_MEMBERSHIP_PITCH,
  HAT_PATTERN_PERSIST_NOTICE_TITLE,
  HAT_PATTERN_PERSIST_WARNING_EMPHASIS,
  HAT_PATTERN_PERSIST_WARNING_LEAD,
  resolveHatPatternPersistNotice,
} from "./hatPatternPersistNotice";

const patternPageSource = readFileSync(
  resolve("src/pages/patterns/hat/pattern.astro"),
  "utf8",
);
const warningBoxSource = readFileSync(
  resolve("src/components/ui/WarningBox.astro"),
  "utf8",
);
const hatPatternPageScript = readFileSync(
  resolve("src/scripts/hat-pattern-page.ts"),
  "utf8",
);

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

describe("resolveHatPatternPersistNotice", () => {
  it("uses SAVE YOUR PATTERN heading and temporary-pattern copy for all visitors", () => {
    expect(HAT_PATTERN_PERSIST_NOTICE_TITLE).toBe("SAVE YOUR PATTERN");
    for (const state of ["loggedOut", "loggedInNoAccess", "memberAccess"] as const) {
      const notice = resolveHatPatternPersistNotice(state);
      expect(notice.title).toBe("SAVE YOUR PATTERN");
      expect(notice.warningLead).toBe(HAT_PATTERN_PERSIST_WARNING_LEAD);
      expect(notice.warningEmphasis).toBe(HAT_PATTERN_PERSIST_WARNING_EMPHASIS);
      expect(notice.warningText).toContain("temporary");
      expect(notice.warningText).toMatch(/isn.?t saved/i);
      expect(notice.warningText).toContain(HAT_PATTERN_PERSIST_WARNING_EMPHASIS);
    }
  });

  it("logged-out visitors see the membership benefit and Explore Membership CTA", () => {
    const state = viewerStateForPlan(null);
    expect(state).toBe("loggedOut");

    const notice = resolveHatPatternPersistNotice(state);
    expect(notice.membershipPitch).toBe(
      "Members can save patterns and return to them anytime.",
    );
    expect(notice.membershipPitch).toBe(HAT_PATTERN_PERSIST_MEMBERSHIP_PITCH);
    expect(notice.showMembershipCta).toBe(true);
    expect(notice.membershipCta).toEqual({
      href: "/membership",
      label: "Explore Membership",
      className: HAT_PATTERN_MEMBERSHIP_CTA_CLASS,
    });
  });

  it("logged-in non-members see the same membership benefit and Explore Membership CTA", () => {
    const state = getViewerAccessState({
      data: {
        id: "ms_test",
        planConnections: [],
      },
    });
    expect(state).toBe("loggedInNoAccess");

    const notice = resolveHatPatternPersistNotice(state);
    expect(notice.membershipPitch).toBe(HAT_PATTERN_PERSIST_MEMBERSHIP_PITCH);
    expect(notice.showMembershipCta).toBe(true);
    expect(notice.membershipCta?.href).toBe(PATTERN_BUILDER_ACCOUNT_GATE_PRIMARY_HREF);
    expect(notice.membershipCta?.label).toBe("Explore Membership");
  });

  it("CTA uses the canonical membership URL and primary button classes", () => {
    expect(HAT_PATTERN_MEMBERSHIP_CTA_HREF).toBe("/membership");
    expect(HAT_PATTERN_MEMBERSHIP_CTA_HREF).toBe(PATTERN_BUILDER_ACCOUNT_GATE_PRIMARY_HREF);
    expect(HAT_PATTERN_MEMBERSHIP_CTA_LABEL).toBe("Explore Membership");
    expect(HAT_PATTERN_MEMBERSHIP_CTA_CLASS).toBe("kbm-btn kbm-btn-primary");

    const notice = resolveHatPatternPersistNotice("loggedOut");
    expect(notice.membershipCta?.href).toBe("/membership");
    expect(notice.membershipCta?.className).toContain("kbm-btn");
    expect(notice.membershipCta?.className).toContain("kbm-btn-primary");
  });

  it("active members are not shown a membership pitch or CTA", () => {
    const state = viewerStateForPlan(MEMBERSHIPS.membership.memberstackPlanId);
    expect(state).toBe("memberAccess");

    const notice = resolveHatPatternPersistNotice(state);
    expect(notice.showMembershipCta).toBe(false);
    expect(notice.membershipPitch).toBeNull();
    expect(notice.membershipCta).toBeNull();
  });

  it("active members still see a temporary-pattern message and are not told the pattern is saved", () => {
    const notice = resolveHatPatternPersistNotice("memberAccess");
    expect(notice.title).toBe("SAVE YOUR PATTERN");
    expect(notice.warningText).toMatch(/temporary/i);
    expect(notice.warningText).toMatch(/isn.?t saved/i);
    expect(notice.warningText.toLowerCase()).not.toMatch(
      /\b(has been|is|was|can be|will be) saved\b/,
    );
    expect(notice.membershipPitch).toBeNull();
    expect(notice.showMembershipCta).toBe(false);
  });
});

describe("Hat Pattern persist notice page wiring", () => {
  it("renders a soft Hat notice without the warning-triangle icon", () => {
    expect(patternPageSource).toContain('class="hat-pattern-persist-notice"');
    expect(patternPageSource).toContain("HAT_PATTERN_PERSIST_NOTICE_TITLE");
    expect(patternPageSource).toContain("hat-pattern-persist-notice__title");
    expect(patternPageSource).not.toMatch(
      /data-hat-pattern-persist-notice[\s\S]{0,400}⚠/,
    );
    expect(patternPageSource).not.toMatch(
      /data-hat-pattern-persist-notice[\s\S]{0,400}kbm-warning-box__icon/,
    );
    expect(patternPageSource).not.toMatch(
      /data-hat-pattern-persist-notice[\s\S]{0,200}<WarningBox/,
    );
  });

  it("emphasizes the print/download sentence and excludes membership pitch/CTA from print", () => {
    expect(patternPageSource).toContain("HAT_PATTERN_PERSIST_WARNING_EMPHASIS");
    expect(patternPageSource).toContain("hat-pattern-print-inline-link");
    expect(patternPageSource).toContain("print-visible");
    expect(patternPageSource).toContain("data-hat-pattern-persist-membership");
    expect(patternPageSource).toMatch(
      /hat-pattern-persist-notice__membership[^"]*no-print|no-print[^"]*hat-pattern-persist-notice__membership/,
    );
    expect(patternPageSource).toContain('data-testid="hat-pattern-membership-cta"');
    expect(patternPageSource).toContain("HAT_PATTERN_MEMBERSHIP_CTA_HREF");
    expect(patternPageSource).toContain("HAT_PATTERN_MEMBERSHIP_CTA_LABEL");
    // Soft notice itself must remain printable (not wrapped in blanket no-print).
    expect(patternPageSource).not.toMatch(
      /class="no-print"[^>]*>\s*<aside[\s\S]*?hat-pattern-persist-notice/,
    );
    expect(patternPageSource).toMatch(
      /@media print\s*\{[\s\S]*?\.hat-pattern-persist-notice\s*\{/,
    );
  });

  it("CTA is a real accessible Explore Membership link styled as a primary button", () => {
    expect(patternPageSource).toMatch(
      /<a[\s\S]*?href=\{HAT_PATTERN_MEMBERSHIP_CTA_HREF\}[\s\S]*?data-hat-pattern-membership-cta/,
    );
    expect(patternPageSource).toContain("HAT_PATTERN_MEMBERSHIP_CTA_CLASS");
    expect(patternPageSource).not.toMatch(
      /data-hat-pattern-membership-cta[\s\S]{0,80}<button/,
    );
    expect(HAT_PATTERN_MEMBERSHIP_CTA_LABEL).toBe("Explore Membership");
  });

  it("does not add a membership gate to the free Hat Pattern page", () => {
    expect(patternPageSource).toMatch(/free\s*\/\s*ungated/i);
    expect(patternPageSource).not.toContain("data-sleeveless-pattern-gate");
    expect(patternPageSource).not.toContain("PatternBuilderAccountGate");
    expect(patternPageSource).not.toContain("initPatternMembershipPageGate");
    expect(hatPatternPageScript).toMatch(/Free\s*\/\s*ungated/i);
    expect(hatPatternPageScript).not.toContain("ensurePatternBuilderAccount");
    expect(hatPatternPageScript).not.toContain("initPatternMembershipPageGate");
  });

  it("shared WarningBox keeps warning appearance and stays hidden in print", () => {
    expect(warningBoxSource).toContain("⚠");
    expect(warningBoxSource).toContain("kbm-warning-box__icon");
    expect(warningBoxSource).toMatch(/border:\s*2px\s+solid\s+#c2614e/);
    expect(warningBoxSource).toMatch(
      /@media print\s*\{[\s\S]*?display:\s*none\s*!important/,
    );
  });

  it("uses ViewerAccessState so active membership is not inferred from login alone", () => {
    expect(hatPatternPageScript).toContain("getViewerAccessState");
    expect(hatPatternPageScript).toContain("applyHatPatternPersistNoticeMembership");
    expect(hatPatternPageScript).toContain("applyHatPatternMyPatternsAccess");
    expect(hatPatternPageScript).not.toMatch(
      /getViewerAccessState[\s\S]{0,200}isMemberLoggedIn\(\)/,
    );
  });
});
