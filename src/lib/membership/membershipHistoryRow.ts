/**
 * Compact Membership History row builder.
 *
 * Renders one flat, scannable two-column row per event:
 *   Column 1: a fixed-width MM/DD/YYYY date (in a <time> element).
 *   Column 2: the event label, with any secondary detail (e.g. the migration
 *             note) in smaller text directly below it - inside the same column,
 *             never as a full-width sibling.
 *
 * Intentionally no checkmark marker and no timeline connector - this is a plain
 * list, not a vertical timeline.
 *
 * The `Document` is injected so this stays a pure, environment-agnostic builder
 * that can be unit-tested without a browser DOM.
 */

import type { MembershipHistoryEvent } from "./membershipHistory";

/** Format a history event's date as MM/DD/YYYY (from its YYYY-MM-DD sort key). */
export function formatMembershipHistoryDate(event: MembershipHistoryEvent): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(event.dateSort ?? "");
  if (match) {
    const [, year, month, day] = match;
    return `${month}/${day}/${year}`;
  }
  return event.date ?? "";
}

export function buildMembershipHistoryRow(
  doc: Document,
  event: MembershipHistoryEvent,
): HTMLLIElement {
  const item = doc.createElement("li");
  item.className = "membership-history-row";

  const dateText = formatMembershipHistoryDate(event);
  if (dateText) {
    const time = doc.createElement("time");
    time.className = "membership-history-date";
    time.textContent = dateText;
    if (event.dateSort) time.setAttribute("datetime", event.dateSort);
    item.appendChild(time);
  }

  const content = doc.createElement("div");
  content.className = "membership-history-content";

  const label = doc.createElement("span");
  label.className = "membership-history-label";
  label.textContent = event.title;
  content.appendChild(label);

  if (event.description) {
    const description = doc.createElement("p");
    description.className = "membership-history-description";
    description.textContent = event.description;
    content.appendChild(description);
  }

  item.appendChild(content);
  return item;
}
