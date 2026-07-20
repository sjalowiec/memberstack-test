/**
 * Netlify Blobs store for handwritten birthday-card status.
 *
 * Status is year-specific for the birthday occurrence year shown in the calendar
 * (e.g. Dec 2026 and Jan 2027 are separate). ActiveCampaign email status is unrelated.
 *
 * Store: birthday-cards
 * Key:  cards/{birthdayYear}/{memberId}.json
 */

import { getStore, type Store } from "@netlify/blobs";

export const BIRTHDAY_CARDS_BLOB_STORE = "birthday-cards";
export const BIRTHDAY_CARDS_KEY_PREFIX = "cards/";

export const BIRTHDAY_CARD_STATUSES = ["not_sent", "sent"] as const;
export type BirthdayCardStatus = (typeof BIRTHDAY_CARD_STATUSES)[number];

export type BirthdayCardStatusRecord = {
  memberId: string;
  birthdayYear: number;
  status: BirthdayCardStatus;
  sentAt: string | null;
  updatedAt: string;
};

type BlobStoreLike = Pick<Store, "get" | "setJSON" | "list" | "delete">;

export class BirthdayCardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BirthdayCardValidationError";
  }
}

export function isBirthdayCardStatus(value: unknown): value is BirthdayCardStatus {
  return (
    typeof value === "string" &&
    (BIRTHDAY_CARD_STATUSES as readonly string[]).includes(value)
  );
}

export function sanitizeKeySegment(segment: string): string {
  return String(segment)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

export function isValidBirthdayYear(year: unknown): year is number {
  return (
    typeof year === "number" &&
    Number.isInteger(year) &&
    year >= 1970 &&
    year <= 2100
  );
}

export function parseBirthdayYear(value: unknown): number | null {
  if (typeof value === "number" && isValidBirthdayYear(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) {
    const year = Number.parseInt(value.trim(), 10);
    return isValidBirthdayYear(year) ? year : null;
  }
  return null;
}

export function birthdayCardBlobKey(memberId: string, birthdayYear: number): string {
  if (!isValidBirthdayYear(birthdayYear)) {
    throw new BirthdayCardValidationError("Birthday year is invalid.");
  }
  const id = sanitizeKeySegment(memberId);
  if (!id) {
    throw new BirthdayCardValidationError("Member ID is required.");
  }
  return `${BIRTHDAY_CARDS_KEY_PREFIX}${birthdayYear}/${id}.json`;
}

export function birthdayCardYearPrefix(birthdayYear: number): string {
  if (!isValidBirthdayYear(birthdayYear)) {
    throw new BirthdayCardValidationError("Birthday year is invalid.");
  }
  return `${BIRTHDAY_CARDS_KEY_PREFIX}${birthdayYear}/`;
}

export function getBirthdayCardsStore(): Store {
  return getStore({
    name: BIRTHDAY_CARDS_BLOB_STORE,
    consistency: "strong",
  });
}

export function normalizeBirthdayCardStatusRecord(
  raw: unknown,
): BirthdayCardStatusRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const memberId = typeof row.memberId === "string" ? row.memberId.trim() : "";
  const birthdayYear = parseBirthdayYear(row.birthdayYear);
  const status = isBirthdayCardStatus(row.status) ? row.status : null;
  const updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : "";
  if (!memberId || birthdayYear == null || !status || !updatedAt) {
    return null;
  }

  const sentAt =
    typeof row.sentAt === "string" && row.sentAt.trim() ? row.sentAt : null;

  return {
    memberId,
    birthdayYear,
    status,
    sentAt: status === "sent" ? sentAt : null,
    updatedAt,
  };
}

export function buildBirthdayCardStatusRecord(input: {
  memberId: string;
  birthdayYear: number;
  status: BirthdayCardStatus;
  sentAt?: string | null;
  updatedAt?: string;
  now?: string;
}): BirthdayCardStatusRecord {
  const memberId = String(input.memberId || "").trim();
  if (!memberId) {
    throw new BirthdayCardValidationError("Member ID is required.");
  }
  if (!isValidBirthdayYear(input.birthdayYear)) {
    throw new BirthdayCardValidationError("Birthday year is invalid.");
  }
  if (!isBirthdayCardStatus(input.status)) {
    throw new BirthdayCardValidationError("Card status is invalid.");
  }

  const now = input.now ?? new Date().toISOString();
  const sentAt =
    input.status === "sent"
      ? input.sentAt?.trim() || now
      : null;

  return {
    memberId,
    birthdayYear: input.birthdayYear,
    status: input.status,
    sentAt,
    updatedAt: input.updatedAt ?? now,
  };
}

export async function getBirthdayCardStatus(
  store: BlobStoreLike,
  memberId: string,
  birthdayYear: number,
): Promise<BirthdayCardStatusRecord | null> {
  const key = birthdayCardBlobKey(memberId, birthdayYear);
  try {
    const raw = await store.get(key, { type: "json" });
    return normalizeBirthdayCardStatusRecord(raw);
  } catch {
    return null;
  }
}

export async function listBirthdayCardStatusesForYear(
  store: BlobStoreLike,
  birthdayYear: number,
): Promise<BirthdayCardStatusRecord[]> {
  const prefix = birthdayCardYearPrefix(birthdayYear);
  const listed = await store.list({ prefix });
  const keys = (listed?.blobs ?? []).map((blob) => blob.key).filter(Boolean);

  const records: BirthdayCardStatusRecord[] = [];
  for (const key of keys) {
    try {
      const raw = await store.get(key, { type: "json" });
      const record = normalizeBirthdayCardStatusRecord(raw);
      if (record && record.birthdayYear === birthdayYear) {
        records.push(record);
      }
    } catch {
      // skip unreadable blobs
    }
  }

  records.sort((a, b) => {
    const byMember = a.memberId.localeCompare(b.memberId);
    if (byMember !== 0) return byMember;
    return a.birthdayYear - b.birthdayYear;
  });

  return records;
}

export async function setBirthdayCardStatus(
  store: BlobStoreLike,
  input: {
    memberId: string;
    birthdayYear: number;
    status: BirthdayCardStatus;
    now?: string;
  },
): Promise<BirthdayCardStatusRecord> {
  const existing = await getBirthdayCardStatus(store, input.memberId, input.birthdayYear);
  const now = input.now ?? new Date().toISOString();
  const key = birthdayCardBlobKey(input.memberId, input.birthdayYear);

  if (input.status === "not_sent") {
    const record = buildBirthdayCardStatusRecord({
      memberId: input.memberId,
      birthdayYear: input.birthdayYear,
      status: "not_sent",
      sentAt: null,
      now,
    });
    await store.delete(key);
    return record;
  }

  const record = buildBirthdayCardStatusRecord({
    memberId: input.memberId,
    birthdayYear: input.birthdayYear,
    status: "sent",
    // Keep original mailed date when re-saving sent.
    sentAt: existing?.status === "sent" && existing.sentAt ? existing.sentAt : now,
    now,
  });

  await store.setJSON(key, record);
  return record;
}
