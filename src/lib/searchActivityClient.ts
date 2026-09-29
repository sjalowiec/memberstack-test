/**
 * One recorded search per settled term.
 *
 * A search is settled when the visitor presses Enter, or when the query has
 * not changed for {@link SEARCH_COMMIT_IDLE_MS} after the on-screen results
 * were updated for that exact query. A newer keystroke replaces the unsent
 * search, so partial words are not recorded while someone is still typing.
 * Opening search, reloading an address that already contains the query, and
 * clicking a result do not send an event. The same settled query is not sent
 * again until it is cleared or changed.
 * Personal-looking terms are sent without the words.
 */

import {
  classifySearchTerm,
  cleanResultCount,
  isSearchActivityArea,
  SEARCH_COMMIT_IDLE_MS,
  type SearchActivityArea,
} from "./searchActivity";

export { SEARCH_COMMIT_IDLE_MS };
export const SEARCH_ACTIVITY_ENDPOINT = "/api/search-activity";

export type SearchCommitDetail = {
  area?: string;
  term?: string;
  resultCount?: number;
  remember?: boolean;
};

type PreparedCommit = {
  area: SearchActivityArea;
  key: string;
  resultCount: number;
  term?: string;
  termOmitted?: "personal";
};

export function prepareSearchCommit(detail: SearchCommitDetail): PreparedCommit | "clear" | null {
  if (!isSearchActivityArea(detail?.area)) return null;
  if (typeof detail.term !== "string" || !detail.term.trim()) return "clear";
  const resultCount = cleanResultCount(detail.resultCount);
  if (resultCount === null) return null;
  const classified = classifySearchTerm(detail.term);
  if (classified.empty) return "clear";
  if (classified.omit) {
    return {
      area: detail.area,
      key: `${detail.area}\0${classified.term}`,
      resultCount,
      termOmitted: "personal",
    };
  }
  return {
    area: detail.area,
    key: `${detail.area}\0${classified.term}`,
    resultCount,
    term: classified.term,
  };
}

export function createSearchCommitScheduler(options: {
  idleMs?: number;
  post: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const idleMs = options.idleMs ?? SEARCH_COMMIT_IDLE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: PreparedCommit | null = null;
  const lastSent = new Map<SearchActivityArea, string>();

  async function sendPending(): Promise<void> {
    if (!pending) return;
    const current = pending;
    pending = null;
    if (lastSent.get(current.area) === current.key) return;
    lastSent.set(current.area, current.key);
    const sender = await resolveSearchSender();
    const body: Record<string, unknown> = {
      area: current.area,
      resultCount: current.resultCount,
      identity: sender.identity,
    };
    if (current.termOmitted) body.termOmitted = "personal";
    else body.term = current.term;
    const token = sender.token;
    const ok = await options.post(
      token ? { ...body, __authorization: token } : body,
    );
    if (!ok) lastSent.delete(current.area);
  }

  return {
    schedule(detail: SearchCommitDetail) {
      const prepared = prepareSearchCommit(detail);
      if (prepared === "clear") {
        pending = null;
        if (timer) clearTimeout(timer);
        timer = null;
        if (isSearchActivityArea(detail.area)) lastSent.delete(detail.area);
        return;
      }
      if (!prepared) return;
      if (timer && pending && pending.key === prepared.key) {
        pending = prepared;
        return;
      }
      pending = prepared;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void sendPending();
      }, idleMs);
    },
    flush() {
      if (timer) clearTimeout(timer);
      timer = null;
      void sendPending();
    },
    /** Drops an unsent search. Does not forget a search that was already sent. */
    cancel() {
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    remember(detail: SearchCommitDetail) {
      const prepared = prepareSearchCommit(detail);
      if (!prepared || prepared === "clear") return;
      lastSent.set(prepared.area, prepared.key);
    },
  };
}

async function readMemberCookie(): Promise<string | null> {
  try {
    const token = await window.$memberstackDom?.getMemberCookie?.();
    return typeof token === "string" && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Signed-out visitors are guests once the header or Memberstack says nobody
 * is logged in. A signed-in id is never taken from the page; the server
 * verifies the session token.
 */
async function resolveSearchSender(): Promise<{
  identity: "guest" | "unknown";
  token: string | null;
}> {
  if (typeof window === "undefined") return { identity: "unknown", token: null };
  const started = Date.now();
  while (Date.now() - started < 800) {
    const loggedIn = window.__KBM_AUTH?.loggedIn;
    if (loggedIn === false) return { identity: "guest", token: null };
    if (loggedIn === true) return { identity: "unknown", token: await readMemberCookie() };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const ms = window.$memberstackDom;
  if (!ms) return { identity: "unknown", token: null };
  try {
    if (ms.onReady) await ms.onReady;
    const member = await ms.getCurrentMember?.();
    const id = member?.data?.id || member?.id;
    if (typeof id === "string" && /^mem_/.test(id)) {
      return { identity: "unknown", token: await readMemberCookie() };
    }
    return { identity: "guest", token: null };
  } catch {
    return { identity: "unknown", token: null };
  }
}

let installed = false;

/** Binds the page-wide commit logger. Safe to call once per page. */
export function installSearchCommitLogger(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  const scheduler = createSearchCommitScheduler({
    post: async (body) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = body.__authorization;
      const payload = { ...body };
      delete payload.__authorization;
      if (typeof token === "string" && token) headers.Authorization = `Bearer ${token}`;
      try {
        const response = await fetch(SEARCH_ACTIVITY_ENDPOINT, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          keepalive: true,
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  });
  window.__kinScheduleSearchCommit = (detail) => scheduler.schedule(detail);
  window.__kinFlushSearchCommit = () => scheduler.flush();
  window.__kinCancelSearchCommit = () => scheduler.cancel();
  window.__kinRememberSearchCommit = (detail) => scheduler.remember(detail);
  const queued = window.__kinSearchCommitQueue ?? [];
  window.__kinSearchCommitQueue = [];
  for (const detail of queued) {
    if (detail.remember) scheduler.remember(detail);
    else scheduler.schedule(detail);
  }
}

export function queueSearchCommit(detail: SearchCommitDetail): void {
  if (typeof window === "undefined") return;
  if (typeof window.__kinScheduleSearchCommit === "function") {
    window.__kinScheduleSearchCommit(detail);
    return;
  }
  window.__kinSearchCommitQueue = window.__kinSearchCommitQueue ?? [];
  window.__kinSearchCommitQueue.push(detail);
}

/** Marks a term as already recorded so a preserved ?q= does not create an event. */
export function rememberSearchCommit(detail: SearchCommitDetail): void {
  if (typeof window === "undefined") return;
  if (typeof window.__kinRememberSearchCommit === "function") {
    window.__kinRememberSearchCommit(detail);
    return;
  }
  window.__kinSearchCommitQueue = window.__kinSearchCommitQueue ?? [];
  window.__kinSearchCommitQueue.push({ ...detail, remember: true });
}
