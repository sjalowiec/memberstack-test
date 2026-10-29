/**
 * My Notes on the saved-pattern sticky nav.
 * Notes are stored on the saved project blob. This module only keeps an in-memory
 * copy for the open editor and the button indicator.
 */
import { patchCustomPatternProjectMemberNotes, loadCustomPatternProject } from "../lib/patterns/customPatternProjectClient";
import { isSavedPatternReadOnlyDocument } from "../lib/patterns/savedPatternReadOnlyChrome";
import {
  memberNotesFeedbackAfterLoad,
  memberNotesFeedbackAfterSave,
  memberNotesFromProject,
  readSavedPatternMemberNotesTarget,
  savedPatternHasMemberNotes,
  type MemberNotesFeedback,
} from "../lib/patterns/savedPatternMemberNotes";
import { setPatternInpageNavSyncHook } from "../lib/patterns/patternInpageNav";

const OPEN_ATTR = "data-saved-pattern-member-notes-open";
const sessionNotes = new Map<string, string>();

function setShown(el: HTMLElement, shown: boolean, displayWhenShown: string): void {
  el.hidden = !shown;
  el.style.display = shown ? displayWhenShown : "none";
}

function applyFeedback(
  feedback: MemberNotesFeedback,
  els: {
    textarea: HTMLTextAreaElement;
    save: HTMLButtonElement;
    status: HTMLElement;
  },
  phase: "loading" | "ready" | "saving",
): void {
  const viewOnly = isSavedPatternReadOnlyDocument();
  els.textarea.value = feedback.draft;
  els.textarea.readOnly = viewOnly || phase !== "ready";
  const canSave = feedback.canSave && !viewOnly && phase === "ready";
  els.save.disabled = !canSave;
  setShown(els.save, !viewOnly, "inline-flex");
  els.status.textContent =
    viewOnly && phase === "ready" && feedback.tone !== "error"
      ? "An active membership is required to change these notes."
      : feedback.message;
  els.status.dataset.tone = feedback.tone === "neutral" && viewOnly ? "neutral" : feedback.tone;
}

export function bindSavedPatternMemberNotes(doc: Document = document): void {
  const button = doc.querySelector(`[${OPEN_ATTR}]`);
  if (!(button instanceof HTMLButtonElement)) return;
  if (button.dataset.memberNotesBound === "true") {
    refreshSavedPatternMemberNotes(button);
    return;
  }
  button.dataset.memberNotesBound = "true";

  const dialog = doc.getElementById("saved-pattern-member-notes-dialog");
  const textarea = doc.getElementById("saved-pattern-member-notes-input");
  const save = doc.querySelector("[data-saved-pattern-member-notes-save]");
  const cancel = doc.querySelector("[data-saved-pattern-member-notes-cancel]");
  const status = doc.querySelector("[data-saved-pattern-member-notes-status]");
  const mark = button.querySelector("[data-saved-pattern-member-notes-mark]");
  const savedLabel = button.querySelector("[data-saved-pattern-member-notes-saved-label]");
  const form = doc.querySelector("[data-saved-pattern-member-notes-form]");
  if (
    !(dialog instanceof HTMLDialogElement) ||
    !(textarea instanceof HTMLTextAreaElement) ||
    !(save instanceof HTMLButtonElement) ||
    !(cancel instanceof HTMLButtonElement) ||
    !(status instanceof HTMLElement) ||
    !(mark instanceof HTMLElement) ||
    !(savedLabel instanceof HTMLElement) ||
    !(form instanceof HTMLFormElement)
  ) {
    return;
  }

  const els = { textarea, save, status };
  let openId = "";
  let requestToken = 0;
  let phase: "loading" | "ready" | "saving" = "ready";
  let stored: string | null = null;

  function renderIndicator(projectId: string): void {
    const current = readSavedPatternMemberNotesTarget();
    if (!current || current.projectId !== projectId) return;
    const notes = sessionNotes.get(projectId) ?? "";
    const hasNotes = savedPatternHasMemberNotes(notes);
    setShown(mark, hasNotes, "inline-block");
    setShown(savedLabel, hasNotes, "inline");
  }

  function remember(projectId: string, notes: string): void {
    sessionNotes.set(projectId, notes);
    renderIndicator(projectId);
  }

  setPatternInpageNavSyncHook((nav) => {
    const notesButton = nav.querySelector(`[${OPEN_ATTR}]`);
    if (notesButton instanceof HTMLButtonElement) refreshSavedPatternMemberNotes(notesButton);
  });

  button.addEventListener("click", () => {
    void openEditor();
  });

  cancel.addEventListener("click", () => {
    dialog.close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveNotes();
  });

  dialog.addEventListener("cancel", () => {
    requestToken += 1;
  });

  dialog.addEventListener("close", () => {
    button.setAttribute("aria-expanded", "false");
    requestToken += 1;
    phase = "ready";
    if (typeof button.focus === "function") button.focus();
  });

  async function openEditor(): Promise<void> {
    const target = readSavedPatternMemberNotesTarget();
    if (!target) return;
    openId = target.projectId;
    const token = ++requestToken;
    stored = sessionNotes.has(openId) ? (sessionNotes.get(openId) ?? "") : null;
    phase = "loading";
    applyFeedback(
      {
        draft: stored ?? "",
        stored,
        message: stored === null ? "Loading notes…" : "",
        canSave: false,
        tone: "neutral",
      },
      els,
      phase,
    );
    button.setAttribute("aria-expanded", "true");
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    else dialog.setAttribute("open", "");

    let loaded: Awaited<ReturnType<typeof loadCustomPatternProject>>;
    try {
      loaded = await loadCustomPatternProject(target.projectId, target.family);
    } catch {
      loaded = { ok: false, error: "Could not load notes." };
    }
    if (token !== requestToken || !dialog.open || openId !== target.projectId) return;
    if (sessionNotes.has(target.projectId)) {
      stored = sessionNotes.get(target.projectId) ?? "";
    }
    const feedback = memberNotesFeedbackAfterLoad({
      draft: textarea.readOnly && stored !== null ? stored : textarea.value,
      previousStored: stored,
      result: loaded.ok
        ? { ok: true, notes: memberNotesFromProject(loaded.project) }
        : { ok: false, error: loaded.error },
    });
    stored = feedback.stored;
    if (feedback.stored !== null) remember(target.projectId, feedback.stored);
    phase = "ready";
    applyFeedback(feedback, els, phase);
    const focusTarget = textarea.readOnly ? cancel : textarea;
    focusTarget.focus();
  }

  async function saveNotes(): Promise<void> {
    if (save.disabled || phase !== "ready" || !openId) return;
    const targetId = openId;
    const draftAtSave = textarea.value;
    const token = ++requestToken;
    phase = "saving";
    applyFeedback(
      {
        draft: draftAtSave,
        stored,
        message: "Saving…",
        canSave: false,
        tone: "neutral",
      },
      els,
      phase,
    );

    let saved: Awaited<ReturnType<typeof patchCustomPatternProjectMemberNotes>>;
    try {
      saved = await patchCustomPatternProjectMemberNotes(targetId, draftAtSave, "sleeveless");
    } catch {
      saved = { ok: false, error: "Could not save notes." };
    }
    const dialogStillOpen = dialog.open && token === requestToken && openId === targetId;
    if (!saved.ok) {
      phase = "ready";
      if (!dialogStillOpen) return;
      applyFeedback(
        memberNotesFeedbackAfterSave({
          draftAtSave,
          draftNow: textarea.value,
          previousStored: stored,
          result: { ok: false, error: saved.error },
        }),
        els,
        phase,
      );
      textarea.focus();
      return;
    }

    const notes = memberNotesFromProject(saved.project);
    remember(targetId, notes);
    stored = notes;
    phase = "ready";
    if (!dialogStillOpen) return;
    applyFeedback(
      memberNotesFeedbackAfterSave({
        draftAtSave,
        draftNow: textarea.value,
        previousStored: stored,
        result: { ok: true, notes },
      }),
      els,
      phase,
    );
  }

  refreshSavedPatternMemberNotes(button);
}

/** Clears the in-memory notes cache. Tests only. */
export function resetSavedPatternMemberNotesForTests(): void {
  sessionNotes.clear();
  prefetching.clear();
  setPatternInpageNavSyncHook(null);
}

export function refreshSavedPatternMemberNotes(button: HTMLButtonElement): void {
  const target = readSavedPatternMemberNotesTarget();
  const visible = Boolean(target);
  setShown(button, visible, "inline-flex");
  if (!visible) {
    button.setAttribute("aria-expanded", "false");
    return;
  }
  const mark = button.querySelector("[data-saved-pattern-member-notes-mark]");
  const savedLabel = button.querySelector("[data-saved-pattern-member-notes-saved-label]");
  const notes = sessionNotes.get(target!.projectId) ?? "";
  const hasNotes = sessionNotes.has(target!.projectId) && savedPatternHasMemberNotes(notes);
  if (mark instanceof HTMLElement) setShown(mark, hasNotes, "inline-block");
  if (savedLabel instanceof HTMLElement) setShown(savedLabel, hasNotes, "inline");
  if (!sessionNotes.has(target!.projectId)) {
    void prefetchMemberNotes(target!.projectId, button);
  }
  const nav = button.closest("[data-saved-pattern-sticky-nav]");
  if (nav instanceof HTMLElement && nav.hidden) nav.hidden = false;
}

const prefetching = new Set<string>();

async function prefetchMemberNotes(projectId: string, button: HTMLButtonElement): Promise<void> {
  if (prefetching.has(projectId) || sessionNotes.has(projectId)) return;
  prefetching.add(projectId);
  try {
    const loaded = await loadCustomPatternProject(projectId, "sleeveless");
    if (!loaded.ok || sessionNotes.has(projectId)) return;
    sessionNotes.set(projectId, memberNotesFromProject(loaded.project));
    refreshSavedPatternMemberNotes(button);
  } catch {
    /* Opening My Notes reports the load error. */
  } finally {
    prefetching.delete(projectId);
  }
}
