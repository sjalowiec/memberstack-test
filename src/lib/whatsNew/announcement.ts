import { losAngelesCalendarDate } from "./billboard";
import { isPublicWhatsNewCard } from "./public";
import {
  billboardMessageHasText,
  sanitizeCardDescriptionHtml,
} from "./sanitizeBillboardHtml";
import type { WhatsNewCard, WhatsNewPopupAudience } from "./types";

export const WHATS_NEW_ANNOUNCEMENT_NOTE =
  "You can find this announcement again under What’s New in the site menu.";

export const WHATS_NEW_ANNOUNCEMENT_READ_MORE = "Read more";

export const WHATS_NEW_ENTRY_ANCHOR_PREFIX = "whats-new-entry-";

export type WhatsNewAnnouncement = {
  id: string;
  title: string;
  introductionHtml: string;
  href: string;
  audience: WhatsNewPopupAudience;
};

export type WhatsNewAnnouncementChoice = {
  everyone: WhatsNewAnnouncement | null;
  members: WhatsNewAnnouncement | null;
};

export function whatsNewEntryAnchorId(id: string): string {
  return `${WHATS_NEW_ENTRY_ANCHOR_PREFIX}${id.trim()}`;
}

export function whatsNewEntryHref(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return "/whats-new";
  return `/whats-new#${whatsNewEntryAnchorId(trimmed)}`;
}

/** Published, popup-on, already released, and not past the optional expiration day. */
export function isWhatsNewAnnouncementEligible(
  card: WhatsNewCard,
  today: string = losAngelesCalendarDate(),
): boolean {
  if (!isPublicWhatsNewCard(card) || !card.popupEnabled) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  if (card.publishDate > today) return false;
  if (card.popupExpiresOn && card.popupExpiresOn < today) return false;
  if (!card.title.trim()) return false;
  const introduction = sanitizeCardDescriptionHtml(card.description);
  return billboardMessageHasText(introduction);
}

function newerFirst(a: WhatsNewCard, b: WhatsNewCard): number {
  if (a.publishDate !== b.publishDate) return a.publishDate < b.publishDate ? 1 : -1;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

export function toWhatsNewAnnouncement(card: WhatsNewCard): WhatsNewAnnouncement {
  return {
    id: card.id,
    title: card.title.trim(),
    introductionHtml: sanitizeCardDescriptionHtml(card.description),
    href: whatsNewEntryHref(card.id),
    audience: card.popupAudience,
  };
}

/**
 * One current announcement for each visitor kind.
 * Members see the single newest eligible popup. Everyone else sees the newest
 * popup aimed at everyone. Older popups are left off so nobody clicks through a backlog.
 */
export function selectWhatsNewAnnouncements(
  cards: readonly WhatsNewCard[],
  today: string = losAngelesCalendarDate(),
): WhatsNewAnnouncementChoice {
  const eligible = cards.filter((card) => isWhatsNewAnnouncementEligible(card, today));
  const newest = (list: WhatsNewCard[]) => (list.length ? [...list].sort(newerFirst)[0]! : null);
  const everyoneCard = newest(eligible.filter((card) => card.popupAudience === "everyone"));
  const membersCard = newest(eligible);
  return {
    everyone: everyoneCard ? toWhatsNewAnnouncement(everyoneCard) : null,
    members: membersCard ? toWhatsNewAnnouncement(membersCard) : null,
  };
}

export function announcementForVisitor(
  choice: WhatsNewAnnouncementChoice,
  signedIn: boolean,
): WhatsNewAnnouncement | null {
  return signedIn ? choice.members : choice.everyone;
}

/**
 * The one current announcement for this visitor, unless they have already seen it.
 * Signed-out visitors do not see a Signed-in announcement.
 * A seen announcement does not fall through to another one.
 * A different announcement id is not suppressed.
 */
export function announcementToShow(
  announcement: WhatsNewAnnouncement | null,
  signedIn: boolean,
  hasSeen: (id: string) => boolean,
): WhatsNewAnnouncement | null {
  if (!announcement) return null;
  if (announcement.audience === "members" && !signedIn) return null;
  if (hasSeen(announcement.id)) return null;
  return announcement;
}
