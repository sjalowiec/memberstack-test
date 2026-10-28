/**
 * Brand and model choices for the Getting Started Guide.
 *
 * Models come from the Machine Library catalog (`data/machines.json` via
 * `getAllMachines`). A model is shown only for the brand stored on that
 * machine. Cross-brand aliases (the same machine sold under another name)
 * live on the Machines Around the World page, not in this catalog.
 *
 * Choices stay in the page. Nothing here is written to ActiveCampaign.
 */

export const BRAND_UNSURE_ID = "unsure";
export const MODEL_UNLISTED_ID = "unlisted";

export const BRAND_UNSURE_LABEL = "I’m not sure";
export const MODEL_UNLISTED_LABEL = "My model isn’t listed / I’m not sure";

export type IdentityOption = {
  id: string;
  label: string;
};

export type MachineIdentitySource = {
  brand: string;
  model: string;
  slug: string;
  productType: string;
};

export type MachineIdentityCatalog = {
  brands: IdentityOption[];
  modelsByBrandId: Record<string, IdentityOption[]>;
};

function compareLabels(a: IdentityOption, b: IdentityOption): number {
  return a.label.localeCompare(b.label, "en", {
    numeric: true,
    sensitivity: "base",
  });
}

/** Machines only, grouped by the brand stored on each record. */
export function buildMachineIdentityCatalog(
  machines: MachineIdentitySource[],
): MachineIdentityCatalog {
  const modelsByBrandId: Record<string, IdentityOption[]> = {};

  for (const machine of machines) {
    if (machine.productType !== "machine") continue;
    const brand = machine.brand.trim();
    const model = machine.model.trim();
    const slug = machine.slug.trim();
    if (!brand || !model || !slug) continue;

    const list = modelsByBrandId[brand] ?? [];
    if (!list.some((option) => option.id === slug)) {
      list.push({ id: slug, label: model });
    }
    modelsByBrandId[brand] = list;
  }

  for (const brand of Object.keys(modelsByBrandId)) {
    modelsByBrandId[brand].sort(compareLabels);
  }

  const brands = Object.keys(modelsByBrandId)
    .map((brand) => ({ id: brand, label: brand }))
    .sort(compareLabels);

  return { brands, modelsByBrandId };
}

export function isIdentityOption(value: unknown): value is IdentityOption {
  if (!value || typeof value !== "object") return false;
  const option = value as { id?: unknown; label?: unknown };
  return typeof option.id === "string" && option.id.trim() !== "" && typeof option.label === "string" && option.label.trim() !== "";
}

export function parseMachineIdentityCatalog(value: unknown): MachineIdentityCatalog | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { brands?: unknown; modelsByBrandId?: unknown };
  if (!Array.isArray(record.brands)) return null;
  if (!record.modelsByBrandId || typeof record.modelsByBrandId !== "object") return null;

  const brands = record.brands.filter(isIdentityOption);
  if (brands.length !== record.brands.length) return null;

  const modelsByBrandId: Record<string, IdentityOption[]> = {};
  for (const [brandId, models] of Object.entries(record.modelsByBrandId)) {
    if (!Array.isArray(models) || !models.every(isIdentityOption)) return null;
    modelsByBrandId[brandId] = models;
  }

  return { brands, modelsByBrandId };
}

/** Real brands, with the explicit unknown choice first. */
export function brandOptions(catalog: MachineIdentityCatalog): IdentityOption[] {
  return [{ id: BRAND_UNSURE_ID, label: BRAND_UNSURE_LABEL }, ...catalog.brands];
}

/**
 * Models for one brand, plus the unlisted choice.
 * Empty until a real brand is selected, including when the visitor chooses
 * “I’m not sure”.
 */
export function modelOptions(
  catalog: MachineIdentityCatalog,
  brandId: string,
): IdentityOption[] {
  if (!isRealBrandId(brandId)) return [];
  const models = catalog.modelsByBrandId[brandId] ?? [];
  return [{ id: MODEL_UNLISTED_ID, label: MODEL_UNLISTED_LABEL }, ...models];
}

export function isRealBrandId(brandId: string): boolean {
  return brandId.trim() !== "" && brandId !== BRAND_UNSURE_ID;
}

/** A different brand always drops the previous model. */
export function shouldClearModelOnBrandChange(
  previousBrandId: string,
  nextBrandId: string,
): boolean {
  return previousBrandId !== nextBrandId;
}

export function normalizeIdentityQuery(value: string): string {
  return value.trim().toLowerCase().replace(/[’‘ʼ]/g, "'");
}

export function filterIdentityOptions(
  options: IdentityOption[],
  query: string,
): IdentityOption[] {
  const q = normalizeIdentityQuery(query);
  if (!q) return options.slice();
  return options.filter((option) => normalizeIdentityQuery(option.label).includes(q));
}

/**
 * Show the full list when the field still displays the committed label,
 * so opening the list does not hide every other choice.
 */
export function visibleIdentityOptions(
  options: IdentityOption[],
  query: string,
  selectedLabel: string,
): IdentityOption[] {
  const q = normalizeIdentityQuery(query);
  const selected = normalizeIdentityQuery(selectedLabel);
  if (!q || (selected !== "" && q === selected)) return options.slice();
  return filterIdentityOptions(options, query);
}

/** Unique case-insensitive label match, used when focus leaves the field. */
export function matchingIdentityOption(
  options: IdentityOption[],
  query: string,
): IdentityOption | null {
  const q = normalizeIdentityQuery(query);
  if (!q) return null;
  const exact = options.filter((option) => normalizeIdentityQuery(option.label) === q);
  return exact.length === 1 ? exact[0] : null;
}

export type ComboKeyResult = {
  open: boolean;
  activeIndex: number;
  commit: boolean;
  revert: boolean;
};

export function reduceComboKey(args: {
  key: string;
  altKey?: boolean;
  open: boolean;
  activeIndex: number;
  optionCount: number;
  selectedIndex: number;
}): ComboKeyResult {
  const { key, open, activeIndex, optionCount, selectedIndex } = args;
  const stay: ComboKeyResult = { open, activeIndex, commit: false, revert: false };

  if (key === "Escape") {
    if (!open) return { open: false, activeIndex: -1, commit: false, revert: false };
    return { open: false, activeIndex: -1, commit: false, revert: true };
  }

  if (key === "Enter") {
    if (open && activeIndex >= 0 && activeIndex < optionCount) {
      return { open: false, activeIndex, commit: true, revert: false };
    }
    return stay;
  }

  if (key === "Home" && open) {
    return {
      open: true,
      activeIndex: optionCount > 0 ? 0 : -1,
      commit: false,
      revert: false,
    };
  }

  if (key === "End" && open) {
    return {
      open: true,
      activeIndex: optionCount > 0 ? optionCount - 1 : -1,
      commit: false,
      revert: false,
    };
  }

  if (key === "ArrowDown" || key === "ArrowUp") {
    if (optionCount <= 0) {
      return { open: true, activeIndex: -1, commit: false, revert: false };
    }
    if (!open || args.altKey) {
      const start =
        selectedIndex >= 0
          ? selectedIndex
          : key === "ArrowUp"
            ? optionCount - 1
            : 0;
      return {
        open: true,
        activeIndex: Math.max(0, Math.min(start, optionCount - 1)),
        commit: false,
        revert: false,
      };
    }
    const next =
      activeIndex < 0
        ? key === "ArrowDown"
          ? 0
          : optionCount - 1
        : activeIndex + (key === "ArrowDown" ? 1 : -1);
    return {
      open: true,
      activeIndex: Math.max(0, Math.min(next, optionCount - 1)),
      commit: false,
      revert: false,
    };
  }

  return stay;
}
