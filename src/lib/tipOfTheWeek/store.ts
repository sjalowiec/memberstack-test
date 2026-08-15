/**
 * Tip of the Week Watson Postgres store.
 */
import { queryWatson } from "../watson/db";
import type { WatsonQueryFn } from "../watson/memberSearch";
import { buildTipOfTheWeekRecord } from "./map";
import { tipIsPubliclyFeatured, tipLosAngelesCalendarDate } from "./schedule";
import type { ValidatedTipInput } from "./validation";
import { validateTipOfTheWeekInput } from "./validation";
import type {
  TipOfTheWeekRecord,
  TipOfTheWeekRow,
  TipValidationResult,
} from "./types";

const TIP_SELECT = `
  id,
  tip_id,
  title,
  intro,
  intro_glossary_slug,
  video_content_id,
  available_from,
  available_through,
  status,
  availability_notice,
  availability_footer_template,
  try_copy,
  sue_tip_copy,
  learn_points_json,
  related_links_json,
  eyebrow,
  created_at,
  updated_at
`;

export const TIP_OF_THE_WEEK_ALL_SQL = `
  SELECT ${TIP_SELECT}
  FROM watson_tip_of_the_week
  ORDER BY available_from DESC, updated_at DESC, title ASC
`;

export const TIP_OF_THE_WEEK_BY_ID_SQL = `
  SELECT ${TIP_SELECT}
  FROM watson_tip_of_the_week
  WHERE id = $1
  LIMIT 1
`;

export const TIP_OF_THE_WEEK_BY_TIP_ID_SQL = `
  SELECT ${TIP_SELECT}
  FROM watson_tip_of_the_week
  WHERE tip_id = $1
  LIMIT 1
`;

function mapRows(rows: TipOfTheWeekRow[]): TipOfTheWeekRecord[] {
  const tips: TipOfTheWeekRecord[] = [];
  for (const row of rows) {
    const tip = buildTipOfTheWeekRecord(row);
    if (tip) tips.push(tip);
  }
  return tips;
}

export async function listAllTipOfTheWeek(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<TipOfTheWeekRecord[]> {
  const rows = await queryFn<TipOfTheWeekRow>(TIP_OF_THE_WEEK_ALL_SQL);
  return mapRows(rows);
}

export async function getTipOfTheWeekById(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<TipOfTheWeekRecord | null> {
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (!trimmed) return null;
  const rows = await queryFn<TipOfTheWeekRow>(TIP_OF_THE_WEEK_BY_ID_SQL, [trimmed]);
  return rows[0] ? buildTipOfTheWeekRecord(rows[0]) : null;
}

/**
 * Current public featured tip for America/Los_Angeles today.
 * Only scheduled/active tips inside their date window.
 */
export async function getPublicFeaturedTip(
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<TipOfTheWeekRecord | null> {
  const today = tipLosAngelesCalendarDate(now);
  const tips = await listAllTipOfTheWeek(queryFn);
  const featured = tips.filter((tip) => tipIsPubliclyFeatured(tip, today));
  featured.sort((a, b) => {
    if (a.availableFrom !== b.availableFrom) {
      return a.availableFrom < b.availableFrom ? 1 : -1;
    }
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
  return featured[0] ?? null;
}

async function insertTip(
  value: ValidatedTipInput,
  queryFn: WatsonQueryFn,
): Promise<TipValidationResult<TipOfTheWeekRecord>> {
  const rows = await queryFn<TipOfTheWeekRow>(
    `
      INSERT INTO watson_tip_of_the_week (
        tip_id,
        title,
        intro,
        intro_glossary_slug,
        video_content_id,
        available_from,
        available_through,
        status,
        availability_notice,
        availability_footer_template,
        try_copy,
        sue_tip_copy,
        learn_points_json,
        related_links_json,
        eyebrow,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
      )
      RETURNING ${TIP_SELECT}
    `,
    [
      value.tipId,
      value.title,
      value.intro,
      value.introGlossarySlug,
      value.videoContentId,
      value.availableFrom,
      value.availableThrough,
      value.status,
      value.availabilityNotice,
      value.availabilityFooterTemplate,
      value.tryCopy,
      value.sueTipCopy,
      JSON.stringify(value.learnPoints),
      JSON.stringify(value.relatedLinks),
      value.eyebrow,
    ],
  );
  const tip = rows[0] ? buildTipOfTheWeekRecord(rows[0]) : null;
  if (!tip) return { ok: false, error: "Unable to create tip." };
  return { ok: true, value: tip };
}

export async function createTipOfTheWeek(
  input: Record<string, unknown>,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<TipValidationResult<TipOfTheWeekRecord> & { warning?: string }> {
  const siblings = await listAllTipOfTheWeek(queryFn);
  const validated = validateTipOfTheWeekInput(input, { siblings });
  if (!validated.ok) return validated;
  try {
    const created = await insertTip(validated.value, queryFn);
    if (!created.ok) return created;
    return validated.warning
      ? { ok: true, value: created.value, warning: validated.warning }
      : created;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(message)) {
      return { ok: false, error: "That Tip ID is already in use." };
    }
    throw error;
  }
}

export async function updateTipOfTheWeek(
  id: string,
  input: Record<string, unknown>,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<TipValidationResult<TipOfTheWeekRecord> & { warning?: string }> {
  const existing = await getTipOfTheWeekById(id, queryFn);
  if (!existing) return { ok: false, error: "Tip not found." };

  const siblings = await listAllTipOfTheWeek(queryFn);
  const merged: Record<string, unknown> = {
    tipId: input.tipId ?? input.tip_id ?? existing.tipId,
    title: input.title ?? existing.title,
    intro: input.intro ?? existing.intro,
    introGlossarySlug:
      input.introGlossarySlug ??
      input.intro_glossary_slug ??
      input.glossaryTooltip ??
      existing.introGlossarySlug,
    videoContentId:
      input.videoContentId ?? input.video_content_id ?? existing.videoContentId,
    availableFrom:
      input.availableFrom ?? input.available_from ?? existing.availableFrom,
    availableThrough:
      input.availableThrough ??
      input.available_through ??
      existing.availableThrough,
    status: input.status ?? existing.status,
    availabilityNotice:
      input.availabilityNotice ??
      input.availability_notice ??
      existing.availabilityNotice,
    availabilityFooterTemplate:
      input.availabilityFooterTemplate ??
      input.availability_footer_template ??
      existing.availabilityFooterTemplate,
    tryCopy: input.tryCopy ?? input.try_copy ?? existing.tryCopy,
    sueTipCopy: input.sueTipCopy ?? input.sue_tip_copy ?? existing.sueTipCopy,
    learnPoints: input.learnPoints ?? input.learn_points ?? existing.learnPoints,
    relatedLinks:
      input.relatedLinks ?? input.related_links ?? existing.relatedLinks,
    eyebrow: input.eyebrow ?? existing.eyebrow,
  };

  const validated = validateTipOfTheWeekInput(merged, {
    siblings,
    existingId: id,
  });
  if (!validated.ok) return validated;

  try {
    const rows = await queryFn<TipOfTheWeekRow>(
      `
        UPDATE watson_tip_of_the_week SET
          tip_id = $2,
          title = $3,
          intro = $4,
          intro_glossary_slug = $5,
          video_content_id = $6,
          available_from = $7::date,
          available_through = $8::date,
          status = $9,
          availability_notice = $10,
          availability_footer_template = $11,
          try_copy = $12,
          sue_tip_copy = $13,
          learn_points_json = $14,
          related_links_json = $15,
          eyebrow = $16,
          updated_at = NOW()
        WHERE id = $1
        RETURNING ${TIP_SELECT}
      `,
      [
        id,
        validated.value.tipId,
        validated.value.title,
        validated.value.intro,
        validated.value.introGlossarySlug,
        validated.value.videoContentId,
        validated.value.availableFrom,
        validated.value.availableThrough,
        validated.value.status,
        validated.value.availabilityNotice,
        validated.value.availabilityFooterTemplate,
        validated.value.tryCopy,
        validated.value.sueTipCopy,
        JSON.stringify(validated.value.learnPoints),
        JSON.stringify(validated.value.relatedLinks),
        validated.value.eyebrow,
      ],
    );
    const tip = rows[0] ? buildTipOfTheWeekRecord(rows[0]) : null;
    if (!tip) return { ok: false, error: "Unable to update tip." };
    return validated.warning
      ? { ok: true, value: tip, warning: validated.warning }
      : { ok: true, value: tip };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(message)) {
      return { ok: false, error: "That Tip ID is already in use." };
    }
    throw error;
  }
}

/** Soft-archive only (no hard delete of historical tips). */
export async function archiveTipOfTheWeek(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<TipValidationResult<TipOfTheWeekRecord>> {
  return updateTipOfTheWeek(id, { status: "archived" }, queryFn);
}
