import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

describe("protected pattern markup (no flash / fail closed)", () => {
  it("keeps builder gate content hidden until membership is confirmed", () => {
    const gate = readFileSync(
      resolve(root, "src/components/patterns/SleevelessPatternMemberGate.astro"),
      "utf8",
    );
    expect(gate).toMatch(/data-gate-pending/);
    expect(gate).toMatch(/data-sleeveless-pattern-gate-content hidden/);
    expect(gate).toMatch(/Checking membership/);
    expect(gate).not.toMatch(/Create a free account/i);
    expect(gate).not.toMatch(/Sign up free/i);
  });

  it("keeps the public Patterns landing page public with membership CTAs (no free-account promise)", () => {
    const about = readFileSync(resolve(root, "src/pages/patterns/about.astro"), "utf8");
    expect(about).toMatch(/PATTERNS_LANDING_BECOME_MEMBER_LABEL/);
    expect(about).toMatch(/PATTERNS_LANDING_LOGIN_LABEL/);
    expect(about).toMatch(/PATTERNS_LANDING_MEMBERSHIP_BODY/);
    expect(about).toMatch(/data-patterns-landing-cta/);
    expect(about).not.toMatch(/free account/i);
    expect(about).not.toMatch(/sign up free/i);
    expect(about).not.toMatch(/noindex/i);
  });

  it("wraps the pattern catalog behind the membership gate", () => {
    const catalog = readFileSync(resolve(root, "src/pages/patterns/index.astro"), "utf8");
    expect(catalog).toMatch(/SleevelessPatternMemberGate/);
  });

  it("keeps the legacy sleeveless unlock URL membership-only (no individual purchase)", () => {
    const unlock = readFileSync(
      resolve(root, "src/pages/patterns/sleeveless/unlock.astro"),
      "utf8",
    );
    expect(unlock).toMatch(/Become a Member/);
    expect(unlock).toMatch(/href=\{membershipHref\}|\/membership/);
    expect(unlock).toMatch(/MEMBERSHIPS/);
    expect(unlock).not.toMatch(/Buy This Pattern System/i);
    expect(unlock).not.toMatch(/Buy the Sleeveless Pattern System/i);
    expect(unlock).not.toMatch(/one-time purchase/i);
    expect(unlock).not.toMatch(/\$24\.95/);
    expect(unlock).not.toMatch(/\$199/);
  });
});
