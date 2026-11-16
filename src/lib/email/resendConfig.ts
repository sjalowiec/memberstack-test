export const VERIFIED_CONTACT_FROM_EMAIL = "Knit It Now <sue@knititnow.com>";

const RESEND_TESTING_ADDRESS = "onboarding@resend.dev";

export const MISSING_CONTACT_FROM_MESSAGE =
  "CONTACT_FROM_EMAIL is missing. Notification was not sent. Set CONTACT_FROM_EMAIL to Knit It Now <sue@knititnow.com>.";

export const RESEND_TESTING_FROM_MESSAGE =
  "CONTACT_FROM_EMAIL is the Resend testing address onboarding@resend.dev. Notification was not sent.";

export type ResendConfig = {
  apiKey: string;
  fromAddress: string;
};

export type ContactFromResult =
  | { ok: true; fromAddress: string }
  | { ok: false; reason: string };

function readProcessEnv(name: string): string {
  if (typeof process !== "undefined" && process.env?.[name]) {
    return String(process.env[name]).trim();
  }
  return "";
}

/** Astro inlines only literal import.meta.env.* access at build time. */
function readAstroEnv(name: "RESEND_API_KEY" | "CONTACT_FROM_EMAIL"): string {
  if (typeof import.meta === "undefined" || !import.meta.env) return "";
  if (name === "RESEND_API_KEY") {
    return String(import.meta.env.RESEND_API_KEY ?? "").trim();
  }
  return String(import.meta.env.CONTACT_FROM_EMAIL ?? "").trim();
}

function readApiKey(): string {
  return readProcessEnv("RESEND_API_KEY") || readAstroEnv("RESEND_API_KEY");
}

/** Runtime process.env wins over the value Astro inlined at build time. */
export function readConfiguredContactFrom(): string {
  return readProcessEnv("CONTACT_FROM_EMAIL") || readAstroEnv("CONTACT_FROM_EMAIL");
}

export function isResendTestingSender(value: string): boolean {
  return value.toLowerCase().includes(RESEND_TESTING_ADDRESS);
}

/**
 * Accept an explicit verified sender. A missing value or the Resend testing
 * address is an error in every environment, including production.
 */
export function resolveContactFromAddress(configured?: string): ContactFromResult {
  const value = (configured === undefined ? readConfiguredContactFrom() : configured).trim();
  if (!value) {
    return { ok: false, reason: MISSING_CONTACT_FROM_MESSAGE };
  }
  if (isResendTestingSender(value)) {
    return { ok: false, reason: RESEND_TESTING_FROM_MESSAGE };
  }
  return { ok: true, fromAddress: value };
}

export function resendConfigError(): string | null {
  const from = resolveContactFromAddress();
  if (!from.ok) return from.reason;
  if (!readApiKey()) return "RESEND_API_KEY is missing. Notification was not sent.";
  return null;
}

export function readResendConfig(): ResendConfig | null {
  const from = resolveContactFromAddress();
  const apiKey = readApiKey();
  if (!from.ok || !apiKey) return null;
  return { apiKey, fromAddress: from.fromAddress };
}
