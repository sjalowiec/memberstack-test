import { sanitizeBillboardHtml } from "../lib/whatsNew/sanitizeBillboardHtml";

const DEFAULT_BUTTON_TEXT: Record<string, string> = {
  tool: "Try It",
  pattern: "View Pattern",
  resource: "Explore",
  learning: "Start Learning",
  improvement: "See What Changed",
};

type CardPayload = {
  title: string;
  description: string;
  category: string;
  destinationUrl: string;
  buttonText: string;
  boardColumn: string;
  publishDate: string;
  featured: boolean;
  status: string;
  displayOrder: number;
  archived: boolean;
};

const WN_FLASH_KEY = "watson-whats-new-flash";

function setStatus(el: HTMLElement | null, message: string, isError = false): void {
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
  el.classList.toggle("watson__status--error", isError);
}

function queueFlash(message: string, isError = false): void {
  try {
    window.sessionStorage.setItem(WN_FLASH_KEY, JSON.stringify({ message, isError }));
  } catch {
    // sessionStorage may be unavailable; the reload alone still refreshes state.
  }
}

function showQueuedFlash(el: HTMLElement | null): void {
  if (!el) return;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(WN_FLASH_KEY);
    if (raw) window.sessionStorage.removeItem(WN_FLASH_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return;
  try {
    const flash = JSON.parse(raw) as { message?: string; isError?: boolean };
    if (flash.message) setStatus(el, flash.message, flash.isError === true);
  } catch {
    // Ignore malformed flash payloads.
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function readForm(form: HTMLFormElement): CardPayload {
  const data = new FormData(form);
  const category = String(data.get("category") || "tool");
  return {
    title: String(data.get("title") || ""),
    description: String(data.get("description") || ""),
    category,
    destinationUrl: String(data.get("destinationUrl") || ""),
    buttonText: String(data.get("buttonText") || ""),
    boardColumn: String(data.get("boardColumn") || "just_added"),
    publishDate: String(data.get("publishDate") || todayIso()),
    featured: data.get("featured") === "on",
    status: String(data.get("status") || "draft"),
    displayOrder: Number.parseInt(String(data.get("displayOrder") || "0"), 10) || 0,
    archived: data.get("archived") === "on",
  };
}

function fillForm(form: HTMLFormElement, card: Record<string, unknown>): void {
  const set = (name: string, value: string | boolean) => {
    const el = form.elements.namedItem(name);
    if (!el) return;
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      el.checked = Boolean(value);
      return;
    }
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      el.value = String(value ?? "");
    }
  };

  set("id", String(card.id || ""));
  set("title", String(card.title || ""));
  set("description", String(card.description || ""));
  set("category", String(card.category || "tool"));
  set("destinationUrl", String(card.destinationUrl || ""));
  set("buttonText", String(card.buttonText || ""));
  set("boardColumn", String(card.boardColumn || "just_added"));
  set("publishDate", String(card.publishDate || todayIso()));
  set("featured", Boolean(card.featured));
  set("status", String(card.status || "draft"));
  set("displayOrder", String(card.displayOrder ?? 0));
  set("archived", Boolean(card.archived));
}

function resetForm(form: HTMLFormElement): void {
  form.reset();
  const idInput = form.elements.namedItem("id");
  if (idInput instanceof HTMLInputElement) idInput.value = "";
  const publish = form.elements.namedItem("publishDate");
  if (publish instanceof HTMLInputElement) publish.value = todayIso();
  const status = form.elements.namedItem("status");
  if (status instanceof HTMLSelectElement) status.value = "published";
  const order = form.elements.namedItem("displayOrder");
  if (order instanceof HTMLInputElement) order.value = "0";
  applyDefaultButtonText(form);
}

function applyDefaultButtonText(form: HTMLFormElement): void {
  const categoryEl = form.elements.namedItem("category");
  const buttonEl = form.elements.namedItem("buttonText");
  if (!(categoryEl instanceof HTMLSelectElement) || !(buttonEl instanceof HTMLInputElement)) {
    return;
  }
  if (buttonEl.dataset.userEdited === "true" && buttonEl.value.trim()) return;
  buttonEl.value = DEFAULT_BUTTON_TEXT[categoryEl.value] || "Learn More";
}

async function jsonFetch(
  url: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
  } | null;
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error || "Request failed." };
  }
  return { ok: true };
}

export function initWatsonWhatsNew(root: ParentNode = document): void {
  const page = root.querySelector<HTMLElement>("[data-whats-new-admin]");
  if (!page) return;

  const formPanel = page.querySelector<HTMLElement>("[data-wn-form-panel]");
  const form = page.querySelector<HTMLFormElement>("[data-wn-card-form]");
  const formStatus = page.querySelector<HTMLElement>("[data-wn-form-status]");
  const formTitle = page.querySelector<HTMLElement>("[data-wn-form-title]");
  const openCreateBtns = page.querySelectorAll<HTMLButtonElement>("[data-wn-open-create]");
  const cancelBtn = page.querySelector<HTMLButtonElement>("[data-wn-cancel-form]");
  const videoForm = page.querySelector<HTMLFormElement>("[data-wn-video-form]");
  const videoStatus = page.querySelector<HTMLElement>("[data-wn-video-status]");
  const flash = page.querySelector<HTMLElement>("[data-wn-flash]");

  showQueuedFlash(flash);

  function showCreateForm(): void {
    if (!form || !formPanel) return;
    resetForm(form);
    if (formTitle) formTitle.textContent = "Add Update";
    formPanel.hidden = false;
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showEditForm(cardPayload: string): void {
    if (!form || !formPanel) return;
    try {
      const card = JSON.parse(decodeURIComponent(cardPayload)) as Record<string, unknown>;
      fillForm(form, card);
      const buttonEl = form.elements.namedItem("buttonText");
      if (buttonEl instanceof HTMLInputElement) {
        buttonEl.dataset.userEdited = card.buttonText ? "true" : "false";
      }
      if (formTitle) formTitle.textContent = "Edit Update";
      formPanel.hidden = false;
      formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setStatus(formStatus, "Unable to open this card for editing.", true);
    }
  }

  for (const btn of openCreateBtns) {
    btn.addEventListener("click", () => showCreateForm());
  }

  cancelBtn?.addEventListener("click", () => {
    if (!form || !formPanel) return;
    resetForm(form);
    formPanel.hidden = true;
    setStatus(formStatus, "");
  });

  form?.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.name === "category") {
      applyDefaultButtonText(form);
    }
    if (target instanceof HTMLInputElement && target.name === "buttonText") {
      target.dataset.userEdited = "true";
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form) return;
    const payload = readForm(form);
    const idInput = form.elements.namedItem("id");
    const id = idInput instanceof HTMLInputElement ? idInput.value.trim() : "";

    setStatus(formStatus, id ? "Saving" : "Publishing");
    const result = id
      ? await jsonFetch(`/api/watson/whats-new/${encodeURIComponent(id)}`, "PATCH", payload)
      : await jsonFetch("/api/watson/whats-new", "POST", payload);

    if (!result.ok) {
      setStatus(formStatus, result.error || "Unable to save.", true);
      return;
    }
    window.location.reload();
  });

  page.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const editBtn = target.closest<HTMLButtonElement>("[data-wn-edit]");
    if (editBtn) {
      showEditForm(editBtn.getAttribute("data-wn-edit") || "{}");
      return;
    }

    const deleteBtn = target.closest<HTMLButtonElement>("[data-wn-delete]");
    if (deleteBtn) {
      const id = deleteBtn.getAttribute("data-wn-id");
      const title = deleteBtn.getAttribute("data-wn-title") || "this card";
      if (!id) return;
      const confirmed = window.confirm(
        `Delete “${title}” permanently?\n\nThis cannot be undone.`,
      );
      // Cancel leaves the card unchanged.
      if (!confirmed) return;

      deleteBtn.disabled = true;
      const result = await jsonFetch(
        `/api/watson/whats-new/${encodeURIComponent(id)}`,
        "DELETE",
      );
      if (!result.ok) {
        deleteBtn.disabled = false;
        setStatus(flash, result.error || "Unable to delete card.", true);
        return;
      }
      queueFlash(`Deleted “${title}”.`);
      window.location.reload();
      return;
    }

    const actionBtn = target.closest<HTMLButtonElement>("[data-wn-action]");
    if (!actionBtn) return;

    const id = actionBtn.getAttribute("data-wn-id");
    const action = actionBtn.getAttribute("data-wn-action");
    if (!id || !action) return;

    let body: Record<string, unknown> | null = null;
    if (action === "publish") body = { status: "published" };
    if (action === "unpublish") body = { status: "draft" };
    if (action === "feature") body = { featured: true };
    if (action === "unfeature") body = { featured: false };
    if (action === "archive") body = { archived: true };
    if (action === "restore") body = { archived: false };
    if (!body) return;

    actionBtn.disabled = true;
    const result = await jsonFetch(`/api/watson/whats-new/${encodeURIComponent(id)}`, "PATCH", body);
    if (!result.ok) {
      actionBtn.disabled = false;
      window.alert(result.error || "Unable to update card.");
      return;
    }
    window.location.reload();
  });

  page.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!target.matches("[data-wn-move]")) return;
    const id = target.getAttribute("data-wn-id");
    const boardColumn = target.value;
    if (!id || !boardColumn) return;
    target.disabled = true;
    const result = await jsonFetch(`/api/watson/whats-new/${encodeURIComponent(id)}`, "PATCH", {
      boardColumn,
    });
    if (!result.ok) {
      target.disabled = false;
      window.alert(result.error || "Unable to move card.");
      return;
    }
    window.location.reload();
  });

  videoForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    // Ensure the rich-text editor has synced into the hidden message field.
    const rteEditor = videoForm.querySelector<HTMLElement>("[data-wn-rte-editor]");
    const rteInput = videoForm.querySelector<HTMLTextAreaElement>("[data-wn-rte-input]");
    if (rteEditor && rteInput) {
      rteInput.value = sanitizeBillboardHtml(rteEditor.innerHTML);
    }
    const data = new FormData(videoForm);
    const payload = {
      headline: String(data.get("headline") || ""),
      message: String(data.get("message") || ""),
      videoUrl: String(data.get("videoUrl") || ""),
      buttonText: String(data.get("buttonText") || ""),
      buttonDestinationUrl: String(data.get("buttonDestinationUrl") || ""),
      startDate: String(data.get("startDate") || ""),
      endDate: String(data.get("endDate") || ""),
      enabled: data.get("enabled") === "on",
    };
    setStatus(videoStatus, "Saving billboard...");
    const result = await jsonFetch("/api/watson/whats-new/settings", "PUT", payload);
    if (!result.ok) {
      setStatus(videoStatus, result.error || "Unable to save billboard settings.", true);
      return;
    }
    window.location.reload();
  });
}
