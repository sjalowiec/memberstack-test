import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

describe("Watson Member Account Repair page", () => {
  const page = fs.readFileSync(path.resolve("src/pages/watson/member-account-repair.astro"), "utf8");
  const form = fs.readFileSync(
    path.resolve("src/components/watson/WatsonMemberAccountRepairForm.astro"),
    "utf8",
  );
  const client = fs.readFileSync(
    path.resolve("src/lib/watson/memberAccountRepairClient.ts"),
    "utf8",
  );
  const load = fs.readFileSync(path.resolve("src/lib/watson/memberAccountRepairLoad.ts"), "utf8");
  const lib = fs.readFileSync(path.resolve("src/lib/watson/memberAccountRepair.ts"), "utf8");
  const shell = fs.readFileSync(path.resolve("src/components/watson/WatsonPageShell.astro"), "utf8");
  const dashboard = fs.readFileSync(path.resolve("src/pages/watson/index.astro"), "utf8");
  const header = fs.readFileSync(
    path.resolve("src/components/watson/WatsonCustomerProfileHeader.astro"),
    "utf8",
  );
  const middleware = fs.readFileSync(path.resolve("src/middleware.ts"), "utf8");
  const profile = fs.readFileSync(path.resolve("src/lib/watson/customerProfile.ts"), "utf8");

  it("defines a short intake form with collapsed detected data", () => {
    expect(page).toContain('export const prerender = false');
    expect(page).toContain("WatsonPageShell");
    expect(page).toContain("Member Account Repair");
    expect(page).toContain("loadMemberAccountRepairPageData");
    expect(page).toContain("initWatsonMemberAccountRepair");
    expect(page).toContain("reporting tool only");
    expect(page).toContain("detected={detected}");

    expect(form).toContain("data-watson-member-account-repair");
    expect(form).toContain("Customer");
    expect(form).toContain("Stripe correction");
    expect(form).toContain("Permission");
    expect(form).toContain('name="Email"');
    expect(form).toContain('name="Name"');
    expect(form).toContain('name="Problem"');
    expect(form).toContain('name="Correct paid Stripe customer"');
    expect(form).toContain('name="Wrong connected Stripe customer"');
    expect(form).toContain('name="Permission"');
    expect(form).toContain('name="Notes"');
    expect(form).toContain("MEMBER_ACCOUNT_REPAIR_PERMISSION_OPTIONS");
    expect(lib).toContain("Audit only");
    expect(lib).toContain("Repair approved after audit");
    expect(form).toContain("Detected account data");
    expect(form).toContain("<details");
    expect(form).not.toContain(" open");
    expect(form).toContain("Copy report");
    expect(form).toContain("Preview report");
    expect(form).toContain("Clear form");
    expect(form).toContain("Restore Watson data");
    expect(form).toContain("Do not enter passwords");

    expect(form).not.toContain('name="Current Memberstack ID"');
    expect(form).not.toContain('name="Memberstack email"');
    expect(form).not.toContain('name="Subscription ID"');
    expect(form).not.toContain('name="Watson ID"');
    expect(form).not.toContain('name="Legacy member ID"');
    expect(form).not.toContain('name="Purchase history"');
    expect(form).not.toContain('name="Ebook downloads"');
    expect(form).not.toContain('name="Saved patterns"');
    expect(form).not.toContain('name="Memberstack action"');
    expect(form.match(/type="email"/g)?.length).toBe(1);
  });

  it("is covered by Watson route auth", () => {
    expect(middleware).toContain("isWatsonRoute");
    expect(middleware).toContain("isWatsonSessionAuthenticated");
    expect(middleware).toContain("/watson/login?next=");
    expect(page).not.toContain("isWatsonPublicPath");
  });

  it("adds navigation, dashboard, and customer profile entry points", () => {
    expect(shell).toContain('href="/watson/member-account-repair"');
    expect(shell).toContain("Account Repair");
    expect(dashboard).toContain("Member Account Repair");
    expect(dashboard).toContain('href="/watson/member-account-repair"');
    expect(profile).toContain('label: "Account Repair"');
    expect(profile).toContain("buildMemberAccountRepairHref");
    expect(header).toContain("watson-customer__header-action--primary");
  });

  it("does not mutate Memberstack, Stripe, Watson, or stored repair input", () => {
    expect(page).not.toContain("method=\"post\"");
    expect(form).not.toContain("method=\"post\"");
    expect(form).not.toContain("type=\"password\"");
    expect(form).not.toContain("autocomplete=\"cc-");
    expect(form).not.toMatch(/name=["'][^"']*(password|card|cvv|cvc|api key)/i);
    expect(form).toContain("Do not enter passwords, complete card numbers");
    expect(client).not.toContain("fetch(");
    expect(client).not.toContain("XMLHttpRequest");
    expect(client).not.toContain("localStorage");
    expect(client).not.toContain("sessionStorage");
    expect(client).not.toContain("memberstack.com");
    expect(client).not.toContain("stripe.com");
    expect(load).not.toMatch(/\bINSERT\b/);
    expect(load).not.toMatch(/\bUPDATE\b/);
    expect(load).not.toMatch(/\bDELETE\b/);
    expect(load).toContain("Never writes");
    expect(lib).toContain("Does not update Memberstack");
    expect(lib).toContain("isStripeSubscriptionId");
    expect(lib).toContain("isMemberstackMemberId");
  });
});
