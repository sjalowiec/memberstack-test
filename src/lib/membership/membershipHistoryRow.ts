/**
 * Compact Membership History row builder.
 *
 * Renders one flat, scannable row per event: the formatted date first, the event
 * label second, and any secondary detail (e.g. the migration note) in smaller
 * text directly below. Intentionally no checkmark marker and no timeline
 * connector - this is a plain list, not a vertical timeline.
 *
 * The `Document` is injected so this stays a pure, environment-agnostic builder
 * that can be unit-tested without a browser DOM.
 */

import type { MembershipHistoryEvent } from "./membershipHistory";

export function buildMembershipHistoryRow(
  doc: Document,
  event: MembershipHistoryEvent,
): HTMLLIElement {
  const item = doc.createElement("li");
  item.className = "account-membership-panel__event";

  if (event.date) {
    const date = doc.createElement("span");
    date.className = "account-membership-panel__event-date";
    date.textContent = event.date;
    item.appendChild(date);
  }

  const label = doc.createElement("span");
  label.className = "account-membership-panel__event-label";
  label.textContent = event.title;
  item.appendChild(label);

  if (event.description) {
    const description = doc.createElement("p");
    description.className = "account-membership-panel__event-description";
    description.textContent = event.description;
    item.appendChild(description);
  }

  return item;
}
