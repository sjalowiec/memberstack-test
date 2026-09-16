export type HelpHubManagedCategory = {
  id: number;
  key: string;
  label: string;
  sortOrder: number;
  retiredAt: string | null;
};

export type HelpHubCategoryChoice = {
  id?: number;
  key: string;
  label: string;
};

export const HELP_HUB_RETIRED_LOOK_RIGHT_KEY = "knitting-doesnt-look-right";
export const HELP_HUB_SOMETHING_NOT_WORKING_KEY = "machine-not-working";
export const HELP_HUB_LK150_KEY = "lk150";

export class HelpHubCategoryError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "HelpHubCategoryError";
    this.code = code;
  }
}

export function sortHelpHubManagedCategories(
  categories: HelpHubManagedCategory[],
): HelpHubManagedCategory[] {
  return [...categories].sort((a, b) => {
    const order = a.sortOrder - b.sortOrder;
    if (order !== 0) return order;
    return a.id - b.id;
  });
}

export function isHelpHubCategoryRetired(category: HelpHubManagedCategory): boolean {
  return typeof category.retiredAt === "string" && category.retiredAt.trim() !== "";
}

export function activeHelpHubCategories(
  categories: HelpHubManagedCategory[],
): HelpHubManagedCategory[] {
  return sortHelpHubManagedCategories(categories).filter((category) => !isHelpHubCategoryRetired(category));
}

export function helpHubCategoryChoice(category: HelpHubManagedCategory): HelpHubCategoryChoice {
  return { id: category.id, key: category.key, label: category.label };
}
