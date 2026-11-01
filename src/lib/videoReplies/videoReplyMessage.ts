export function extractFirstName(memberName: string): string {
  const trimmed = String(memberName || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function buildVideoReplyPublicUrl(origin: string, publicToken: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/video-reply/${encodeURIComponent(publicToken)}`;
}

export function buildDefaultVideoReplyEmailMessage(input: {
  memberName: string;
  publicViewingUrl: string;
}): string {
  const firstName = extractFirstName(input.memberName) || "there";
  return [
    `Hi ${firstName},`,
    "",
    "I made this short video for you:",
    "",
    input.publicViewingUrl,
    "",
    "I hope this helps!",
    "",
    "Sue",
    "Knit It Now",
  ].join("\n");
}

export const MEMBERSHIP_THANK_YOU_HEADING = "A personal thank-you from Sue";
export const MEMBERSHIP_THANK_YOU_EMAIL_SUBJECT = "A personal thank-you from Sue";

const UNNAMED_MEMBER = "name not on file";

/** First name for a membership thank-you. The placeholder name is not used as a greeting. */
export function membershipThankYouFirstName(memberName: string): string {
  const trimmed = String(memberName || "").trim();
  if (!trimmed || trimmed.toLowerCase() === UNNAMED_MEMBER) return "there";
  return extractFirstName(trimmed) || "there";
}

export function buildMembershipThankYouGreeting(firstName: string): string {
  const name = String(firstName || "").trim() || "there";
  return `Hi ${name}! I recorded this little message just for you. Thank you for being part of Knit It Now.`;
}

export function buildMembershipThankYouEmailMessage(input: {
  memberName: string;
  publicViewingUrl: string;
}): string {
  const firstName = membershipThankYouFirstName(input.memberName);
  return [
    `Hi ${firstName},`,
    "",
    "Thank you for being a Knit It Now member! I recorded a little video just for you.",
    "",
    "Watch your personal video:",
    input.publicViewingUrl,
    "",
    "I’m so glad you’re part of our machine knitting community. If you have a question or need help finding something, just reply to this email. I’m happy to help.",
    "",
    "Happy knitting!",
    "Sue",
  ].join("\n");
}
