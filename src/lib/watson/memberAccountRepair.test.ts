import { describe, expect, it } from "vitest";

import {
  buildDetectedAccountData,
  buildMemberAccountRepairHref,
  buildMemberAccountRepairReport,
  buildMemberAccountRepairValuesFromPrefill,
  emptyMemberAccountRepairValues,
  isMemberstackMemberId,
  isStripeCustomerId,
  isStripeSubscriptionId,
  MEMBER_ACCOUNT_REPAIR_PATH,
  memberAccountRepairFieldsAreSafe,
  memberAccountRepairFieldNames,
  parseMemberAccountRepairSource,
  PERMISSION_AUDIT_ONLY,
  valuesFromCustomerProfile,
  watsonIdFromIdentifiers,
  type CustomerProfileRepairInput,
} from "./memberAccountRepair";

function profile(overrides: Partial<CustomerProfileRepairInput> = {}): CustomerProfileRepairInput {
  return {
    displayName: "Sue Hall",
    notesWriteId: "M1",
    legacyMemberid: "M1",
    memberstackId: "mem_123",
    hasLegacyHistory: true,
    pdfPurchaseCount: 2,
    orders: [{ id: "o1" }],
    courses: [{ id: "c1" }],
    member: { email: "legacy@example.com" },
    memberstack: {
      email: "sue@example.com",
      membershipStatusLabel: "Active",
      connections: [
        {
          planName: "Monthly Membership",
          planId: "pln_membership",
          activeLabel: "Active",
          billingInterval: "monthly",
          connectionId: "pc_abc",
        },
      ],
    },
    headerView: {
      email: "sue@example.com",
      currentPlan: "Monthly Membership",
      membershipStatus: "Active",
      membershipSource: "Memberstack/Stripe",
    },
    ...overrides,
  };
}

describe("memberAccountRepair", () => {
  it("starts as a blank standalone intake form", () => {
    const values = emptyMemberAccountRepairValues();
    expect(memberAccountRepairFieldNames()).toEqual([
      "Name",
      "Email",
      "Problem",
      "Correct paid Stripe customer",
      "Wrong connected Stripe customer",
      "Permission",
      "Notes",
    ]);
    expect(Object.values(values).every((value) => value === "")).toBe(true);
    expect(buildMemberAccountRepairReport(values)).toBe("MEMBER ACCOUNT REPAIR\n\nNotes:");
    expect(parseMemberAccountRepairSource({ get: () => null })).toEqual({
      legacyMemberid: null,
      memberstackId: null,
    });
    expect(buildMemberAccountRepairHref({})).toBe(MEMBER_ACCOUNT_REPAIR_PATH);
  });

  it("prefills only customer name and email from Watson", () => {
    const values = valuesFromCustomerProfile(profile());
    expect(values.Name).toBe("Sue Hall");
    expect(values.Email).toBe("sue@example.com");
    expect(values.Problem).toBe("");
    expect(values["Correct paid Stripe customer"]).toBe("");
    expect(values["Wrong connected Stripe customer"]).toBe("");
    expect(values.Permission).toBe("");
    expect(values.Notes).toBe("");
    expect(values).not.toHaveProperty("Current Memberstack ID");
    expect(values).not.toHaveProperty("Watson ID");
    expect(values).not.toHaveProperty("Subscription ID");
  });

  it("does not invent a customer name from an email or Memberstack id", () => {
    const values = valuesFromCustomerProfile(
      profile({
        displayName: "sue@example.com",
        memberstackId: "mem_123",
        headerView: {
          email: "sue@example.com",
          currentPlan: null,
          membershipStatus: null,
          membershipSource: null,
        },
      }),
    );
    expect(values.Name).toBe("");
    expect(values.Email).toBe("sue@example.com");
  });

  it("builds the short intake report and omits blank fields except Notes", () => {
    const report = buildMemberAccountRepairReport({
      Name: "Linda Dawson",
      Email: "texas44@gmail.com",
      Problem: "Old Stripe customer ID connected in Memberstack",
      "Correct paid Stripe customer": "cus_Mmpdx2IylY9sEU",
      "Wrong connected Stripe customer": "cus_Uzw6b3nflTcBIy",
      Permission: PERMISSION_AUDIT_ONLY,
      Notes: "",
    });

    expect(report).toBe(
      [
        "MEMBER ACCOUNT REPAIR",
        "",
        "Customer: Linda Dawson",
        "Email: texas44@gmail.com",
        "Problem: Old Stripe customer ID connected in Memberstack",
        "",
        "Correct paid Stripe customer: cus_Mmpdx2IylY9sEU",
        "Wrong connected Stripe customer: cus_Uzw6b3nflTcBIy",
        "",
        "Permission: Audit only",
        "Notes:",
      ].join("\n"),
    );
    expect(report.match(/^Email:/gm)).toHaveLength(1);
    expect(report).not.toContain("Memberstack ID");
    expect(report).not.toContain("Watson ID");
    expect(report).not.toContain("Subscription ID");
    expect(report).not.toContain("Purchase history");
  });

  it("does not label a Memberstack mem_ value as a Watson ID", () => {
    const memberstackId = "mem_cmroqaip20um70tpcbihd3rh2";
    expect(isMemberstackMemberId(memberstackId)).toBe(true);
    expect(watsonIdFromIdentifiers(null, memberstackId)).toBe("");
    expect(watsonIdFromIdentifiers("M1", memberstackId)).toBe("M1");

    const detected = buildDetectedAccountData(
      profile({
        notesWriteId: memberstackId,
        legacyMemberid: null,
        memberstackId,
      }),
    );
    expect(detected.find((field) => field.label === "Watson ID")).toBeUndefined();
    expect(detected.find((field) => field.label === "Memberstack ID")?.value).toBe(memberstackId);
    expect(detected.every((field) => field.label !== "Watson ID" || !field.value.startsWith("mem_"))).toBe(
      true,
    );
  });

  it("does not label a value as a Stripe subscription unless it begins with sub_", () => {
    const guid = "315319A8-A2F8-0C09-339C-A81646E5DC42";
    expect(isStripeSubscriptionId(guid)).toBe(false);
    expect(isStripeSubscriptionId("sub_abc123")).toBe(true);
    expect(isStripeCustomerId("cus_Mmpdx2IylY9sEU")).toBe(true);
    expect(isStripeCustomerId(guid)).toBe(false);

    const detected = buildDetectedAccountData(
      profile({
        memberstack: {
          email: "sue@example.com",
          membershipStatusLabel: "Active",
          connections: [
            {
              planName: "Monthly Membership",
              planId: "pln_membership",
              activeLabel: "Active",
              billingInterval: "monthly",
              connectionId: guid,
            },
          ],
        },
      }),
    );

    expect(detected.find((field) => field.label === "Stripe subscription ID")).toBeUndefined();
    expect(detected.find((field) => field.label === "Memberstack connection ID")?.value).toBe(guid);

    const withStripeSub = buildDetectedAccountData(
      profile({
        memberstack: {
          email: "sue@example.com",
          membershipStatusLabel: "Active",
          connections: [
            {
              planName: "Monthly Membership",
              activeLabel: "Active",
              billingInterval: "monthly",
              connectionId: "sub_abc123",
            },
          ],
        },
      }),
    );
    expect(withStripeSub.find((field) => field.label === "Stripe subscription ID")?.value).toBe(
      "sub_abc123",
    );
  });

  it("keeps detected Watson data out of the copied report", () => {
    const detected = buildDetectedAccountData(profile(), {
      stripeCustomerId: "cus_legacy",
      savedPatternCount: 3,
    });
    expect(detected.find((field) => field.label === "Memberstack ID")?.value).toBe("mem_123");
    expect(detected.find((field) => field.label === "Legacy member ID")?.value).toBe("M1");
    expect(detected.find((field) => field.label === "Saved patterns")?.value).toBe("Present");
    expect(detected.find((field) => field.label === "Email")).toBeUndefined();

    const report = buildMemberAccountRepairReport(valuesFromCustomerProfile(profile()));
    expect(report).not.toContain("mem_123");
    expect(report).not.toContain("M1");
    expect(report).not.toContain("Saved patterns");
  });

  it("restores original prefilled name and email after a clear", () => {
    const original = valuesFromCustomerProfile(profile());
    const cleared = emptyMemberAccountRepairValues();
    expect(cleared.Email).toBe("");
    expect(cleared.Name).toBe("");

    const restored = buildMemberAccountRepairValuesFromPrefill({
      displayName: original.Name,
      email: original.Email,
      memberstackId: "mem_123",
    });
    expect(restored.Email).toBe("sue@example.com");
    expect(restored.Name).toBe("Sue Hall");
    expect(restored.Permission).toBe("");
  });

  it("passes customer ids on the repair form URL", () => {
    expect(
      buildMemberAccountRepairHref({
        legacyMemberid: "M1",
        memberstackId: "mem_123",
      }),
    ).toBe("/watson/member-account-repair?legacyMemberid=M1&memberstackId=mem_123");
  });

  it("does not include password, card, API key, or credential fields", () => {
    expect(memberAccountRepairFieldsAreSafe()).toBe(true);
    const names = memberAccountRepairFieldNames().join(" ").toLowerCase();
    expect(names).not.toContain("password");
    expect(names).not.toContain("card number");
    expect(names).not.toContain("api key");
    expect(names).not.toContain("credential");
  });
});
