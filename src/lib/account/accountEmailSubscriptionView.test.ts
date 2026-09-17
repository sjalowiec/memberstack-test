import { describe, expect, it } from "vitest";
import {
  ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL,
  ACCOUNT_EMAIL_SUBSCRIPTION_CONSENT,
  ACCOUNT_EMAIL_SUBSCRIPTION_HEADING,
  ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES,
} from "./accountEmailSubscriptionShared";
import { resolveAccountEmailSubscriptionView } from "./accountEmailSubscriptionView";

describe("resolveAccountEmailSubscriptionView", () => {
  it("shows receiving copy for an active subscriber without a button", () => {
    const view = resolveAccountEmailSubscriptionView({ state: "active" });
    expect(view.heading).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_HEADING);
    expect(view.statusMessage).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.receiving);
    expect(view.showButton).toBe(false);
    expect(view.consentText).toBeNull();
    expect(view.statusMessage).not.toMatch(/unsubscribe/i);
  });

  it("shows not-receiving copy and the consent button when unsubscribed", () => {
    const view = resolveAccountEmailSubscriptionView({ state: "unsubscribed" });
    expect(view.statusMessage).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.notReceiving);
    expect(view.showButton).toBe(true);
    expect(view.buttonLabel).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL);
    expect(view.consentText).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_CONSENT);
  });

  it("uses the same not-receiving copy for a contact that is not on the list", () => {
    const view = resolveAccountEmailSubscriptionView({ state: "not_found" });
    expect(view.statusMessage).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.notReceiving);
    expect(view.showButton).toBe(true);
    expect(view.statusMessage).not.toMatch(/unsubscribed/i);
  });

  it("does not describe an unconfirmed contact as a voluntary unsubscribe", () => {
    const view = resolveAccountEmailSubscriptionView({ state: "unconfirmed" });
    expect(view.statusMessage).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.notReceiving);
    expect(view.extraMessage).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unconfirmed);
    expect(view.extraMessage).not.toMatch(/unsubscribed/i);
    expect(view.showButton).toBe(true);
  });

  it("does not offer resubscribe for a bounced contact", () => {
    const view = resolveAccountEmailSubscriptionView({ state: "bounced" });
    expect(view.statusMessage).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.notReceiving);
    expect(view.extraMessage).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.bounced);
    expect(view.showButton).toBe(false);
    expect(view.consentText).toBeNull();
  });

  it("shows the post-click subscribed confirmation", () => {
    const view = resolveAccountEmailSubscriptionView({
      state: "unsubscribed",
      justSubscribed: true,
    });
    expect(view.statusMessage).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.nowSubscribed);
    expect(view.showButton).toBe(false);
  });

  it("hides the button when status cannot be checked", () => {
    const view = resolveAccountEmailSubscriptionView({ state: "unavailable" });
    expect(view.statusMessage).toBe(ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unavailable);
    expect(view.showButton).toBe(false);
  });
});
