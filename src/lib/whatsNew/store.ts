import { randomUUID } from "node:crypto";

import { getWatsonPool, queryWatson } from "../watson/db";
import {
  applySchemaStatements,
  getWatsonNativeSchemaStatements,
} from "../watson/schema";
import type { WatsonQueryFn } from "../watson/memberSearch";
import { normalizeVimeoUrl } from "../videoReplies/vimeoUrl";
import type { WhatsNewAnnouncement } from "./announcement";
import {
  buildPopupAnnouncement,
  isPopupAnnouncementActive,
  POPUP_ANNOUNCEMENT_KEY,
  shouldMintAnnouncementId,
  validatePopupAnnouncementInput,
  type WhatsNewPopupAnnouncement,
  type WhatsNewPopupAnnouncementRow,
} from "./popupAnnouncement";
import type { WhatsNewAnnouncementActivityEvent } from "./announcementActivity";
import {
  WHATS_NEW_POPUP_SCAN_ANNOUNCEMENT_ID,
  WHATS_NEW_POPUP_SCAN_MEMBER_ID,
  whatsNewSqlProbePathPattern,
} from "./announcementActivityReport";
import {
  buildBillboardSettings,
  getPublicBillboard,
} from "./billboard";
import {
  buildWhatsNewCard,
  filterPublicWhatsNewCards,
  groupWhatsNewCardsByColumn,
  type WhatsNewBoardGroups,
} from "./public";
import {
  WHATS_NEW_FEATURED_VIDEO_SETTINGS_KEY,
  type WhatsNewBillboardSettings,
  type WhatsNewBillboardSettingsRow,
  type WhatsNewCard,
  type WhatsNewCardRow,
  type WhatsNewValidationResult,
} from "./types";
import {
  validateBillboardInput,
  validateWhatsNewCardInput,
  type ValidatedBillboardInput,
  type ValidatedWhatsNewCardInput,
} from "./validation";

const CARD_SELECT = `
  id,
  title,
  description,
  category,
  destination_url,
  button_text,
  board_column,
  publish_date,
  featured,
  status,
  display_order,
  archived,
  popup_enabled,
  popup_audience,
  popup_expires_on,
  created_at,
  updated_at
`;

export const WHATS_NEW_CARDS_ALL_SQL = `
  SELECT ${CARD_SELECT}
  FROM watson_whats_new_cards
  ORDER BY archived ASC, board_column ASC, display_order ASC, publish_date DESC, title ASC
`;

export const WHATS_NEW_CARDS_PUBLIC_SQL = `
  SELECT ${CARD_SELECT}
  FROM watson_whats_new_cards
  WHERE status = 'published' AND archived = FALSE
  ORDER BY board_column ASC, display_order ASC, publish_date DESC, title ASC
`;

export const WHATS_NEW_CARD_BY_ID_SQL = `
  SELECT ${CARD_SELECT}
  FROM watson_whats_new_cards
  WHERE id = $1
  LIMIT 1
`;

export const WHATS_NEW_SETTINGS_SQL = `
  SELECT
    key,
    headline,
    introduction,
    original_video_url,
    safe_vimeo_embed_url,
    publish_date,
    button_text,
    button_destination_url,
    start_date,
    end_date,
    enabled,
    updated_at
  FROM watson_whats_new_settings
  WHERE key = $1
  LIMIT 1
`;

const ANNOUNCEMENT_SCHEMA_LABELS = [
  "alter watson_whats_new_cards announcement columns",
  "constraint watson_whats_new_cards popup audience",
  "table watson_whats_new_announcement_events",
  "index idx_watson_whats_new_announcement_events_card",
  "table watson_whats_new_popup_announcement",
];

let announcementSchemaReady: Promise<void> | null = null;

/**
 * Adds popup columns on the database this site is using.
 * Kin-dev's live database URL is a secret, so the first What's New request applies
 * the same statements as scripts/sql/watson-whats-new-announcements.sql.
 */
export function ensureWhatsNewAnnouncementSchema(): Promise<void> {
  if (!announcementSchemaReady) {
    announcementSchemaReady = ensureWhatsNewAnnouncementSchemaOnce().catch((error) => {
      announcementSchemaReady = null;
      throw error;
    });
  }
  return announcementSchemaReady;
}

async function ensureWhatsNewAnnouncementSchemaOnce(): Promise<void> {
  try {
    await queryWatson("SELECT popup_enabled, popup_audience, popup_expires_on FROM watson_whats_new_cards LIMIT 1");
    await queryWatson("SELECT id FROM watson_whats_new_announcement_events LIMIT 1");
    await queryWatson("SELECT announcement_id FROM watson_whats_new_popup_announcement LIMIT 1");
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/popup_|watson_whats_new_announcement_events|watson_whats_new_popup_announcement/i.test(message)) {
      throw error;
    }
  }

  const statements = getWatsonNativeSchemaStatements().filter((statement) =>
    ANNOUNCEMENT_SCHEMA_LABELS.includes(statement.label),
  );
  const pool = await getWatsonPool();
  await applySchemaStatements(pool, statements);
}

function mapRows(rows: WhatsNewCardRow[], now: Date = new Date()): WhatsNewCard[] {
  const cards: WhatsNewCard[] = [];
  for (const row of rows) {
    const card = buildWhatsNewCard(row, now);
    if (card) cards.push(card);
  }
  return cards;
}

export async function listAllWhatsNewCards(
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewCard[]> {
  const rows = await queryFn<WhatsNewCardRow>(WHATS_NEW_CARDS_ALL_SQL);
  return mapRows(rows, now);
}

export async function listPublicWhatsNewCards(
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewCard[]> {
  const rows = await queryFn<WhatsNewCardRow>(WHATS_NEW_CARDS_PUBLIC_SQL);
  return filterPublicWhatsNewCards(mapRows(rows, now));
}

export async function getPublicWhatsNewBoard(
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewBoardGroups> {
  const cards = await listPublicWhatsNewCards(queryFn, now);
  return groupWhatsNewCardsByColumn(cards);
}

export async function getWhatsNewCardById(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewCard | null> {
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (!trimmed) return null;
  const rows = await queryFn<WhatsNewCardRow>(WHATS_NEW_CARD_BY_ID_SQL, [trimmed]);
  const row = rows[0];
  return row ? buildWhatsNewCard(row, now) : null;
}

async function insertCard(
  value: ValidatedWhatsNewCardInput,
  queryFn: WatsonQueryFn,
  now: Date,
): Promise<WhatsNewValidationResult<WhatsNewCard>> {
  const rows = await queryFn<WhatsNewCardRow>(
    `
      INSERT INTO watson_whats_new_cards (
        title,
        description,
        category,
        destination_url,
        button_text,
        board_column,
        publish_date,
        featured,
        status,
        display_order,
        archived,
        popup_enabled,
        popup_audience,
        popup_expires_on,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13, $14::date, NOW())
      RETURNING ${CARD_SELECT}
    `,
    [
      value.title,
      value.description,
      value.category,
      value.destinationUrl,
      value.buttonText,
      value.boardColumn,
      value.publishDate,
      value.featured,
      value.status,
      value.displayOrder,
      value.archived,
      value.popupEnabled,
      value.popupAudience,
      value.popupExpiresOn,
    ],
  );
  const card = rows[0] ? buildWhatsNewCard(rows[0], now) : null;
  if (!card) return { ok: false, error: "Unable to create update card." };
  return { ok: true, value: card };
}

async function updateCardRow(
  id: string,
  value: ValidatedWhatsNewCardInput,
  queryFn: WatsonQueryFn,
  now: Date,
): Promise<WhatsNewValidationResult<WhatsNewCard>> {
  const rows = await queryFn<WhatsNewCardRow>(
    `
      UPDATE watson_whats_new_cards
      SET
        title = $2,
        description = $3,
        category = $4,
        destination_url = $5,
        button_text = $6,
        board_column = $7,
        publish_date = $8::date,
        featured = $9,
        status = $10,
        display_order = $11,
        archived = $12,
        popup_enabled = $13,
        popup_audience = $14,
        popup_expires_on = $15::date,
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${CARD_SELECT}
    `,
    [
      id,
      value.title,
      value.description,
      value.category,
      value.destinationUrl,
      value.buttonText,
      value.boardColumn,
      value.publishDate,
      value.featured,
      value.status,
      value.displayOrder,
      value.archived,
      value.popupEnabled,
      value.popupAudience,
      value.popupExpiresOn,
    ],
  );
  const card = rows[0] ? buildWhatsNewCard(rows[0], now) : null;
  if (!card) return { ok: false, error: "Update card not found." };
  return { ok: true, value: card };
}

export async function createWhatsNewCard(
  input: Record<string, unknown>,
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewValidationResult<WhatsNewCard>> {
  const validated = validateWhatsNewCardInput(input, now);
  if (!validated.ok) return validated;
  return insertCard(validated.value, queryFn, now);
}

export async function updateWhatsNewCard(
  id: string,
  input: Record<string, unknown>,
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewValidationResult<WhatsNewCard>> {
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (!trimmed) return { ok: false, error: "Card id is required." };

  const existing = await getWhatsNewCardById(trimmed, queryFn, now);
  if (!existing) return { ok: false, error: "Update card not found." };

  const merged: Record<string, unknown> = {
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    category: input.category ?? existing.category,
    destinationUrl:
      input.destinationUrl !== undefined
        ? input.destinationUrl
        : input.destination_url !== undefined
          ? input.destination_url
          : existing.destinationUrl,
    buttonText:
      input.buttonText !== undefined
        ? input.buttonText
        : input.button_text !== undefined
          ? input.button_text
          : existing.buttonText,
    boardColumn: input.boardColumn ?? input.board_column ?? existing.boardColumn,
    publishDate: input.publishDate ?? input.publish_date ?? existing.publishDate,
    featured: input.featured !== undefined ? input.featured : existing.featured,
    status: input.status ?? existing.status,
    displayOrder:
      input.displayOrder !== undefined
        ? input.displayOrder
        : input.display_order !== undefined
          ? input.display_order
          : existing.displayOrder,
    archived: input.archived !== undefined ? input.archived : existing.archived,
    popupEnabled:
      input.popupEnabled !== undefined
        ? input.popupEnabled
        : input.popup_enabled !== undefined
          ? input.popup_enabled
          : existing.popupEnabled,
    popupAudience: input.popupAudience ?? input.popup_audience ?? existing.popupAudience,
    popupExpiresOn:
      input.popupExpiresOn !== undefined
        ? input.popupExpiresOn
        : input.popup_expires_on !== undefined
          ? input.popup_expires_on
          : existing.popupExpiresOn,
  };

  const validated = validateWhatsNewCardInput(merged, now);
  if (!validated.ok) return validated;
  return updateCardRow(trimmed, validated.value, queryFn, now);
}

export async function archiveWhatsNewCard(
  id: string,
  archived: boolean,
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewValidationResult<WhatsNewCard>> {
  return updateWhatsNewCard(id, { archived }, queryFn, now);
}

export const WHATS_NEW_DELETE_ACTIVE_PUBLISHED_ERROR =
  "Unpublish or archive this card before deleting it permanently.";

export async function deleteWhatsNewCard(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewValidationResult<WhatsNewCard>> {
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (!trimmed) return { ok: false, error: "Card id is required." };

  const existing = await getWhatsNewCardById(trimmed, queryFn, now);
  if (!existing) return { ok: false, error: "Delete card not found." };

  // Only draft or archived cards may be permanently deleted. An actively
  // published, non-archived card must be unpublished or archived first.
  if (existing.status === "published" && !existing.archived) {
    return { ok: false, error: WHATS_NEW_DELETE_ACTIVE_PUBLISHED_ERROR };
  }

  await queryFn(`DELETE FROM watson_whats_new_cards WHERE id = $1`, [trimmed]);
  return { ok: true, value: existing };
}

const POPUP_ANNOUNCEMENT_SQL = `
  SELECT
    announcement_id,
    source_card_id,
    title,
    introduction,
    audience,
    expires_at,
    enabled,
    updated_at
  FROM watson_whats_new_popup_announcement
  WHERE key = $1
  LIMIT 1
`;

async function readPopupAnnouncementRow(
  queryFn: WatsonQueryFn,
): Promise<WhatsNewPopupAnnouncementRow | null> {
  const rows = await queryFn<WhatsNewPopupAnnouncementRow>(POPUP_ANNOUNCEMENT_SQL, [
    POPUP_ANNOUNCEMENT_KEY,
  ]);
  return rows[0] ?? null;
}

/** The one saved pop-up, including a disabled or expired one. Does not change What's New entries. */
export async function getWhatsNewPopupAnnouncement(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WhatsNewPopupAnnouncement | null> {
  const row = await readPopupAnnouncementRow(queryFn);
  return buildPopupAnnouncement(row);
}

/** The pop-up visitors can see right now. Disabled and expired announcements are omitted. */
export async function getPublicWhatsNewAnnouncement(
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewAnnouncement | null> {
  const saved = await getWhatsNewPopupAnnouncement(queryFn);
  if (!saved || !isPopupAnnouncementActive(saved, now)) return null;
  return {
    id: saved.id,
    title: saved.title.trim(),
    introductionHtml: saved.introductionHtml,
    href: saved.href,
    audience: saved.audience,
  };
}

/** @deprecated Use getPublicWhatsNewAnnouncement. Kept so older imports still resolve. */
export async function getPublicWhatsNewAnnouncements(
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<{ everyone: WhatsNewAnnouncement | null; members: WhatsNewAnnouncement | null }> {
  const announcement = await getPublicWhatsNewAnnouncement(queryFn, now);
  if (!announcement) return { everyone: null, members: null };
  return {
    everyone: announcement.audience === "everyone" ? announcement : null,
    members: announcement,
  };
}

export async function upsertWhatsNewPopupAnnouncement(
  input: Record<string, unknown>,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WhatsNewValidationResult<WhatsNewPopupAnnouncement>> {
  const validated = validatePopupAnnouncementInput(input);
  if (!validated.ok) return validated;
  const existing = await getWhatsNewPopupAnnouncement(queryFn);
  const id = shouldMintAnnouncementId(existing, validated.value.sourceCardId)
    ? randomUUID()
    : existing!.id;
  const rows = await queryFn<WhatsNewPopupAnnouncementRow>(
    `
      INSERT INTO watson_whats_new_popup_announcement (
        key,
        announcement_id,
        source_card_id,
        title,
        introduction,
        audience,
        expires_at,
        enabled,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, NOW())
      ON CONFLICT (key) DO UPDATE SET
        announcement_id = EXCLUDED.announcement_id,
        source_card_id = EXCLUDED.source_card_id,
        title = EXCLUDED.title,
        introduction = EXCLUDED.introduction,
        audience = EXCLUDED.audience,
        expires_at = EXCLUDED.expires_at,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
      RETURNING
        announcement_id,
        source_card_id,
        title,
        introduction,
        audience,
        expires_at,
        enabled,
        updated_at
    `,
    [
      POPUP_ANNOUNCEMENT_KEY,
      id,
      validated.value.sourceCardId,
      validated.value.title,
      validated.value.introductionHtml,
      validated.value.audience,
      validated.value.expiresAt,
      validated.value.enabled,
    ],
  );
  const saved = buildPopupAnnouncement(rows[0] ?? null);
  if (!saved) return { ok: false, error: "Unable to save the pop-up announcement." };
  return { ok: true, value: saved };
}

export type WhatsNewAnnouncementActivityCounts = {
  displayed: number;
  readMore: number;
};

export async function listWhatsNewAnnouncementActivityCounts(
  environment: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<Record<string, WhatsNewAnnouncementActivityCounts>> {
  const rows = await queryFn<{ card_id: string; event_type: string; count: number | string }>(
    `
      SELECT card_id, event_type, COUNT(*)::int AS count
      FROM watson_whats_new_announcement_events
      WHERE environment = $1
        -- IS DISTINCT FROM keeps signed-out rows. NULL = $2 would drop them.
        AND (
          member_id IS DISTINCT FROM $2
          OR card_id IS DISTINCT FROM $3
        )
        AND COALESCE(source_page, '') !~* $4
      GROUP BY card_id, event_type
    `,
    [
      environment,
      WHATS_NEW_POPUP_SCAN_MEMBER_ID,
      WHATS_NEW_POPUP_SCAN_ANNOUNCEMENT_ID,
      whatsNewSqlProbePathPattern(),
    ],
  );
  const counts: Record<string, WhatsNewAnnouncementActivityCounts> = {};
  for (const row of rows) {
    const bucket = counts[row.card_id] ?? { displayed: 0, readMore: 0 };
    const count = Number(row.count) || 0;
    if (row.event_type === "displayed") bucket.displayed = count;
    if (row.event_type === "read_more") bucket.readMore = count;
    counts[row.card_id] = bucket;
  }
  return counts;
}

export async function insertWhatsNewAnnouncementActivity(
  event: WhatsNewAnnouncementActivityEvent,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<void> {
  await queryFn(
    `
      INSERT INTO watson_whats_new_announcement_events (
        id,
        card_id,
        event_type,
        identity,
        member_id,
        environment,
        source_page,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
    `,
    [
      event.id,
      event.cardId,
      event.eventType,
      event.identity,
      event.memberId ?? null,
      event.environment,
      event.sourcePage ?? null,
      event.createdAt,
    ],
  );
}

export async function getWhatsNewBillboardSettings(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WhatsNewBillboardSettings | null> {
  const rows = await queryFn<WhatsNewBillboardSettingsRow>(WHATS_NEW_SETTINGS_SQL, [
    WHATS_NEW_FEATURED_VIDEO_SETTINGS_KEY,
  ]);
  return buildBillboardSettings(rows[0] ?? null);
}

/** @deprecated Use getWhatsNewBillboardSettings */
export const getWhatsNewFeaturedVideoSettings = getWhatsNewBillboardSettings;

export async function getPublicBillboardSettings(
  queryFn: WatsonQueryFn = queryWatson,
  now: Date = new Date(),
): Promise<WhatsNewBillboardSettings | null> {
  const settings = await getWhatsNewBillboardSettings(queryFn);
  return getPublicBillboard(settings, now);
}

/** @deprecated Use getPublicBillboardSettings */
export const getPublicFeaturedVideoSettings = getPublicBillboardSettings;

export async function upsertWhatsNewBillboardSettings(
  input: Record<string, unknown>,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WhatsNewValidationResult<WhatsNewBillboardSettings>> {
  const validated = validateBillboardInput(input, normalizeVimeoUrl);
  if (!validated.ok) return validated;
  return persistBillboardSettings(validated.value, queryFn);
}

/** @deprecated Use upsertWhatsNewBillboardSettings */
export const upsertWhatsNewFeaturedVideoSettings = upsertWhatsNewBillboardSettings;

async function persistBillboardSettings(
  value: ValidatedBillboardInput,
  queryFn: WatsonQueryFn,
): Promise<WhatsNewValidationResult<WhatsNewBillboardSettings>> {
  const rows = await queryFn<WhatsNewBillboardSettingsRow>(
    `
      INSERT INTO watson_whats_new_settings (
        key,
        headline,
        introduction,
        original_video_url,
        safe_vimeo_embed_url,
        publish_date,
        button_text,
        button_destination_url,
        start_date,
        end_date,
        enabled,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9::date, $10::date, $11, NOW())
      ON CONFLICT (key) DO UPDATE SET
        headline = EXCLUDED.headline,
        introduction = EXCLUDED.introduction,
        original_video_url = EXCLUDED.original_video_url,
        safe_vimeo_embed_url = EXCLUDED.safe_vimeo_embed_url,
        publish_date = EXCLUDED.publish_date,
        button_text = EXCLUDED.button_text,
        button_destination_url = EXCLUDED.button_destination_url,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
      RETURNING
        key,
        headline,
        introduction,
        original_video_url,
        safe_vimeo_embed_url,
        publish_date,
        button_text,
        button_destination_url,
        start_date,
        end_date,
        enabled,
        updated_at
    `,
    [
      WHATS_NEW_FEATURED_VIDEO_SETTINGS_KEY,
      value.headline,
      value.introduction,
      value.originalVideoUrl,
      value.safeVimeoEmbedUrl,
      value.publishDate,
      value.buttonText,
      value.buttonDestinationUrl,
      value.startDate,
      value.endDate,
      value.enabled,
    ],
  );

  const settings = buildBillboardSettings(rows[0] ?? null);
  if (!settings) {
    return { ok: false, error: "Unable to save billboard settings." };
  }
  return { ok: true, value: settings };
}
