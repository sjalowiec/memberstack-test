const DEFAULT_CONTACT_FROM_EMAIL = "Knit It Now <hello@knititnow.com>";

export type ResendConfig = {
  apiKey: string;
  fromAddress: string;
};

function readEnv(name: string): string {
  const fromImportMeta =
    typeof import.meta !== "undefined" && import.meta.env
      ? String(import.meta.env[name as keyof ImportMetaEnv] ?? "")
      : "";
  if (fromImportMeta.trim()) return fromImportMeta.trim();

  if (typeof process !== "undefined" && process.env?.[name]) {
    return String(process.env[name]).trim();
  }

  return "";
}

export function readResendConfig(): ResendConfig | null {
  const apiKey = readEnv("RESEND_API_KEY");
  const configuredFrom = readEnv("CONTACT_FROM_EMAIL");
  const fromAddress = configuredFrom || DEFAULT_CONTACT_FROM_EMAIL;

  if (!apiKey || !fromAddress) return null;
  return { apiKey, fromAddress };
}
