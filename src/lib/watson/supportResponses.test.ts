import { describe, expect, it } from "vitest";

import {
  CUSTOMER_SUPPORT_RESPONSE_IDS,
  LOGIN_HELP_PASSWORD_RESET_RESPONSE,
  LOGIN_HELP_TEMPORARY_PASSWORD_RESPONSE,
  SUPPORT_RESPONSE_TEMPLATES,
  customerFirstNameFromProfile,
  fillSupportResponse,
  getCustomerSupportResponseTemplates,
  resolveSupportResponseGreetingName,
} from "./supportResponses";

describe("supportResponses", () => {
  it("stores login help templates once with expected titles and placeholders", () => {
    const titles = SUPPORT_RESPONSE_TEMPLATES.map((template) => template.title);
    expect(titles).toContain("Login Help - Password Reset Email");
    expect(titles).toContain("Login Help - Temporary Password");
    expect(LOGIN_HELP_PASSWORD_RESET_RESPONSE).toContain("Hi {FirstName},");
    expect(LOGIN_HELP_PASSWORD_RESET_RESPONSE).toContain("Forgot Password");
    expect(LOGIN_HELP_TEMPORARY_PASSWORD_RESPONSE).toContain("{TemporaryPassword}");
    expect(LOGIN_HELP_TEMPORARY_PASSWORD_RESPONSE).toContain("Account Settings");
  });

  it("exposes the two login templates for customer pages", () => {
    const customerTemplates = getCustomerSupportResponseTemplates();
    expect(CUSTOMER_SUPPORT_RESPONSE_IDS).toEqual([
      "login-help-password-reset",
      "login-help-temporary-password",
    ]);
    expect(customerTemplates.map((template) => template.id)).toEqual(
      CUSTOMER_SUPPORT_RESPONSE_IDS,
    );
    expect(
      customerTemplates.find((template) => template.id === "login-help-temporary-password")
        ?.requiresTemporaryPassword,
    ).toBe(true);
  });

  it("resolves greeting name to first name or there", () => {
    expect(resolveSupportResponseGreetingName("Sue")).toBe("Sue");
    expect(resolveSupportResponseGreetingName("  Pat  ")).toBe("Pat");
    expect(resolveSupportResponseGreetingName(null)).toBe("there");
    expect(resolveSupportResponseGreetingName("")).toBe("there");
  });

  it("derives customer first name from legacy or display name", () => {
    expect(
      customerFirstNameFromProfile({
        legacyFirstName: "Sue",
        displayName: "Ignored Name",
      }),
    ).toBe("Sue");
    expect(
      customerFirstNameFromProfile({
        legacyFirstName: null,
        displayName: "Alex Rivera",
      }),
    ).toBe("Alex");
    expect(
      customerFirstNameFromProfile({
        legacyFirstName: null,
        displayName: "member@example.com",
      }),
    ).toBeNull();
    expect(
      customerFirstNameFromProfile({
        legacyFirstName: "  ",
        displayName: "",
      }),
    ).toBeNull();
  });

  it("fills FirstName and TemporaryPassword placeholders", () => {
    const passwordReset = fillSupportResponse(LOGIN_HELP_PASSWORD_RESET_RESPONSE, {
      firstName: "Sue",
    });
    expect(passwordReset).toContain("Hi Sue,");
    expect(passwordReset).not.toContain("{FirstName}");

    const withoutName = fillSupportResponse(LOGIN_HELP_PASSWORD_RESET_RESPONSE, {
      firstName: null,
    });
    expect(withoutName).toContain("Hi there,");

    const temporary = fillSupportResponse(LOGIN_HELP_TEMPORARY_PASSWORD_RESPONSE, {
      firstName: "Pat",
      temporaryPassword: "Temp-123!",
    });
    expect(temporary).toContain("Hi Pat,");
    expect(temporary).toContain("Temp-123!");
    expect(temporary).not.toContain("{TemporaryPassword}");
  });

  it("leaves TemporaryPassword placeholder when not provided", () => {
    const temporary = fillSupportResponse(LOGIN_HELP_TEMPORARY_PASSWORD_RESPONSE, {
      firstName: "Pat",
    });
    expect(temporary).toContain("{TemporaryPassword}");
  });

  it("can fill TemporaryPassword without touching FirstName", () => {
    const prepared = fillSupportResponse(LOGIN_HELP_TEMPORARY_PASSWORD_RESPONSE, {
      firstName: "Pat",
    });
    const withPassword = fillSupportResponse(prepared, {
      temporaryPassword: "Temp-99",
    });
    expect(withPassword).toContain("Hi Pat,");
    expect(withPassword).toContain("Temp-99");
    expect(withPassword).not.toContain("{FirstName}");
    expect(withPassword).not.toContain("{TemporaryPassword}");
  });
});
