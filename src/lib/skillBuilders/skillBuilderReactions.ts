/**
 * Skill Builder practice reactions — client helpers.
 *
 * Mirrors Tip of the Week: localStorage keeps one choice per Skill Builder;
 * Netlify Blobs upserts by skillBuilderId + visitorId so a changed choice
 * replaces the previous record instead of counting twice.
 *
 * Does not send email or create alerts.
 */
import { getTipVisitorId } from "../tipOfTheWeekReactions";
import {
  SKILL_BUILDER_FEEDBACK_SAVE_ERROR,
  SKILL_BUILDER_FEEDBACK_THANKS,
  SKILL_BUILDER_REACTION_CONTENT_TYPE,
  SKILL_BUILDER_REACTIONS,
  isSkillBuilderReactionId,
  type SkillBuilderReactionId,
} from "./skillBuilderFeedback";
import { SKILL_BUILDER_MEMBER_BODY_MOUNTED_EVENT } from "./skillBuilderMemberGate";

export const SKILL_BUILDER_REACTION_ENDPOINT = "/.netlify/functions/log-skill-builder-reaction";

export { SKILL_BUILDER_REACTIONS, isSkillBuilderReactionId };
export type { SkillBuilderReactionId };

export function skillBuilderReactionStorageKey(skillBuilderId: string): string {
  return `kin_sb_reaction_${String(skillBuilderId || "").trim()}`;
}

export function readStoredSkillBuilderReaction(
  skillBuilderId: string,
  storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): SkillBuilderReactionId | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(skillBuilderReactionStorageKey(skillBuilderId));
    return isSkillBuilderReactionId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredSkillBuilderReaction(
  skillBuilderId: string,
  reaction: SkillBuilderReactionId,
  storage: Pick<Storage, "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(skillBuilderReactionStorageKey(skillBuilderId), reaction);
  } catch {
    /* ignore quota / private mode */
  }
}

export type SkillBuilderReactionButtonEl = {
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  classList: { add: (c: string) => void; remove: (c: string) => void };
};

export type SkillBuilderReactionStatusEl = {
  hidden: boolean;
  textContent: string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
};

export type SkillBuilderReactionHelpEl = {
  hidden: boolean;
};

export type SkillBuilderReactionDomRoot = {
  querySelectorAll: (selectors: string) => ArrayLike<SkillBuilderReactionButtonEl>;
  querySelector: (selectors: string) => SkillBuilderReactionStatusEl | SkillBuilderReactionHelpEl | null;
};

function setStatus(
  status: SkillBuilderReactionStatusEl | null,
  message: string,
  kind: "success" | "error" | "polite",
): void {
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
  if (kind === "error") {
    status.setAttribute("role", "alert");
    status.setAttribute("aria-live", "assertive");
  } else {
    status.removeAttribute("role");
    status.setAttribute("aria-live", "polite");
  }
}

function setHelpVisible(root: SkillBuilderReactionDomRoot, visible: boolean): void {
  const help = root.querySelector("[data-sb-feedback-help]");
  if (help && "hidden" in help) {
    (help as SkillBuilderReactionHelpEl).hidden = !visible;
  }
}

/**
 * Apply selected state. Labels (not emoji) communicate the choice.
 * Only one reaction is active at a time.
 */
export function applySkillBuilderReactionSelection(
  root: SkillBuilderReactionDomRoot,
  reactionId: SkillBuilderReactionId,
): void {
  const buttons = Array.from(root.querySelectorAll("[data-sb-feedback-reaction]"));
  for (const btn of buttons) {
    const id = btn.getAttribute("data-sb-feedback-reaction");
    const selected = id === reactionId;
    if (selected) {
      btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.classList.remove("is-selected");
      btn.setAttribute("aria-pressed", "false");
    }
  }
  setHelpVisible(root, reactionId === "need_help");
}

export async function persistSkillBuilderReaction(input: {
  skillBuilderId: string;
  reaction: SkillBuilderReactionId;
  fetchImpl?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
}): Promise<boolean> {
  try {
    const fetchImpl = input.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
    if (!fetchImpl) return false;

    const storage =
      input.storage !== undefined
        ? input.storage
        : typeof localStorage !== "undefined"
          ? localStorage
          : null;
    const visitorId = getTipVisitorId(storage);

    const payload: Record<string, unknown> = {
      contentType: SKILL_BUILDER_REACTION_CONTENT_TYPE,
      skillBuilderId: input.skillBuilderId,
      reaction: input.reaction,
      createdAt: new Date().toISOString(),
      sourcePage: typeof window !== "undefined" ? window.location?.pathname : "",
    };
    if (visitorId) payload.visitorId = visitorId;

    try {
      const auth = (window as unknown as { __KBM_AUTH?: { memberId?: string | null } }).__KBM_AUTH;
      const memberId = auth?.memberId;
      if (typeof memberId === "string" && memberId) payload.memberId = memberId;
    } catch {
      /* optional */
    }

    const res = await fetchImpl(SKILL_BUILDER_REACTION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return Boolean(res && res.ok);
  } catch {
    return false;
  }
}

export async function selectSkillBuilderReaction(
  root: SkillBuilderReactionDomRoot,
  skillBuilderId: string,
  reactionId: SkillBuilderReactionId,
  options?: {
    storage?: Pick<Storage, "getItem" | "setItem"> | null;
    fetchImpl?: typeof fetch;
    skipPersist?: boolean;
  },
): Promise<void> {
  const storage =
    options?.storage !== undefined
      ? options.storage
      : typeof localStorage !== "undefined"
        ? localStorage
        : null;

  applySkillBuilderReactionSelection(root, reactionId);
  writeStoredSkillBuilderReaction(skillBuilderId, reactionId, storage);

  const status = root.querySelector("[data-sb-feedback-status]") as SkillBuilderReactionStatusEl | null;

  if (options?.skipPersist) {
    setStatus(status, SKILL_BUILDER_FEEDBACK_THANKS, "success");
    return;
  }

  const saved = await persistSkillBuilderReaction({
    skillBuilderId,
    reaction: reactionId,
    fetchImpl: options?.fetchImpl,
    storage,
  });
  setStatus(
    status,
    saved ? SKILL_BUILDER_FEEDBACK_THANKS : SKILL_BUILDER_FEEDBACK_SAVE_ERROR,
    saved ? "success" : "error",
  );
}

export function hydrateSkillBuilderReactions(
  root: SkillBuilderReactionDomRoot,
  skillBuilderId: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null,
): SkillBuilderReactionId | null {
  const existing = readStoredSkillBuilderReaction(skillBuilderId, storage);
  if (existing) {
    applySkillBuilderReactionSelection(root, existing);
    const status = root.querySelector("[data-sb-feedback-status]") as SkillBuilderReactionStatusEl | null;
    setStatus(status, SKILL_BUILDER_FEEDBACK_THANKS, "polite");
  }
  return existing;
}

function bindSkillBuilderFeedbackRoot(root: HTMLElement): void {
  if (root.dataset.sbFeedbackBound === "true") return;
  const skillBuilderId = root.getAttribute("data-sb-feedback-id")?.trim() || "";
  if (!skillBuilderId) return;
  root.dataset.sbFeedbackBound = "true";

  hydrateSkillBuilderReactions(root, skillBuilderId);

  root.querySelectorAll<HTMLButtonElement>("[data-sb-feedback-reaction]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const reaction = btn.getAttribute("data-sb-feedback-reaction");
      if (!isSkillBuilderReactionId(reaction)) return;
      void selectSkillBuilderReaction(root, skillBuilderId, reaction);
    });
  });
}

/** Hydrate every feedback block currently in the live DOM (idempotent). */
export function bootSkillBuilderFeedback(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-sb-feedback]").forEach((el) => {
    bindSkillBuilderFeedbackRoot(el);
  });
}

let pageBootBound = false;

/** Bind once per page; re-run after member-gated markup is mounted. */
export function bindSkillBuilderFeedbackPage(): void {
  bootSkillBuilderFeedback();
  if (pageBootBound) return;
  pageBootBound = true;
  window.addEventListener(SKILL_BUILDER_MEMBER_BODY_MOUNTED_EVENT, () => {
    bootSkillBuilderFeedback();
  });
}

export function resetSkillBuilderFeedbackPageBindForTests(): void {
  pageBootBound = false;
}
