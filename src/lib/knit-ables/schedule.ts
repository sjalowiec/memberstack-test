/**
 * Knit-able publication schedule.
 * A publish date is the America/Los_Angeles calendar day the page becomes public
 * at 12:00 a.m. Pacific. No date stays unpublished.
 */
import { KNIT_ABLES_CARDS, type KnitAbleLandingCard } from "./knitAblesLanding";

export const KNIT_ABLE_TIME_ZONE = "America/Los_Angeles";

export const KNIT_ABLE_PUBLIC_HOUR_LABEL = "12:00 a.m. Pacific";

/**
 * First-run dates for Knit-ables that already exist in code.
 * Sock pages keep the public status they already have. The Branch Out Tank
 * (cap-sleeve-tank) waits until October 1, 2026. Coco Loco Tank, Vest in
 * Show, and Rhythmic Colour Top have no seed date, so they stay unpublished
 * until Watson saves one.
 * Inserts use ON CONFLICT DO NOTHING so a later Watson edit is not overwritten.
 */
export const KNIT_ABLE_INITIAL_PUBLISH_DATES: Readonly<Record<string, string>> = {
  "teenage-kicks-socks": "2026-09-14",
  "worsted-color-block-socks": "2026-09-21",
  "cap-sleeve-tank": "2026-10-01",
};

export type KnitAblePublicationStatus = "unpublished" | "scheduled" | "published";

export type KnitAbleAdminRow = {
  slug: string;
  title: string;
  path: string;
  publishDate: string | null;
  status: KnitAblePublicationStatus;
  statusLabel: "Unpublished" | "Scheduled" | "Published";
};

const SLUG_IN_PATH = /^\/knit-ables\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function knitAbleSlugFromPath(path: string): string | null {
  const match = path.match(SLUG_IN_PATH);
  return match?.[1] ?? null;
}

export function knitAbleCatalogSlug(card: KnitAbleLandingCard): string | null {
  return knitAbleSlugFromPath(card.href);
}

export function isKnownKnitAbleSlug(slug: string): boolean {
  return KNIT_ABLES_CARDS.some((card) => knitAbleCatalogSlug(card) === slug);
}

export function knitAbleLosAngelesCalendarDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KNIT_ABLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function knitAblePublicationStatus(
  publishDate: string | null | undefined,
  now: Date = new Date(),
): KnitAblePublicationStatus {
  if (!publishDate) return "unpublished";
  const today = knitAbleLosAngelesCalendarDate(now);
  if (publishDate > today) return "scheduled";
  return "published";
}

export function knitAbleStatusLabel(
  status: KnitAblePublicationStatus,
): "Unpublished" | "Scheduled" | "Published" {
  if (status === "scheduled") return "Scheduled";
  if (status === "published") return "Published";
  return "Unpublished";
}

export function formatKnitAblePublishDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function knitAbleSaveMessage(
  title: string,
  status: KnitAblePublicationStatus,
  publishDate: string | null,
): string {
  if (status === "unpublished" || !publishDate) {
    return `Saved. ${title} is unpublished. It stays off the public site until you set a publish date.`;
  }
  const when = formatKnitAblePublishDate(publishDate);
  if (status === "scheduled") {
    return `Saved. ${title} is scheduled. It becomes public at ${KNIT_ABLE_PUBLIC_HOUR_LABEL} on ${when}.`;
  }
  return `Saved. ${title} is published. It has been public since ${KNIT_ABLE_PUBLIC_HOUR_LABEL} on ${when}.`;
}

export function parseKnitAblePublishDate(
  value: unknown,
): { ok: true; publishDate: string | null } | { ok: false; error: string } {
  if (value == null) return { ok: true, publishDate: null };
  if (typeof value !== "string") {
    return {
      ok: false,
      error: "Enter a publish date as YYYY-MM-DD, or leave it blank to unpublish.",
    };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, publishDate: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return {
      ok: false,
      error: "Enter a publish date as YYYY-MM-DD, or leave it blank to unpublish.",
    };
  }
  const [year, month, day] = trimmed.split("-").map(Number);
  if (year < 2000 || year > 2100) {
    return { ok: false, error: "Enter a publish date between 2000 and 2100." };
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return { ok: false, error: "That is not a real calendar date." };
  }
  return { ok: true, publishDate: trimmed };
}

/** Local calendar parts for a node-pg DATE, or the leading YYYY-MM-DD of a string. */
export function knitAblePublishDateFromDb(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}

export function selectPublishedKnitAbleCards(
  publishDates: Readonly<Record<string, string | null | undefined>>,
  now: Date = new Date(),
): KnitAbleLandingCard[] {
  return KNIT_ABLES_CARDS.filter((card) => {
    const slug = knitAbleCatalogSlug(card);
    if (!slug) return false;
    const publishDate = Object.prototype.hasOwnProperty.call(publishDates, slug)
      ? publishDates[slug] ?? null
      : null;
    return knitAblePublicationStatus(publishDate, now) === "published";
  });
}

export function buildKnitAbleAdminRows(
  publishDates: Readonly<Record<string, string | null | undefined>>,
  now: Date = new Date(),
): KnitAbleAdminRow[] {
  const rows: KnitAbleAdminRow[] = [];
  for (const card of KNIT_ABLES_CARDS) {
    const slug = knitAbleCatalogSlug(card);
    if (!slug) continue;
    const publishDate = Object.prototype.hasOwnProperty.call(publishDates, slug)
      ? publishDates[slug] ?? null
      : null;
    const status = knitAblePublicationStatus(publishDate, now);
    rows.push({
      slug,
      title: card.title,
      path: card.href,
      publishDate,
      status,
      statusLabel: knitAbleStatusLabel(status),
    });
  }
  return rows;
}

export function knitAbleScheduleSeedValues(): { slug: string; publishDate: string }[] {
  const values: { slug: string; publishDate: string }[] = [];
  for (const card of KNIT_ABLES_CARDS) {
    const slug = knitAbleCatalogSlug(card);
    if (!slug) continue;
    const publishDate = KNIT_ABLE_INITIAL_PUBLISH_DATES[slug];
    if (!publishDate) continue;
    values.push({ slug, publishDate });
  }
  return values;
}

export function knitAbleScheduleSeedSql(): string {
  const tuples = knitAbleScheduleSeedValues().map(({ slug, publishDate }) => {
    if (!/^[a-z0-9-]+$/.test(slug) || !/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
      throw new Error("Invalid Knit-able schedule seed.");
    }
    return `('${slug}', DATE '${publishDate}')`;
  });
  return `INSERT INTO watson_knit_able_schedules (slug, publish_date)
VALUES
  ${tuples.join(",\n  ")}
ON CONFLICT (slug) DO NOTHING`;
}

export function knitAblePreviewPath(path: string): string {
  return `${path}?preview=1`;
}
