import { documentsMatch } from "./document";
import { listHelpHubTipsForAdmin, upsertHelpHubTipFromDocument } from "./store";
import type { HelpHubTipDocument, HelpHubTipRecord, HelpHubWriteActor } from "./types";
import type { WatsonQueryFn } from "../watson/memberSearch";

export type HelpHubImportReport = {
  expectedCount: number;
  upsertedCount: number;
  uniqueIds: boolean;
  uniqueSlugs: boolean;
  roundTripFailures: string[];
  ids: number[];
  slugs: string[];
};

export function validateHelpHubSnapshot(docs: HelpHubTipDocument[]): {
  uniqueIds: boolean;
  uniqueSlugs: boolean;
  ids: number[];
  slugs: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const ids: number[] = [];
  const slugs: string[] = [];
  for (const doc of docs) {
    const id = typeof doc.id === "number" ? doc.id : NaN;
    const slug = typeof doc.slug === "string" ? doc.slug.trim() : "";
    if (!Number.isFinite(id)) errors.push(`Missing numeric id for slug "${slug || "(none)"}"`);
    else ids.push(id);
    if (!slug) errors.push(`Missing slug for id ${id}`);
    else slugs.push(slug);
  }
  const uniqueIds = new Set(ids).size === ids.length;
  const uniqueSlugs = new Set(slugs).size === slugs.length;
  if (!uniqueIds) errors.push("Duplicate ids in snapshot.");
  if (!uniqueSlugs) errors.push("Duplicate slugs in snapshot.");
  return { uniqueIds, uniqueSlugs, ids, slugs, errors };
}

export async function importHelpHubDocuments(
  docs: HelpHubTipDocument[],
  queryFn: WatsonQueryFn,
  actor: HelpHubWriteActor | null = { email: "help-hub-import" },
): Promise<HelpHubImportReport> {
  const snapshot = validateHelpHubSnapshot(docs);
  if (snapshot.errors.length) {
    throw new Error(snapshot.errors.join(" "));
  }

  const upserted: HelpHubTipRecord[] = [];
  for (const doc of docs) {
    upserted.push(await upsertHelpHubTipFromDocument(doc, actor, queryFn));
  }

  const loaded = await listHelpHubTipsForAdmin(queryFn);
  const bySlug = new Map(loaded.map((t) => [String(t.slug).trim().toLowerCase(), t]));
  const roundTripFailures: string[] = [];
  for (const original of docs) {
    const slug = String(original.slug).trim().toLowerCase();
    const imported = bySlug.get(slug);
    if (!imported) {
      roundTripFailures.push(`${slug}: missing after import`);
      continue;
    }
    if (!documentsMatch(original, imported)) {
      roundTripFailures.push(`${slug}: document mismatch`);
    }
  }

  return {
    expectedCount: docs.length,
    upsertedCount: upserted.length,
    uniqueIds: snapshot.uniqueIds,
    uniqueSlugs: snapshot.uniqueSlugs,
    roundTripFailures,
    ids: snapshot.ids,
    slugs: snapshot.slugs,
  };
}
