/** Display helpers for Watson Video Replies (status text + date formatting). */

export function formatVideoReplyDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function formatVideoReplyDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(ms));
}

export function sentStatusLabel(sentAt: string | null | undefined): string {
  if (!sentAt) return "Not sent";
  const formatted = formatVideoReplyDate(sentAt);
  return formatted ? `Sent ${formatted}` : "Not sent";
}

export function openedStatusLabel(
  firstOpenedAt: string | null | undefined,
  lastOpenedAt?: string | null,
): string {
  const stamp = lastOpenedAt || firstOpenedAt;
  if (!stamp) return "Not opened";
  const formatted = formatVideoReplyDate(stamp);
  return formatted ? `Opened ${formatted}` : "Not opened";
}

export function linkStatusLabel(status: string, disabledAt?: string | null): string {
  if (status === "disabled" || disabledAt) return "Link disabled";
  return "Active";
}

/** Empty string sorts as missing for date columns (sortableTable ? NEGATIVE_INFINITY). */
export function dateSortValue(iso: string | null | undefined): string {
  return iso && Number.isFinite(Date.parse(iso)) ? iso : "";
}
