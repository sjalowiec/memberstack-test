/** Same mailbox as the contact form and course-ready notices. */
export const ESTABLISHED_STAFF_NOTIFICATION_RECIPIENT = "sue@knititnow.com";

function readProcessEnv(name: string): string {
  if (typeof process !== "undefined" && process.env?.[name]) {
    return String(process.env[name]).trim();
  }
  return "";
}

function readOverride(): string {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const value = String(import.meta.env.STAFF_NOTIFICATION_EMAIL ?? "").trim();
    if (value) return value;
  }
  return readProcessEnv("STAFF_NOTIFICATION_EMAIL");
}

/**
 * Staff mail goes to the contact-form recipient unless STAFF_NOTIFICATION_EMAIL
 * is set. An empty result means delivery must stay off.
 */
export function readStaffNotificationRecipient(): string | null {
  const override = readOverride();
  if (override) return override;
  return ESTABLISHED_STAFF_NOTIFICATION_RECIPIENT || null;
}
