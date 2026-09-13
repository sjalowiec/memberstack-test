import {
  getTipId,
  nextHelpHubId,
  nextHelpHubSortOrder,
  readHelpHubFile,
  sortHelpHubTipsBySortOrder,
  writeHelpHubFile,
} from "../helpHubAdminFile";
import { filterPublicHelpHubTips, helpHubTipIsPublic } from "../helpHubPublic";
import {
  getHelpHubTipById,
  getHelpHubTipBySlug,
  insertHelpHubTip,
  listHelpHubTipsForAdmin,
  listPublicHelpHubTips,
  nextHelpHubDatabaseId,
  softDeleteHelpHubTip,
  updateHelpHubTip,
} from "./store";
import { useHelpHubJsonStore } from "./storeMode";
import type { HelpHubTipDocument, HelpHubTipRecord, HelpHubWriteActor } from "./types";

export async function loadHelpHubTipsForAdmin(): Promise<HelpHubTipRecord[]> {
  if (useHelpHubJsonStore()) {
    return sortHelpHubTipsBySortOrder(readHelpHubFile()) as HelpHubTipRecord[];
  }
  return listHelpHubTipsForAdmin();
}

export async function loadPublicHelpHubTips(): Promise<HelpHubTipRecord[]> {
  if (useHelpHubJsonStore()) {
    return filterPublicHelpHubTips(readHelpHubFile() as HelpHubTipRecord[]);
  }
  const rows = await listPublicHelpHubTips();
  return rows.filter((tip) => helpHubTipIsPublic(tip));
}

export async function loadHelpHubTipBySlug(
  slug: string,
  options: { publicOnly?: boolean } = {},
): Promise<HelpHubTipRecord | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  if (useHelpHubJsonStore()) {
    const found = readHelpHubFile().find((row) => {
      const s = typeof row.slug === "string" ? row.slug.trim().toLowerCase() : "";
      return s === trimmed.toLowerCase();
    }) as HelpHubTipRecord | undefined;
    if (!found) return null;
    if (options.publicOnly && !helpHubTipIsPublic(found)) return null;
    return found;
  }
  const tip = await getHelpHubTipBySlug(trimmed);
  if (!tip) return null;
  if (options.publicOnly && !helpHubTipIsPublic(tip)) return null;
  return tip;
}

export async function loadHelpHubTipById(id: number): Promise<HelpHubTipRecord | null> {
  if (useHelpHubJsonStore()) {
    const found = readHelpHubFile().find((row) => getTipId(row) === id);
    return (found as HelpHubTipRecord) ?? null;
  }
  return getHelpHubTipById(id);
}

export async function saveNewHelpHubTip(
  body: HelpHubTipDocument,
  required: { slug: string; status: string; title: string; category: string },
  actor: HelpHubWriteActor | null,
): Promise<HelpHubTipRecord> {
  if (useHelpHubJsonStore()) {
    const tips = readHelpHubFile();
    const id = nextHelpHubId(tips);
    const row: HelpHubTipDocument = {
      ...body,
      id,
      slug: required.slug,
      status: required.status,
      title: required.title,
      category: required.category,
      sortOrder: nextHelpHubSortOrder(tips),
    };
    tips.push(row);
    writeHelpHubFile(tips);
    return row as HelpHubTipRecord;
  }
  const id = await nextHelpHubDatabaseId();
  const withOrder: HelpHubTipDocument = { ...body };
  if (withOrder.sortOrder == null) {
    const existing = await listHelpHubTipsForAdmin();
    withOrder.sortOrder = nextHelpHubSortOrder(existing);
  }
  return insertHelpHubTip(
    withOrder,
    { id, slug: required.slug, status: required.status, title: required.title, category: required.category },
    actor,
  );
}

export async function saveExistingHelpHubTip(
  id: number,
  body: HelpHubTipDocument,
  required: { slug: string; status: string; title: string; category: string },
  actor: HelpHubWriteActor | null,
): Promise<HelpHubTipRecord | null> {
  if (useHelpHubJsonStore()) {
    const tips = readHelpHubFile();
    const idx = tips.findIndex((row) => getTipId(row) === id);
    if (idx === -1) return null;
    const row: HelpHubTipDocument = {
      ...tips[idx],
      ...body,
      id,
      slug: required.slug,
      status: required.status,
      title: required.title,
      category: required.category,
    };
    tips[idx] = row;
    writeHelpHubFile(tips);
    return row as HelpHubTipRecord;
  }
  return updateHelpHubTip(id, body, required, actor);
}

export async function removeHelpHubTip(
  id: number,
  actor: HelpHubWriteActor | null,
): Promise<boolean> {
  if (useHelpHubJsonStore()) {
    const tips = readHelpHubFile();
    const next = tips.filter((row) => getTipId(row) !== id);
    if (next.length === tips.length) return false;
    writeHelpHubFile(next);
    return true;
  }
  const deleted = await softDeleteHelpHubTip(id, actor);
  return deleted != null;
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "23505";
}
