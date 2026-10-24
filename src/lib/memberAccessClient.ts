/**
 * Browser helper: load Watson paid-through for logged-in members without an
 * active paid plan so sync {@link hasMemberAccess} calls share one determination.
 *
 * Paid members skip the network. Fail closed when the lookup is unavailable:
 * an unavailable lookup leaves the date unknown (no access from sync checks)
 * and is reported as `unavailable`, never as a confirmed "no legacy date".
 *
 * {@link resolveVerifiedMemberAccess} is the shared, deduped page-level
 * verification used by gates. It waits (bounded) for a Memberstack payload that
 * includes `planConnections` (early `getCurrentMember()` results can omit them),
 * then loads Watson dates when needed. Verified results are kept in
 * sessionStorage for {@link MEMBER_ACCESS_FRESH_MS} so navigation between pages
 * does not repeat the Watson lookup or flash non-member UI.
 *
 * The cache only affects what the browser shows first. Server endpoints still
 * authorize every protected resource with the member JWT.
 */
import {
  clearRememberedComplimentaryThroughForAccess,
  clearRememberedLegacyPaidThroughForAccess,
  complimentaryThroughYmdForAccess,
  getViewerAccessState,
  hasComplimentaryMemberAccess,
  hasCurrentComplimentaryAccess,
  hasPaidMemberAccess,
  isLegacyPaidThroughCurrentlyValid,
  isMemberLoggedIn,
  memberAccessCalendarYmdForNow,
  memberAccessYmdFromDateOnlyValue,
  needsLegacyPaidThroughForAccess,
  rememberComplimentaryThroughForAccess,
  rememberLegacyPaidThroughForAccess,
  rememberedComplimentaryThroughYmdForMember,
  rememberedLegacyPaidThroughYmdForMember,
  type ViewerAccessState,
} from "./memberAccess";
import { getMembershipStatusAuthHeaders } from "./membership/membershipStatusClient";
import {
  memberIdFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "./patterns/memberstackMember";
import { isSharedMemberstackPayloadResolved } from "./sharedMemberAccessPublish";

export const MEMBER_ACCESS_API_PATH = "/.netlify/functions/member-access";

/** sessionStorage key for the verified access snapshot (per tab). */
export const MEMBER_ACCESS_CACHE_KEY = "kbm:member-access:v1";

/** How long a verified result is reused across page loads before re-checking Watson. */
export const MEMBER_ACCESS_FRESH_MS = 10 * 60 * 1000;

const MEMBER_ACCESS_FETCH_TIMEOUT_MS = 10_000;

type InFlightLookup = Promise<MemberAccessContextStatus>;

const inFlightByMemberId = new Map<string, InFlightLookup>();

function memberIdForAccessContext(memberOrPayload: unknown): string | undefined {
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  const nested = member?.id ?? member?._id;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  return memberIdFromMemberstackPayload(memberOrPayload);
}

type MemberAccessApiBody = {
  ok?: boolean;
  legacyPaidThroughYmd?: string | null;
  complimentaryThroughYmd?: string | null;
  /** Server could not reach Watson: membership is unconfirmed, not denied. */
  legacyLookupFailed?: boolean;
};

export type MemberAccessDateContext = {
  legacyPaidThroughYmd: string | null;
  complimentaryThroughYmd: string | null;
};

/** `ready` = dates known (or not needed). `unavailable` = lookup failed; retry later. */
export type MemberAccessContextStatus = "ready" | "unavailable";

// ---------------------------------------------------------------------------
// sessionStorage snapshot
// ---------------------------------------------------------------------------

export type CachedMemberAccess = {
  memberId: string;
  viewer: ViewerAccessState;
  verifiedAt: number;
  /**
   * Last America/Los_Angeles day a dated grant (legacy or complimentary) covers.
   * Null when the grant is not date-bound (paid plan, open complimentary).
   * A cached member result is ignored after this day, even inside the
   * freshness window.
   */
  accessThroughYmd?: string | null;
  /** Present only when the Watson legacy date was loaded successfully. */
  legacyPaidThroughYmd?: string | null;
  /** Present only when the complimentary date was loaded successfully. */
  complimentaryThroughYmd?: string | null;
};

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

function readCachedMemberAccess(): CachedMemberAccess | null {
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(MEMBER_ACCESS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedMemberAccess> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.memberId !== "string" || !parsed.memberId) return null;
    if (typeof parsed.verifiedAt !== "number") return null;
    if (
      parsed.viewer !== "memberAccess" &&
      parsed.viewer !== "loggedInNoAccess" &&
      parsed.viewer !== "loggedOut"
    ) {
      return null;
    }
    return parsed as CachedMemberAccess;
  } catch {
    return null;
  }
}

function writeCachedMemberAccess(entry: CachedMemberAccess): void {
  const store = sessionStore();
  if (!store) return;
  try {
    store.setItem(MEMBER_ACCESS_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* storage full or blocked: in-memory state still works for this page */
  }
}

function isFresh(entry: CachedMemberAccess, now = Date.now()): boolean {
  const age = now - entry.verifiedAt;
  return age >= 0 && age <= MEMBER_ACCESS_FRESH_MS;
}

function freshCachedEntryForMember(memberId: string): CachedMemberAccess | null {
  const entry = readCachedMemberAccess();
  if (!entry || entry.memberId !== memberId || !isFresh(entry)) return null;
  return entry;
}

function persistDates(memberId: string, dates: Partial<MemberAccessDateContext>): void {
  const prior = readCachedMemberAccess();
  const base: CachedMemberAccess =
    prior && prior.memberId === memberId
      ? prior
      : { memberId, viewer: "loggedInNoAccess", verifiedAt: Date.now() };
  writeCachedMemberAccess({ ...base, ...dates, verifiedAt: Date.now() });
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    for (const part of document.cookie.split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k === name) return decodeURIComponent(rest.join("=")).trim() || null;
    }
  } catch {
    /* cookies unavailable */
  }
  return null;
}

/**
 * Memberstack member id visible without a network call (`_ms_mid` cookie or the
 * `_ms-mem` localStorage record). `null` when neither identifies a member.
 */
export function currentMemberstackMemberIdHint(): string | null {
  const fromCookie = readCookie("_ms_mid");
  if (fromCookie) return fromCookie;
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem("_ms-mem");
    if (!raw) return null;
    return memberIdFromMemberstackPayload(JSON.parse(raw)) ?? null;
  } catch {
    return null;
  }
}

/**
 * A recently verified snapshot for the member Memberstack currently reports
 * (by cookie/localStorage id). Use only to choose the first paint; always
 * follow with {@link resolveVerifiedMemberAccess}. A member result whose
 * legacy/complimentary access-through day has passed is not returned.
 */
export function readFreshVerifiedMemberAccess(now: Date = new Date()): CachedMemberAccess | null {
  const memberId = currentMemberstackMemberIdHint();
  if (!memberId) return null;
  const entry = freshCachedEntryForMember(memberId);
  if (!entry) return null;
  if (
    entry.viewer === "memberAccess" &&
    typeof entry.accessThroughYmd === "string" &&
    entry.accessThroughYmd < memberAccessCalendarYmdForNow(now)
  ) {
    return null;
  }
  return entry;
}

/**
 * The day a current grant ends, or null when it is not date-bound. Uses the
 * same rules as {@link hasMemberAccess}: paid plans and an open complimentary
 * plan are unbounded; otherwise the later of the valid complimentary and
 * legacy dates.
 */
function accessThroughYmdForGrant(payload: unknown, memberId: string): string | null {
  if (hasPaidMemberAccess(payload)) return null;
  const dates: string[] = [];
  if (hasCurrentComplimentaryAccess(payload)) {
    const complimentary = complimentaryThroughYmdForAccess(payload);
    if (complimentary == null) return null;
    dates.push(complimentary);
  }
  const legacy = rememberedLegacyPaidThroughYmdForMember(memberId);
  if (legacy && isLegacyPaidThroughCurrentlyValid(legacy)) dates.push(legacy);
  dates.sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** Forget verified status and remembered dates (logout, login, account switch). */
export function clearVerifiedMemberAccessCache(): void {
  const store = sessionStore();
  try {
    store?.removeItem(MEMBER_ACCESS_CACHE_KEY);
  } catch {
    /* ignore */
  }
  clearRememberedLegacyPaidThroughForAccess();
  clearRememberedComplimentaryThroughForAccess();
  inFlightByMemberId.clear();
}

/** Clear cached status and drop this page's settled check (login/logout). */
export function invalidateVerifiedMemberAccess(): void {
  clearVerifiedMemberAccessCache();
  if (typeof window !== "undefined") {
    window.__KBM_VERIFIED_MEMBER_ACCESS__ = undefined;
  }
}

// ---------------------------------------------------------------------------
// Watson date context
// ---------------------------------------------------------------------------

async function fetchMemberAccessDatesFromApi(): Promise<MemberAccessDateContext | null> {
  if (typeof window === "undefined") return null;
  const headers = await getMembershipStatusAuthHeaders();
  if (!headers.Authorization) return null;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), MEMBER_ACCESS_FETCH_TIMEOUT_MS)
    : null;
  let res: Response;
  try {
    res = await fetch(MEMBER_ACCESS_API_PATH, {
      method: "GET",
      headers,
      credentials: "same-origin",
      signal: controller?.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) return null;

  let body: MemberAccessApiBody | null = null;
  try {
    body = (await res.json()) as MemberAccessApiBody;
  } catch {
    return null;
  }
  if (!body || body.ok === false || body.legacyLookupFailed === true) return null;
  return {
    legacyPaidThroughYmd: memberAccessYmdFromDateOnlyValue(body.legacyPaidThroughYmd ?? null),
    complimentaryThroughYmd: memberAccessYmdFromDateOnlyValue(body.complimentaryThroughYmd ?? null),
  };
}

export type EnsureLegacyPaidThroughContextDeps = {
  /** Legacy-only test hook. Complimentary date stays unloaded when this is used alone. */
  fetchPaidThroughYmd?: () => Promise<string | null>;
  fetchAccessDates?: () => Promise<MemberAccessDateContext | null>;
};

function hydrateDatesFromCache(
  memberId: string,
  needsLegacy: boolean,
  needsComplimentary: boolean,
): void {
  const entry = freshCachedEntryForMember(memberId);
  if (!entry) return;
  if (
    needsLegacy &&
    rememberedLegacyPaidThroughYmdForMember(memberId) === undefined &&
    "legacyPaidThroughYmd" in entry
  ) {
    rememberLegacyPaidThroughForAccess(memberId, entry.legacyPaidThroughYmd ?? null);
  }
  if (
    needsComplimentary &&
    rememberedComplimentaryThroughYmdForMember(memberId) === undefined &&
    "complimentaryThroughYmd" in entry
  ) {
    rememberComplimentaryThroughForAccess(memberId, entry.complimentaryThroughYmd ?? null);
  }
}

/**
 * Load and remember the Watson paid-through date when the visitor has no
 * active paid plan. No-op for paid members, logged-out visitors, and users
 * who already have a remembered (or fresh cached) date. The free legacy plan
 * is not required.
 *
 * Resolves `unavailable` when the lookup fails. The date then stays unknown,
 * so sync access checks deny, and the next call retries.
 */
export async function ensureLegacyPaidThroughContext(
  memberOrPayload: unknown,
  deps: EnsureLegacyPaidThroughContextDeps = {},
): Promise<MemberAccessContextStatus> {
  if (!isMemberLoggedIn(memberOrPayload)) {
    clearRememberedLegacyPaidThroughForAccess();
    clearRememberedComplimentaryThroughForAccess();
    return "ready";
  }
  if (hasPaidMemberAccess(memberOrPayload)) return "ready";

  const needsComplimentary = hasComplimentaryMemberAccess(memberOrPayload);
  const needsLegacy = needsLegacyPaidThroughForAccess(memberOrPayload);
  if (!needsComplimentary && !needsLegacy) return "ready";

  const memberId = memberIdForAccessContext(memberOrPayload);
  if (!memberId) return "ready";

  hydrateDatesFromCache(memberId, needsLegacy, needsComplimentary);

  const legacyKnown = rememberedLegacyPaidThroughYmdForMember(memberId) !== undefined;
  const complimentaryKnown =
    rememberedComplimentaryThroughYmdForMember(memberId) !== undefined;
  if ((!needsLegacy || legacyKnown) && (!needsComplimentary || complimentaryKnown)) {
    return "ready";
  }

  const existing = inFlightByMemberId.get(memberId);
  if (existing) return existing;

  const work: InFlightLookup = (async () => {
    try {
      if (deps.fetchPaidThroughYmd && !deps.fetchAccessDates) {
        const ymd = await deps.fetchPaidThroughYmd();
        rememberLegacyPaidThroughForAccess(memberId, ymd);
        persistDates(memberId, { legacyPaidThroughYmd: ymd });
        return "ready";
      }
      const load = deps.fetchAccessDates ?? fetchMemberAccessDatesFromApi;
      const dates = await load();
      if (!dates) return "unavailable";
      rememberLegacyPaidThroughForAccess(memberId, dates.legacyPaidThroughYmd);
      const persisted: Partial<MemberAccessDateContext> = {
        legacyPaidThroughYmd: dates.legacyPaidThroughYmd,
      };
      if (needsComplimentary) {
        rememberComplimentaryThroughForAccess(memberId, dates.complimentaryThroughYmd);
        persisted.complimentaryThroughYmd = dates.complimentaryThroughYmd;
      }
      persistDates(memberId, persisted);
      return "ready";
    } catch {
      return "unavailable";
    } finally {
      inFlightByMemberId.delete(memberId);
    }
  })();

  inFlightByMemberId.set(memberId, work);
  return work;
}

// ---------------------------------------------------------------------------
// Shared page-level verification
// ---------------------------------------------------------------------------

export type VerifiedMemberAccess =
  | {
      status: "verified";
      viewer: ViewerAccessState;
      memberId: string | null;
      /** Memberstack payload with `planConnections` (null when logged out). */
      payload: unknown;
    }
  | {
      status: "error";
      reason: "memberstack-unavailable" | "access-lookup-unavailable";
      /**
       * Logged-in payload when only the Watson lookup failed. Sync access checks
       * on it deny (date unknown); it must not be shown as a non-member result.
       */
      payload?: unknown;
    };

export type ResolveVerifiedMemberAccessDeps = {
  /** Total time allowed to obtain a finished Memberstack payload. */
  memberstackDeadlineMs?: number;
  pollIntervalMs?: number;
  ensureContext?: typeof ensureLegacyPaidThroughContext;
};

type MemberstackDomLike = NonNullable<Window["$memberstackDom"]>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function readMemberstackPayload(ms: MemberstackDomLike): Promise<unknown> {
  const api = ms.getAppAndMember ?? ms.getCurrentMember;
  if (typeof api !== "function") return null;
  return withTimeout(Promise.resolve(api.call(ms)), 5000, null);
}

/**
 * Wait (bounded) for Memberstack and return a resolved payload: logged out,
 * or logged in with `planConnections` loaded. `undefined` when Memberstack never
 * produced one before the deadline.
 */
async function waitForResolvedMemberstackPayload(
  deadlineMs: number,
  intervalMs: number,
): Promise<unknown | undefined> {
  const deadline = Date.now() + deadlineMs;
  let ms: MemberstackDomLike | undefined;
  while (Date.now() < deadline) {
    ms = window.$memberstackDom;
    if (ms && (ms.getAppAndMember || ms.getCurrentMember)) break;
    await sleep(intervalMs);
  }
  if (!ms || !(ms.getAppAndMember || ms.getCurrentMember)) return undefined;

  // Read while the session restores. A logged-out payload is final only after
  // onReady has actually settled (a restored session does not fire
  // member.login); a logged-in payload must include planConnections. If
  // onReady never settles before the deadline the result is unverified (an
  // error with Retry), never "signed out".
  let sessionReady =
    !ms.onReady || typeof (ms.onReady as Promise<unknown>).then !== "function";
  if (!sessionReady) {
    Promise.resolve(ms.onReady).then(
      () => {
        sessionReady = true;
      },
      () => {
        sessionReady = true;
      },
    );
  }

  do {
    const payload = await readMemberstackPayload(ms);
    if (isSharedMemberstackPayloadResolved(payload, sessionReady)) return payload;
    await sleep(intervalMs);
  } while (Date.now() < deadline);
  return undefined;
}

async function resolveVerifiedMemberAccessUncached(
  deps: ResolveVerifiedMemberAccessDeps,
): Promise<VerifiedMemberAccess> {
  const payload = await waitForResolvedMemberstackPayload(
    deps.memberstackDeadlineMs ?? 12_000,
    deps.pollIntervalMs ?? 200,
  );
  if (payload === undefined) {
    return { status: "error", reason: "memberstack-unavailable" };
  }

  if (!isMemberLoggedIn(payload)) {
    clearVerifiedMemberAccessCache();
    return { status: "verified", viewer: "loggedOut", memberId: null, payload: null };
  }

  const memberId = memberIdForAccessContext(payload) ?? null;
  const prior = readCachedMemberAccess();
  if (prior && memberId && prior.memberId !== memberId) {
    // Account switched in this tab: drop the previous member's state.
    clearVerifiedMemberAccessCache();
  }

  const ensure = deps.ensureContext ?? ensureLegacyPaidThroughContext;
  const status = await ensure(payload);
  if (status === "unavailable") {
    return { status: "error", reason: "access-lookup-unavailable", payload };
  }

  const viewer = getViewerAccessState(payload);
  if (memberId) {
    const current = readCachedMemberAccess();
    const dates = current && current.memberId === memberId ? current : null;
    writeCachedMemberAccess({
      ...(dates ?? {}),
      memberId,
      viewer,
      accessThroughYmd:
        viewer === "memberAccess" ? accessThroughYmdForGrant(payload, memberId) : null,
      verifiedAt: Date.now(),
    });
  }
  return { status: "verified", viewer, memberId, payload };
}

const invalidationBoundTo = new WeakSet<object>();
let invalidationPolling = false;

function bindMemberstackInvalidation(): void {
  if (typeof window === "undefined") return;
  const attach = (): boolean => {
    const ms = window.$memberstackDom;
    if (!ms || typeof ms.on !== "function") return false;
    if (invalidationBoundTo.has(ms)) return true;
    invalidationBoundTo.add(ms);
    ms.on("member.login", invalidateVerifiedMemberAccess);
    ms.on("member.logout", invalidateVerifiedMemberAccess);
    return true;
  };
  if (attach() || invalidationPolling) return;
  invalidationPolling = true;
  void (async () => {
    try {
      for (let i = 0; i < 40; i++) {
        await sleep(200);
        if (attach()) return;
      }
    } finally {
      invalidationPolling = false;
    }
  })();
}

/**
 * Shared membership verification for the current page. Concurrent callers share
 * one in-flight check. `force` starts a new check (Retry, login/logout).
 * Errors are never cached, so the next call retries.
 */
export function resolveVerifiedMemberAccess(
  options: { force?: boolean } & ResolveVerifiedMemberAccessDeps = {},
): Promise<VerifiedMemberAccess> {
  if (typeof window === "undefined") {
    return Promise.resolve({
      status: "verified",
      viewer: "loggedOut",
      memberId: null,
      payload: null,
    });
  }
  bindMemberstackInvalidation();
  const existing = window.__KBM_VERIFIED_MEMBER_ACCESS__;
  if (existing && !options.force) return existing;

  const work = resolveVerifiedMemberAccessUncached(options).then((result) => {
    if (result.status === "error" && window.__KBM_VERIFIED_MEMBER_ACCESS__ === work) {
      window.__KBM_VERIFIED_MEMBER_ACCESS__ = undefined;
    }
    return result;
  });
  window.__KBM_VERIFIED_MEMBER_ACCESS__ = work;
  return work;
}

declare global {
  interface Window {
    __KBM_VERIFIED_MEMBER_ACCESS__?: Promise<VerifiedMemberAccess>;
  }
}
