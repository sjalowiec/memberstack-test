/**
 * Build a mailto: URL for replying to a contact message from Watson.
 * Replies are sent from the user's email client (Gmail), not from Watson.
 */

export function buildContactReplyMailto(options: {
  email: string;
  name?: string;
  subject?: string;
  source?: string;
  createdAt?: string;
}): string {
  const email = String(options.email || "").trim();
  if (!email) return "";

  const submittedSubject = options.subject?.trim();
  const subjectParts = submittedSubject
    ? [`Re: ${submittedSubject}`]
    : ["Re: Knit It Now contact"];
  if (!submittedSubject && options.source?.trim()) {
    subjectParts.push(`(${options.source.trim()})`);
  }

  const greetingName = options.name?.trim();
  const bodyLines = [
    `Hi${greetingName ? ` ${greetingName}` : ""},`,
    "",
    "",
    "---",
    `Original message received${options.createdAt ? ` ${options.createdAt}` : ""}.`,
  ];

  const params = new URLSearchParams();
  params.set("subject", subjectParts.join(" "));
  params.set("body", bodyLines.join("\n"));
  return `mailto:${email}?${params.toString()}`;
}
