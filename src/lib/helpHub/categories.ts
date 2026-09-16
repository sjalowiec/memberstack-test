import helpHubCategories from "../../data/help-hub-categories.json";

export type HelpHubCategoryChoice = {
  id?: number;
  key: string;
  label: string;
};

/** Ordered admin/public category choices. Stored value is `key`; display is `label`. */
export function helpHubCategoryChoices(): HelpHubCategoryChoice[] {
  if (!Array.isArray(helpHubCategories)) return [];
  return helpHubCategories.reduce<HelpHubCategoryChoice[]>((acc, cat) => {
    const rec = cat as Record<string, unknown>;
    const key = typeof rec.key === "string" ? rec.key.trim() : "";
    if (!key) return acc;
    const label =
      typeof rec.label === "string" && rec.label.trim() !== "" ? rec.label.trim() : key;
    const id = typeof rec.id === "number" && Number.isFinite(rec.id) ? rec.id : undefined;
    acc.push(id != null ? { id, key, label } : { key, label });
    return acc;
  }, []);
}

export function helpHubCategoryLabel(key: string): string {
  const normalized = key.trim();
  if (!normalized) return "";
  const found = helpHubCategoryChoices().find((choice) => choice.key === normalized);
  return found?.label ?? normalized;
}

export function helpHubTipsInCategory<T extends { category?: unknown }>(
  tips: T[],
  categoryKey: string,
): T[] {
  const key = categoryKey.trim();
  if (!key) return [];
  return tips.filter((tip) => typeof tip.category === "string" && tip.category.trim() === key);
}
