/**
 * Tip of the Week feedback — client helpers.
 *
 * The public page offers two choices: Helpful (`helped`) and Not for me
 * (`not_for_me`). Older choices (`will_try`, `more_like_this`) stay valid so
 * stored responses still count.
 *
 * One reaction blob per tipId + visitorId. Repeating the same choice does
 * not write again. A topic suggestion is a separate blob and is optional.
 */

import {
  reportTipFeedbackChoice,
  reportTipTopicSuggestion,
  type TipOfTheWeekGaContext,
} from "./analytics/tipOfTheWeekGa";

export const TIP_REACTION_ENDPOINT = "/.netlify/functions/log-tip-reaction";
export const TIP_VISITOR_ID_KEY = "kin_tip_visitor_id";
export const TIP_TOPIC_MAX_LENGTH = 500;

export const TIP_FEEDBACK_CHOICES = [
  { id: "helped", label: "Helpful" },
  { id: "not_for_me", label: "Not for me" },
] as const;

/** Retired buttons. Still recognized so historical responses keep their ids. */
export const TIP_REACTION_HISTORY = [
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

export const TIP_REACTIONS = [...TIP_FEEDBACK_CHOICES, ...TIP_REACTION_HISTORY] as const;

export type TipFeedbackChoiceId = (typeof TIP_FEEDBACK_CHOICES)[number]["id"];
export type TipReactionId = (typeof TIP_REACTIONS)[number]["id"];

export const TIP_REACTION_THANKS =
  "Thanks! Your response helps me choose future tips.";

export const TIP_TOPIC_PROMPT = "What topic would you like us to cover?";
export const TIP_TOPIC_SUBMIT_LABEL = "Submit";
export const TIP_TOPIC_THANKS = "Thanks. We saved your topic idea.";
export const TIP_TOPIC_EMPTY = "You can leave this blank.";

export function isTipFeedbackChoice(value: unknown): value is TipFeedbackChoiceId {
  return TIP_FEEDBACK_CHOICES.some((choice) => choice.id === value);
}

export function isTipReactionId(value: unknown): value is TipReactionId {
  return TIP_REACTIONS.some((reaction) => reaction.id === value);
}

export function tipReactionStorageKey(tipId: string): string {
  return `kin_tip_reaction_${String(tipId || "").trim()}`;
}

export function tipTopicStorageKey(tipId: string): string {
  return `kin_tip_topic_${String(tipId || "").trim()}`;
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

export function normalizeTipTopic(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, TIP_TOPIC_MAX_LENGTH);
}

export function readStoredTipTopic(
  tipId: string,
  storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): string {
  if (!storage) return "";
  try {
    return normalizeTipTopic(storage.getItem(tipTopicStorageKey(tipId)));
  } catch {
    return "";
  }
}

export function writeStoredTipTopic(
  tipId: string,
  topic: string,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(tipTopicStorageKey(tipId), normalizeTipTopic(topic));
  } catch {
    /* ignore quota / private mode */
  }
}

export type TipReactionDomRoot = {
  querySelectorAll: (selectors: string) => ArrayLike<TipReactionButtonEl>;
  querySelector: (selectors: string) => TipReactionThanksEl | TipReactionFollowupEl | null;
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

export type TipReactionFollowupEl = {
  hidden: boolean;
};

/**
 * Apply selected state to the two feedback buttons and show the follow-up.
 * Only one choice is active at a time.
 */
export function applyTipReactionSelection(
  root: TipReactionDomRoot,
  reactionId: TipFeedbackChoiceId,
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
  if (thanks && "textContent" in thanks) {
    thanks.hidden = false;
    thanks.textContent = TIP_REACTION_THANKS;
    thanks.setAttribute("aria-live", "polite");
  }

  const followup = root.querySelector("[data-tip-reaction-followup]");
  if (followup) followup.hidden = false;
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

export function persistTipTopic(input: {
  tipId: string;
  topic: string;
  fetchImpl?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
}): void {
  try {
    const topic = normalizeTipTopic(input.topic);
    if (!topic) return;

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
      topicSuggestion: topic,
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

export type TipTopicSubmitStatus = "empty" | "unchanged" | "saved";

/**
 * Save an optional topic suggestion. An empty field does not create a record.
 * Sending the same text again does not write a second response.
 */
export function submitTipTopic(input: {
  tipId: string;
  topic: string;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  fetchImpl?: typeof fetch;
  skipPersist?: boolean;
  gaContext?: TipOfTheWeekGaContext;
}): TipTopicSubmitStatus {
  const topic = normalizeTipTopic(input.topic);
  if (!topic) return "empty";

  const storage =
    input.storage !== undefined
      ? input.storage
      : typeof localStorage !== "undefined"
        ? localStorage
        : null;

  if (readStoredTipTopic(input.tipId, storage) === topic) return "unchanged";

  writeStoredTipTopic(input.tipId, topic, storage);
  if (!input.skipPersist) {
    persistTipTopic({
      tipId: input.tipId,
      topic,
      fetchImpl: input.fetchImpl,
      storage,
    });
    reportTipTopicSuggestion(input.tipId, input.gaContext);
  }
  return "saved";
}

/**
 * Select a feedback choice: update the UI, store it locally, and upsert it.
 * Clicking the choice that is already saved does not write again.
 */
export function selectTipReaction(
  root: TipReactionDomRoot,
  tipId: string,
  reactionId: TipFeedbackChoiceId,
  options?: {
    storage?: Pick<Storage, "getItem" | "setItem"> | null;
    fetchImpl?: typeof fetch;
    skipPersist?: boolean;
    gaContext?: TipOfTheWeekGaContext;
  },
): void {
  if (!isTipFeedbackChoice(reactionId)) return;

  const storage =
    options?.storage !== undefined
      ? options.storage
      : typeof localStorage !== "undefined"
        ? localStorage
        : null;

  applyTipReactionSelection(root, reactionId);
  if (readStoredTipReaction(tipId, storage) === reactionId) return;

  writeStoredTipReaction(tipId, reactionId, storage);

  if (!options?.skipPersist) {
    persistTipReaction({
      tipId,
      reaction: reactionId,
      fetchImpl: options?.fetchImpl,
      storage,
    });
    reportTipFeedbackChoice(tipId, reactionId, options?.gaContext);
  }
}

/**
 * Restore a current choice on page load (no re-POST).
 * A retired choice stays in storage and is not shown as selected.
 */
export function hydrateTipReactions(
  root: TipReactionDomRoot,
  tipId: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): TipReactionId | null {
  const existing = readStoredTipReaction(tipId, storage);
  if (existing && isTipFeedbackChoice(existing)) applyTipReactionSelection(root, existing);
  return existing;
}
