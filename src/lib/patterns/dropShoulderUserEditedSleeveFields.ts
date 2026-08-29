/**
 * Drop Shoulder — explicit user-edit tracking for chart-owned sleeve measurement fields.
 *
 * Stale `cbMeasurementOverrides` must not be treated as user edits after a size change.
 * Only manual review input sets these flags.
 */
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";

export const DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY = "dropShoulderUserEditedSleeveFields";

export const DROP_SHOULDER_USER_EDITED_SLEEVE_FIELD_KEYS = [
  "upperArm",
  "sleeveLength",
  "cuffCircumference",
] as const;

export type DropShoulderUserEditedSleeveFieldKey =
  (typeof DROP_SHOULDER_USER_EDITED_SLEEVE_FIELD_KEYS)[number];

export type DropShoulderUserEditedSleeveFields = Record<
  DropShoulderUserEditedSleeveFieldKey,
  boolean
>;

/** Diagram override storage keys (`wrist` is the cuff field on the review diagram). */
export const DROP_SHOULDER_SLEEVE_OVERRIDE_KEY_BY_USER_EDITED_FIELD: Record<
  DropShoulderUserEditedSleeveFieldKey,
  string
> = {
  upperArm: "upperArm",
  sleeveLength: "sleeveLength",
  cuffCircumference: "wrist",
};

export const DROP_SHOULDER_USER_EDITED_FIELD_BY_OVERRIDE_KEY: Record<
  string,
  DropShoulderUserEditedSleeveFieldKey
> = {
  upperArm: "upperArm",
  sleeveLength: "sleeveLength",
  wrist: "cuffCircumference",
};

function emptyFlags(): DropShoulderUserEditedSleeveFields {
  return {
    upperArm: false,
    sleeveLength: false,
    cuffCircumference: false,
  };
}

function readExpressBlob(): Record<string, unknown> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeExpressBlobPatch(patch: Record<string, unknown>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const prev = readExpressBlob();
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ ...prev, ...patch }),
    );
  } catch {
    /* ignore */
  }
}

function normalizeFlags(raw: unknown): DropShoulderUserEditedSleeveFields {
  const out = emptyFlags();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const key of DROP_SHOULDER_USER_EDITED_SLEEVE_FIELD_KEYS) {
    out[key] = (raw as DropShoulderUserEditedSleeveFields)[key] === true;
  }
  return out;
}

/** Coerce arbitrary stored data into the canonical flags shape (missing/invalid → all false). */
export function normalizeDropShoulderUserEditedSleeveFields(
  raw: unknown,
): DropShoulderUserEditedSleeveFields {
  return normalizeFlags(raw);
}

/** True when at least one tracked sleeve field is flagged as user-edited. */
export function hasAnyDropShoulderUserEditedSleeveField(
  flags: DropShoulderUserEditedSleeveFields,
): boolean {
  return DROP_SHOULDER_USER_EDITED_SLEEVE_FIELD_KEYS.some((key) => flags[key] === true);
}

/**
 * Read persisted user-edited sleeve flags from a saved project `fit` section
 * (`fit.dropShoulderUserEditedSleeveFields`). Older projects without the metadata yield all-false.
 * Never infers a flag by comparing measurement values.
 */
export function readDropShoulderUserEditedSleeveFieldsFromFit(
  fit: unknown,
): DropShoulderUserEditedSleeveFields {
  if (!fit || typeof fit !== "object" || Array.isArray(fit)) return emptyFlags();
  return normalizeFlags((fit as Record<string, unknown>)[DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY]);
}

export function readDropShoulderUserEditedSleeveFields(): DropShoulderUserEditedSleeveFields {
  return normalizeFlags(readExpressBlob()[DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY]);
}

/** Merge express-session flags with persisted `fit` metadata (saved reopen + generator parity). */
export function readEffectiveDropShoulderUserEditedSleeveFields(
  fit?: unknown,
): DropShoulderUserEditedSleeveFields {
  const fromFit = readDropShoulderUserEditedSleeveFieldsFromFit(fit);
  const fromExpress = readDropShoulderUserEditedSleeveFields();
  const out = emptyFlags();
  for (const key of DROP_SHOULDER_USER_EDITED_SLEEVE_FIELD_KEYS) {
    out[key] = fromFit[key] === true || fromExpress[key] === true;
  }
  return out;
}

export function writeDropShoulderUserEditedSleeveFields(
  flags: DropShoulderUserEditedSleeveFields,
): void {
  writeExpressBlobPatch({ [DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY]: normalizeFlags(flags) });
}

function isEmptyExpressBlob(blob: Record<string, unknown>): boolean {
  return Object.keys(blob).length === 0;
}

export function clearDropShoulderUserEditedSleeveFields(): void {
  if (typeof localStorage === "undefined") return;
  const prev = readExpressBlob();
  delete prev[DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY];
  try {
    if (isEmptyExpressBlob(prev)) {
      localStorage.removeItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    } else {
      localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, JSON.stringify(prev));
    }
  } catch {
    /* ignore */
  }
}

export function markDropShoulderSleeveFieldUserEdited(
  field: DropShoulderUserEditedSleeveFieldKey,
): void {
  const flags = readDropShoulderUserEditedSleeveFields();
  if (flags[field] === true) return;
  writeDropShoulderUserEditedSleeveFields({ ...flags, [field]: true });
}

/** Clear specific user-edited flags (picker change resets sleeve length / cuff to scaled defaults). */
export function clearDropShoulderSleeveFieldsUserEdited(
  fields: readonly DropShoulderUserEditedSleeveFieldKey[],
): DropShoulderUserEditedSleeveFields {
  const flags = readDropShoulderUserEditedSleeveFields();
  const next = { ...flags };
  for (const field of fields) next[field] = false;
  writeDropShoulderUserEditedSleeveFields(next);
  return next;
}

export function isDropShoulderSleeveFieldUserEdited(
  field: DropShoulderUserEditedSleeveFieldKey,
): boolean {
  return readDropShoulderUserEditedSleeveFields()[field] === true;
}

/** Mark user-edited from a diagram override key (`upperArm`, `sleeveLength`, `wrist`). */
export function markDropShoulderSleeveOverrideKeyUserEdited(overrideKey: string): void {
  const field = DROP_SHOULDER_USER_EDITED_FIELD_BY_OVERRIDE_KEY[overrideKey];
  if (field) markDropShoulderSleeveFieldUserEdited(field);
}
