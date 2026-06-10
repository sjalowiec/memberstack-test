/**
 * Bookshelf usage tracking (client-side, best-effort).
 *
 * Fires small, anonymous-friendly events for the public Machine Knitter's
 * Bookshelf so we can answer: how many people viewed the bookshelf, opened a
 * book, searched, used filters, and added books to My Library (and which books
 * are added most). Events are POSTed to the `log-bookshelf-activity` Netlify
 * function (Netlify Blobs).
 *
 * Design rules (mirrors `patternActivityLog.ts`):
 * - Logging is **best-effort** and must NEVER block the UI or break the page.
 * - Failed requests are silently ignored.
 * - The bookshelf is public, so events are tracked for anonymous visitors too.
 *   We attach a stable, random per-device `visitorId` (no PII) and, when the
 *   visitor happens to be logged in, their Memberstack id — best-effort only.
 * - We never store the raw search term; only its length + the result count.
 */

export const BOOKSHELF_ACTIVITY_ENDPOINT = "/.netlify/functions/log-bookshelf-activity";

const VISITOR_ID_KEY = "kin_bookshelf_visitor_id";
const SEARCH_DEBOUNCE_MS = 700;

export type BookshelfEventType =
  | "bookshelf_viewed"
  | "bookshelf_book_viewed"
  | "bookshelf_search_used"
  | "bookshelf_filter_used"
  | "bookshelf_library_add"
  | "bookshelf_library_remove";

export type BookshelfFilterType = "topic" | "tag" | "scope";

export interface BookshelfTrackInput {
  eventType: BookshelfEventType;
  bookId?: string;
  bookTitle?: string;
  searchLength?: number;
  resultCount?: number;
  filterType?: BookshelfFilterType;
  filterValue?: string;
}

function generateId(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* ignore */
  }
  return `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable per-device id (anonymous). Returns undefined if storage is unavailable. */
function getVisitorId(): string | undefined {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = generateId();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/** Best-effort, synchronous read of the logged-in member id set by the header. */
function getMemberId(): string | undefined {
  try {
    const auth = (window as unknown as { __KBM_AUTH?: { memberId?: string | null } }).__KBM_AUTH;
    const id = auth?.memberId;
    return typeof id === "string" && id ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fire one bookshelf event. Never throws and never blocks the UI.
 * Returns immediately; the network request runs in the background.
 */
export function trackBookshelfEvent(input: BookshelfTrackInput): void {
  try {
    if (typeof window === "undefined" || typeof fetch !== "function") return;

    const payload: Record<string, unknown> = {
      id: generateId(),
      eventType: input.eventType,
      createdAt: new Date().toISOString(),
      sourcePage: window.location?.pathname,
    };

    const visitorId = getVisitorId();
    if (visitorId) payload.visitorId = visitorId;
    const memberId = getMemberId();
    if (memberId) payload.memberId = memberId;

    if (input.bookId) payload.bookId = input.bookId;
    if (input.bookTitle) payload.bookTitle = input.bookTitle;
    if (typeof input.searchLength === "number") payload.searchLength = input.searchLength;
    if (typeof input.resultCount === "number") payload.resultCount = input.resultCount;
    if (input.filterType) payload.filterType = input.filterType;
    if (input.filterValue) payload.filterValue = input.filterValue;

    void fetch(BOOKSHELF_ACTIVITY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* tracking failures are silently ignored */
    });
  } catch {
    /* tracking must never break the page */
  }
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

/** Count currently-visible cards (the inline filter logic toggles `style.display`). */
function countVisibleCards(grid: Element): number {
  let visible = 0;
  grid.querySelectorAll<HTMLElement>(".book-card").forEach((card) => {
    if (card.style.display !== "none") visible += 1;
  });
  return visible;
}

/** Read the human title for a saved/removed book id from a card in the DOM, if present. */
function titleFromDom(bookId: string): string | undefined {
  try {
    const card = document.querySelector(`.book-card[data-book-id="${CSS.escape(bookId)}"]`);
    const title = card?.querySelector(".book-card__title")?.textContent?.trim();
    return title || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Diff helper shared by both pages: compares the previous and current saved-id
 * lists from a `kin-bookshelf-change` event and fires add/remove events.
 * `resolveTitle` looks up a human title for the changed book id.
 */
function wireLibraryChangeTracking(resolveTitle: (id: string) => string | undefined): void {
  let prev: string[] = [];
  try {
    prev = window.KinBookshelf?.getIds?.() ?? [];
  } catch {
    prev = [];
  }

  window.addEventListener("kin-bookshelf-change", (event) => {
    try {
      const detail = (event as CustomEvent<{ ids?: unknown }>).detail;
      const next = Array.isArray(detail?.ids) ? detail.ids.map(String) : window.KinBookshelf?.getIds?.() ?? [];

      const prevSet = new Set(prev);
      const nextSet = new Set(next);

      for (const id of next) {
        if (!prevSet.has(id)) {
          trackBookshelfEvent({ eventType: "bookshelf_library_add", bookId: id, bookTitle: resolveTitle(id) });
        }
      }
      for (const id of prev) {
        if (!nextSet.has(id)) {
          trackBookshelfEvent({ eventType: "bookshelf_library_remove", bookId: id, bookTitle: resolveTitle(id) });
        }
      }

      prev = next;
    } catch {
      /* never break the page on a tracking diff */
    }
  });
}

/**
 * Wire all tracking for the bookshelf catalog page (`/reference/bookshelf`).
 * Safe to call once on page load; coexists with the page's existing inline
 * filter/library scripts without modifying them.
 */
export function initBookshelfIndexTracking(): void {
  try {
    trackBookshelfEvent({ eventType: "bookshelf_viewed" });

    const grid = document.getElementById("book-grid");
    const searchInput = document.getElementById("book-search") as HTMLInputElement | null;
    const topicFilter = document.getElementById("topic-filter") as HTMLSelectElement | null;
    const tagFilter = document.getElementById("tag-filter") as HTMLSelectElement | null;

    // Search — debounced so it never fires per keystroke. Term is not stored.
    if (searchInput && grid) {
      const fireSearch = debounce(() => {
        const length = searchInput.value.trim().length;
        if (length === 0) return;
        trackBookshelfEvent({
          eventType: "bookshelf_search_used",
          searchLength: length,
          resultCount: countVisibleCards(grid),
        });
      }, SEARCH_DEBOUNCE_MS);
      searchInput.addEventListener("input", fireSearch);
    }

    // Topic / tag filters — fire only when an actual value is selected.
    const wireSelect = (select: HTMLSelectElement | null, filterType: BookshelfFilterType) => {
      if (!select || !grid) return;
      select.addEventListener("change", () => {
        const value = select.value;
        if (!value) return;
        trackBookshelfEvent({
          eventType: "bookshelf_filter_used",
          filterType,
          filterValue: value,
          resultCount: countVisibleCards(grid),
        });
      });
    };
    wireSelect(topicFilter, "topic");
    wireSelect(tagFilter, "tag");

    // Scope toggle (All Books / My Books).
    document.querySelectorAll<HTMLElement>(".scope-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-scope") || "";
        if (!grid) return;
        trackBookshelfEvent({
          eventType: "bookshelf_filter_used",
          filterType: "scope",
          filterValue: value,
          resultCount: countVisibleCards(grid),
        });
      });
    });

    wireLibraryChangeTracking((id) => titleFromDom(id));
  } catch {
    /* tracking must never break the page */
  }
}

/**
 * Wire tracking for a single book detail page (`/reference/bookshelf/[id]`).
 * Reads `data-book-id` / `data-book-title` from the `.book-detail` element.
 */
export function initBookshelfDetailTracking(): void {
  try {
    const root = document.querySelector<HTMLElement>(".book-detail");
    const bookId = root?.getAttribute("data-book-id") || undefined;
    const bookTitle = root?.getAttribute("data-book-title") || undefined;

    trackBookshelfEvent({ eventType: "bookshelf_book_viewed", bookId, bookTitle });

    wireLibraryChangeTracking((id) => (id === bookId ? bookTitle : titleFromDom(id)));
  } catch {
    /* tracking must never break the page */
  }
}
