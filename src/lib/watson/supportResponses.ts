export type SupportResponseId =
  | "dak-license-delivery"
  | "login-help-password-reset"
  | "login-help-temporary-password";

export interface SupportResponseTemplate {
  id: SupportResponseId;
  title: string;
  body: string;
  /** When true, customer-page copy should collect a temporary password first. */
  requiresTemporaryPassword?: boolean;
}

export const DAK_LICENSE_DELIVERY_RESPONSE = `Hello {Customer Name},

Thank you for your order for DesignaKnit 9 {Version}.

You can download your software here:

https://softbyte.co.uk/_dk9webinst/MiniSetup_D9_US.exe

If you have any questions about downloading or installing DesignaKnit, please contact Knitcraft Technical Support at knitcraft@knitcraft.com.

An official proof of ownership certificate will be mailed to you. This certificate also includes the download information. Please keep it in a safe place. You will need to complete the bottom portion and return it to Knitcraft Inc. to register your software. Unregistered licenses are not eligible for future upgrade pricing.

License Number:
{License Number}

I've added our course, DesignaKnit Demystified, to your library at Learn DesignaKnit:

https://learndesignaknit.com/courses/designaknit-quick-start/

Use your Knit It Now login to access the course.

DesignaKnit Demystified will give you a good overview of what DesignaKnit can do for your knitting.

I've also added a token for one free course of your choice. Look for the Use a Token button.

Please let me know if you have any questions.

Sue`;

export const LOGIN_HELP_PASSWORD_RESET_RESPONSE = `Hi {FirstName},

I'm sorry you're having trouble logging in.

Before I reset your password, please check the following:

 Make sure you're using the correct email address.
 Passwords on the new Knit It Now site are case-sensitive, so check that Caps Lock is off and that you're entering your password exactly as you created it.
 Click "Forgot Password" on the login page to request a password reset email.
 If you don't receive the email within a few minutes, please check your Spam, Junk, and Promotions folders.

If you're still unable to log in, simply reply to this email and I'll reset your password for you.

Thanks,
Sue`;

export const LOGIN_HELP_TEMPORARY_PASSWORD_RESPONSE = `Hi {FirstName},

I've reset your password to a temporary password.

Temporary password:
{TemporaryPassword}

Please log in using your email address and this temporary password.

Once you're logged in:

1. Go to Account.
2. Open Account Settings.
3. Change your password to one of your choosing.

If you have any problems logging in, just let me know and I'll be happy to help.

Thanks,
Sue`;

export const SUPPORT_RESPONSE_TEMPLATES: SupportResponseTemplate[] = [
  {
    id: "dak-license-delivery",
    title: "DAK License Delivery",
    body: DAK_LICENSE_DELIVERY_RESPONSE,
  },
  {
    id: "login-help-password-reset",
    title: "Login Help - Password Reset Email",
    body: LOGIN_HELP_PASSWORD_RESET_RESPONSE,
  },
  {
    id: "login-help-temporary-password",
    title: "Login Help - Temporary Password",
    body: LOGIN_HELP_TEMPORARY_PASSWORD_RESPONSE,
    requiresTemporaryPassword: true,
  },
];

export const CUSTOMER_SUPPORT_RESPONSE_IDS: SupportResponseId[] = [
  "login-help-password-reset",
  "login-help-temporary-password",
];

export function getSupportResponseTemplate(
  id: SupportResponseId,
): SupportResponseTemplate | undefined {
  return SUPPORT_RESPONSE_TEMPLATES.find((template) => template.id === id);
}

export function getCustomerSupportResponseTemplates(): SupportResponseTemplate[] {
  return CUSTOMER_SUPPORT_RESPONSE_IDS.map((id) => getSupportResponseTemplate(id)).filter(
    (template): template is SupportResponseTemplate => Boolean(template),
  );
}

/** Prefer an explicit first name; otherwise derive from display name; else null. */
export function customerFirstNameFromProfile(input: {
  legacyFirstName?: string | null;
  displayName?: string | null;
}): string | null {
  const legacy = String(input.legacyFirstName ?? "").trim();
  if (legacy) {
    return legacy;
  }

  const display = String(input.displayName ?? "").trim();
  if (!display || display.includes("@")) {
    return null;
  }

  const first = display.split(/\s+/)[0] ?? "";
  return first || null;
}

/** Greeting name for templates: use first name when available, otherwise "there". */
export function resolveSupportResponseGreetingName(
  firstName: string | null | undefined,
): string {
  const trimmed = String(firstName ?? "").trim();
  return trimmed || "there";
}

export function fillSupportResponse(
  body: string,
  values: {
    firstName?: string | null;
    temporaryPassword?: string | null;
  } = {},
): string {
  let result = body;

  if (Object.prototype.hasOwnProperty.call(values, "firstName")) {
    result = result.replaceAll(
      "{FirstName}",
      resolveSupportResponseGreetingName(values.firstName),
    );
  }

  if (Object.prototype.hasOwnProperty.call(values, "temporaryPassword")) {
    result = result.replaceAll(
      "{TemporaryPassword}",
      String(values.temporaryPassword ?? ""),
    );
  }

  return result;
}
