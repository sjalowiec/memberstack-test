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
