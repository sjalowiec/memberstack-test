import { queryWatson } from "../watson/db";
import type { WatsonQueryFn } from "../watson/memberSearch";
import { normalizeVimeoUrl } from "../videoReplies/vimeoUrl";
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
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, NOW())
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
