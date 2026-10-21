/**
 * Reporting filter for the confirmed October 2026 pop-up scan.
 * Stored events stay in watson_whats_new_announcement_events.
 * Counts remain event counts, not people.
 */

/** Memberstack id recovered from that announcement's events in the scan window. */
export const WHATS_NEW_POPUP_SCAN_MEMBER_ID = "mem_cmvg0pz7j02co0sp16yqh4tqq";

/** Announcement whose events were inflated by that account. */
export const WHATS_NEW_POPUP_SCAN_ANNOUNCEMENT_ID = "72f46506-b5df-4ae9-bea1-f83782ccd54b";

/**
 * Markers present on the scan's probe paths.
 * Not a filter for unusual URLs in general.
 */
export const WHATS_NEW_SQL_PROBE_PATH_MARKERS = [
  "pg_sleep",
  "waitfor",
  "dbms_pipe",
  "xor(",
] as const;

/** Case-insensitive POSIX pattern shared with the count query. */
export function whatsNewSqlProbePathPattern(): string {
  return WHATS_NEW_SQL_PROBE_PATH_MARKERS.map((marker) =>
    marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|");
}

export function sourcePageHasSqlProbeMarker(sourcePage: string | null | undefined): boolean {
  if (typeof sourcePage !== "string" || !sourcePage) return false;
  return new RegExp(whatsNewSqlProbePathPattern(), "i").test(sourcePage);
}

export function isExcludedWhatsNewAnnouncementActivity(event: {
  memberId?: string | null;
  cardId: string;
  sourcePage?: string | null;
}): boolean {
  const scanAccountOnAnnouncement =
    event.memberId === WHATS_NEW_POPUP_SCAN_MEMBER_ID &&
    event.cardId === WHATS_NEW_POPUP_SCAN_ANNOUNCEMENT_ID;
  return scanAccountOnAnnouncement || sourcePageHasSqlProbeMarker(event.sourcePage);
}
