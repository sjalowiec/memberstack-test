import type {
  FinishedLengthSizeRule,
  PatternErrataBuilder,
  PatternErrataMatchRules,
  PatternErrataStatus,
} from "./types";
import { FINISHED_LENGTH_DEFAULTS_KIND, PATTERN_ERRATA_BUILDERS, PATTERN_ERRATA_STATUSES } from "./types";

export type PatternErrataWriteInput = {
  slug: string;
  status: PatternErrataStatus;
  title: string;
  whatChanged: string;
  knitterAction: string;
  publishedOn: string | null;
  affectedBuilders: PatternErrataBuilder[];
  matchRules: PatternErrataMatchRules;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string): string | { error: string } {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: `${label} is required.` };
  }
  return value.trim();
}

function isBuilder(value: string): value is PatternErrataBuilder {
  return (PATTERN_ERRATA_BUILDERS as readonly string[]).includes(value);
}

export function affectedSizesFromRules(rules: PatternErrataMatchRules): Record<string, string[]> {
  const sizes: Record<string, string[]> = {};
  for (const rule of rules.sizes) {
    const list = sizes[rule.audience] ?? [];
    if (!list.includes(rule.size)) list.push(rule.size);
    sizes[rule.audience] = list;
  }
  return sizes;
}

function parseSizeRules(value: unknown): FinishedLengthSizeRule[] | { error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "At least one affected size is required." };
  }
  const rules: FinishedLengthSizeRule[] = [];
  for (const entry of value) {
    const row = asRecord(entry);
    if (!row) return { error: "Each affected size needs an audience, size, and lengths." };
    const audience = typeof row.audience === "string" ? row.audience.trim().toLowerCase() : "";
    if (audience !== "baby" && audience !== "kids") {
      return { error: "Affected sizes must use the Baby or Kids chart." };
    }
    const size = typeof row.size === "string" ? row.size.trim().replace(/\s+/g, " ") : "";
    if (!size) return { error: "Each affected size needs a size label." };
    const oldLengthInches = Number(row.oldLengthInches);
    const newLengthInches = Number(row.newLengthInches);
    if (!Number.isFinite(oldLengthInches) || oldLengthInches <= 0) {
      return { error: `The previous length for ${size} must be a positive number of inches.` };
    }
    if (!Number.isFinite(newLengthInches) || newLengthInches <= 0) {
      return { error: `The corrected length for ${size} must be a positive number of inches.` };
    }
    if (Math.abs(oldLengthInches - newLengthInches) < 0.001) {
      return { error: `The previous and corrected lengths for ${size} must be different.` };
    }
    const hasOldArm = row.oldUpperArmInches !== undefined && row.oldUpperArmInches !== null && row.oldUpperArmInches !== "";
    const hasNewArm = row.newUpperArmInches !== undefined && row.newUpperArmInches !== null && row.newUpperArmInches !== "";
    if (hasOldArm !== hasNewArm) {
      return { error: `Size ${size} needs both the previous and corrected upper arm, or neither.` };
    }
    if (hasOldArm && hasNewArm) {
      const oldUpperArmInches = Number(row.oldUpperArmInches);
      const newUpperArmInches = Number(row.newUpperArmInches);
      if (!Number.isFinite(oldUpperArmInches) || oldUpperArmInches <= 0) {
        return { error: `The previous upper arm for ${size} must be a positive number of inches.` };
      }
      if (!Number.isFinite(newUpperArmInches) || newUpperArmInches <= 0) {
        return { error: `The corrected upper arm for ${size} must be a positive number of inches.` };
      }
      if (Math.abs(oldUpperArmInches - newUpperArmInches) < 0.001) {
        return { error: `The previous and corrected upper arms for ${size} must be different.` };
      }
      rules.push({ audience, size, oldLengthInches, newLengthInches, oldUpperArmInches, newUpperArmInches });
      continue;
    }
    rules.push({ audience, size, oldLengthInches, newLengthInches });
  }
  return rules;
}

export function parsePatternErrataWriteInput(
  body: unknown,
): { ok: true; value: PatternErrataWriteInput } | { ok: false; error: string } {
  const record = asRecord(body);
  if (!record) return { ok: false, error: "Invalid JSON body." };

  const slug = requiredText(record.slug, "Slug");
  if (typeof slug !== "string") return { ok: false, error: slug.error };
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "Slug may use lowercase letters, numbers, and hyphens." };
  }

  const title = requiredText(record.title, "Title");
  if (typeof title !== "string") return { ok: false, error: title.error };
  const whatChanged = requiredText(record.whatChanged, "What changed");
  if (typeof whatChanged !== "string") return { ok: false, error: whatChanged.error };
  const knitterAction = requiredText(record.knitterAction, "Knitter action");
  if (typeof knitterAction !== "string") return { ok: false, error: knitterAction.error };

  const statusRaw = typeof record.status === "string" ? record.status.trim() : "";
  if (!(PATTERN_ERRATA_STATUSES as readonly string[]).includes(statusRaw)) {
    return { ok: false, error: "Status must be draft or published." };
  }
  const status = statusRaw as PatternErrataStatus;

  let publishedOn: string | null = null;
  if (record.publishedOn !== undefined && record.publishedOn !== null && record.publishedOn !== "") {
    if (typeof record.publishedOn !== "string" || !DATE_PATTERN.test(record.publishedOn.trim())) {
      return { ok: false, error: "Publication date must be YYYY-MM-DD." };
    }
    publishedOn = record.publishedOn.trim();
  }
  if (status === "published" && !publishedOn) {
    return { ok: false, error: "A published correction needs a publication date." };
  }

  if (!Array.isArray(record.affectedBuilders) || record.affectedBuilders.length === 0) {
    return { ok: false, error: "Choose at least one affected builder." };
  }
  const affectedBuilders: PatternErrataBuilder[] = [];
  for (const builder of record.affectedBuilders) {
    if (typeof builder !== "string" || !isBuilder(builder)) {
      return { ok: false, error: "Affected builders must be Drop Shoulder or Sleeveless." };
    }
    if (!affectedBuilders.includes(builder)) affectedBuilders.push(builder);
  }

  const rulesRecord = asRecord(record.matchRules);
  const correctedAt =
    typeof rulesRecord?.correctedAt === "string" ? rulesRecord.correctedAt.trim() : "";
  if (!correctedAt || !Number.isFinite(Date.parse(correctedAt))) {
    return { ok: false, error: "The length comparison needs the date the corrected defaults were saved." };
  }
  const sizes = parseSizeRules(rulesRecord?.sizes);
  if (!Array.isArray(sizes)) return { ok: false, error: sizes.error };

  return {
    ok: true,
    value: {
      slug,
      status,
      title,
      whatChanged,
      knitterAction,
      publishedOn,
      affectedBuilders,
      matchRules: {
        kind: FINISHED_LENGTH_DEFAULTS_KIND,
        correctedAt: new Date(correctedAt).toISOString(),
        sizes,
      },
    },
  };
}
