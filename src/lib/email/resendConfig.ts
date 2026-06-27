const DEFAULT_CONTACT_FROM_EMAIL = "Knit It Now <hello@knititnow.com>";

export type ResendConfig = {
  apiKey: string;
  fromAddress: string;
};

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

export function readResendConfig(): ResendConfig | null {
  const apiKey = readAstroEnv("RESEND_API_KEY") || readProcessEnv("RESEND_API_KEY");
  const configuredFrom =
    readAstroEnv("CONTACT_FROM_EMAIL") || readProcessEnv("CONTACT_FROM_EMAIL");
  const fromAddress = configuredFrom || DEFAULT_CONTACT_FROM_EMAIL;

  if (!apiKey || !fromAddress) return null;
  return { apiKey, fromAddress };
}
