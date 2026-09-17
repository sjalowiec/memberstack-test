import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const panelSource = readFileSync(
  join(dir, "../../components/dashboard/AccountSettingsPanel.astro"),
  "utf8",
);
const pageSource = readFileSync(join(dir, "../../pages/account.astro"), "utf8");
const clientSource = readFileSync(
  join(dir, "../account/accountEmailSubscriptionClient.ts"),
  "utf8",
);
const scriptSource = readFileSync(
  join(dir, "../../scripts/account-email-subscription.ts"),
  "utf8",
);
const handlerSource = readFileSync(
  join(dir, "../account/accountEmailSubscription.ts"),
  "utf8",
);
const functionSource = readFileSync(
  join(dir, "../../../netlify/functions/account-email-subscription.ts"),
  "utf8",
);
const signupWebhookSource = readFileSync(
  join(dir, "../../../netlify/functions/memberstack-created.ts"),
  "utf8",
);
const membershipStatusSource = readFileSync(
  join(dir, "../../../netlify/functions/membership-status.ts"),
  "utf8",
);

describe("Account page email updates markup and wiring", () => {
  it("shows Email updates copy, consent, and the resubscribe button", () => {
    expect(panelSource).toContain("Email updates");
    expect(panelSource).toContain("Start Receiving Emails");
    expect(panelSource).toContain("By clicking this button, you’re asking Knit It Now");
    expect(panelSource).toContain("data-kbm-account-email-updates");
    expect(pageSource).toContain("account-email-subscription.ts");
  });

  it("uses a decorative dark-green check SVG only for subscribed markup", () => {
    expect(panelSource).toContain('data-kbm-account-email-updates-check');
    expect(panelSource).toContain('aria-hidden="true"');
    expect(panelSource).toContain('M5 13l4 4L19 7');
    expect(panelSource).toContain("color: #52682d");
    expect(panelSource).toContain("width: 1em");
    expect(panelSource).toContain("height: 1em");
    expect(panelSource).not.toMatch(/👍|😊|✓|✔/);
    expect(scriptSource).toContain("els.checkEl.hidden = !view.showCheckmark");
  });

  it("does not expose ActiveCampaign credentials or let the browser choose an email", () => {
    expect(clientSource).not.toMatch(/ACTIVECAMPAIGN/);
    expect(clientSource).not.toMatch(/Api-Token/);
    expect(clientSource).not.toMatch(/activehosted\.com|api-us1\.com/);
    expect(scriptSource).not.toMatch(/ACTIVECAMPAIGN/);
    expect(clientSource).toContain('body: JSON.stringify({})');
    expect(scriptSource).toContain("els.buttonEl.disabled");
    expect(scriptSource).toContain("aria-busy");
    expect(handlerSource).toContain("getActiveCampaignKinListId");
    expect(functionSource).toContain("auth.member.email");
    expect(functionSource).toContain("Intentionally ignore any client-supplied email");
  });
});

describe("prevention of automatic resubscription", () => {
  it("does not subscribe contacts when a Memberstack account is created", () => {
    expect(signupWebhookSource).not.toContain("contactLists");
    expect(signupWebhookSource).not.toContain("subscribeToList");
    expect(signupWebhookSource).not.toContain("account-email-subscription");
  });

  it("does not subscribe from membership status checks", () => {
    expect(membershipStatusSource).not.toContain("subscribeToList");
    expect(membershipStatusSource).not.toContain("account-email-subscription");
    expect(membershipStatusSource).not.toContain("createActiveCampaignClient");
  });

  it("status checks never call subscribeToList in the account handler", () => {
    const checkFn = handlerSource.slice(
      handlerSource.indexOf("export async function checkAccountEmailSubscription"),
      handlerSource.indexOf("export async function resubscribeAccountEmailSubscription"),
    );
    expect(checkFn).toContain("findContactByEmail");
    expect(checkFn).toContain("getListStatus");
    expect(checkFn).not.toContain("subscribeToList");
    expect(checkFn).not.toContain("syncContact");
  });
});
