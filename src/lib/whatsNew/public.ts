import {
  WHATS_NEW_BOARD_COLUMNS,
  WHATS_NEW_BOARD_COLUMN_META,
  WHATS_NEW_CATEGORIES,
  WHATS_NEW_CATEGORY_LABELS,
  WHATS_NEW_DEFAULT_BUTTON_TEXT,
  WHATS_NEW_NEW_BADGE_DAYS,
  WHATS_NEW_STATUSES,
  type WhatsNewBoardColumn,
  type WhatsNewCard,
  type WhatsNewCardRow,
  type WhatsNewCategory,
  type WhatsNewStatus,
} from "./types";

export {
  buildBillboardSettings,
  getPublicBillboard,
  losAngelesCalendarDate,
} from "./billboard";

export function isWhatsNewCategory(value: string): value is WhatsNewCategory {
  return (WHATS_NEW_CATEGORIES as readonly string[]).includes(value);
}

export function isWhatsNewBoardColumn(value: string): value is WhatsNewBoardColumn {
  return (WHATS_NEW_BOARD_COLUMNS as readonly string[]).includes(value);
}

export function isWhatsNewStatus(value: string): value is WhatsNewStatus {
  return (WHATS_NEW_STATUSES as readonly string[]).includes(value);
}

export function toIsoDateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // DATE columns often arrive as YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

export function toIsoTimestamp(value: Date | string | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return Number.isNaN(value.getTime()) ? "" : value.toISOString();
}

export function defaultButtonTextForCategory(category: WhatsNewCategory): string {
  return WHATS_NEW_DEFAULT_BUTTON_TEXT[category];
}

export function resolveButtonText(
  category: WhatsNewCategory,
  buttonText: string | null | undefined,
): string | null {
  const trimmed = typeof buttonText === "string" ? buttonText.trim() : "";
  if (trimmed) return trimmed;
  return defaultButtonTextForCategory(category);
}

export function isWithinNewBadgeWindow(
  publishDate: string,
  now: Date = new Date(),
  windowDays: number = WHATS_NEW_NEW_BADGE_DAYS,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) return false;
  const published = new Date(`${publishDate}T00:00:00.000Z`);
  if (Number.isNaN(published.getTime())) return false;
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const pubUtc = Date.UTC(
    published.getUTCFullYear(),
    published.getUTCMonth(),
    published.getUTCDate(),
  );
  const diffDays = Math.floor((nowUtc - pubUtc) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= windowDays;
}

export function formatQuietPublishDate(publishDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) return publishDate;
  const date = new Date(`${publishDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return publishDate;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function buildWhatsNewCard(
  row: WhatsNewCardRow,
  now: Date = new Date(),
): WhatsNewCard | null {
  if (!isWhatsNewCategory(row.category)) return null;
  if (!isWhatsNewBoardColumn(row.board_column)) return null;
  if (!isWhatsNewStatus(row.status)) return null;

  const publishDate = toIsoDateOnly(row.publish_date);
  if (!publishDate) return null;

  const destinationUrl =
    typeof row.destination_url === "string" && row.destination_url.trim()
      ? row.destination_url.trim()
      : null;

  const buttonTextRaw =
    typeof row.button_text === "string" && row.button_text.trim()
      ? row.button_text.trim()
      : null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    categoryLabel: WHATS_NEW_CATEGORY_LABELS[row.category],
    destinationUrl,
    buttonText: destinationUrl
      ? resolveButtonText(row.category, buttonTextRaw)
      : null,
    boardColumn: row.board_column,
    publishDate,
    featured: Boolean(row.featured),
    status: row.status,
    displayOrder: Number(row.display_order) || 0,
    archived: Boolean(row.archived),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
    isNew: row.status === "published" && !row.archived && isWithinNewBadgeWindow(publishDate, now),
  };
}

/** Public visitors: published and not archived only. */
export function isPublicWhatsNewCard(card: WhatsNewCard): boolean {
  return card.status === "published" && !card.archived;
}

export function filterPublicWhatsNewCards(cards: WhatsNewCard[]): WhatsNewCard[] {
  return cards.filter(isPublicWhatsNewCard);
}

export function compareWhatsNewCards(a: WhatsNewCard, b: WhatsNewCard): number {
  if (a.displayOrder !== b.displayOrder) {
    return a.displayOrder - b.displayOrder;
  }
  if (a.publishDate !== b.publishDate) {
    return a.publishDate < b.publishDate ? 1 : -1;
  }
  return a.title.localeCompare(b.title);
}

export type WhatsNewBoardGroups = Record<WhatsNewBoardColumn, WhatsNewCard[]>;

export function groupWhatsNewCardsByColumn(cards: WhatsNewCard[]): WhatsNewBoardGroups {
  const groups: WhatsNewBoardGroups = {
    just_added: [],
    worth_exploring: [],
    in_the_pipeline: [],
  };

  for (const card of cards) {
    groups[card.boardColumn].push(card);
  }

  for (const column of WHATS_NEW_BOARD_COLUMNS) {
    groups[column].sort(compareWhatsNewCards);
  }

  return groups;
}

export function buildPublicWhatsNewBoard(cards: WhatsNewCard[]): WhatsNewBoardGroups {
  return groupWhatsNewCardsByColumn(filterPublicWhatsNewCards(cards));
}

export function boardColumnMeta(column: WhatsNewBoardColumn) {
  return WHATS_NEW_BOARD_COLUMN_META[column];
}
