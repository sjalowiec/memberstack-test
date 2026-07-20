/**
 * Shared client-side logic for the admin machine list tables.
 *
 * Used by both the full Machine Database list (`/admin/machines`) and the
 * For-Sale inventory view (`/admin/machines/for-sale`) so table rendering,
 * inline quick-edit (For sale / Status / Price), search, sort, and the
 * save-to-API pattern stay in one place instead of being duplicated per page.
 *
 * State (the `machines` array, editing/search state) stays in each page; this
 * module provides the stateless building blocks and the shared save path.
 */
import {
  asString,
  machineId,
  normalizeProductType,
  normalizeSale,
  numberOrNull,
  normalizeExpectedDate,
  SALE_STATUSES,
  SALE_STATUS_LABELS,
  SHOP_PRODUCT_TYPE_LABELS,
  MACHINE_AVAILABILITY_STATUSES,
  AVAILABILITY_STATUS_LABELS,
  type MachineRecord,
  type MachineSaleStatus,
  type MachineAvailabilityStatus,
} from "./machineAdminFields";

export const API_BASE = "/api/admin/machines";

/** Partial sale edit applied by the inline quick-edit controls. */
export type SalePatch = {
  forSale?: boolean;
  status?: MachineSaleStatus;
  price?: number | null;
  availabilityStatus?: MachineAvailabilityStatus;
  expectedDate?: string | null;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function cell(value: string): string {
  const v = value.trim();
  return `<td>${v ? escapeHtml(v) : "?"}</td>`;
}

/** Case-insensitive substring match across the visible + technique fields. */
export function matchesQuery(m: MachineRecord, q: string, techList: string[] = []): boolean {
  if (!q) return true;
  const productType = normalizeProductType(m.productType);
  const id = machineId(m);
  const haystack = [
    asString(m.brand),
    asString(m.model),
    asString(m.gauge),
    asString(m.machineStyle),
    asString(m.punchcardWidth),
    asString(m.year),
    id != null ? String(id) : "",
    productType,
    SHOP_PRODUCT_TYPE_LABELS[productType],
    techList.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.indexOf(q) !== -1;
}

/** Stable sort by brand, then model (numeric-aware). */
export function sortMachines(list: MachineRecord[]): MachineRecord[] {
  return list.slice().sort((a, b) => {
    const byBrand = asString(a.brand).localeCompare(asString(b.brand), undefined, {
      sensitivity: "base",
    });
    if (byBrand !== 0) return byBrand;
    return asString(a.model).localeCompare(asString(b.model), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

type QuickSale = ReturnType<typeof normalizeSale>;

/** For-sale checkbox cell. */
function forSaleCell(id: number | null, sale: QuickSale, disabled: string): string {
  const forSale = sale?.forSale ?? false;
  return `<td class="am__num am__quick">
      <input type="checkbox" class="am__quick-check" data-quick="forSale" data-qid="${id ?? ""}"${
    forSale ? " checked" : ""
  }${disabled} aria-label="For sale" />
    </td>`;
}

/** Legacy sale-status dropdown cell (main list only). */
function saleStatusCell(id: number | null, sale: QuickSale, disabled: string): string {
  const status = sale?.status ?? "available";
  const options = SALE_STATUSES.map(
    (s) =>
      `<option value="${s}"${s === status ? " selected" : ""}>${escapeHtml(
        SALE_STATUS_LABELS[s]
      )}</option>`
  ).join("");
  return `<td class="am__quick">
      <select class="am__quick-select" data-quick="status" data-qid="${id ?? ""}"${disabled} aria-label="Sale status">
        ${options}
      </select>
    </td>`;
}

/** Price input cell. */
function priceCell(id: number | null, sale: QuickSale, disabled: string): string {
  const price = sale?.price != null ? String(sale.price) : "";
  return `<td class="am__quick">
      <input type="number" class="am__quick-price" data-quick="price" data-qid="${id ?? ""}" step="0.01" min="0" value="${escapeHtml(
    price
  )}" placeholder="&#8212;"${disabled} aria-label="Price (USD)" />
    </td>`;
}

/** Availability-status dropdown cell. */
function availabilityCell(id: number | null, sale: QuickSale, disabled: string): string {
  const availability = sale?.availabilityStatus ?? "available";
  const options = MACHINE_AVAILABILITY_STATUSES.map(
    (s) =>
      `<option value="${s}"${s === availability ? " selected" : ""}>${escapeHtml(
        AVAILABILITY_STATUS_LABELS[s]
      )}</option>`
  ).join("");
  return `<td class="am__quick">
      <select class="am__quick-select" data-quick="availabilityStatus" data-qid="${id ?? ""}"${disabled} aria-label="Availability">
        ${options}
      </select>
    </td>`;
}

/** Expected-date input cell. */
function expectedDateCell(id: number | null, sale: QuickSale, disabled: string): string {
  const expectedDate = sale?.expectedDate ?? "";
  return `<td class="am__quick">
      <input type="date" class="am__quick-date" data-quick="expectedDate" data-qid="${id ?? ""}" value="${escapeHtml(
    expectedDate
  )}"${disabled} aria-label="Expected date" />
    </td>`;
}

/**
 * Full quick-edit cell group for the main admin list, in column order:
 * For sale / Status / Price / Availability / Expected date.
 */
export function quickCellsHtml(id: number | null, m: MachineRecord): string {
  const disabled = id === null ? " disabled" : "";
  const sale = normalizeSale(m.sale);
  return [
    forSaleCell(id, sale, disabled),
    saleStatusCell(id, sale, disabled),
    priceCell(id, sale, disabled),
    availabilityCell(id, sale, disabled),
    expectedDateCell(id, sale, disabled),
  ].join("\n    ");
}

/**
 * Render one table row. Columns match on both admin list pages; the action cell
 * content differs (an inline "View / Edit" button on the main list vs. a link on
 * the for-sale page), so it's supplied by the caller.
 */
export function machineRowHtml(
  m: MachineRecord,
  opts: { activeId: number | null; techCount: number; actionHtml: string }
): string {
  const id = machineId(m);
  const active = id !== null && id === opts.activeId ? " is-active" : "";
  return `<tr class="am__row${active}" data-id="${id ?? ""}">
    ${cell(asString(m.brand))}
    ${cell(asString(m.model))}
    ${cell(asString(m.gauge))}
    ${cell(asString(m.machineStyle))}
    ${cell(asString(m.punchcardWidth))}
    ${cell(asString(m.year))}
    <td class="am__num">${countOf(m.images)}</td>
    <td class="am__num">${countOf(m.manuals)}</td>
    <td class="am__num">${countOf(m.accessories)}</td>
    <td class="am__num">${opts.techCount}</td>
    ${quickCellsHtml(id, m)}
    <td class="am__row-action">
      ${opts.actionHtml}
      <span class="am__qfeedback" data-qfeedback="${id ?? ""}" aria-live="polite"></span>
    </td>
  </tr>`;
}

/**
 * Compact full-catalog row for /admin/machines ? every product (for sale or not)
 * so any record can be opened for edit.
 */
export function machineCatalogRowHtml(
  m: MachineRecord,
  opts: { activeId: number | null; actionHtml: string }
): string {
  const id = machineId(m);
  const active = id !== null && id === opts.activeId ? " is-active" : "";
  const productType = normalizeProductType(m.productType);
  const forSale = normalizeSale(m.sale)?.forSale === true;
  return `<tr class="am__row${active}" data-id="${id ?? ""}" data-product-type="${productType}">
    ${cell(asString(m.brand))}
    ${cell(asString(m.model))}
    ${cell(SHOP_PRODUCT_TYPE_LABELS[productType])}
    <td>${forSale ? "Yes" : "?"}</td>
    <td class="am__num">${id ?? "?"}</td>
    <td class="am__row-action">${opts.actionHtml}</td>
  </tr>`;
}

/**
 * Compact inventory row for /admin/machines/for-sale ? only the columns needed
 * to manage stock: Brand, Model, Sale, Status (availability), Expected date,
 * Price, Actions. Reuses the same quick-edit cell builders and save wiring, so
 * the reference/catalog columns from the main list are simply omitted here.
 */
export function machineForSaleRowHtml(m: MachineRecord, opts: { actionHtml: string }): string {
  const id = machineId(m);
  const disabled = id === null ? " disabled" : "";
  const sale = normalizeSale(m.sale);
  const productType = normalizeProductType(m.productType);
  return `<tr class="am__row" data-id="${id ?? ""}" data-product-type="${productType}">
    ${cell(asString(m.brand))}
    ${cell(asString(m.model))}
    ${cell(SHOP_PRODUCT_TYPE_LABELS[productType])}
    ${forSaleCell(id, sale, disabled)}
    ${availabilityCell(id, sale, disabled)}
    ${expectedDateCell(id, sale, disabled)}
    ${priceCell(id, sale, disabled)}
    <td class="am__row-action">
      ${opts.actionHtml}
      <span class="am__qfeedback" data-qfeedback="${id ?? ""}" aria-live="polite"></span>
    </td>
  </tr>`;
}

/** Build the for-sale "View / Edit" href for a record (exact machineId only). */
export function machineEditHref(id: number | null): string {
  return id === null ? "/admin/machines" : `/admin/machines?edit=${id}`;
}

/** Show transient per-row save feedback next to the row's action button. */
export function setQuickFeedback(
  tbody: HTMLElement | null,
  id: number,
  message: string,
  kind: "ok" | "err" | "neutral"
): void {
  const el = tbody?.querySelector(`[data-qfeedback="${id}"]`);
  if (!(el instanceof HTMLElement)) return;
  el.textContent = message;
  el.classList.toggle("is-error", kind === "err");
  el.classList.toggle("is-ok", kind === "ok");
  if (kind === "ok") {
    window.setTimeout(() => {
      if (el.textContent === message) {
        el.textContent = "";
        el.classList.remove("is-ok");
      }
    }, 2500);
  }
}

export type PersistMachineOpts = {
  machine: MachineRecord;
  expectedMachineId: number;
  mode: "edit" | "new";
  routeMachineId?: number | null;
};

/** POST a single-record create/update; resolve with the saved list or throw. */
export async function persistMachine(opts: PersistMachineOpts): Promise<MachineRecord[]> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok || !Array.isArray(data.machines)) {
    throw new Error(data?.error || `Save failed (${res.status})`);
  }
  return data.machines as MachineRecord[];
}

/**
 * Apply a quick-edit sale patch to one record by exact machineId and save.
 * Only the sale fields exposed inline are touched; all other sale data on
 * the record is preserved. Returns the authoritative list from the server.
 */
export async function quickSaveSale(
  machines: MachineRecord[],
  id: number,
  patch: SalePatch
): Promise<MachineRecord[]> {
  const idx = machines.findIndex((m) => machineId(m) === id);
  if (idx < 0) throw new Error("Machine not found; reload the page.");

  const current = JSON.parse(JSON.stringify(machines[idx])) as MachineRecord;
  const existing = normalizeSale(current.sale);
  const merged = {
    forSale: patch.forSale ?? existing?.forSale ?? false,
    featured: existing?.featured ?? false,
    status: patch.status ?? existing?.status ?? "available",
    availabilityStatus:
      patch.availabilityStatus ?? existing?.availabilityStatus ?? "available",
    expectedDate:
      patch.expectedDate !== undefined ? patch.expectedDate : existing?.expectedDate ?? null,
    price: patch.price !== undefined ? patch.price : existing?.price ?? null,
    stripePaymentLink: existing?.stripePaymentLink ?? null,
    shortDescriptionHtml: existing?.shortDescriptionHtml ?? null,
    longDescriptionHtml: existing?.longDescriptionHtml ?? null,
    shippingNotes: existing?.shippingNotes ?? null,
  };
  const nextSale = normalizeSale(merged);
  if (nextSale === null) delete current.sale;
  else current.sale = nextSale;

  return persistMachine({
    machine: current,
    expectedMachineId: id,
    mode: "edit",
    routeMachineId: id,
  });
}

/** Read a quick-edit control's patch from a change event target, or null. */
export function readQuickPatch(target: EventTarget | null): { id: number; patch: SalePatch } | null {
  if (!(target instanceof HTMLElement)) return null;
  const field = target.getAttribute("data-quick");
  if (!field) return null;
  const id = Number.parseInt(target.getAttribute("data-qid") || "", 10);
  if (!Number.isFinite(id)) return null;

  if (field === "forSale" && target instanceof HTMLInputElement) {
    return { id, patch: { forSale: target.checked } };
  }
  if (field === "status" && target instanceof HTMLSelectElement) {
    return { id, patch: { status: target.value as MachineSaleStatus } };
  }
  if (field === "price" && target instanceof HTMLInputElement) {
    return { id, patch: { price: numberOrNull(target.value) } };
  }
  if (field === "availabilityStatus" && target instanceof HTMLSelectElement) {
    return { id, patch: { availabilityStatus: target.value as MachineAvailabilityStatus } };
  }
  if (field === "expectedDate" && target instanceof HTMLInputElement) {
    return { id, patch: { expectedDate: normalizeExpectedDate(target.value) } };
  }
  return null;
}
