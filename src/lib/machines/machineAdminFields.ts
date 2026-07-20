/**
 * Machine Database admin — shared record schema, parsing, and normalization.
 *
 * Used by both the admin page (`/admin/machines`) and the save API
 * (`/api/admin/machines`) so the client preview and the authoritative
 * server-side write stay in sync.
 *
 * The legacy catalog lives in `data/machines.json`. Records are keyed by the
 * stable numeric `machineId`. Array fields use small object shapes:
 *   - images:      { url, isMain }
 *   - accessories: { model, title, category }
 *   - manuals:     { title, type, url }
 *
 * Unknown top-level fields already present on a record are preserved on save;
 * only the known fields below are coerced.
 */

export type MachineImage = { url: string; isMain: boolean };
export type MachineAccessory = { model: string; title: string; category: string };
export type MachineManual = { title: string; type: string; url: string };

/**
 * Shop catalog classification for for-sale records.
 * Missing / unknown values normalize to `"machine"` for backward compatibility.
 */
export type ShopProductType = "machine" | "accessory";

export const SHOP_PRODUCT_TYPES: ShopProductType[] = ["machine", "accessory"];

export const SHOP_PRODUCT_TYPE_LABELS: Record<ShopProductType, string> = {
  machine: "Machine",
  accessory: "Accessory",
};

/** Sales status shown on the shop page. */
export type MachineSaleStatus = "available" | "sold-out" | "coming-soon" | "inquiry-only";

/**
 * Inventory availability, controlling the public availability badge and whether
 * online checkout is offered. Separate from the legacy `status` field above so
 * it can drive Buy vs. Contact behavior independently.
 */
export type MachineAvailabilityStatus = "available" | "backorder" | "unavailable";

/**
 * Optional per-machine sales data. Attached to a machine record only when a
 * machine is being (or has been) listed for sale. Absent on the vast majority
 * of reference-only records.
 */
export type MachineSale = {
  forSale: boolean;
  price: number | null;
  stripePaymentLink: string | null;
  status: MachineSaleStatus;
  /** Inventory availability driving the public badge + Buy/Contact behavior. */
  availabilityStatus: MachineAvailabilityStatus;
  /** Optional expected arrival date (ISO `YYYY-MM-DD`) for backordered stock. */
  expectedDate: string | null;
  /** Trusted admin-authored HTML for shop cards/listings. */
  shortDescriptionHtml: string | null;
  /** Trusted admin-authored HTML for the machine detail page. */
  longDescriptionHtml: string | null;
  shippingNotes: string | null;
  featured: boolean;
};

export const SALE_STATUSES: MachineSaleStatus[] = [
  "available",
  "sold-out",
  "coming-soon",
  "inquiry-only",
];

export const SALE_STATUS_LABELS: Record<MachineSaleStatus, string> = {
  available: "Available",
  "sold-out": "Sold Out",
  "coming-soon": "Coming Soon",
  "inquiry-only": "Inquiry Only",
};

export const MACHINE_AVAILABILITY_STATUSES: MachineAvailabilityStatus[] = [
  "available",
  "backorder",
  "unavailable",
];

export const AVAILABILITY_STATUS_LABELS: Record<MachineAvailabilityStatus, string> = {
  available: "Available",
  backorder: "Backorder",
  unavailable: "Unavailable",
};

/** A machine record. Unknown keys are preserved through normalization. */
export type MachineRecord = Record<string, unknown>;

export type NormalizeResult =
  | { ok: true; machine: MachineRecord }
  | { ok: false; error: string };

export function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isNaN(value)) return "";
  return String(value);
}

/** Coerce to a known shop product type; anything else (including missing) → machine. */
export function normalizeProductType(value: unknown): ShopProductType {
  return asString(value).trim().toLowerCase() === "accessory" ? "accessory" : "machine";
}

/** Coerce a form/string/number value to a finite number or null. */
export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/** Coerce to a trimmed string, or null when empty. */
export function stringOrNull(value: unknown): string | null {
  const s = asString(value).trim();
  return s === "" ? null : s;
}

export function machineId(machine: MachineRecord): number | null {
  return numberOrNull(machine.machineId);
}

/** Next available machineId: one past the current maximum (min 1). */
export function nextMachineId(machines: MachineRecord[]): number {
  let max = 0;
  for (const m of machines) {
    const id = machineId(m);
    if (id !== null && id > max) max = id;
  }
  return max + 1;
}

/** Normalized lowercase "brand|model" key used to detect duplicates. */
export function brandModelKey(machine: MachineRecord): string {
  return `${asString(machine.brand).trim().toLowerCase()}|${asString(machine.model)
    .trim()
    .toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Array fields: line-based textarea (de)serialization.
// ---------------------------------------------------------------------------

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Images textarea: one image per line.
 *   url
 *   url | main      ← marks isMain = true
 */
export function parseImages(text: string): MachineImage[] {
  return splitLines(text)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const url = parts[0] ?? "";
      const isMain = parts.slice(1).some((p) => p.toLowerCase() === "main");
      return { url, isMain };
    })
    .filter((img) => img.url.length > 0);
}

export function serializeImages(value: unknown): string {
  return normalizeImages(value)
    .map((img) => (img.isMain ? `${img.url} | main` : img.url))
    .join("\n");
}

export function normalizeImages(value: unknown): MachineImage[] {
  if (!Array.isArray(value)) return [];
  const out: MachineImage[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const url = item.trim();
      if (url) out.push({ url, isMain: false });
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const url = asString(rec.url).trim();
      if (url) out.push({ url, isMain: rec.isMain === true });
    }
  }
  return out;
}

/**
 * Accessories textarea: one per line.
 *   model | title | category
 */
export function parseAccessories(text: string): MachineAccessory[] {
  return splitLines(text)
    .map((line) => {
      const [model = "", title = "", category = ""] = line.split("|").map((p) => p.trim());
      return { model, title, category };
    })
    .filter((a) => a.model || a.title || a.category);
}

export function serializeAccessories(value: unknown): string {
  return normalizeAccessories(value)
    .map((a) => [a.model, a.title, a.category].join(" | "))
    .join("\n");
}

export function normalizeAccessories(value: unknown): MachineAccessory[] {
  if (!Array.isArray(value)) return [];
  const out: MachineAccessory[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const model = asString(rec.model).trim();
    const title = asString(rec.title).trim();
    const category = asString(rec.category).trim();
    if (model || title || category) out.push({ model, title, category });
  }
  return out;
}

/**
 * Manuals textarea: one per line.
 *   title | type | url
 */
export function parseManuals(text: string): MachineManual[] {
  return splitLines(text)
    .map((line) => {
      const [title = "", type = "", url = ""] = line.split("|").map((p) => p.trim());
      return { title, type, url };
    })
    .filter((m) => m.title || m.type || m.url);
}

export function serializeManuals(value: unknown): string {
  return normalizeManuals(value)
    .map((m) => [m.title, m.type, m.url].join(" | "))
    .join("\n");
}

export function normalizeManuals(value: unknown): MachineManual[] {
  if (!Array.isArray(value)) return [];
  const out: MachineManual[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const title = asString(rec.title).trim();
    const type = asString(rec.type).trim();
    const url = asString(rec.url).trim();
    if (title || type || url) out.push({ title, type, url });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ordering Information defaults (auto-filled for new machines by brand).
// ---------------------------------------------------------------------------

/**
 * Per-brand shipping carrier. The default Ordering Information template is
 * identical across brands except for the carrier line, so brands map to a
 * carrier here and the shared template is built once below.
 */
const ORDERING_INFO_CARRIERS: Record<string, string> = {
  "silver reed": "UPS Ground",
  titexma: "FedEx",
};

/**
 * Default "Ordering Information" HTML for a machine's brand, used to auto-fill
 * the admin field when creating a new machine. Returns `null` for brands
 * without a template so callers can leave the field untouched.
 */
export function defaultOrderingInfoHtml(brand: unknown): string | null {
  const carrier = ORDERING_INFO_CARRIERS[asString(brand).trim().toLowerCase()];
  if (!carrier) return null;
  return [
    "<h2>Ordering Information</h2>",
    "",
    "<ul>",
    `  <li>Ships via ${carrier}.</li>`,
    "  <li>Shipping is available within the United States only.</li>",
    "  <li>All knitting machine sales are final. We do not accept returns or exchanges on knitting machines.</li>",
    '  <li>Includes a 90-day manufacturer\'s warranty. See our <a href="/warranty">Warranty Policy</a> for complete details.</li>',
    "  <li>Your machine will be carefully packed, and tracking information will be provided when your order ships.</li>",
    "</ul>",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Sales data (optional per-machine block).
// ---------------------------------------------------------------------------

/** Coerce an arbitrary value to a known sale status, defaulting to "available". */
export function normalizeSaleStatus(value: unknown): MachineSaleStatus {
  const s = asString(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
  return (SALE_STATUSES as string[]).includes(s) ? (s as MachineSaleStatus) : "available";
}

/** Coerce a value to a known availability status, defaulting to "available". */
export function normalizeAvailabilityStatus(value: unknown): MachineAvailabilityStatus {
  const s = asString(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
  return (MACHINE_AVAILABILITY_STATUSES as string[]).includes(s)
    ? (s as MachineAvailabilityStatus)
    : "available";
}

/**
 * Normalize an expected-arrival date to ISO `YYYY-MM-DD`, or `null` when blank
 * or unparseable. `<input type="date">` already emits ISO; other inputs are
 * coerced via Date parsing.
 */
export function normalizeExpectedDate(value: unknown): string | null {
  const s = asString(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Friendly display for an expected date, e.g. "September 1" (the year is added
 * only when it differs from the current year). Returns `null` for blank/invalid.
 */
export function formatExpectedDate(value: string | null | undefined): string | null {
  const iso = normalizeExpectedDate(value);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((p) => Number.parseInt(p, 10));
  const month = MONTH_NAMES[m - 1];
  if (!month) return null;
  const base = `${month} ${d}`;
  return y === new Date().getFullYear() ? base : `${base}, ${y}`;
}

/** Public availability badge text per the inventory rules. */
export function availabilityLabel(
  sale: Pick<MachineSale, "availabilityStatus" | "expectedDate">
): string {
  if (sale.availabilityStatus === "backorder") {
    const when = formatExpectedDate(sale.expectedDate);
    return when ? `Expected Ship Date ${when}` : "Backorder";
  }
  if (sale.availabilityStatus === "unavailable") return "Unavailable";
  return "Available";
}

/** Required prefix for Stripe Payment Links pasted into admin. */
export const STRIPE_PAYMENT_LINK_PREFIX = "https://buy.stripe.com/";

/**
 * Whether online checkout is offered: status is Available and a Stripe Payment
 * Link is set. Availability status / expectedDate do not block checkout.
 * Matches the admin Sales intro and the live checkout status summary.
 */
export function canCheckout(
  sale: Pick<MachineSale, "stripePaymentLink" | "status">
): boolean {
  return getCheckoutInactiveReason(sale) === null;
}

/**
 * Exact reason checkout is inactive, or `null` when checkout is active.
 * Check order matches admin copy:
 *   1. Stripe Payment Link missing
 *   2. status must be Available
 */
export function getCheckoutInactiveReason(
  sale: Pick<MachineSale, "stripePaymentLink" | "status">
): string | null {
  if (!stringOrNull(sale.stripePaymentLink)) {
    return "Stripe Payment Link is missing";
  }
  if (normalizeSaleStatus(sale.status) !== "available") {
    return "status must be Available";
  }
  return null;
}

/** "Checkout active: Yes" or "Checkout active: No — <reason>". */
export function formatCheckoutActiveLine(
  sale: Pick<MachineSale, "stripePaymentLink" | "status">
): string {
  const reason = getCheckoutInactiveReason(sale);
  return reason === null
    ? "Checkout active: Yes"
    : `Checkout active: No \u2014 ${reason}`;
}

export type StripePaymentLinkValidation =
  | { ok: true; link: string | null }
  | { ok: false; error: string };

/**
 * Validate a Stripe Payment Link before save.
 * Empty is allowed (checkout simply stays inactive). Truncated `...` links and
 * non-buy.stripe.com URLs are rejected.
 */
export function validateStripePaymentLink(value: unknown): StripePaymentLinkValidation {
  const link = stringOrNull(value);
  if (link === null) return { ok: true, link: null };
  if (link.includes("...")) {
    return {
      ok: false,
      error:
        'Stripe Payment Link looks truncated (contains "..."). Paste the full link from Stripe.',
    };
  }
  if (!link.startsWith(STRIPE_PAYMENT_LINK_PREFIX)) {
    return {
      ok: false,
      error: `Stripe Payment Link must begin with ${STRIPE_PAYMENT_LINK_PREFIX}`,
    };
  }
  return { ok: true, link };
}

/** Full stored Stripe Payment Link for display — never truncated or replaced. */
export function displayStripePaymentLink(value: unknown): string {
  const link = stringOrNull(value);
  return link ?? "(none)";
}

export type SaleCheckoutSummaryInput = {
  machineId: number | null;
  brand: string;
  model: string;
  productType: ShopProductType | string;
  status: MachineSaleStatus | string;
  availabilityStatus: MachineAvailabilityStatus | string;
  expectedDate?: string | null;
  stripePaymentLink: string | null | undefined;
};

export type SaleCheckoutSummary = {
  productId: string;
  productName: string;
  productType: string;
  status: string;
  availability: string;
  /** Complete stored Stripe Payment Link (or "(none)"). Never truncated. */
  stripePaymentLink: string;
  checkoutActive: boolean;
  checkoutActiveLine: string;
  inactiveReason: string | null;
};

/** Live read-only status summary for the Sales admin section. */
export function buildSaleCheckoutSummary(input: SaleCheckoutSummaryInput): SaleCheckoutSummary {
  const status = normalizeSaleStatus(input.status);
  const availabilityStatus = normalizeAvailabilityStatus(input.availabilityStatus);
  const stripePaymentLink = stringOrNull(input.stripePaymentLink);
  const sale = { stripePaymentLink, status };
  const inactiveReason = getCheckoutInactiveReason(sale);
  const productType = normalizeProductType(input.productType);

  return {
    productId: input.machineId === null ? "(none)" : String(input.machineId),
    productName: `${asString(input.brand).trim()} ${asString(input.model).trim()}`.trim() || "(unnamed)",
    productType: SHOP_PRODUCT_TYPE_LABELS[productType],
    status: SALE_STATUS_LABELS[status],
    availability: availabilityLabel({
      availabilityStatus,
      expectedDate: input.expectedDate ?? null,
    }),
    stripePaymentLink: displayStripePaymentLink(stripePaymentLink),
    checkoutActive: inactiveReason === null,
    checkoutActiveLine: formatCheckoutActiveLine(sale),
    inactiveReason,
  };
}

/** Prominent editing-id label shown while a record is open in the form. */
export function formatEditingMachineIdLabel(
  id: number | null,
  mode: "edit" | "new" | "none" = "edit"
): string {
  if (id === null) return "";
  if (mode === "new") return `Creating machineId: ${id}`;
  return `Editing machineId: ${id}`;
}

export type SaleAdminWarningInput = {
  forSale: boolean;
  productType: ShopProductType | string;
  featured: boolean;
  stripePaymentLink: string | null | undefined;
  status: MachineSaleStatus | string;
};

/** Non-blocking warnings to confirm before save. */
export function getSaleAdminWarnings(input: SaleAdminWarningInput): string[] {
  const warnings: string[] = [];
  const sale = {
    stripePaymentLink: stringOrNull(input.stripePaymentLink),
    status: normalizeSaleStatus(input.status),
  };
  if (input.forSale) {
    const reason = getCheckoutInactiveReason(sale);
    if (reason !== null) {
      warnings.push(
        `For Sale is checked but checkout will not be active (${reason}).`
      );
    }
  }
  if (normalizeProductType(input.productType) === "accessory" && input.featured) {
    warnings.push(
      "Product type is Accessory but Feature on /shop/machines is checked."
    );
  }
  return warnings;
}

/**
 * Normalize a machine's optional `sale` block. Returns `null` when the block is
 * effectively empty (not for sale and no data entered) so callers can omit the
 * field entirely rather than storing an all-default object.
 *
 * Invalid numeric input (e.g. NaN, blank) is normalized to `null` for `price`.
 */
export function normalizeSale(value: unknown): MachineSale | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;

  // One-time migration: the legacy plain-text `sale.description` field has been
  // retired in favor of the two HTML fields. If a record still carries it and
  // the Short Description is empty, adopt it once as the short blurb. The
  // `description` key is intentionally dropped from the output below.
  const legacyDescription = stringOrNull(rec.description);
  const shortDescriptionHtml = stringOrNull(rec.shortDescriptionHtml) ?? legacyDescription;

  const sale: MachineSale = {
    forSale: rec.forSale === true,
    price: numberOrNull(rec.price),
    stripePaymentLink: stringOrNull(rec.stripePaymentLink),
    status: normalizeSaleStatus(rec.status),
    availabilityStatus: normalizeAvailabilityStatus(rec.availabilityStatus),
    expectedDate: normalizeExpectedDate(rec.expectedDate),
    shortDescriptionHtml,
    longDescriptionHtml: stringOrNull(rec.longDescriptionHtml),
    shippingNotes: stringOrNull(rec.shippingNotes),
    featured: rec.featured === true,
  };

  const isEmpty =
    !sale.forSale &&
    sale.price === null &&
    sale.stripePaymentLink === null &&
    sale.shortDescriptionHtml === null &&
    sale.longDescriptionHtml === null &&
    sale.shippingNotes === null &&
    !sale.featured &&
    sale.status === "available" &&
    sale.availabilityStatus === "available" &&
    sale.expectedDate === null;

  return isEmpty ? null : sale;
}

// ---------------------------------------------------------------------------
// Record normalization (authoritative shape written to disk).
// ---------------------------------------------------------------------------

/**
 * Normalize one record for saving. Preserves unknown top-level fields, coerces
 * the known fields, and normalizes the three array fields.
 *
 * Requires a numeric `machineId` (the integrity key for in-place updates) and a
 * non-empty `brand`. `model` is coerced but not required here: a few legacy
 * "brand-only" records have no model, and the bulk write must preserve them.
 * The per-record brand + model requirement is enforced where a record is
 * created or edited (the admin page), not on every record in the array.
 */
export function normalizeMachineForSave(
  input: unknown,
  index: number
): NormalizeResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: `Machine #${index + 1} is not a valid object.` };
  }

  // Preserve unknown fields by starting from a shallow copy.
  const out: MachineRecord = { ...(input as MachineRecord) };

  const id = numberOrNull(out.machineId);
  if (id === null) {
    return { ok: false, error: `Machine #${index + 1} is missing a numeric machineId.` };
  }

  const brand = asString(out.brand).trim();
  if (!brand) return { ok: false, error: `Machine #${index + 1} (machineId ${id}): brand is required.` };
  const model = asString(out.model).trim();

  out.machineId = id;
  out.brand = brand;
  out.model = model;
  out.productType = normalizeProductType(out.productType);
  out.bed = stringOrNull(out.bed);
  out.gauge = stringOrNull(out.gauge);
  out.needleCount = numberOrNull(out.needleCount);
  out.machineStyle = stringOrNull(out.machineStyle);
  out.punchcardWidth = numberOrNull(out.punchcardWidth);
  out.year = numberOrNull(out.year);

  // `notes` is reserved/optional: keep it only when present and non-empty.
  const notes = stringOrNull(out.notes);
  if (notes === null) delete out.notes;
  else out.notes = notes;

  out.images = normalizeImages(out.images);
  out.accessories = normalizeAccessories(out.accessories);
  out.manuals = normalizeManuals(out.manuals);

  // `sale` is optional: keep it only when meaningful data is present.
  const sale = normalizeSale(out.sale);
  if (sale === null) delete out.sale;
  else out.sale = sale;

  return { ok: true, machine: out };
}
