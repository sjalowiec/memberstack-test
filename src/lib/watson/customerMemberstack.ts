import {
  buildPlanIndex,
  buildPriceIndex,
  connectionCanceledAt,
  fetchAllMembers,
  isCanceledConnectionStatus,
  isConnectionCurrentlyActive,
  paidConnectionPriceId,
  type MemberstackListMembersClient,
  type MemberstackMember,
  type PlanConnection,
} from "../membership/membershipSummary";
import { formatMemberDisplayName } from "./memberSearch";
import { type LegacyMemberDetailRow } from "./memberDetail";
import { normalizeCustomerEmail } from "./customerIdentifier";

export type MemberstackGetMemberClient = MemberstackListMembersClient & {
  getMember: (idOrEmail: string) => Promise<Record<string, unknown> | null>;
};

export type CustomerMemberstackLookupStatus = "linked" | "not_found" | "load_error";

export type CustomerMemberstackLoadResult =
  | { ok: true; status: "linked"; member: MemberstackMember }
  | { ok: false; status: "not_found"; error: string }
  | { ok: false; status: "load_error"; error: string };

export const MEMBERSTACK_LOOKUP_UNAVAILABLE_LABEL = "Memberstack lookup unavailable";
export const MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL =
  "No Memberstack member found for this email";

export interface CustomerPlanConnectionDisplay {
  connectionId: string | null;
  planName: string | null;
  planId: string | null;
  status: string | null;
  activeLabel: string;
  billingInterval: string | null;
  startDate: string | null;
  startDateSort: string;
  canceledAt: string | null;
  canceledAtSort: string;
  isPaidPlan: boolean | null;
}

export interface CustomerMemberstackSummary {
  memberstackId: string;
  email: string | null;
  displayName: string | null;
  accountCreatedAt: string | null;
  accountCreatedAtSort: string;
  connections: CustomerPlanConnectionDisplay[];
  hasActiveConnection: boolean;
  membershipStatusLabel: string | null;
  configured: boolean;
  loadError: string | null;
}

export const CUSTOMER_MEMBERSTACK_SEARCH_LIMIT = 50;

function parseMemberstackMember(raw: Record<string, unknown> | null): MemberstackMember | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) {
    return null;
  }

  const auth =
    raw.auth && typeof raw.auth === "object"
      ? (raw.auth as {
          email?: string;
          firstName?: string;
          lastName?: string;
        })
      : undefined;

  return {
    id,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    auth,
    planConnections: Array.isArray(raw.planConnections)
      ? (raw.planConnections as PlanConnection[])
      : [],
  };
}

function formatIsoDateDisplay(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatIsoDateSort(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

export function formatMemberstackDisplayName(member: MemberstackMember): string {
  const firstName = member.auth?.firstName?.trim();
  const lastName = member.auth?.lastName?.trim();
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  const email = member.auth?.email?.trim();
  if (email) {
    return email;
  }
  return member.id;
}

export function formatCustomerDisplayName(
  memberstack: CustomerMemberstackSummary,
  legacyMember: LegacyMemberDetailRow | null,
): string {
  if (legacyMember && (legacyMember.fristname || legacyMember.lastname)) {
    const legacyName = formatMemberDisplayName(legacyMember);
    if (legacyName.replace(/\u2014/g, "").replace(/-/g, "").trim()) {
      return legacyName;
    }
  }
  return memberstack.displayName ?? memberstack.email ?? memberstack.memberstackId;
}

export function buildCustomerPlanConnectionDisplay(
  connection: PlanConnection,
): CustomerPlanConnectionDisplay {
  const planIndex = buildPlanIndex();
  const priceIndex = buildPriceIndex();
  const planId = connection.planId ?? null;
  const planInfo = planId ? planIndex.get(planId) : undefined;
  const priceId = paidConnectionPriceId(connection);
  const priceInfo = priceId ? priceIndex.get(priceId) : undefined;
  const active = isConnectionCurrentlyActive(connection);
  const status = connection.status ?? null;
  const canceledDate = connectionCanceledAt(connection);

  let activeLabel = "Inactive";
  if (active) {
    activeLabel = "Active";
  } else if (status && isCanceledConnectionStatus(status)) {
    activeLabel = "Canceled";
  } else if (status) {
    activeLabel = status;
  }

  return {
    connectionId: connection.id ?? null,
    planName: connection.planName ?? planInfo?.name ?? null,
    planId,
    status,
    activeLabel,
    billingInterval: priceInfo?.interval ?? null,
    startDate: formatIsoDateDisplay(connection.createdAt),
    startDateSort: formatIsoDateSort(connection.createdAt),
    canceledAt: canceledDate ? formatIsoDateDisplay(canceledDate.toISOString()) : null,
    canceledAtSort: canceledDate ? canceledDate.toISOString() : "",
    isPaidPlan: planInfo ? planInfo.paid : null,
  };
}

export function buildCustomerMemberstackSummary(options: {
  member: MemberstackMember | null;
  configured: boolean;
  loadError: string | null;
}): CustomerMemberstackSummary {
  const connections = (options.member?.planConnections ?? []).map(buildCustomerPlanConnectionDisplay);
  const hasActiveConnection = connections.some((connection) => connection.activeLabel === "Active");

  return {
    memberstackId: options.member?.id ?? "",
    email: options.member?.auth?.email ?? null,
    displayName: options.member ? formatMemberstackDisplayName(options.member) : null,
    accountCreatedAt: formatIsoDateDisplay(options.member?.createdAt),
    accountCreatedAtSort: formatIsoDateSort(options.member?.createdAt),
    connections,
    hasActiveConnection,
    membershipStatusLabel: options.member
      ? hasActiveConnection
        ? "Active"
        : connections.length === 0
          ? "No Plan"
          : "Inactive"
      : null,
    configured: options.configured,
    loadError: options.loadError,
  };
}

export function resolveCustomerMemberstackSecretKey(
  env: { MEMBERSTACK_SECRET_KEY?: string } = import.meta.env,
): string | null {
  const key = (env.MEMBERSTACK_SECRET_KEY || "").trim();
  return key || null;
}

async function getMemberstackClient(
  secretKey: string | null,
): Promise<MemberstackGetMemberClient | null> {
  if (!secretKey) {
    return null;
  }

  const { getMemberstackAdminClient } = await import(
    "../../../netlify/functions/lib/memberstack-admin.js"
  );
  const client = getMemberstackAdminClient({ secretKey });
  if (!client || typeof client.getMember !== "function" || typeof client.listMembers !== "function") {
    return null;
  }
  return client as MemberstackGetMemberClient;
}

export async function loadCustomerMemberstackMember(options: {
  lookupValue: string;
  secretKey?: string | null;
  getClient?: (secretKey: string | null) => Promise<MemberstackGetMemberClient | null>;
}): Promise<CustomerMemberstackLoadResult> {
  const secretKey =
    options.secretKey !== undefined
      ? options.secretKey
      : resolveCustomerMemberstackSecretKey();
  const getClient = options.getClient ?? getMemberstackClient;
  const client = await getClient(secretKey);

  if (!client) {
    return {
      ok: false,
      status: "load_error",
      error: "Memberstack admin API is not configured.",
    };
  }

  try {
    const raw = await client.getMember(options.lookupValue);
    if (raw == null) {
      return {
        ok: false,
        status: "not_found",
        error: "No Memberstack member found for this identifier.",
      };
    }

    const member = parseMemberstackMember(raw);
    if (!member) {
      return {
        ok: false,
        status: "load_error",
        error: "Memberstack returned a malformed member response.",
      };
    }

    return { ok: true, status: "linked", member };
  } catch {
    return {
      ok: false,
      status: "load_error",
      error: "Failed to load Memberstack member data.",
    };
  }
}

export async function loadCustomerMemberstackMemberById(
  memberstackId: string,
  options?: {
    secretKey?: string | null;
    getClient?: (secretKey: string | null) => Promise<MemberstackGetMemberClient | null>;
  },
): Promise<CustomerMemberstackLoadResult> {
  return loadCustomerMemberstackMember({
    lookupValue: memberstackId,
    secretKey: options?.secretKey,
    getClient: options?.getClient,
  });
}

export async function loadCustomerMemberstackSummaryById(
  memberstackId: string,
  options?: {
    secretKey?: string | null;
    getClient?: (secretKey: string | null) => Promise<MemberstackGetMemberClient | null>;
  },
): Promise<CustomerMemberstackSummary> {
  const secretKey =
    options?.secretKey !== undefined
      ? options.secretKey
      : resolveCustomerMemberstackSecretKey();
  const configured = Boolean(secretKey);

  if (!configured) {
    return buildCustomerMemberstackSummary({
      member: null,
      configured: false,
      loadError: "Memberstack admin API is not configured.",
    });
  }

  const result = await loadCustomerMemberstackMemberById(memberstackId, options);
  if (!result.ok) {
    return buildCustomerMemberstackSummary({
      member: null,
      configured: result.error !== "Memberstack admin API is not configured.",
      loadError: result.error,
    });
  }

  return buildCustomerMemberstackSummary({
    member: result.member,
    configured: true,
    loadError: null,
  });
}

/**
 * Looks up a Memberstack member by normalized (trim + lowercase) email.
 * Preserves lowercase lookup because Memberstack's Admin API email match is case-sensitive.
 *
 * Distinguishes:
 * - linked: member found
 * - not_found: API completed and returned no member
 * - load_error: missing config, API failure, malformed response, or unexpected exception
 */
export async function resolveMemberstackMemberByExactEmail(
  email: string | null | undefined,
  options?: {
    secretKey?: string | null;
    getClient?: (secretKey: string | null) => Promise<MemberstackGetMemberClient | null>;
  },
): Promise<CustomerMemberstackLoadResult> {
  const normalized = normalizeCustomerEmail(email);
  if (!normalized) {
    return {
      ok: false,
      status: "not_found",
      error: MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL,
    };
  }

  const result = await loadCustomerMemberstackMember({
    lookupValue: normalized,
    secretKey: options?.secretKey,
    getClient: options?.getClient,
  });

  if (result.ok) {
    return result;
  }

  if (result.status === "not_found") {
    return {
      ok: false,
      status: "not_found",
      error: MEMBERSTACK_NOT_FOUND_FOR_EMAIL_LABEL,
    };
  }

  return result;
}

export function memberstackMemberMatchesQuery(
  member: MemberstackMember,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (member.id.toLowerCase().includes(normalized)) {
    return true;
  }

  const email = member.auth?.email?.trim().toLowerCase() ?? "";
  if (email.includes(normalized)) {
    return true;
  }

  const displayName = formatMemberstackDisplayName(member).toLowerCase();
  return displayName.includes(normalized);
}

export async function searchMemberstackCustomerDirectory(
  query: string,
  options?: {
    secretKey?: string | null;
    getClient?: (secretKey: string | null) => Promise<MemberstackGetMemberClient | null>;
    limit?: number;
  },
): Promise<{ members: MemberstackMember[]; truncated: boolean; configured: boolean; error: string | null }> {
  const limit = options?.limit ?? CUSTOMER_MEMBERSTACK_SEARCH_LIMIT;
  const secretKey =
    options?.secretKey !== undefined
      ? options.secretKey
      : resolveCustomerMemberstackSecretKey();
  const getClient = options?.getClient ?? getMemberstackClient;
  const client = await getClient(secretKey);

  if (!client) {
    return {
      members: [],
      truncated: false,
      configured: false,
      error: "Memberstack admin API is not configured.",
    };
  }

  const normalized = query.trim();
  if (!normalized) {
    return { members: [], truncated: false, configured: true, error: null };
  }

  try {
    const { members, truncated } = await fetchAllMembers(client);
    const matches = members.filter((member) => memberstackMemberMatchesQuery(member, normalized));
    return {
      members: matches.slice(0, limit),
      truncated: truncated || matches.length > limit,
      configured: true,
      error: null,
    };
  } catch {
    return {
      members: [],
      truncated: false,
      configured: true,
      error: "Failed to search Memberstack customers.",
    };
  }
}
