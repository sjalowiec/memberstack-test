/**
 * Watson Postgres store for Knit-able publish dates.
 * Content stays in code. This table only stores when each existing Knit-able is public.
 */
import type { WatsonQueryFn } from "../watson/memberSearch";
import { queryWatson, getWatsonPool } from "../watson/db";
import {
  applySchemaStatements,
  getWatsonKnitAbleScheduleSchemaStatements,
} from "../watson/schema";
import {
  buildKnitAbleAdminRows,
  isKnownKnitAbleSlug,
  knitAblePreviewPath,
  knitAblePublicationStatus,
  knitAblePublishDateFromDb,
  knitAbleSaveMessage,
  knitAbleScheduleSeedSql,
  knitAbleSlugFromPath,
  parseKnitAblePublishDate,
  selectPublishedKnitAbleCards,
  type KnitAbleAdminRow,
} from "./schedule";
import type { KnitAbleLandingCard } from "./knitAblesLanding";

export const KNIT_ABLE_SCHEDULES_SQL = `
  SELECT slug, to_char(publish_date, 'YYYY-MM-DD') AS publish_date
  FROM watson_knit_able_schedules
`;

export const KNIT_ABLE_SCHEDULE_UPSERT_SQL = `
  INSERT INTO watson_knit_able_schedules (slug, publish_date, updated_at)
  VALUES ($1, $2::date, NOW())
  ON CONFLICT (slug) DO UPDATE
  SET publish_date = EXCLUDED.publish_date,
      updated_at = NOW()
  RETURNING slug, to_char(publish_date, 'YYYY-MM-DD') AS publish_date
`;

type ScheduleQueryRow = {
  slug?: unknown;
  publish_date?: unknown;
};

let schemaEnsured = false;

export function resetKnitAbleScheduleSchemaGuard(): void {
  schemaEnsured = false;
}

export async function ensureKnitAbleScheduleTable(): Promise<void> {
  if (schemaEnsured) return;
  const pool = await getWatsonPool();
  await applySchemaStatements(pool, getWatsonKnitAbleScheduleSchemaStatements());
  await pool.query(knitAbleScheduleSeedSql());
  schemaEnsured = true;
}

function datesFromRows(rows: ScheduleQueryRow[]): Record<string, string | null> {
  const dates: Record<string, string | null> = {};
  for (const row of rows) {
    if (typeof row.slug !== "string" || !row.slug.trim()) continue;
    dates[row.slug] = knitAblePublishDateFromDb(row.publish_date);
  }
  return dates;
}

export async function loadKnitAblePublishDates(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<Record<string, string | null>> {
  if (queryFn === queryWatson) {
    await ensureKnitAbleScheduleTable();
  }
  const rows = await queryFn<ScheduleQueryRow>(KNIT_ABLE_SCHEDULES_SQL);
  return datesFromRows(rows);
}

export async function listKnitAbleAdminRows(
  now: Date = new Date(),
  queryFn: WatsonQueryFn = queryWatson,
): Promise<KnitAbleAdminRow[]> {
  const dates = await loadKnitAblePublishDates(queryFn);
  return buildKnitAbleAdminRows(dates, now);
}

export async function listPublicKnitAbleCards(
  now: Date = new Date(),
  queryFn: WatsonQueryFn = queryWatson,
): Promise<KnitAbleLandingCard[]> {
  const dates = await loadKnitAblePublishDates(queryFn);
  return selectPublishedKnitAbleCards(dates, now);
}

export async function isKnitAblePathPublic(
  path: string,
  now: Date = new Date(),
  queryFn: WatsonQueryFn = queryWatson,
): Promise<boolean> {
  const slug = knitAbleSlugFromPath(path);
  if (!slug || !isKnownKnitAbleSlug(slug)) return false;
  const dates = await loadKnitAblePublishDates(queryFn);
  const publishDate = Object.prototype.hasOwnProperty.call(dates, slug) ? dates[slug] : null;
  return knitAblePublicationStatus(publishDate, now) === "published";
}

export async function updateKnitAblePublishDate(
  slug: string,
  rawPublishDate: unknown,
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<{ ok: true; value: KnitAbleAdminRow & { message: string; previewPath: string } } | { ok: false; error: string }> {
  const trimmedSlug = typeof slug === "string" ? slug.trim() : "";
  if (!trimmedSlug || !isKnownKnitAbleSlug(trimmedSlug)) {
    return { ok: false, error: "Unknown Knit-able." };
  }
  const parsed = parseKnitAblePublishDate(rawPublishDate);
  if (!parsed.ok) return parsed;

  if (queryFn === queryWatson) {
    await ensureKnitAbleScheduleTable();
  }

  const rows = await queryFn<ScheduleQueryRow>(KNIT_ABLE_SCHEDULE_UPSERT_SQL, [
    trimmedSlug,
    parsed.publishDate,
  ]);
  const saved = rows[0];
  if (!saved || saved.slug !== trimmedSlug) {
    return { ok: false, error: "Could not save the publish date." };
  }
  const publishDate = knitAblePublishDateFromDb(saved.publish_date);
  const [row] = buildKnitAbleAdminRows({ [trimmedSlug]: publishDate }, now).filter(
    (item) => item.slug === trimmedSlug,
  );
  if (!row) return { ok: false, error: "Could not save the publish date." };
  return {
    ok: true,
    value: {
      ...row,
      previewPath: knitAblePreviewPath(row.path),
      message: knitAbleSaveMessage(row.title, row.status, row.publishDate),
    },
  };
}
