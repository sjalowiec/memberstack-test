/**
 * Searchable brand and model choices on the Getting Started Guide.
 * Selections stay in the page and are not saved.
 */

import {
  brandOptions,
  BRAND_UNSURE_ID,
  isRealBrandId,
  matchingIdentityOption,
  modelOptions,
  normalizeIdentityQuery,
  parseMachineIdentityCatalog,
  reduceComboKey,
  shouldClearModelOnBrandChange,
  visibleIdentityOptions,
  type IdentityOption,
  type MachineIdentityCatalog,
} from "../lib/gettingStarted/machineIdentity";

type FieldName = "brand" | "model";

type FieldUi = {
  name: FieldName;
  root: HTMLElement;
  input: HTMLInputElement;
  toggle: HTMLButtonElement;
  list: HTMLUListElement;
  empty: HTMLElement;
  open: boolean;
  activeIndex: number;
  selectedId: string;
  options: IdentityOption[];
};

function readCatalog(doc: Document): MachineIdentityCatalog | null {
  const node = doc.getElementById("getting-started-machine-catalog");
  if (!node?.textContent) return null;
  try {
    return parseMachineIdentityCatalog(JSON.parse(node.textContent));
  } catch {
    return null;
  }
}

function selectedOption(field: FieldUi): IdentityOption | null {
  return field.options.find((option) => option.id === field.selectedId) ?? null;
}

function visibleOptions(field: FieldUi): IdentityOption[] {
  return visibleIdentityOptions(
    field.options,
    field.input.value,
    selectedOption(field)?.label ?? "",
  );
}

function revealOption(list: HTMLElement, option: HTMLElement): void {
  const top = option.offsetTop;
  const bottom = top + option.offsetHeight;
  if (top < list.scrollTop) {
    list.scrollTop = top;
  } else if (bottom > list.scrollTop + list.clientHeight) {
    list.scrollTop = bottom - list.clientHeight;
  }
}

export function initGettingStartedMachineIdentity(
  doc: Document = document,
): void {
  const root = doc.querySelector<HTMLElement>("[data-gsg-machine-identity]");
  const catalog = readCatalog(doc);
  if (!root || !catalog) return;

  const status = root.querySelector<HTMLElement>("[data-gsg-status]");
  const brand = bindField(root, "brand");
  const model = bindField(root, "model");
  if (!brand || !model) return;

  brand.options = brandOptions(catalog);
  applyModelAvailability("");

  function announce(message: string): void {
    if (!status) return;
    status.textContent = "";
    status.textContent = message;
  }

  function listNoun(field: FieldUi): string {
    return field.name === "brand" ? "brands" : "models";
  }

  function paint(field: FieldUi): void {
    const options = field.open ? visibleOptions(field) : [];
    field.list.replaceChildren();
    options.forEach((option, index) => {
      const item = doc.createElement("li");
      item.id = `${field.input.id}-opt-${index}`;
      item.className = "gsg-combo__option";
      item.setAttribute("role", "option");
      item.dataset.optionId = option.id;
      item.textContent = option.label;
      item.setAttribute("aria-selected", option.id === field.selectedId ? "true" : "false");
      if (index === field.activeIndex) item.classList.add("is-active");
      field.list.append(item);
    });

    const showEmpty = field.open && options.length === 0;
    field.list.hidden = !field.open || showEmpty;
    field.empty.hidden = !showEmpty;
    field.input.setAttribute("aria-expanded", field.open ? "true" : "false");
    field.toggle.setAttribute("aria-expanded", field.open ? "true" : "false");
    field.toggle.setAttribute(
      "aria-label",
      `${field.open ? "Hide" : "Show"} ${listNoun(field)}`,
    );

    const active =
      field.open && field.activeIndex >= 0
        ? field.list.querySelector<HTMLElement>(".is-active")
        : null;
    if (active?.id) field.input.setAttribute("aria-activedescendant", active.id);
    else field.input.removeAttribute("aria-activedescendant");

    field.root.dataset.selectedId = field.selectedId;
    if (active) revealOption(field.list, active);
  }

  function applyModelAvailability(brandId: string): void {
    model.options = modelOptions(catalog, brandId);
    const enabled = isRealBrandId(brandId);
    model.input.disabled = !enabled;
    model.toggle.disabled = !enabled;
    model.input.placeholder = enabled
      ? "Search models"
      : brandId === BRAND_UNSURE_ID
        ? "You can continue without a model"
        : "Choose a brand first";
    model.input.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function clearModel(): void {
    model.selectedId = "";
    model.input.value = "";
    model.open = false;
    model.activeIndex = -1;
    applyModelAvailability(brand.selectedId);
    paint(model);
  }

  function setBrandId(nextBrandId: string): void {
    const previous = brand.selectedId;
    brand.selectedId = nextBrandId;
    if (shouldClearModelOnBrandChange(previous, nextBrandId)) clearModel();
  }

  function close(field: FieldUi): void {
    field.open = false;
    field.activeIndex = -1;
    paint(field);
  }

  function commit(field: FieldUi, optionId: string): void {
    const option = field.options.find((item) => item.id === optionId);
    if (!option) return;
    if (field.name === "brand") setBrandId(option.id);
    else field.selectedId = option.id;
    field.input.value = option.label;
    close(field);
    announce(`${option.label} selected.`);
  }

  function revertText(field: FieldUi): void {
    const selected = selectedOption(field);
    field.input.value = selected?.label ?? "";
    close(field);
  }

  function commitTypedValue(field: FieldUi): void {
    const match = matchingIdentityOption(field.options, field.input.value);
    if (match) {
      commit(field, match.id);
      return;
    }
    if (!field.input.value.trim()) {
      if (field.name === "brand") setBrandId("");
      else field.selectedId = "";
      field.input.value = "";
      close(field);
      return;
    }
    revertText(field);
  }

  function openField(field: FieldUi, activeIndex: number): void {
    if (field.input.disabled) return;
    field.open = true;
    const count = visibleOptions(field).length;
    field.activeIndex = count === 0 ? -1 : Math.max(0, Math.min(activeIndex, count - 1));
    paint(field);
    if (count === 0) announce(`No matching ${listNoun(field)}.`);
  }

  function onInput(field: FieldUi): void {
    const selected = selectedOption(field);
    const unchanged =
      selected != null &&
      normalizeIdentityQuery(field.input.value) === normalizeIdentityQuery(selected.label);
    if (!unchanged && field.selectedId) {
      if (field.name === "brand") setBrandId("");
      else field.selectedId = "";
    }
    openField(field, 0);
  }

  function onKeyDown(field: FieldUi, event: KeyboardEvent): void {
    const options = visibleOptions(field);
    const selectedIndex = options.findIndex((option) => option.id === field.selectedId);
    const next = reduceComboKey({
      key: event.key,
      altKey: event.altKey,
      open: field.open,
      activeIndex: field.activeIndex,
      optionCount: options.length,
      selectedIndex,
    });
    const handled = next.commit || next.revert || next.open !== field.open || next.activeIndex !== field.activeIndex;
    if (!handled && event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End" && event.key !== "Escape" && event.key !== "Enter") {
      return;
    }
    if (event.key === "Enter" && !field.open) return;
    if ((event.key === "Home" || event.key === "End") && !field.open) return;
    if (event.key === "Escape" && !field.open) return;

    event.preventDefault();
    if (next.commit) {
      const option = options[next.activeIndex];
      if (option) commit(field, option.id);
      return;
    }
    if (next.revert) {
      revertText(field);
      return;
    }
    field.open = next.open;
    field.activeIndex = next.activeIndex;
    paint(field);
  }

  function bind(field: FieldUi): void {
    field.input.addEventListener("input", () => onInput(field));
    field.input.addEventListener("keydown", (event) => onKeyDown(field, event));
    field.input.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (field.root.contains(doc.activeElement)) return;
        if (!field.open && selectedOption(field)?.label === field.input.value) return;
        commitTypedValue(field);
      }, 0);
    });
    field.input.addEventListener("focus", () => {
      field.input.select();
    });

    field.toggle.addEventListener("mousedown", (event) => event.preventDefault());
    field.toggle.addEventListener("click", () => {
      if (field.input.disabled) return;
      field.input.focus();
      if (field.open) close(field);
      else {
        const options = visibleOptions(field);
        const selectedIndex = options.findIndex((option) => option.id === field.selectedId);
        openField(field, selectedIndex >= 0 ? selectedIndex : 0);
      }
    });

    field.list.addEventListener("mousedown", (event) => event.preventDefault());
    field.list.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const item = target.closest<HTMLElement>("[data-option-id]");
      const optionId = item?.dataset.optionId;
      if (optionId) commit(field, optionId);
    });
  }

  bind(brand);
  bind(model);
  paint(brand);
  paint(model);

  doc.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    for (const field of [brand, model]) {
      if (!field.root.contains(target) && field.open) commitTypedValue(field);
    }
  });
}

function bindField(root: HTMLElement, name: FieldName): FieldUi | null {
  const fieldRoot = root.querySelector<HTMLElement>(`[data-gsg-combo="${name}"]`);
  const input = fieldRoot?.querySelector<HTMLInputElement>("[data-gsg-input]");
  const toggle = fieldRoot?.querySelector<HTMLButtonElement>("[data-gsg-toggle]");
  const list = fieldRoot?.querySelector<HTMLUListElement>("[data-gsg-list]");
  const empty = fieldRoot?.querySelector<HTMLElement>("[data-gsg-empty]");
  if (!fieldRoot || !input || !toggle || !list || !empty) return null;
  return {
    name,
    root: fieldRoot,
    input,
    toggle,
    list,
    empty,
    open: false,
    activeIndex: -1,
    selectedId: "",
    options: [],
  };
}
