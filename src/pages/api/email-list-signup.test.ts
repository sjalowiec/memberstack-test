import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(join(dir, "email-list-signup.ts"), "utf8");
const componentSource = readFileSync(
  join(dir, "../../components/EmailListSignup.astro"),
  "utf8",
);
const weeklySignupSource = readFileSync(
  join(dir, "../../components/tip-of-the-week/WeeklyTipSignup.astro"),
  "utf8",
);
const clientSource = readFileSync(
  join(dir, "../../scripts/emailListSignupForm.ts"),
  "utf8",
);
const modalSource = readFileSync(
  join(dir, "../../scripts/emailListSignupModal.ts"),
  "utf8",
);
const sharedSource = readFileSync(
  join(dir, "../../lib/email/emailListSignupShared.ts"),
  "utf8",
);
const handlerSource = readFileSync(
  join(dir, "../../lib/email/emailListSignup.ts"),
  "utf8",
);
const orphanEmbed = readFileSync(
  join(dir, "../../components/ActiveCampaignForm.astro"),
  "utf8",
);

describe("email-list-signup API route", () => {
  it("is a JSON POST endpoint with content-type validation", () => {
    expect(routeSource).toContain("export const prerender = false");
    expect(routeSource).toContain("export const POST");
    expect(routeSource).toContain("application/json");
    expect(routeSource).toContain("handleEmailListSignupRequest");
    expect(routeSource).toContain("toPublicEmailListSignupResponse");
  });

  it("does not embed ActiveCampaign credentials or call AC from the route file directly", () => {
    expect(routeSource).not.toMatch(/ACTIVECAMPAIGN_API_KEY/);
    expect(routeSource).not.toMatch(/Api-Token/);
    expect(routeSource).not.toMatch(/activehosted\.com/);
  });
});

describe("EmailListSignup component and client script", () => {
  it("uses real labels, required markers, honeypot, and privacy link", () => {
    expect(componentSource).toContain("First name");
    expect(componentSource).toContain("Email address");
    expect(componentSource).toContain('name="bot-field"');
    expect(componentSource).toContain('href="/privacy"');
    expect(componentSource).toContain("Send Me the Weekly Tip");
    expect(componentSource).toContain('role="alert"');
    expect(componentSource).toContain('role="status"');
    expect(componentSource).toContain("aria-required");
    expect(componentSource).toContain("data-signup-done");
    expect(weeklySignupSource).toContain("Get the Weekly Tip");
    expect(weeklySignupSource).toContain("data-weekly-tip-signup-modal");
  });

  it("is structured for a future Turnstile hook without embedding AC secrets", () => {
    expect(clientSource).toContain("turnstileToken");
    expect(clientSource).toContain("EMAIL_LIST_SIGNUP_ENDPOINT");
    expect(clientSource).toContain("/api/email-list-signup");
    expect(clientSource).not.toMatch(/ACTIVECAMPAIGN/);
    expect(clientSource).not.toMatch(/Api-Token/);
    expect(clientSource).not.toMatch(/activehosted\.com/);
    expect(sharedSource).not.toMatch(/ACTIVECAMPAIGN_API_KEY/);
    expect(sharedSource).not.toMatch(/activehosted\.com/);
    expect(modalSource).not.toMatch(/ACTIVECAMPAIGN_API_KEY/);
    expect(modalSource).toContain("markWeeklyTipSubscriberRecognized");
  });

  it("does not revive the orphan ActiveCampaignForm embed", () => {
    expect(componentSource).not.toContain("ActiveCampaignForm");
    expect(componentSource).not.toContain("knitbymachine.activehosted.com");
    expect(orphanEmbed).toContain("knitbymachine.activehosted.com");
    expect(handlerSource).not.toContain("ActiveCampaignForm");
  });

  it("keeps mobile-safe stacked fields and accessible status messaging", () => {
    expect(componentSource).toContain("data-signup-error");
    expect(componentSource).toContain("data-signup-thanks");
    expect(componentSource).toContain('autocomplete="given-name"');
    expect(componentSource).toContain('autocomplete="email"');
    expect(componentSource).toContain('inputmode="email"');
    expect(weeklySignupSource).toContain("max-height: min(90vh, 40rem)");
    expect(weeklySignupSource).toContain("92dvh");
  });
});
