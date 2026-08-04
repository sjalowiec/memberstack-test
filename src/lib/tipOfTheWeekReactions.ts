/**
 * Tip of the Week one-click reactions — client helpers.
 *
 * UI selection persists in localStorage (one choice per tipId per visitor).
 * Server totals are recorded best-effort via `log-tip-reaction` (Netlify Blobs),
 * upserting by tipId + visitorId so changing a choice updates rather than duplicates.
 */

export const TIP_REACTION_ENDPOINT = "/.netlify/functions/log-tip-reaction";
export const TIP_VISITOR_ID_KEY = "kin_tip_visitor_id";

export const TIP_REACTIONS = [
  {
    id: "helped",
    label: "This helped",
    emoji: "👍",
  },
  {
    id: "will_try",
    label: "I’m going to try it",
    emoji: "🙂",
  },
  {
    id: "more_like_this",
    label: "Show me more like this",
    emoji: "💡",
  },
] as const;

export type TipReactionId = (typeof TIP_REACTIONS)[number]["id"];

export const TIP_REACTION_THANKS =
  "Thanks! Your response helps me choose future tips.";

export function isTipReactionId(value: unknown): value is TipReactionId {
  return TIP_REACTIONS.some((r) => r.id === value);
}

export function tipReactionStorageKey(tipId: string): string {
  return `kin_tip_reaction_${String(tipId || "").trim()}`;
}

function generateId(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* ignore */
  }
  return `tip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable per-device visitor id (no PII). */
export function getTipVisitorId(
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): string | undefined {
  if (!storage) return undefined;
  try {
    let id = storage.getItem(TIP_VISITOR_ID_KEY);
    if (!id) {
      id = generateId();
      storage.setItem(TIP_VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export function readStoredTipReaction(
  tipId: string,
  storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): TipReactionId | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(tipReactionStorageKey(tipId));
    return isTipReactionId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredTipReaction(
  tipId: string,
  reaction: TipReactionId,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(tipReactionStorageKey(tipId), reaction);
  } catch {
    /* ignore quota / private mode */
  }
}

export type TipReactionDomRoot = {
  querySelectorAll: (selectors: string) => ArrayLike<TipReactionButtonEl>;
  querySelector: (selectors: string) => TipReactionThanksEl | null;
};

export type TipReactionButtonEl = {
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  classList: { add: (c: string) => void; remove: (c: string) => void; contains: (c: string) => boolean };
};

export type TipReactionThanksEl = {
  hidden: boolean;
  textContent: string | null;
  setAttribute: (name: string, value: string) => void;
};

/**
 * Apply selected state to reaction buttons and show the confirmation message.
 * Only one reaction is active at a time.
 */
export function applyTipReactionSelection(
  root: TipReactionDomRoot,
  reactionId: TipReactionId,
): void {
  const buttons = Array.from(root.querySelectorAll("[data-tip-reaction]"));
  for (const btn of buttons) {
    const id = btn.getAttribute("data-tip-reaction");
    const selected = id === reactionId;
    if (selected) {
      btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.classList.remove("is-selected");
      btn.setAttribute("aria-pressed", "false");
    }
  }

  const thanks = root.querySelector("[data-tip-reaction-thanks]");
  if (thanks) {
    thanks.hidden = false;
    thanks.textContent = TIP_REACTION_THANKS;
    thanks.setAttribute("aria-live", "polite");
  }
}

/** Best-effort POST; never throws; never blocks the UI. */
export function persistTipReaction(input: {
  tipId: string;
  reaction: TipReactionId;
  fetchImpl?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
}): void {
  try {
    const fetchImpl = input.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
    if (!fetchImpl) return;

    const storage =
      input.storage !== undefined
        ? input.storage
        : typeof localStorage !== "undefined"
          ? localStorage
          : null;
    const visitorId = getTipVisitorId(storage);

    const payload: Record<string, unknown> = {
      tipId: input.tipId,
      reaction: input.reaction,
      createdAt: new Date().toISOString(),
      sourcePage: typeof window !== "undefined" ? window.location?.pathname : "/tip-of-the-week",
    };
    if (visitorId) payload.visitorId = visitorId;

    try {
      const auth = (window as unknown as { __KBM_AUTH?: { memberId?: string | null } }).__KBM_AUTH;
      const memberId = auth?.memberId;
      if (typeof memberId === "string" && memberId) payload.memberId = memberId;
    } catch {
      /* optional */
    }

    void fetchImpl(TIP_REACTION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  } catch {
    /* never break the page */
  }
}

/**
 * Select a reaction: update UI, store locally, upsert server-side.
 * Changing choice replaces the previous selection (UI + storage + blob upsert).
 */
export function selectTipReaction(
  root: TipReactionDomRoot,
  tipId: string,
  reactionId: TipReactionId,
  options?: {
    storage?: Pick<Storage, "getItem" | "setItem"> | null;
    fetchImpl?: typeof fetch;
    skipPersist?: boolean;
  },
): void {
  const storage =
    options?.storage !== undefined
      ? options.storage
      : typeof localStorage !== "undefined"
        ? localStorage
        : null;

  applyTipReactionSelection(root, reactionId);
  writeStoredTipReaction(tipId, reactionId, storage);

  if (!options?.skipPersist) {
    persistTipReaction({
      tipId,
      reaction: reactionId,
      fetchImpl: options?.fetchImpl,
      storage,
    });
  }
}

/** Restore a previously stored selection on page load (no re-POST). */
export function hydrateTipReactions(
  root: TipReactionDomRoot,
  tipId: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): TipReactionId | null {
  const existing = readStoredTipReaction(tipId, storage);
  if (existing) applyTipReactionSelection(root, existing);
  return existing;
}
