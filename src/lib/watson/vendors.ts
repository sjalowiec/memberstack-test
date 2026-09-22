import { isValidEmailAddress } from "../email/validateEmailAddress";
import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";

export const VENDOR_COMPANY_NAME_MAX_LENGTH = 200;
export const VENDOR_CONTACT_NAME_MAX_LENGTH = 200;
export const VENDOR_EMAIL_MAX_LENGTH = 320;
export const VENDOR_PHONE_MAX_LENGTH = 50;
export const VENDOR_WEBSITE_MAX_LENGTH = 500;
export const VENDOR_TYPE_MAX_LENGTH = 100;
export const VENDOR_ADDRESS_MAX_LENGTH = 200;
export const VENDOR_CITY_MAX_LENGTH = 100;
export const VENDOR_STATE_MAX_LENGTH = 100;
export const VENDOR_POSTAL_CODE_MAX_LENGTH = 20;
export const VENDOR_COUNTRY_MAX_LENGTH = 100;
export const VENDOR_ACCOUNT_NUMBER_MAX_LENGTH = 100;
export const VENDOR_NOTES_MAX_LENGTH = 5_000;
export const VENDOR_ID_MAX_LENGTH = 64;

export const VENDOR_STATUS_FILTERS = ["active", "inactive", "all"] as const;
export type VendorStatusFilter = (typeof VENDOR_STATUS_FILTERS)[number];
export const VENDOR_DEFAULT_STATUS_FILTER: VendorStatusFilter = "active";

export type VendorValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface VendorRow {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  vendor_type: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  account_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string | null;
}

export interface VendorDisplay {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  vendorType: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  accountNumber: string | null;
  notes: string | null;
  isActive: boolean;
  statusLabel: "Active" | "Inactive";
  createdAt: string;
  createdAtSort: string;
  updatedAt: string | null;
  updatedAtSort: string;
  href: string;
  editHref: string;
}

export interface VendorFormValues {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  vendorType: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  accountNumber: string;
  notes: string;
  isActive: boolean;
}

export interface VendorWriteInput {
  companyName: unknown;
  contactName?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  vendorType?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  country?: unknown;
  accountNumber?: unknown;
  notes?: unknown;
  isActive?: unknown;
}

export interface ValidatedVendorWrite {
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  vendorType: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  accountNumber: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface VendorListQuery {
  q?: string;
  status?: string | null;
}

export const EMPTY_VENDOR_FORM: VendorFormValues = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  vendorType: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  accountNumber: "",
  notes: "",
  isActive: true,
};

export const VENDOR_SELECT_COLUMNS = `
  id,
  company_name,
  contact_name,
  email,
  phone,
  website,
  vendor_type,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  country,
  account_number,
  notes,
  is_active,
  created_at,
  updated_at
`;

export const VENDOR_BY_ID_SQL = `
  SELECT ${VENDOR_SELECT_COLUMNS}
  FROM watson_vendors
  WHERE id = $1
  LIMIT 1
`;

export const VENDOR_LIST_SQL = `
  SELECT ${VENDOR_SELECT_COLUMNS}
  FROM watson_vendors
  WHERE
    (
      $1::text = ''
      OR company_name ILIKE $2
      OR COALESCE(contact_name, '') ILIKE $2
      OR COALESCE(email, '') ILIKE $2
      OR COALESCE(phone, '') ILIKE $2
      OR COALESCE(vendor_type, '') ILIKE $2
      OR COALESCE(account_number, '') ILIKE $2
    )
    AND (
      $3::text = 'all'
      OR ($3 = 'active' AND is_active = TRUE)
      OR ($3 = 'inactive' AND is_active = FALSE)
    )
  ORDER BY LOWER(company_name) ASC, company_name ASC, id ASC
`;

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseVendorStatusFilter(value: string | null | undefined): VendorStatusFilter {
  if (value && (VENDOR_STATUS_FILTERS as readonly string[]).includes(value)) {
    return value as VendorStatusFilter;
  }
  return VENDOR_DEFAULT_STATUS_FILTER;
}

export function parseVendorIsActive(value: unknown, defaultValue = true): boolean {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (["1", "true", "on", "yes", "active"].includes(trimmed)) return true;
    if (["0", "false", "off", "no", "inactive"].includes(trimmed)) return false;
  }
  return defaultValue;
}

export function vendorFormValuesFromUnknown(input: Record<string, unknown>): VendorFormValues {
  return {
    companyName: typeof input.companyName === "string" ? input.companyName : "",
    contactName: typeof input.contactName === "string" ? input.contactName : "",
    email: typeof input.email === "string" ? input.email : "",
    phone: typeof input.phone === "string" ? input.phone : "",
    website: typeof input.website === "string" ? input.website : "",
    vendorType: typeof input.vendorType === "string" ? input.vendorType : "",
    addressLine1: typeof input.addressLine1 === "string" ? input.addressLine1 : "",
    addressLine2: typeof input.addressLine2 === "string" ? input.addressLine2 : "",
    city: typeof input.city === "string" ? input.city : "",
    state: typeof input.state === "string" ? input.state : "",
    postalCode: typeof input.postalCode === "string" ? input.postalCode : "",
    country: typeof input.country === "string" ? input.country : "",
    accountNumber: typeof input.accountNumber === "string" ? input.accountNumber : "",
    notes: typeof input.notes === "string" ? input.notes : "",
    isActive: parseVendorIsActive(input.isActive, true),
  };
}

export function vendorWriteInputFromFormData(form: FormData): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  const statusValues = form.getAll("isActive").filter((value) => typeof value === "string");
  if (statusValues.length > 0) {
    record.isActive = statusValues[statusValues.length - 1];
  }
  return record;
}

export function vendorFormValuesFromDisplay(vendor: VendorDisplay): VendorFormValues {
  return {
    companyName: vendor.companyName,
    contactName: vendor.contactName ?? "",
    email: vendor.email ?? "",
    phone: vendor.phone ?? "",
    website: vendor.website ?? "",
    vendorType: vendor.vendorType ?? "",
    addressLine1: vendor.addressLine1 ?? "",
    addressLine2: vendor.addressLine2 ?? "",
    city: vendor.city ?? "",
    state: vendor.state ?? "",
    postalCode: vendor.postalCode ?? "",
    country: vendor.country ?? "",
    accountNumber: vendor.accountNumber ?? "",
    notes: vendor.notes ?? "",
    isActive: vendor.isActive,
  };
}

export function validateVendorId(value: unknown): VendorValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Vendor ID is required." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Vendor ID is required." };
  }
  if (trimmed.length > VENDOR_ID_MAX_LENGTH) {
    return { ok: false, error: "Vendor ID is invalid." };
  }
  return { ok: true, value: trimmed };
}

function validateRequiredText(
  value: unknown,
  label: string,
  maxLength: number,
): VendorValidationResult<string> {
  const trimmed = asTrimmedString(value);
  if (!trimmed) {
    return { ok: false, error: `${label} is required.` };
  }
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${label} must be ${maxLength} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

function validateOptionalText(
  value: unknown,
  label: string,
  maxLength: number,
): VendorValidationResult<string | null> {
  if (value == null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${label} must be a string.` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${label} must be ${maxLength} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export function validateVendorEmail(value: unknown): VendorValidationResult<string | null> {
  const optional = validateOptionalText(value, "Email", VENDOR_EMAIL_MAX_LENGTH);
  if (!optional.ok) {
    return optional;
  }
  if (!optional.value) {
    return { ok: true, value: null };
  }
  if (!isValidEmailAddress(optional.value)) {
    return { ok: false, error: "Email must be a valid email address." };
  }
  return { ok: true, value: optional.value };
}

export function validateVendorWebsite(value: unknown): VendorValidationResult<string | null> {
  const optional = validateOptionalText(value, "Website", VENDOR_WEBSITE_MAX_LENGTH);
  if (!optional.ok) {
    return optional;
  }
  if (!optional.value) {
    return { ok: true, value: null };
  }

  const raw = optional.value;
  if (/[<>"']/.test(raw) || /javascript:/i.test(raw) || raw.startsWith("//")) {
    return { ok: false, error: "Website must be a valid URL (http:// or https://)." };
  }

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "Website must be a valid URL (http:// or https://)." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Website must be a valid URL (http:// or https://)." };
  }
  if (!url.hostname || !url.hostname.includes(".")) {
    return { ok: false, error: "Website must be a valid URL (http:// or https://)." };
  }

  return { ok: true, value: url.toString() };
}

export function validateVendorWriteInput(
  input: VendorWriteInput,
): VendorValidationResult<ValidatedVendorWrite> {
  const companyName = validateRequiredText(
    input.companyName,
    "Company name",
    VENDOR_COMPANY_NAME_MAX_LENGTH,
  );
  if (!companyName.ok) return companyName;

  const contactName = validateOptionalText(
    input.contactName,
    "Contact name",
    VENDOR_CONTACT_NAME_MAX_LENGTH,
  );
  if (!contactName.ok) return contactName;

  const email = validateVendorEmail(input.email);
  if (!email.ok) return email;

  const phone = validateOptionalText(input.phone, "Phone", VENDOR_PHONE_MAX_LENGTH);
  if (!phone.ok) return phone;

  const website = validateVendorWebsite(input.website);
  if (!website.ok) return website;

  const vendorType = validateOptionalText(
    input.vendorType,
    "Vendor type/category",
    VENDOR_TYPE_MAX_LENGTH,
  );
  if (!vendorType.ok) return vendorType;

  const addressLine1 = validateOptionalText(
    input.addressLine1,
    "Address line 1",
    VENDOR_ADDRESS_MAX_LENGTH,
  );
  if (!addressLine1.ok) return addressLine1;

  const addressLine2 = validateOptionalText(
    input.addressLine2,
    "Address line 2",
    VENDOR_ADDRESS_MAX_LENGTH,
  );
  if (!addressLine2.ok) return addressLine2;

  const city = validateOptionalText(input.city, "City", VENDOR_CITY_MAX_LENGTH);
  if (!city.ok) return city;

  const state = validateOptionalText(input.state, "State/province", VENDOR_STATE_MAX_LENGTH);
  if (!state.ok) return state;

  const postalCode = validateOptionalText(
    input.postalCode,
    "Postal code",
    VENDOR_POSTAL_CODE_MAX_LENGTH,
  );
  if (!postalCode.ok) return postalCode;

  const country = validateOptionalText(input.country, "Country", VENDOR_COUNTRY_MAX_LENGTH);
  if (!country.ok) return country;

  const accountNumber = validateOptionalText(
    input.accountNumber,
    "Account number",
    VENDOR_ACCOUNT_NUMBER_MAX_LENGTH,
  );
  if (!accountNumber.ok) return accountNumber;

  const notes = validateOptionalText(input.notes, "Notes", VENDOR_NOTES_MAX_LENGTH);
  if (!notes.ok) return notes;

  return {
    ok: true,
    value: {
      companyName: companyName.value,
      contactName: contactName.value,
      email: email.value,
      phone: phone.value,
      website: website.value,
      vendorType: vendorType.value,
      addressLine1: addressLine1.value,
      addressLine2: addressLine2.value,
      city: city.value,
      state: state.value,
      postalCode: postalCode.value,
      country: country.value,
      accountNumber: accountNumber.value,
      notes: notes.value,
      isActive: parseVendorIsActive(input.isActive, true),
    },
  };
}

function toTimestampSort(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

export function formatVendorTimestamp(value: Date | string | null | undefined): string | null {
  const sort = toTimestampSort(value);
  if (!sort) {
    return null;
  }
  return new Date(sort).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildVendorHref(id: string): string {
  return `/watson/vendors/${encodeURIComponent(id)}`;
}

export function buildVendorEditHref(id: string): string {
  return `/watson/vendors/${encodeURIComponent(id)}/edit`;
}

export function buildVendorDisplay(row: VendorRow): VendorDisplay {
  const isActive = row.is_active === true;
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    website: row.website,
    vendorType: row.vendor_type,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    accountNumber: row.account_number,
    notes: row.notes,
    isActive,
    statusLabel: isActive ? "Active" : "Inactive",
    createdAt: formatVendorTimestamp(row.created_at) ?? "",
    createdAtSort: toTimestampSort(row.created_at),
    updatedAt: formatVendorTimestamp(row.updated_at),
    updatedAtSort: toTimestampSort(row.updated_at),
    href: buildVendorHref(row.id),
    editHref: buildVendorEditHref(row.id),
  };
}

export function buildVendorOverviewFields(
  vendor: VendorDisplay,
): Array<{ label: string; value: string }> {
  return [
    { label: "Vendor ID", value: vendor.id },
    { label: "Company name", value: vendor.companyName },
    { label: "Contact name", value: vendor.contactName ?? "" },
    { label: "Vendor type/category", value: vendor.vendorType ?? "" },
    { label: "Email", value: vendor.email ?? "" },
    { label: "Phone", value: vendor.phone ?? "" },
    { label: "Website", value: vendor.website ?? "" },
    { label: "Address line 1", value: vendor.addressLine1 ?? "" },
    { label: "Address line 2", value: vendor.addressLine2 ?? "" },
    { label: "City", value: vendor.city ?? "" },
    { label: "State/province", value: vendor.state ?? "" },
    { label: "Postal code", value: vendor.postalCode ?? "" },
    { label: "Country", value: vendor.country ?? "" },
    { label: "Account number", value: vendor.accountNumber ?? "" },
    { label: "Status", value: vendor.statusLabel },
    { label: "Notes", value: vendor.notes ?? "" },
    { label: "Created", value: vendor.createdAt },
    { label: "Updated", value: vendor.updatedAt ?? "" },
  ].filter((field) => {
    if (field.label === "Company name" || field.label === "Vendor ID" || field.label === "Status") {
      return true;
    }
    return Boolean(field.value);
  });
}

function writeParams(value: ValidatedVendorWrite): unknown[] {
  return [
    value.companyName,
    value.contactName,
    value.email,
    value.phone,
    value.website,
    value.vendorType,
    value.addressLine1,
    value.addressLine2,
    value.city,
    value.state,
    value.postalCode,
    value.country,
    value.accountNumber,
    value.notes,
    value.isActive,
  ];
}

export async function listVendors(
  query: VendorListQuery = {},
  queryFn: WatsonQueryFn = queryWatson,
): Promise<VendorDisplay[]> {
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const status = parseVendorStatusFilter(query.status);
  const pattern = q ? `%${q}%` : "";
  const rows = await queryFn<VendorRow>(VENDOR_LIST_SQL, [q, pattern, status]);
  return rows.map(buildVendorDisplay);
}

export async function getVendorById(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<VendorDisplay | null> {
  const validated = validateVendorId(id);
  if (!validated.ok) {
    return null;
  }
  const rows = await queryFn<VendorRow>(VENDOR_BY_ID_SQL, [validated.value]);
  const row = rows[0];
  return row ? buildVendorDisplay(row) : null;
}

export async function createVendor(
  input: VendorWriteInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<VendorValidationResult<VendorDisplay>> {
  const validated = validateVendorWriteInput(input);
  if (!validated.ok) {
    return validated;
  }

  const rows = await queryFn<VendorRow>(
    `
      INSERT INTO watson_vendors (
        company_name,
        contact_name,
        email,
        phone,
        website,
        vendor_type,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        account_number,
        notes,
        is_active,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, NOW()
      )
      RETURNING ${VENDOR_SELECT_COLUMNS}
    `,
    writeParams(validated.value),
  );

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Unable to create vendor." };
  }
  return { ok: true, value: buildVendorDisplay(row) };
}

export async function updateVendor(
  id: string,
  input: VendorWriteInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<VendorValidationResult<VendorDisplay>> {
  const validatedId = validateVendorId(id);
  if (!validatedId.ok) {
    return validatedId;
  }

  const validated = validateVendorWriteInput(input);
  if (!validated.ok) {
    return validated;
  }

  const rows = await queryFn<VendorRow>(
    `
      UPDATE watson_vendors
      SET
        company_name = $2,
        contact_name = $3,
        email = $4,
        phone = $5,
        website = $6,
        vendor_type = $7,
        address_line1 = $8,
        address_line2 = $9,
        city = $10,
        state = $11,
        postal_code = $12,
        country = $13,
        account_number = $14,
        notes = $15,
        is_active = $16,
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${VENDOR_SELECT_COLUMNS}
    `,
    [validatedId.value, ...writeParams(validated.value)],
  );

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Vendor not found." };
  }
  return { ok: true, value: buildVendorDisplay(row) };
}
