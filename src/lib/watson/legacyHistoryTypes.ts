/**
 * Cleaned legacy customer/history ledger (Watson-native).
 * Not part of the legacy_* dump truncate/import.
 */

export const WATSON_LEGACY_HISTORY_CATEGORIES = [
  "Membership",
  "Course Purchase",
  "Pattern Purchase",
  "LK150 Bundle",
] as const;

export type WatsonLegacyHistoryCategory =
  (typeof WATSON_LEGACY_HISTORY_CATEGORIES)[number];

export const WATSON_LEGACY_LINK_STATUSES = [
  "unmatched",
  "unique_email",
  "ambiguous_email",
  "manual",
] as const;

export type WatsonLegacyLinkStatus = (typeof WATSON_LEGACY_LINK_STATUSES)[number];

export const WATSON_LEGACY_CUSTOMER_HEADERS = [
  "LegacyMemberID",
  "FirstName",
  "Lastname",
  "Email",
  "DateJoined",
  "CustomerNotes",
] as const;

export const WATSON_LEGACY_HISTORY_HEADERS = [
  "LegacyMemberID",
  "Category",
  "TransactionDate",
  "Description",
  "Amount",
  "ExpirationDate",
  "Processor",
  "SourceRecordID",
  "ItemID",
  "TransactionID",
] as const;

/** Candidate identity keys, shortest first. Inspect CSV uniqueness before choosing. */
export const HISTORY_IDENTITY_CANDIDATES: Array<{
  name: string;
  fields: readonly string[];
}> = [
  { name: "TransactionID", fields: ["TransactionID"] },
  { name: "SourceRecordID", fields: ["SourceRecordID"] },
  { name: "LegacyMemberID+SourceRecordID", fields: ["LegacyMemberID", "SourceRecordID"] },
  { name: "LegacyMemberID+TransactionID", fields: ["LegacyMemberID", "TransactionID"] },
  {
    name: "LegacyMemberID+SourceRecordID+TransactionID",
    fields: ["LegacyMemberID", "SourceRecordID", "TransactionID"],
  },
  {
    name: "LegacyMemberID+SourceRecordID+TransactionID+Category+ItemID",
    fields: ["LegacyMemberID", "SourceRecordID", "TransactionID", "Category", "ItemID"],
  },
];

export const HISTORY_IDENTITY_FALLBACK = HISTORY_IDENTITY_CANDIDATES[HISTORY_IDENTITY_CANDIDATES.length - 1];

/** Confirmed unique key from the 2026-08-26 dry-run. Apply upserts on this identity. */
export const HISTORY_IDENTITY_APPLY = {
  name: "LegacyMemberID+SourceRecordID+TransactionID",
  fields: ["LegacyMemberID", "SourceRecordID", "TransactionID"],
} as const;

export type WatsonLegacyRejectedRow = {
  file: "customers" | "history";
  lineNumber: number;
  reason: string;
  raw: string;
};

export type HistoryIdentityCandidateReport = {
  name: string;
  fields: string[];
  unique: boolean;
  duplicateCount: number;
  blankKeyCount: number;
  sampleDuplicates: string[];
};

export type WatsonLegacyHistoryDryRunReport = {
  mode: "dry-run";
  customersFile: string;
  historyFile: string;
  customerRowCount: number;
  uniqueLegacyMemberIdCount: number;
  historyRowCount: number;
  countsByCategory: Record<string, number>;
  orphanHistoryCount: number;
  orphanHistorySample: Array<{ lineNumber: number; legacyMemberId: string }>;
  duplicateCustomerLegacyMemberIds: Array<{ legacyMemberId: string; count: number }>;
  duplicateCustomerEmails: Array<{ email: string; count: number; legacyMemberIds: string[] }>;
  blankCustomerEmailCount: number;
  identityCandidates: HistoryIdentityCandidateReport[];
  chosenIdentityKey: string;
  chosenIdentityFields: string[];
  duplicateHistoryIdentityCandidates: Array<{ identityKey: string; count: number }>;
  invalidCategoryCount: number;
  invalidCategories: Array<{ category: string; count: number }>;
  malformedDateCount: number;
  malformedAmountCount: number;
  rejectedRowCount: number;
  rejectedRows: WatsonLegacyRejectedRow[];
  parseRejectedCustomerCount: number;
  parseRejectedHistoryCount: number;
};

export type WatsonLegacyTableWriteCounts = {
  csvRowCount: number;
  upserted: number;
  inserted: number;
  updated: number;
  skipped: number;
};

export type WatsonLegacyHistoryApplyReport = {
  mode: "apply";
  status: "completed" | "aborted" | "failed";
  databaseTarget: string;
  customersFile: string;
  historyFile: string;
  batchId: string;
  dryRun: WatsonLegacyHistoryDryRunReport;
  customers: WatsonLegacyTableWriteCounts;
  history: WatsonLegacyTableWriteCounts;
  errorMessage?: string;
};

export function isWatsonLegacyHistoryCategory(
  value: string,
): value is WatsonLegacyHistoryCategory {
  return (WATSON_LEGACY_HISTORY_CATEGORIES as readonly string[]).includes(value);
}
