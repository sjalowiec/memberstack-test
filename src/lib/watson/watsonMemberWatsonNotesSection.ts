import { buildWatsonNotesFragmentUrl } from "./watsonMemberNotesSection";

export type WatsonNotesPanelOptions = {
  onNotesChanged?: () => void | Promise<void>;
  fragmentUrl?: string;
  fetchJson?: typeof fetch;
  fetchHtml?: typeof fetch;
  confirmDelete?: (message: string) => boolean;
  getNow?: () => Date;
};

export function formatWatsonNoteDatePrefix(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}: `;
}

export function prefillWatsonNewNoteTextarea(
  textarea: HTMLTextAreaElement,
  now: Date = new Date(),
): void {
  const prefix = formatWatsonNoteDatePrefix(now);
  textarea.value = prefix;
  textarea.focus();
  textarea.setSelectionRange(prefix.length, prefix.length);
}

function getAddNoteTextarea(addForm: HTMLFormElement): HTMLTextAreaElement | null {
  return addForm.querySelector<HTMLTextAreaElement>('textarea[name="noteText"]');
}

function setFormStatus(root: HTMLElement, message: string, isError = false): void {
  const status = root.querySelector<HTMLElement>("[data-watson-note-form-status]");
  if (!status) {
    return;
  }
  status.hidden = !message;
  status.textContent = message;
  status.classList.toggle("watson__status--error", isError);
}

function getMemberid(root: HTMLElement): string {
  return root.dataset.memberid?.trim() ?? "";
}

function buildNotesApiUrl(memberid: string): string {
  return `/api/watson/members/${encodeURIComponent(memberid)}/notes`;
}

function buildNoteApiUrl(noteId: string): string {
  return `/api/watson/notes/${encodeURIComponent(noteId)}`;
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  fetchJson: typeof fetch,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetchJson(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

async function patchJson(
  url: string,
  body: Record<string, unknown>,
  fetchJson: typeof fetch,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetchJson(url, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

async function deleteJson(
  url: string,
  fetchJson: typeof fetch,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetchJson(url, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const data = (await response.json()) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

function isInteractiveElement(target: unknown): target is HTMLElement {
  return (
    typeof target === "object" &&
    target !== null &&
    "matches" in target &&
    typeof (target as HTMLElement).matches === "function"
  );
}

export function initWatsonNotesPanel(
  root: HTMLElement,
  options: WatsonNotesPanelOptions = {},
): void {
  if (root.dataset.watsonNotesInitialized === "true") {
    return;
  }
  root.dataset.watsonNotesInitialized = "true";

  const fetchJson = options.fetchJson ?? fetch;
  const confirmDelete = options.confirmDelete ?? ((message) => window.confirm(message));
  const getNow = options.getNow ?? (() => new Date());
  const memberid = getMemberid(root);

  const addForm = root.querySelector<HTMLFormElement>("[data-watson-note-add-form]");
  if (addForm) {
    const addTextarea = getAddNoteTextarea(addForm);
    if (addTextarea) {
      prefillWatsonNewNoteTextarea(addTextarea, getNow());
    }

    addForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!memberid) {
        setFormStatus(root, "Member ID is missing.", true);
        return;
      }

      const formData = new FormData(addForm);
      const noteText = String(formData.get("noteText") ?? "");
      const category = String(formData.get("category") ?? "");
      const createdBy = String(formData.get("createdBy") ?? "");

      const submitButton = addForm.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const result = await postJson(
          buildNotesApiUrl(memberid),
          { noteText, category, createdBy },
          fetchJson,
        );
        if (!result.ok) {
          const error =
            typeof result.data.error === "string" ? result.data.error : "Unable to add note.";
          setFormStatus(root, error, true);
          return;
        }

        addForm.reset();
        const categorySelect = addForm.querySelector<HTMLSelectElement>('select[name="category"]');
        if (categorySelect) {
          categorySelect.value = "General";
        }
        const resetTextarea = getAddNoteTextarea(addForm);
        if (resetTextarea) {
          prefillWatsonNewNoteTextarea(resetTextarea, getNow());
        }
        setFormStatus(root, "Note added.");
        await options.onNotesChanged?.();
      } catch {
        setFormStatus(root, "Unable to add note.", true);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  }

  root.addEventListener("click", async (event) => {
    const target = event.target;
    if (!isInteractiveElement(target)) {
      return;
    }

    const item = target.closest<HTMLElement>("[data-watson-note-item]");
    if (!item) {
      return;
    }

    const noteId = item.dataset.noteId?.trim();
    if (!noteId) {
      return;
    }

    if (target.matches("[data-watson-note-edit]")) {
      const editForm = item.querySelector<HTMLElement>("[data-watson-note-edit-form]");
      const text = item.querySelector<HTMLElement>("[data-watson-note-text]");
      const actions = item.querySelector<HTMLElement>(".watson-watson-notes__item-actions");
      if (editForm && text && actions) {
        editForm.hidden = false;
        text.hidden = true;
        actions.hidden = true;
      }
      return;
    }

    if (target.matches("[data-watson-note-cancel]")) {
      const editForm = item.querySelector<HTMLElement>("[data-watson-note-edit-form]");
      const text = item.querySelector<HTMLElement>("[data-watson-note-text]");
      const actions = item.querySelector<HTMLElement>(".watson-watson-notes__item-actions");
      if (editForm && text && actions) {
        editForm.hidden = true;
        text.hidden = false;
        actions.hidden = false;
      }
      return;
    }

    if (target.matches("[data-watson-note-delete]")) {
      if (!confirmDelete("Delete this Watson note? This cannot be undone.")) {
        return;
      }

      target.setAttribute("disabled", "true");
      try {
        const result = await deleteJson(buildNoteApiUrl(noteId), fetchJson);
        if (!result.ok) {
          const error =
            typeof result.data.error === "string" ? result.data.error : "Unable to delete note.";
          setFormStatus(root, error, true);
          return;
        }
        await options.onNotesChanged?.();
      } catch {
        setFormStatus(root, "Unable to delete note.", true);
      } finally {
        target.removeAttribute("disabled");
      }
    }
  });

  root.addEventListener("submit", async (event) => {
    const target = event.target;
    if (
      !isInteractiveElement(target) ||
      !target.matches("[data-watson-note-edit-form]")
    ) {
      return;
    }
    event.preventDefault();

    const item = target.closest<HTMLElement>("[data-watson-note-item]");
    const noteId = item?.dataset.noteId?.trim();
    if (!noteId) {
      return;
    }

    const formData = new FormData(target);
    const noteText = String(formData.get("noteText") ?? "");
    const category = String(formData.get("category") ?? "");
    const submitButton = target.querySelector<HTMLButtonElement>('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const result = await patchJson(
        buildNoteApiUrl(noteId),
        { noteText, category },
        fetchJson,
      );
      if (!result.ok) {
        const error =
          typeof result.data.error === "string" ? result.data.error : "Unable to save note.";
        setFormStatus(root, error, true);
        return;
      }
      setFormStatus(root, "Note updated.");
      await options.onNotesChanged?.();
    } catch {
      setFormStatus(root, "Unable to save note.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

export function buildWatsonNotesApiUrl(memberid: string): string {
  return buildNotesApiUrl(memberid);
}

export function buildWatsonNoteItemApiUrl(noteId: string): string {
  return buildNoteApiUrl(noteId);
}

export function getWatsonNotesFragmentUrlForMember(memberid: string): string {
  return buildWatsonNotesFragmentUrl(memberid);
}
