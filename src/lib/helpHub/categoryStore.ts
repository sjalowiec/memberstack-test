import { queryWatson } from "../watson/db";
import type { WatsonQueryFn } from "../watson/memberSearch";
import { helpHubJsonSeedCategories } from "./categories";
import { mergeSeededHelpHubCategories } from "./categoryManage";
import {
  HELP_HUB_RETIRED_LOOK_RIGHT_KEY,
  sortHelpHubManagedCategories,
  type HelpHubManagedCategory,
} from "./categoryTypes";
import { helpHubActorLabel } from "./document";
import type { HelpHubWriteActor } from "./types";

export type HelpHubCategoryRow = {
  id: number;
  key: string;
  label: string;
  sort_order: number | null;
  retired_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  updated_by: string | null;
  deleted_at: Date | string | null;
};

const COLUMNS = `
  id,
  key,
  label,
  sort_order,
  retired_at,
  created_at,
  updated_at,
  updated_by,
  deleted_at
`;

export const HELP_HUB_CATEGORY_LIST_SQL = `
  SELECT ${COLUMNS}
  FROM help_hub_categories
  WHERE deleted_at IS NULL
  ORDER BY sort_order ASC NULLS LAST, id ASC
`;

export const HELP_HUB_CATEGORY_LIST_ALL_SQL = `
  SELECT ${COLUMNS}
  FROM help_hub_categories
  ORDER BY sort_order ASC NULLS LAST, id ASC
`;

export const HELP_HUB_CATEGORY_SYNC_ID_SEQUENCE_SQL = `
  SELECT CASE
    WHEN pg_get_serial_sequence('public.help_hub_categories', 'id') IS NULL THEN NULL
    ELSE setval(
      pg_get_serial_sequence('public.help_hub_categories', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM public.help_hub_categories), 9), 9)
    )
  END AS last_value
`;

export const HELP_HUB_CATEGORY_GET_SQL = `
  SELECT ${COLUMNS}
  FROM help_hub_categories
  WHERE id = $1
    AND deleted_at IS NULL
  LIMIT 1
`;

export const HELP_HUB_CATEGORY_MAX_ID_SQL = `
  SELECT COALESCE(MAX(id), 9) AS max_id
  FROM help_hub_categories
`;

export const HELP_HUB_CATEGORY_INSERT_SQL = `
  INSERT INTO help_hub_categories (
    id, key, label, sort_order, retired_at, updated_by
  ) VALUES (
    $1, $2, $3, $4, $5, $6
  )
  RETURNING ${COLUMNS}
`;

export const HELP_HUB_CATEGORY_UPDATE_SQL = `
  UPDATE help_hub_categories SET
    label = $2,
    sort_order = $3,
    retired_at = $4,
    updated_at = NOW(),
    updated_by = $5
  WHERE id = $1
    AND deleted_at IS NULL
  RETURNING ${COLUMNS}
`;

export const HELP_HUB_CATEGORY_DELETE_SQL = `
  UPDATE help_hub_categories SET
    deleted_at = NOW(),
    updated_at = NOW(),
    updated_by = $2
  WHERE id = $1
    AND deleted_at IS NULL
  RETURNING ${COLUMNS}
`;

export const HELP_HUB_REASSIGN_TIP_CATEGORY_SQL = `
  UPDATE help_hub_tips SET
    category = $2,
    document = jsonb_set(COALESCE(document, '{}'::jsonb), '{category}', to_jsonb($2::text), true),
    updated_at = NOW(),
    updated_by = $3
  WHERE deleted_at IS NULL
    AND (
      category = $1
      OR document->>'category' = $1
    )
  RETURNING id, slug, status, category
`;

function retiredAtIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function categoryFromRow(row: HelpHubCategoryRow): HelpHubManagedCategory {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    sortOrder: typeof row.sort_order === "number" && Number.isFinite(row.sort_order) ? row.sort_order : row.id * 10,
    retiredAt: retiredAtIso(row.retired_at),
  };
}

export function isMissingHelpHubCategoryTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /help_hub_categories/i.test(message) && /does not exist/i.test(message);
}

export async function listHelpHubCategories(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubManagedCategory[]> {
  const rows = await queryFn<HelpHubCategoryRow>(HELP_HUB_CATEGORY_LIST_SQL);
  return sortHelpHubManagedCategories(rows.map(categoryFromRow));
}

export async function listHelpHubCategoriesIncludingDeleted(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubManagedCategory[]> {
  const rows = await queryFn<HelpHubCategoryRow>(HELP_HUB_CATEGORY_LIST_ALL_SQL);
  return sortHelpHubManagedCategories(rows.map(categoryFromRow));
}

export async function advanceHelpHubCategoryIdSequence(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<void> {
  await queryFn(HELP_HUB_CATEGORY_SYNC_ID_SEQUENCE_SQL);
}

export async function insertHelpHubCategoryRow(
  category: HelpHubManagedCategory,
  actor: HelpHubWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubManagedCategory> {
  const rows = await queryFn<HelpHubCategoryRow>(HELP_HUB_CATEGORY_INSERT_SQL, [
    category.id,
    category.key,
    category.label,
    category.sortOrder,
    category.retiredAt,
    helpHubActorLabel(actor),
  ]);
  if (!rows[0]) throw new Error("Help Hub category insert returned no row.");
  await advanceHelpHubCategoryIdSequence(queryFn);
  return categoryFromRow(rows[0]);
}

export async function updateHelpHubCategoryRow(
  category: HelpHubManagedCategory,
  actor: HelpHubWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubManagedCategory | null> {
  const rows = await queryFn<HelpHubCategoryRow>(HELP_HUB_CATEGORY_UPDATE_SQL, [
    category.id,
    category.label,
    category.sortOrder,
    category.retiredAt,
    helpHubActorLabel(actor),
  ]);
  return rows[0] ? categoryFromRow(rows[0]) : null;
}

export async function deleteHelpHubCategoryRow(
  id: number,
  actor: HelpHubWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<boolean> {
  const rows = await queryFn<HelpHubCategoryRow>(HELP_HUB_CATEGORY_DELETE_SQL, [
    id,
    helpHubActorLabel(actor),
  ]);
  return Boolean(rows[0]);
}

export async function reassignHelpHubTipCategoryKey(
  fromKey: string,
  toKey: string,
  actor: HelpHubWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const rows = await queryFn<{ id: number }>(HELP_HUB_REASSIGN_TIP_CATEGORY_SQL, [
    fromKey,
    toKey,
    helpHubActorLabel(actor),
  ]);
  return rows.length;
}

export async function replaceHelpHubCategoryRows(
  categories: HelpHubManagedCategory[],
  actor: HelpHubWriteActor | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubManagedCategory[]> {
  const existing = await listHelpHubCategories(queryFn);
  const existingIds = new Set(existing.map((category) => category.id));
  const nextIds = new Set(categories.map((category) => category.id));
  for (const category of categories) {
    if (existingIds.has(category.id)) {
      await updateHelpHubCategoryRow(category, actor, queryFn);
    } else {
      await insertHelpHubCategoryRow(category, actor, queryFn);
    }
  }
  for (const category of existing) {
    if (!nextIds.has(category.id)) {
      await deleteHelpHubCategoryRow(category.id, actor, queryFn);
    }
  }
  return listHelpHubCategories(queryFn);
}

export async function ensureHelpHubCategoriesSeeded(
  actor: HelpHubWriteActor | null = null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<HelpHubManagedCategory[]> {
  const occupancy = await listHelpHubCategoriesIncludingDeleted(queryFn);
  const merged = mergeSeededHelpHubCategories(occupancy, helpHubJsonSeedCategories());
  const existingKeys = new Set(occupancy.map((category) => category.key));
  if (occupancy.length === 0) {
    for (const category of merged) {
      await insertHelpHubCategoryRow(category, actor, queryFn);
    }
    await advanceHelpHubCategoryIdSequence(queryFn);
    return listHelpHubCategories(queryFn);
  }
  for (const category of merged) {
    if (existingKeys.has(category.key)) {
      const current = occupancy.find((row) => row.key === category.key);
      if (
        current &&
        category.key === HELP_HUB_RETIRED_LOOK_RIGHT_KEY &&
        !current.retiredAt &&
        category.retiredAt
      ) {
        await updateHelpHubCategoryRow({ ...current, retiredAt: category.retiredAt }, actor, queryFn);
      }
      continue;
    }
    await insertHelpHubCategoryRow(category, actor, queryFn);
    existingKeys.add(category.key);
  }
  await advanceHelpHubCategoryIdSequence(queryFn);
  return listHelpHubCategories(queryFn);
}
