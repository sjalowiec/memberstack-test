/**
 * Member Account Repair intake form — investigation only.
 * Does not update Memberstack, Stripe, Watson, Netlify Blobs, or any production data.
 */

export const MEMBER_ACCOUNT_REPAIR_PATH = "/watson/member-account-repair";

export const PERMISSION_AUDIT_ONLY = "Audit only";
export const PERMISSION_REPAIR_APPROVED = "Repair approved after audit";

export const MEMBER_ACCOUNT_REPAIR_INTAKE_FIELDS = [
  "Name",
  "Email",
  "Problem",
  "Correct paid Stripe customer",
  "Wrong connected Stripe customer",
  "Permission",
  "Notes",
] as const;

export type MemberAccountRepairFieldName = (typeof MEMBER_ACCOUNT_REPAIR_INTAKE_FIELDS)[number];
export type MemberAccountRepairValues = Record<MemberAccountRepairFieldName, string>;

export const MEMBER_ACCOUNT_REPAIR_PERMISSION_OPTIONS = [
  PERMISSION_AUDIT_ONLY,
  PERMISSION_REPAIR_APPROVED,
] as const;

const FORBIDDEN_FIELD_PATTERN =
  /password|card number|credit card|cvv|cvc|api key|secret|login credential/i;

export function memberAccountRepairFieldNames(): MemberAccountRepairFieldName[] {
  return [...MEMBER_ACCOUNT_REPAIR_INTAKE_FIELDS];
}

export function emptyMemberAccountRepairValues(): MemberAccountRepairValues {
  const values = {} as MemberAccountRepairValues;
  for (const name of MEMBER_ACCOUNT_REPAIR_INTAKE_FIELDS) {
    values[name] = "";
  }
  return values;
}

export function trimRepairFieldValue(value: unknown): string {
  return String(value ?? "").trim();
}

export function isRepairFieldBlank(value: unknown): boolean {
  return trimRepairFieldValue(value) === "";
}

export function sanitizeRepairValues(
  input: Partial<Record<string, unknown>> | null | undefined,
): MemberAccountRepairValues {
  const values = emptyMemberAccountRepairValues();
  if (!input) {
    return values;
  }
  for (const name of MEMBER_ACCOUNT_REPAIR_INTAKE_FIELDS) {
    values[name] = trimRepairFieldValue(input[name]);
  }
  return values;
}

export function isMemberstackMemberId(value: unknown): boolean {
  return /^mem_[A-Za-z0-9]+$/i.test(trimRepairFieldValue(value));
}

export function isStripeCustomerId(value: unknown): boolean {
  return /^cus_[A-Za-z0-9]+$/.test(trimRepairFieldValue(value));
}

export function isStripeSubscriptionId(value: unknown): boolean {
  return /^sub_[A-Za-z0-9]+$/.test(trimRepairFieldValue(value));
}

export function watsonIdFromIdentifiers(
  legacyMemberid: string | null | undefined,
  notesWriteId: string | null | undefined,
): string {
  for (const candidate of [legacyMemberid, notesWriteId]) {
    const value = trimRepairFieldValue(candidate);
    if (value && !isMemberstackMemberId(value)) {
      return value;
    }
  }
  return "";
}

export function stripeCustomerIdOrBlank(value: unknown): string {
  const trimmed = trimRepairFieldValue(value);
  return isStripeCustomerId(trimmed) ? trimmed : "";
}

export function stripeSubscriptionIdOrBlank(value: unknown): string {
  const trimmed = trimRepairFieldValue(value);
  return isStripeSubscriptionId(trimmed) ? trimmed : "";
}

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

function displayNameForForm(
  displayName: string | null | undefined,
  email: string | null | undefined,
  memberstackId: string | null | undefined,
): string {
  const name = trimRepairFieldValue(displayName);
  if (!name) return "";
  if (email && name.toLowerCase() === email.toLowerCase()) return "";
  if (memberstackId && name === memberstackId) return "";
  if (looksLikeEmail(name)) return "";
  if (isMemberstackMemberId(name)) return "";
  return name;
}

export function buildMemberAccountRepairReport(
  values: Partial<Record<string, unknown>> | null | undefined,
): string {
  const data = sanitizeRepairValues(values);
  const customerLines: string[] = [];
  if (!isRepairFieldBlank(data.Name)) customerLines.push(`Customer: ${data.Name}`);
  if (!isRepairFieldBlank(data.Email)) customerLines.push(`Email: ${data.Email}`);
  if (!isRepairFieldBlank(data.Problem)) customerLines.push(`Problem: ${data.Problem}`);

  const stripeLines: string[] = [];
  if (!isRepairFieldBlank(data["Correct paid Stripe customer"])) {
    stripeLines.push(`Correct paid Stripe customer: ${data["Correct paid Stripe customer"]}`);
  }
  if (!isRepairFieldBlank(data["Wrong connected Stripe customer"])) {
    stripeLines.push(`Wrong connected Stripe customer: ${data["Wrong connected Stripe customer"]}`);
  }

  const closingLines: string[] = [];
  if (!isRepairFieldBlank(data.Permission)) {
    closingLines.push(`Permission: ${data.Permission}`);
  }
  closingLines.push(data.Notes ? `Notes: ${data.Notes}` : "Notes:");

  const blocks = ["MEMBER ACCOUNT REPAIR"];
  if (customerLines.length) blocks.push(customerLines.join("\n"));
  if (stripeLines.length) blocks.push(stripeLines.join("\n"));
  blocks.push(closingLines.join("\n"));
  return blocks.join("\n\n");
}

export function buildMemberAccountRepairHref(ids: {
  legacyMemberid?: string | null;
  memberstackId?: string | null;
}): string {
  const params = new URLSearchParams();
  const legacyMemberid = ids.legacyMemberid?.trim();
  const memberstackId = ids.memberstackId?.trim();
  if (legacyMemberid) {
    params.set("legacyMemberid", legacyMemberid);
  }
  if (memberstackId) {
    params.set("memberstackId", memberstackId);
  }
  const query = params.toString();
  return query ? `${MEMBER_ACCOUNT_REPAIR_PATH}?${query}` : MEMBER_ACCOUNT_REPAIR_PATH;
}

export function parseMemberAccountRepairSource(searchParams: {
  get: (name: string) => string | null;
}): {
  legacyMemberid: string | null;
  memberstackId: string | null;
} {
  const legacyMemberid = searchParams.get("legacyMemberid")?.trim() || null;
  const memberstackId = searchParams.get("memberstackId")?.trim() || null;
  return { legacyMemberid, memberstackId };
}

export function hasMemberAccountRepairSource(source: {
  legacyMemberid: string | null;
  memberstackId: string | null;
}): boolean {
  return Boolean(source.legacyMemberid || source.memberstackId);
}

export function memberAccountRepairFieldsAreSafe(): boolean {
  return MEMBER_ACCOUNT_REPAIR_INTAKE_FIELDS.every((name) => !FORBIDDEN_FIELD_PATTERN.test(name));
}

export type VisibleMissingStatus = "Visible" | "Missing" | "";
export type PresentNoneMissingStatus = "Present" | "None" | "Missing" | "";

export function mapMemberstackPlanStatusLabel(label: string | null | undefined): string {
  const normalized = trimRepairFieldValue(label).toLowerCase();
  if (!normalized) return "";
  if (normalized === "active") return "Active";
  if (normalized.includes("past due")) return "Past due";
  if (normalized.includes("cancel")) return "Canceled";
  if (normalized === "expired" || normalized === "inactive") return "Expired";
  if (normalized === "no plan") return "No plan";
  if (
    normalized.includes("unavailable") ||
    normalized.includes("not found") ||
    normalized.includes("no memberstack")
  ) {
    return "";
  }
  return "Unknown";
}

export function mapBillingFrequency(interval: string | null | undefined): string {
  const normalized = trimRepairFieldValue(interval).toLowerCase();
  if (normalized === "monthly") return "Monthly";
  if (normalized === "annual" || normalized === "yearly") return "Annual";
  if (normalized === "complimentary" || normalized === "free") return "Complimentary";
  return "";
}

export function mapVisibleMissingStatus(hasRecords: boolean): VisibleMissingStatus {
  return hasRecords ? "Visible" : "";
}

export function mapPresentNoneStatus(
  count: number | null | undefined,
): PresentNoneMissingStatus {
  if (count == null || Number.isNaN(count)) {
    return "";
  }
  if (count > 0) {
    return "Present";
  }
  return "None";
}

export interface MemberAccountRepairPrefillSource {
  displayName?: string | null;
  email?: string | null;
  memberstackId?: string | null;
}

export function buildMemberAccountRepairValuesFromPrefill(
  source: MemberAccountRepairPrefillSource | null | undefined,
): MemberAccountRepairValues {
  const values = emptyMemberAccountRepairValues();
  if (!source) {
    return values;
  }
  const email = trimRepairFieldValue(source.email);
  const memberstackId = trimRepairFieldValue(source.memberstackId);
  values.Email = email;
  values.Name = displayNameForForm(source.displayName, email, memberstackId);
  return values;
}

export interface CustomerProfileRepairInput {
  displayName: string;
  notesWriteId: string;
  legacyMemberid: string | null;
  memberstackId: string | null;
  hasLegacyHistory: boolean;
  pdfPurchaseCount: number | null;
  orders: Array<unknown>;
  courses: Array<unknown>;
  member?: { email?: string | null } | null;
  memberstack: {
    email: string | null;
    membershipStatusLabel: string | null;
    connections: Array<{
      planName: string | null;
      planId?: string | null;
      activeLabel: string;
      billingInterval: string | null;
      connectionId?: string | null;
    }>;
  };
  headerView: {
    email: string | null;
    currentPlan: string | null;
    membershipStatus: string | null;
    membershipSource: string | null;
  };
}

export interface MemberAccountRepairStatusExtras {
  stripeCustomerId?: string | null;
  savedPatternCount?: number | null;
}

export interface DetectedAccountField {
  label: string;
  value: string;
}

export function memberstackPlansLabel(
  connections: Array<{ planName: string | null }>,
): string {
  const names = connections
    .map((connection) => trimRepairFieldValue(connection.planName))
    .filter(Boolean);
  return [...new Set(names)].join(", ");
}

export function memberstackPlanIdsLabel(
  connections: Array<{ planId?: string | null }>,
): string {
  const ids = connections
    .map((connection) => trimRepairFieldValue(connection.planId))
    .filter(Boolean);
  return [...new Set(ids)].join(", ");
}

export function preferredBillingInterval(
  connections: Array<{ activeLabel: string; billingInterval: string | null }>,
): string {
  const active = connections.find(
    (connection) => connection.activeLabel === "Active" && connection.billingInterval,
  );
  if (active?.billingInterval) {
    return active.billingInterval;
  }
  const any = connections.find((connection) => connection.billingInterval);
  return any?.billingInterval ?? "";
}

function pushDetected(
  fields: DetectedAccountField[],
  label: string,
  value: string | null | undefined,
): void {
  const trimmed = trimRepairFieldValue(value);
  if (!trimmed) return;
  fields.push({ label, value: trimmed });
}

export function buildDetectedAccountData(
  profile: CustomerProfileRepairInput,
  extras: MemberAccountRepairStatusExtras = {},
): DetectedAccountField[] {
  const fields: DetectedAccountField[] = [];
  const memberstackId = trimRepairFieldValue(profile.memberstackId);
  const watsonId = watsonIdFromIdentifiers(profile.legacyMemberid, profile.notesWriteId);
  const legacyMemberid = trimRepairFieldValue(profile.legacyMemberid);
  const stripeFromWatson = stripeCustomerIdOrBlank(extras.stripeCustomerId);
  const connectionIds = (profile.memberstack.connections ?? [])
    .map((connection) => trimRepairFieldValue(connection.connectionId))
    .filter(Boolean);
  const stripeSubscriptionIds = connectionIds.filter((id) => isStripeSubscriptionId(id));
  const memberstackConnectionIds = connectionIds.filter((id) => !isStripeSubscriptionId(id));
  const savedPatternCount =
    extras.savedPatternCount == null ? null : extras.savedPatternCount;
  const courseCount = profile.hasLegacyHistory ? profile.courses.length : null;

  pushDetected(fields, "Memberstack ID", memberstackId);
  pushDetected(fields, "Memberstack plan(s)", memberstackPlansLabel(profile.memberstack.connections));
  pushDetected(fields, "Memberstack plan ID(s)", memberstackPlanIdsLabel(profile.memberstack.connections));
  pushDetected(
    fields,
    "Memberstack plan status",
    mapMemberstackPlanStatusLabel(profile.memberstack.membershipStatusLabel),
  );
  pushDetected(fields, "Current plan", profile.headerView.currentPlan);
  pushDetected(fields, "Current membership status", profile.headerView.membershipStatus);
  pushDetected(fields, "Membership source", profile.headerView.membershipSource);
  pushDetected(
    fields,
    "Billing frequency",
    mapBillingFrequency(preferredBillingInterval(profile.memberstack.connections)),
  );
  if (legacyMemberid && !isMemberstackMemberId(legacyMemberid)) {
    pushDetected(fields, "Legacy member ID", legacyMemberid);
  }
  if (watsonId && watsonId !== legacyMemberid) {
    pushDetected(fields, "Watson ID", watsonId);
  }
  pushDetected(fields, "Stripe customer ID in Watson", stripeFromWatson);
  pushDetected(fields, "Stripe subscription ID", stripeSubscriptionIds.join(", "));
  pushDetected(fields, "Memberstack connection ID", memberstackConnectionIds.join(", "));
  pushDetected(fields, "Purchase history", mapVisibleMissingStatus(profile.orders.length > 0));
  pushDetected(
    fields,
    "Ebook downloads",
    mapVisibleMissingStatus((profile.pdfPurchaseCount ?? 0) > 0),
  );
  pushDetected(fields, "Saved patterns", mapPresentNoneStatus(savedPatternCount));
  pushDetected(fields, "Garments or measurements", mapPresentNoneStatus(savedPatternCount));
  pushDetected(fields, "Individual course access", mapPresentNoneStatus(courseCount));
  return fields;
}

export function valuesFromCustomerProfile(
  profile: CustomerProfileRepairInput,
): MemberAccountRepairValues {
  return buildMemberAccountRepairValuesFromPrefill({
    displayName: profile.displayName,
    email: profile.headerView.email ?? profile.memberstack.email ?? profile.member?.email ?? null,
    memberstackId: profile.memberstackId,
  });
}
