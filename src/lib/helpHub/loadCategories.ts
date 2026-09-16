import {
  HELP_HUB_CATEGORIES_JSON_PATH,
  readHelpHubFile,
  writeHelpHubFile,
} from "../helpHubAdminFile";
import { readFileSync, writeFileSync } from "node:fs";
import {
  helpHubCategoriesToJsonSeed,
  helpHubCategoryUsageCounts,
  helpHubJsonSeedCategories,
  parseHelpHubCategoryRecords,
} from "./categories";
import {
  createHelpHubCategory,
  deleteHelpHubCategory,
  HelpHubCategoryError,
  mergeSeededHelpHubCategories,
  renameHelpHubCategory,
  reorderHelpHubCategories,
  restoreHelpHubCategory,
  retireHelpHubCategory,
} from "./categoryManage";
import {
  ensureHelpHubCategoriesSeeded,
  insertHelpHubCategoryRow,
  isMissingHelpHubCategoryTable,
  reassignHelpHubTipCategoryKey,
  replaceHelpHubCategoryRows,
  updateHelpHubCategoryRow,
} from "./categoryStore";
import { activeHelpHubCategories, type HelpHubManagedCategory } from "./categoryTypes";
import { loadHelpHubTipsForAdmin } from "./loadTips";
import { useHelpHubJsonStore } from "./storeMode";
import type { HelpHubWriteActor } from "./types";

export type HelpHubCategoryAdminRow = HelpHubManagedCategory & { usageCount: number };

function readHelpHubCategoriesFile(): HelpHubManagedCategory[] {
  const raw = readFileSync(HELP_HUB_CATEGORIES_JSON_PATH, "utf-8");
  return parseHelpHubCategoryRecords(JSON.parse(raw));
}

function writeHelpHubCategoriesFile(categories: HelpHubManagedCategory[]): void {
  writeFileSync(
    HELP_HUB_CATEGORIES_JSON_PATH,
    `${JSON.stringify(helpHubCategoriesToJsonSeed(categories), null, 2)}\n`,
    "utf-8",
  );
}

function withUsage(
  categories: HelpHubManagedCategory[],
  tips: { category?: unknown }[],
): HelpHubCategoryAdminRow[] {
  const counts = helpHubCategoryUsageCounts(tips);
  return categories.map((category) => ({
    ...category,
    usageCount: counts[category.key] ?? 0,
  }));
}

async function loadJsonCategories(): Promise<HelpHubManagedCategory[]> {
  try {
    return mergeSeededHelpHubCategories(readHelpHubCategoriesFile(), helpHubJsonSeedCategories());
  } catch {
    return helpHubJsonSeedCategories();
  }
}

export async function loadManagedHelpHubCategories(): Promise<HelpHubManagedCategory[]> {
  if (useHelpHubJsonStore()) {
    return loadJsonCategories();
  }
  try {
    return await ensureHelpHubCategoriesSeeded();
  } catch (error) {
    if (isMissingHelpHubCategoryTable(error)) return helpHubJsonSeedCategories();
    throw error;
  }
}

export async function loadPublicHelpHubCategories(): Promise<HelpHubManagedCategory[]> {
  const categories = await loadManagedHelpHubCategories();
  return activeHelpHubCategories(categories);
}

export async function loadHelpHubCategoriesForAdmin(): Promise<HelpHubCategoryAdminRow[]> {
  const [categories, tips] = await Promise.all([
    loadManagedHelpHubCategories(),
    loadHelpHubTipsForAdmin(),
  ]);
  return withUsage(categories, tips);
}

export async function createManagedHelpHubCategory(
  label: string,
  actor: HelpHubWriteActor | null,
): Promise<{ categories: HelpHubCategoryAdminRow[]; created: HelpHubManagedCategory }> {
  const current = await loadManagedHelpHubCategories();
  const { categories, created } = createHelpHubCategory(current, { label });
  if (useHelpHubJsonStore()) {
    writeHelpHubCategoriesFile(categories);
  } else {
    await insertHelpHubCategoryRow(created, actor);
  }
  return { categories: await loadHelpHubCategoriesForAdmin(), created };
}

export async function renameManagedHelpHubCategory(
  id: number,
  label: string,
  actor: HelpHubWriteActor | null,
): Promise<HelpHubCategoryAdminRow[]> {
  const current = await loadManagedHelpHubCategories();
  const next = renameHelpHubCategory(current, id, label);
  const renamed = next.find((category) => category.id === id);
  if (!renamed) throw new HelpHubCategoryError("NOT_FOUND", `No category with id ${id}.`);
  if (useHelpHubJsonStore()) {
    writeHelpHubCategoriesFile(next);
  } else {
    await updateHelpHubCategoryRow(renamed, actor);
  }
  return loadHelpHubCategoriesForAdmin();
}

export async function reorderManagedHelpHubCategories(
  orderedIds: number[],
  actor: HelpHubWriteActor | null,
): Promise<HelpHubCategoryAdminRow[]> {
  const current = await loadManagedHelpHubCategories();
  const next = reorderHelpHubCategories(current, orderedIds);
  if (useHelpHubJsonStore()) {
    writeHelpHubCategoriesFile(next);
  } else {
    await replaceHelpHubCategoryRows(next, actor);
  }
  return loadHelpHubCategoriesForAdmin();
}

export async function deleteManagedHelpHubCategory(
  id: number,
  actor: HelpHubWriteActor | null,
): Promise<HelpHubCategoryAdminRow[]> {
  const [current, tips] = await Promise.all([
    loadManagedHelpHubCategories(),
    loadHelpHubTipsForAdmin(),
  ]);
  const next = deleteHelpHubCategory(current, tips, id);
  const retired = next.find((category) => category.id === id);
  if (!retired) throw new HelpHubCategoryError("NOT_FOUND", `No category with id ${id}.`);
  if (useHelpHubJsonStore()) {
    writeHelpHubCategoriesFile(next);
  } else {
    await updateHelpHubCategoryRow(retired, actor);
  }
  return loadHelpHubCategoriesForAdmin();
}

export async function restoreManagedHelpHubCategory(
  id: number,
  actor: HelpHubWriteActor | null,
): Promise<HelpHubCategoryAdminRow[]> {
  const current = await loadManagedHelpHubCategories();
  const next = restoreHelpHubCategory(current, id);
  const restored = next.find((category) => category.id === id);
  if (!restored) throw new HelpHubCategoryError("NOT_FOUND", `No category with id ${id}.`);
  if (useHelpHubJsonStore()) {
    writeHelpHubCategoriesFile(next);
  } else {
    await updateHelpHubCategoryRow(restored, actor);
  }
  return loadHelpHubCategoriesForAdmin();
}

export async function retireManagedHelpHubCategory(
  id: number,
  input: { replacementKey?: string; confirm?: boolean },
  actor: HelpHubWriteActor | null,
): Promise<{ categories: HelpHubCategoryAdminRow[]; reassigned: number }> {
  const [current, tips] = await Promise.all([
    loadManagedHelpHubCategories(),
    loadHelpHubTipsForAdmin(),
  ]);
  const result = retireHelpHubCategory(current, tips, {
    id,
    replacementKey: input.replacementKey,
    confirm: input.confirm,
  });
  if (useHelpHubJsonStore()) {
    writeHelpHubCategoriesFile(result.categories);
    if (result.reassigned > 0) {
      const from = current.find((category) => category.id === id)?.key ?? "";
      const rows = readHelpHubFile().map((row) => {
        if (typeof row.category === "string" && row.category.trim() === from) {
          return { ...row, category: input.replacementKey?.trim() };
        }
        return row;
      });
      writeHelpHubFile(rows);
    }
  } else {
    if (result.reassigned > 0 && input.replacementKey) {
      const from = current.find((category) => category.id === id)?.key ?? "";
      await reassignHelpHubTipCategoryKey(from, input.replacementKey.trim(), actor);
    }
    await updateHelpHubCategoryRow(result.retired, actor);
  }
  return { categories: await loadHelpHubCategoriesForAdmin(), reassigned: result.reassigned };
}
