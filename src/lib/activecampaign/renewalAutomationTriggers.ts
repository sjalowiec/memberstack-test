/**
 * Read ActiveCampaign start triggers for the legacy renewal tags.
 * A tag counts only when a trigger field names it. Automation titles are ignored.
 */
export const LEGACY_RENEWAL_TRIGGER_TAGS = [
  "legacy-renewal-30-days",
  "legacy-renewal-7-days",
  "legacy-renewal-1-day",
] as const;

export type LegacyRenewalTriggerTag = (typeof LEGACY_RENEWAL_TRIGGER_TAGS)[number];

const TRIGGER_TAG_KEYS = new Set(["tag", "tagid", "tagId", "tag_id"]);

export function renewalTriggerTagFromValue(
  value: unknown,
  tagNameById: ReadonlyMap<string, string>,
): LegacyRenewalTriggerTag | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return asRenewalTag(tagNameById.get(String(value)));
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const named = asRenewalTag(trimmed);
  if (named) return named;
  return asRenewalTag(tagNameById.get(trimmed));
}

function asRenewalTag(value: string | undefined): LegacyRenewalTriggerTag | null {
  if (!value) return null;
  return LEGACY_RENEWAL_TRIGGER_TAGS.find((tag) => tag === value) ?? null;
}

export function confirmedRenewalTriggerTags(
  payload: unknown,
  tagNameById: ReadonlyMap<string, string>,
): LegacyRenewalTriggerTag[] {
  const found = new Set<LegacyRenewalTriggerTag>();
  collectTriggerTags(payload, tagNameById, found);
  return LEGACY_RENEWAL_TRIGGER_TAGS.filter((tag) => found.has(tag));
}

function collectTriggerTags(
  payload: unknown,
  tagNameById: ReadonlyMap<string, string>,
  found: Set<LegacyRenewalTriggerTag>,
): void {
  if (!payload || typeof payload !== "object") return;
  if (Array.isArray(payload)) {
    for (const item of payload) collectTriggerTags(item, tagNameById, found);
    return;
  }
  const record = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (TRIGGER_TAG_KEYS.has(key)) {
      const tag = renewalTriggerTagFromValue(value, tagNameById);
      if (tag) found.add(tag);
    }
    if (key === "params" && typeof value === "string") {
      try {
        collectTriggerTags(JSON.parse(value) as unknown, tagNameById, found);
      } catch {
        // A non-JSON params string is not a confirmed tag trigger.
      }
      continue;
    }
    if (value && typeof value === "object") collectTriggerTags(value, tagNameById, found);
  }
}

function tagsOnTriggerNode(
  node: unknown,
  tagNameById: ReadonlyMap<string, string>,
  found: Set<LegacyRenewalTriggerTag>,
): void {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (!TRIGGER_TAG_KEYS.has(key)) continue;
    const tag = renewalTriggerTagFromValue(value, tagNameById);
    if (tag) found.add(tag);
  }
  const params = record.params;
  if (typeof params === "string") {
    try {
      collectTriggerTags(JSON.parse(params) as unknown, tagNameById, found);
    } catch {
      // A non-JSON params string is not a confirmed tag trigger.
    }
    return;
  }
  if (params && typeof params === "object") collectTriggerTags(params, tagNameById, found);
}

export function confirmedStartBlockTriggerTags(
  payload: unknown,
  tagNameById: ReadonlyMap<string, string>,
): LegacyRenewalTriggerTag[] {
  const found = new Set<LegacyRenewalTriggerTag>();
  collectStartBlocks(payload, tagNameById, found);
  return LEGACY_RENEWAL_TRIGGER_TAGS.filter((tag) => found.has(tag));
}

export interface RenewalAutomationTriggerCount {
  tag: LegacyRenewalTriggerTag;
  activeAutomations: number;
  inactiveAutomations: number;
}

export function summarizeRenewalAutomationTriggers(
  automations: ReadonlyArray<{ active: boolean; triggerTags: readonly LegacyRenewalTriggerTag[] }>,
): RenewalAutomationTriggerCount[] {
  return LEGACY_RENEWAL_TRIGGER_TAGS.map((tag) => {
    const matches = automations.filter((automation) => automation.triggerTags.includes(tag));
    return {
      tag,
      activeAutomations: matches.filter((automation) => automation.active).length,
      inactiveAutomations: matches.filter((automation) => !automation.active).length,
    };
  });
}

/** Key names only, for a failed trigger check. Values are never returned. */
export function triggerPayloadKeys(payload: unknown): string[] {
  const keys = new Set<string>();
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 5) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      keys.add(key);
      if (key === "params" && typeof child === "string") {
        try {
          visit(JSON.parse(child) as unknown, depth + 1);
        } catch {
          // Non-JSON params do not add keys.
        }
        continue;
      }
      if (child && typeof child === "object") visit(child, depth + 1);
    }
  };
  visit(payload, 0);
  return [...keys].sort();
}

function collectStartBlocks(
  payload: unknown,
  tagNameById: ReadonlyMap<string, string>,
  found: Set<LegacyRenewalTriggerTag>,
): void {
  if (!payload || typeof payload !== "object") return;
  if (Array.isArray(payload)) {
    for (const item of payload) collectStartBlocks(item, tagNameById, found);
    return;
  }
  const record = payload as Record<string, unknown>;
  const type = String(record.type ?? "").trim().toLowerCase();
  if (type === "start" || type === "trigger") {
    tagsOnTriggerNode(record, tagNameById, found);
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") collectStartBlocks(value, tagNameById, found);
  }
}
