import { queryWatson } from "../watson/db";
import type { WatsonQueryFn } from "../watson/memberSearch";
import {
  fieldsFromTipDocument,
  helpHubActorLabel,
  isHelpHubStatus,
  requireTipId,
  tipFromRow,
  type HelpHubInsertFields,
} from "./document";
import type { HelpHubTipDocument, HelpHubTipRecord, HelpHubTipRow, HelpHubWriteActor } from "./types";

const COLUMNS = `
  id,
  slug,
  status,
  sort_order,
  category,
  title,
  question,
  is_new,
  featured,
  document,
  created_at,
  updated_at,
  updated_by,
  deleted_at
`;

export const HELP_HUB_LIST_ADMIN_SQL = `
  SELECT ${COLUMNS}
  FROM help_hub_tips
  WHERE deleted_at IS NULL
  ORDER BY sort_order ASC NULLS LAST, id ASC
`;

export const HELP_HUB_LIST_ADMIN_INCLUDING_DELETED_SQL = `
  SELECT ${COLUMNS}
  FROM help_hub_tips
  ORDER BY sort_order ASC NULLS LAST, id ASC
`;

export const HELP_HUB_LIST_PUBLIC_SQL = `
  SELECT ${COLUMNS}
  FROM help_hub_tips
  WHERE deleted_at IS NULL
    AND lower(status) = 'published'
  ORDER BY sort_order ASC NULLS LAST, id ASC
`;

export const HELP_HUB_GET_BY_SLUG_SQL = `
  SELECT ${COLUMNS}
  FROM help_hub_tips
  WHERE lower(slug) = lower($1)
    AND deleted_at IS NULL
  LIMIT 1
`;

export const HELP_HUB_GET_BY_ID_SQL = `
  SELECT ${COLUMNS}
  FROM help_hub_tips
  WHERE id = $1
    AND deleted_at IS NULL
  LIMIT 1
`;

export const HELP_HUB_MAX_ID_SQL = `
  SELECT COALESCE(MAX(id), 999) AS max_id
  FROM help_hub_tips
`;

export const HELP_HUB_INSERT_SQL = `
  INSERT INTO help_hub_tips (
    id, slug, status, sort_order, category, title, question, is_new, featured, document, updated_by
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11
  )
  ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    category = EXCLUDED.category,
    title = EXCLUDED.title,
    question = EXCLUDED.question,
    is_new = EXCLUDED.is_new,
    featured = EXCLUDED.featured,
    document = EXCLUDED.document,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by,
    deleted_at = NULL
  RETURNING ${COLUMNS}
`;

export const HELP_HUB_UPDATE_SQL = `
  UPDATE help_hub_tips SET
    slug = $2,
    status = $3,
    sort_order = $4,
    category = $5,
    title = $6,
    question = $7,
    is_new = $8,
    featured = $9,
    document = $10::jsonb,
    updated_at = NOW(),
    updated_by = $11,
    deleted_at = NULL
  WHERE id = $1
    AND deleted_at IS NULL
  RETURNING ${COLUMNS}
`;

export const HELP_HUB_SOFT_DELETE_SQL = `
  UPDATE help_hub_tips SET
    deleted_at = NOW(),
    updated_at = NOW(),
    updated_by = $2
  WHERE id = $1
    AND deleted_at IS NULL
  RETURNING ${COLUMNS}
`;

function mapRows(rows: HelpHubTipRow[]): HelpHubTipRecord[] {
  return rows.map(tipFromRow);
}

function insertParams(fields: HelpHubInsertFields, actor: HelpHubWriteActor | null): unknown[] {
  return [
    fields.id,
    fields.slug,
    fields.status,
    fields.sortOrder,
    fields.category,
    fields.title,
    fields.question,
    fields.isNew,
    fields.featured,
    JSON.stringify(fields.document),
    helpHubActorLabel(actor),
  ];
}

export async function listHelpHubTipsForAdmin(
  queryFn: WatsonQueryFn = queryWatson,
  options: { includeDeleted?: boolean } = {},
): Promise<HelpHubTipRecord[]> {
  const sql = options.includeDeleted
    ? HELP_HUB_LIST_ADMIN_INCLUDING_DELETED_SQL
    : HELP_HUB_LIST_ADMIN_SQL;
  const rows = await queryFn<HelpHubTipRow>(sql);
  return mapRows(rows);
}

export async function listPublicHelpHubTips(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubTipRecord[]> {
  const rows = await queryFn<HelpHubTipRow>(HELP_HUB_LIST_PUBLIC_SQL);
  return mapRows(rows);
}

export async function getHelpHubTipBySlug(
  slug: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubTipRecord | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  const rows = await queryFn<HelpHubTipRow>(HELP_HUB_GET_BY_SLUG_SQL, [trimmed]);
  return rows[0] ? tipFromRow(rows[0]) : null;
}

export async function getHelpHubTipById(
  id: number,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubTipRecord | null> {
  if (!Number.isFinite(id)) return null;
  const rows = await queryFn<HelpHubTipRow>(HELP_HUB_GET_BY_ID_SQL, [id]);
  return rows[0] ? tipFromRow(rows[0]) : null;
}

export async function nextHelpHubDatabaseId(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const rows = await queryFn<{ max_id: number | string }>(HELP_HUB_MAX_ID_SQL);
  const raw = rows[0]?.max_id;
  const max = typeof raw === "number" ? raw : parseInt(String(raw ?? "999"), 10);
  const n = Number.isFinite(max) ? max : 999;
  return Math.max(n, 999) + 1;
}

export async function insertHelpHubTip(
  tip: HelpHubTipDocument,
  required: { id: number; slug: string; status: string; title: string; category: string },
  actor: HelpHubWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubTipRecord> {
  if (!isHelpHubStatus(required.status)) {
    throw new Error(`Invalid Help Hub status: ${required.status}`);
  }
  const fields = fieldsFromTipDocument(tip, {
    id: required.id,
    slug: required.slug,
    status: required.status,
    title: required.title,
    category: required.category,
  });
  const rows = await queryFn<HelpHubTipRow>(HELP_HUB_INSERT_SQL, insertParams(fields, actor));
  if (!rows[0]) throw new Error("Help Hub insert returned no row.");
  return tipFromRow(rows[0]);
}

export async function updateHelpHubTip(
  id: number,
  tip: HelpHubTipDocument,
  required: { slug: string; status: string; title: string; category: string },
  actor: HelpHubWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubTipRecord | null> {
  if (!isHelpHubStatus(required.status)) {
    throw new Error(`Invalid Help Hub status: ${required.status}`);
  }
  const fields = fieldsFromTipDocument(tip, {
    id,
    slug: required.slug,
    status: required.status,
    title: required.title,
    category: required.category,
  });
  const params = insertParams(fields, actor);
  const rows = await queryFn<HelpHubTipRow>(HELP_HUB_UPDATE_SQL, [
    id,
    params[1],
    params[2],
    params[3],
    params[4],
    params[5],
    params[6],
    params[7],
    params[8],
    params[9],
    params[10],
  ]);
  return rows[0] ? tipFromRow(rows[0]) : null;
}

export async function softDeleteHelpHubTip(
  id: number,
  actor: HelpHubWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubTipRecord | null> {
  const rows = await queryFn<HelpHubTipRow>(HELP_HUB_SOFT_DELETE_SQL, [
    id,
    helpHubActorLabel(actor),
  ]);
  return rows[0] ? tipFromRow(rows[0]) : null;
}

export async function upsertHelpHubTipFromDocument(
  tip: HelpHubTipDocument,
  actor: HelpHubWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubTipRecord> {
  const id = requireTipId(tip);
  const slug = typeof tip.slug === "string" ? tip.slug.trim() : "";
  const title =
    (typeof tip.title === "string" && tip.title.trim()) ||
    (typeof tip.question === "string" && tip.question.trim()) ||
    slug;
  const category = typeof tip.category === "string" ? tip.category.trim() : "";
  const statusRaw = typeof tip.status === "string" ? tip.status.trim().toLowerCase() : "draft";
  const status = isHelpHubStatus(statusRaw) ? statusRaw : "draft";
  if (!slug) throw new Error(`Help Hub tip id ${id} is missing a slug.`);
  return insertHelpHubTip(
    tip,
    { id, slug, status, title, category },
    actor,
    queryFn,
  );
}
