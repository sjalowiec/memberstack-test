import {
  getMemberstackSecretKey as sharedGetMemberstackSecretKey,
  isMemberstackEnvironmentMismatch,
  logMemberstackEnvironmentMismatch,
} from "../../../netlify/functions/lib/memberstack-admin.js";
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

/** Internal failure taxonomy for logs / status loader — not customer-facing copy. */
export type MemberstackAdminFailureReason =
  | "admin_not_configured"
  | "member_not_found"
  | "admin_lookup_failed"
  | "environment_mismatch";

/** Sanitized Admin API failure details for server logs only — never shown in Watson UI. */
export type MemberstackLoadDiagnostic = {
  operation: string;
  name: string | null;
  code: string | null;
  message: string;
  fetchCause?: string;
};

export type CustomerMemberstackLoadResult =
  | { ok: true; status: "linked"; member: MemberstackMember }
  | {
      ok: false;
      status: "not_found";
      error: string;
      failureReason: "member_not_found";
    }
  | {
      ok: false;
      status: "load_error";
      error: string;
      failureReason:
        | "admin_not_configured"
        | "admin_lookup_failed"
        | "environment_mismatch";
      diagnostic?: MemberstackLoadDiagnostic;
    };

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

export type MemberstackSecretEnv = {
  MEMBERSTACK_SECRET_KEY?: string;
};

export type ResolveCustomerMemberstackSecretKeyDeps = {
  /** Injected for tests; defaults to shared Admin helper used by requireMember. */
  getSharedSecretKey?: () => string | null;
};

/**
 * Resolve the Memberstack Admin secret for Watson loaders / tests.
 *
 * - Explicit `env` object wins (Astro SSR / tests).
 * - Otherwise uses shared `getMemberstackSecretKey()` (process.env + local dotenv),
 *   the same helper `requireMember` / `getMemberstackAdminClient()` use.
 * - Never assumes `import.meta.env` exists (undefined in the function runtime).
 * - Resolver failures are logged; they are not swallowed without a trace.
 */
export function resolveCustomerMemberstackSecretKey(
  env?: MemberstackSecretEnv | null,
  deps: ResolveCustomerMemberstackSecretKeyDeps = {},
): string | null {
  if (env != null && typeof env === "object") {
    const fromEnv = (env.MEMBERSTACK_SECRET_KEY || "").trim();
    return fromEnv || null;
  }

  const getShared = deps.getSharedSecretKey ?? sharedGetMemberstackSecretKey;
  if (typeof getShared !== "function") {
    console.warn("[watson-memberstack] Shared secret resolver unavailable", {
      operation: "resolveCustomerMemberstackSecretKey",
      failureReason: "admin_not_configured",
    });
    return null;
  }

  try {
    const shared = getShared();
    if (typeof shared !== "string") return null;
    const trimmed = shared.trim();
    return trimmed || null;
  } catch (err) {
    console.warn("[watson-memberstack] Shared secret resolver failed", {
      operation: "resolveCustomerMemberstackSecretKey",
      failureReason: "admin_not_configured",
      name: err instanceof Error ? err.name : null,
      message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    return null;
  }
}

/**
 * Obtain the Admin client the same way as `requireMember`:
 * `getMemberstackAdminClient()` with no args (process.env + dotenv).
 * Explicit secretKey is only for tests / callers that already resolved one.
 */
export async function getSharedMemberstackAdminClient(
  explicitSecretKey?: string,
): Promise<MemberstackGetMemberClient | null> {
  const { getMemberstackAdminClient } = await import(
    "../../../netlify/functions/lib/memberstack-admin.js"
  );
  const client =
    typeof explicitSecretKey === "string"
      ? getMemberstackAdminClient({ secretKey: explicitSecretKey })
      : getMemberstackAdminClient();
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
  let client: MemberstackGetMemberClient | null = null;
  let resolvedSecretKey: string | null =
    options.secretKey !== undefined
      ? options.secretKey
      : resolveCustomerMemberstackSecretKey();

  try {
    if (options.getClient) {
      client = await options.getClient(resolvedSecretKey);
    } else if (options.secretKey === null) {
      client = null;
    } else if (typeof options.secretKey === "string") {
      client = await getSharedMemberstackAdminClient(options.secretKey);
    } else {
      // Default production/dev path — identical to requireMember (shared env resolver).
      resolvedSecretKey = resolveCustomerMemberstackSecretKey();
      client = await getSharedMemberstackAdminClient();
    }
  } catch (err) {
    const diagnostic = await buildMemberstackLoadDiagnostic(err, options.lookupValue);
    console.warn("[watson-memberstack] Admin client init failed", {
      failureReason: "admin_not_configured" satisfies MemberstackAdminFailureReason,
      ...diagnostic,
    });
    return {
      ok: false,
      status: "load_error",
      failureReason: "admin_not_configured",
      error: "Memberstack admin API is not configured.",
      diagnostic,
    };
  }

  if (!client) {
    console.warn("[watson-memberstack] Admin client unavailable", {
      operation: options.lookupValue.includes("@") ? "getMember by email" : "getMember by id",
      failureReason: "admin_not_configured" satisfies MemberstackAdminFailureReason,
    });
    return {
      ok: false,
      status: "load_error",
      failureReason: "admin_not_configured",
      error: "Memberstack admin API is not configured.",
    };
  }

  // Never look up a sandbox member id with a live Admin secret (or the reverse).
  if (
    resolvedSecretKey &&
    isMemberstackEnvironmentMismatch(options.lookupValue, resolvedSecretKey)
  ) {
    logMemberstackEnvironmentMismatch(
      options.lookupValue,
      resolvedSecretKey,
      options.lookupValue.includes("@") ? "getMember by email" : "getMember by id",
    );
    return {
      ok: false,
      status: "load_error",
      failureReason: "environment_mismatch",
      error: "Memberstack Admin environment does not match the authenticated member.",
    };
  }

  try {
    const raw = await client.getMember(options.lookupValue);
    if (raw == null) {
      console.warn("[watson-memberstack] Admin getMember returned no member", {
        operation: options.lookupValue.includes("@") ? "getMember by email" : "getMember by id",
        failureReason: "member_not_found" satisfies MemberstackAdminFailureReason,
      });
      return {
        ok: false,
        status: "not_found",
        failureReason: "member_not_found",
        error: "No Memberstack member found for this identifier.",
      };
    }

    const member = parseMemberstackMember(raw);
    if (!member) {
      console.warn("[watson-memberstack] Admin getMember returned malformed member", {
        operation: options.lookupValue.includes("@") ? "getMember by email" : "getMember by id",
        failureReason: "admin_lookup_failed" satisfies MemberstackAdminFailureReason,
      });
      return {
        ok: false,
        status: "load_error",
        failureReason: "admin_lookup_failed",
        error: "Memberstack returned a malformed member response.",
      };
    }

    return { ok: true, status: "linked", member };
  } catch (err) {
    const diagnostic = await buildMemberstackLoadDiagnostic(err, options.lookupValue);
    console.warn("[watson-memberstack] Admin lookup failed", {
      failureReason: "admin_lookup_failed" satisfies MemberstackAdminFailureReason,
      ...diagnostic,
    });
    return {
      ok: false,
      status: "load_error",
      failureReason: "admin_lookup_failed",
      error: "Failed to load Memberstack member data.",
      diagnostic,
    };
  }
}

async function buildMemberstackLoadDiagnostic(
  err: unknown,
  lookupValue: string,
): Promise<MemberstackLoadDiagnostic> {
  try {
    const {
      describeGetMemberOperation,
      sanitizeMemberstackErrorDiagnostic,
    } = await import("../../../netlify/functions/lib/memberstack-admin.js");
    return sanitizeMemberstackErrorDiagnostic(
      err,
      describeGetMemberOperation(lookupValue),
    ) as MemberstackLoadDiagnostic;
  } catch {
    const message =
      err instanceof Error
        ? err.message.slice(0, 300)
        : "Failed to load Memberstack member data.";
    return {
      operation: lookupValue.includes("@") ? "getMember by email" : "getMember by id",
      name: err instanceof Error ? err.name : null,
      code:
        err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string"
          ? ((err as { code: string }).code)
          : null,
      message,
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
      failureReason: "member_not_found",
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
      failureReason: "member_not_found",
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
