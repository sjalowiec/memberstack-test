import type { WatsonQueryFn } from "../../watson/memberSearch";
import { queryWatson } from "../../watson/db";
import { affectedSizesFromRules } from "./patternErrataDocument";
import type { PatternErrataWriteInput } from "./patternErrataDocument";
import type {
  PatternErrataBuilder,
  PatternErrataMatchRules,
  PatternErrataRecord,
  PatternErrataStatus,
} from "./types";
import { FINISHED_LENGTH_DEFAULTS_KIND, PATTERN_ERRATA_BUILDERS, PATTERN_ERRATA_STATUSES } from "./types";

const COLUMNS = `
  id,
  slug,
  status,
  title,
  what_changed,
  knitter_action,
  published_on,
  affected_builders,
  affected_sizes,
  match_rules,
  created_at,
  updated_at,
  updated_by
`;

export const PATTERN_ERRATA_LIST_ADMIN_SQL = `
  SELECT ${COLUMNS}
  FROM pattern_errata
  ORDER BY created_at DESC, slug ASC
`;

export const PATTERN_ERRATA_LIST_PUBLISHED_SQL = `
  SELECT ${COLUMNS}
  FROM pattern_errata
  WHERE status = 'published'
  ORDER BY published_on DESC NULLS LAST, slug ASC
`;

export const PATTERN_ERRATA_GET_BY_ID_SQL = `
  SELECT ${COLUMNS}
  FROM pattern_errata
  WHERE id = $1
  LIMIT 1
`;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function dateOnly(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim().slice(0, 10);
  }
  return null;
}

function iso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return "";
}

function readBuilders(value: unknown): PatternErrataBuilder[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is PatternErrataBuilder =>
      typeof entry === "string" && (PATTERN_ERRATA_BUILDERS as readonly string[]).includes(entry),
  );
}

function readMatchRules(value: unknown): PatternErrataMatchRules | null {
  const rules = asRecord(value);
  if (!rules || rules.kind !== FINISHED_LENGTH_DEFAULTS_KIND) return null;
  if (typeof rules.correctedAt !== "string") return null;
  if (!Array.isArray(rules.sizes)) return null;
  const sizes = [];
  for (const entry of rules.sizes) {
    const row = asRecord(entry);
    if (!row) return null;
    const audience = row.audience === "baby" || row.audience === "kids" ? row.audience : null;
    if (!audience || typeof row.size !== "string") return null;
    const oldLengthInches = Number(row.oldLengthInches);
    const newLengthInches = Number(row.newLengthInches);
    if (!Number.isFinite(oldLengthInches) || !Number.isFinite(newLengthInches)) return null;
    const oldUpperArmInches = Number(row.oldUpperArmInches);
    const newUpperArmInches = Number(row.newUpperArmInches);
    const hasUpperArm = Number.isFinite(oldUpperArmInches) && Number.isFinite(newUpperArmInches);
    sizes.push({
      audience,
      size: row.size,
      oldLengthInches,
      newLengthInches,
      ...(hasUpperArm ? { oldUpperArmInches, newUpperArmInches } : {}),
    });
  }
  return { kind: FINISHED_LENGTH_DEFAULTS_KIND, correctedAt: rules.correctedAt, sizes };
}

export function patternErrataFromRow(row: Record<string, unknown>): PatternErrataRecord | null {
  const id = typeof row.id === "string" ? row.id : "";
  const slug = typeof row.slug === "string" ? row.slug : "";
  const status = typeof row.status === "string" ? row.status : "";
  const title = typeof row.title === "string" ? row.title : "";
  const whatChanged = typeof row.what_changed === "string" ? row.what_changed : "";
  const knitterAction = typeof row.knitter_action === "string" ? row.knitter_action : "";
  if (!id || !slug || !title || !whatChanged || !knitterAction) return null;
  if (!(PATTERN_ERRATA_STATUSES as readonly string[]).includes(status)) return null;
  const matchRules = readMatchRules(row.match_rules);
  if (!matchRules) return null;
  const affectedSizes = asRecord(row.affected_sizes) ?? {};
  const sizes: Record<string, string[]> = {};
  for (const [audience, labels] of Object.entries(affectedSizes)) {
    if (!Array.isArray(labels)) continue;
    sizes[audience] = labels.filter((label): label is string => typeof label === "string");
  }
  return {
    id,
    slug,
    status: status as PatternErrataStatus,
    title,
    whatChanged,
    knitterAction,
    publishedOn: dateOnly(row.published_on),
    affectedBuilders: readBuilders(row.affected_builders),
    affectedSizes: sizes,
    matchRules,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    updatedBy: typeof row.updated_by === "string" ? row.updated_by : null,
  };
}

function rowsFrom(value: unknown): PatternErrataRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];
    const parsed = patternErrataFromRow(record);
    return parsed ? [parsed] : [];
  });
}

export async function listPatternErrataForAdmin(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<PatternErrataRecord[]> {
  const rows = await queryFn<Record<string, unknown>>(PATTERN_ERRATA_LIST_ADMIN_SQL);
  return rowsFrom(rows);
}

export async function listPublishedPatternErrata(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<PatternErrataRecord[]> {
  const rows = await queryFn<Record<string, unknown>>(PATTERN_ERRATA_LIST_PUBLISHED_SQL);
  return rowsFrom(rows).filter((row) => row.status === "published");
}

export async function getPatternErrataById(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<PatternErrataRecord | null> {
  const rows = await queryFn<Record<string, unknown>>(PATTERN_ERRATA_GET_BY_ID_SQL, [id]);
  return rowsFrom(rows)[0] ?? null;
}

export const PATTERN_ERRATA_INSERT_SQL = `
  INSERT INTO pattern_errata (
    slug,
    status,
    title,
    what_changed,
    knitter_action,
    published_on,
    affected_builders,
    affected_sizes,
    match_rules,
    updated_by
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8::jsonb, $9::jsonb, $10)
  RETURNING ${COLUMNS}
`;

export const PATTERN_ERRATA_UPDATE_SQL = `
  UPDATE pattern_errata
  SET
    slug = $2,
    status = $3,
    title = $4,
    what_changed = $5,
    knitter_action = $6,
    published_on = $7,
    affected_builders = $8::text[],
    affected_sizes = $9::jsonb,
    match_rules = $10::jsonb,
    updated_by = $11,
    updated_at = NOW()
  WHERE id = $1
  RETURNING ${COLUMNS}
`;

function writeParams(input: PatternErrataWriteInput, actor: string | null): unknown[] {
  return [
    input.slug,
    input.status,
    input.title,
    input.whatChanged,
    input.knitterAction,
    input.publishedOn,
    input.affectedBuilders,
    JSON.stringify(affectedSizesFromRules(input.matchRules)),
    JSON.stringify(input.matchRules),
    actor,
  ];
}

export async function insertPatternErrata(
  input: PatternErrataWriteInput,
  actor: string | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<PatternErrataRecord> {
  const rows = await queryFn<Record<string, unknown>>(
    PATTERN_ERRATA_INSERT_SQL,
    writeParams(input, actor),
  );
  const saved = rowsFrom(rows)[0];
  if (!saved) throw new Error("The correction was not saved.");
  return saved;
}

export async function updatePatternErrata(
  id: string,
  input: PatternErrataWriteInput,
  actor: string | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<PatternErrataRecord | null> {
  const rows = await queryFn<Record<string, unknown>>(PATTERN_ERRATA_UPDATE_SQL, [
    id,
    ...writeParams(input, actor),
  ]);
  return rowsFrom(rows)[0] ?? null;
}
