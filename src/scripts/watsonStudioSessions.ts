import {
  studioPreviewAction,
  studioSlugFromTitle,
  type StudioSessionRecord,
  type StudioSessionStatus,
} from "../lib/studio/sessions";

type SaveResponse = {
  ok?: boolean;
  error?: string;
  session?: StudioSessionRecord;
};

const FLASH_KEY = "watson-studio-flash";

function field(form: HTMLFormElement, name: string): string {
  const input = form.elements.namedItem(name);
  return input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
    ? input.value.trim()
    : "";
}

function setField(form: HTMLFormElement, name: string, value: string): void {
  const input = form.elements.namedItem(name);
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    input.value = value;
  }
}

function snapshot(form: HTMLFormElement): string {
  return JSON.stringify({
    title: field(form, "title"),
    introduction: field(form, "introduction"),
    video: field(form, "video"),
    slug: field(form, "slug"),
    status: form.dataset.status || "",
  });
}

function setStatus(el: HTMLElement | null, message: string, isError = false): void {
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
  el.classList.toggle("watson__status--error", Boolean(message) && isError);
  el.classList.toggle("watson__status--success", Boolean(message) && !isError);
}

function queueFlash(message: string): void {
  try {
    window.sessionStorage.setItem(FLASH_KEY, message);
  } catch {
    /* reload still shows the saved list */
  }
}

function showQueuedFlash(el: HTMLElement | null): void {
  if (!el) return;
  let message: string | null = null;
  try {
    message = window.sessionStorage.getItem(FLASH_KEY);
    if (message) window.sessionStorage.removeItem(FLASH_KEY);
  } catch {
    message = null;
  }
  if (message) setStatus(el, message);
}

function readSessions(): StudioSessionRecord[] {
  const node = document.getElementById("studio-sessions-data");
  if (!node?.textContent) return [];
  try {
    const parsed = JSON.parse(node.textContent) as StudioSessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fillForm(form: HTMLFormElement, session: StudioSessionRecord | null): void {
  const slug = form.elements.namedItem("slug");
  if (session) {
    setField(form, "title", session.title);
    setField(form, "introduction", session.introduction);
    setField(form, "video", session.video);
    setField(form, "slug", session.slug);
    form.dataset.id = session.id;
    form.dataset.status = session.status;
    if (slug instanceof HTMLInputElement) slug.dataset.touched = "true";
  } else {
    form.reset();
    delete form.dataset.id;
    form.dataset.status = "draft";
    if (slug instanceof HTMLInputElement) delete slug.dataset.touched;
  }
  const idLabel = document.querySelector<HTMLElement>("[data-studio-permanent-id]");
  if (idLabel) {
    idLabel.hidden = !session;
    const value = idLabel.querySelector("[data-studio-permanent-id-value]");
    if (value) value.textContent = session?.id ?? "";
  }
  form.dataset.saved = snapshot(form);
}

async function saveSession(
  form: HTMLFormElement,
  status: StudioSessionStatus,
): Promise<StudioSessionRecord | null> {
  const statusEl = document.querySelector<HTMLElement>("[data-studio-form-status]");
  const id = form.dataset.id || "";
  const body = {
    title: field(form, "title"),
    introduction: field(form, "introduction"),
    video: field(form, "video"),
    slug: field(form, "slug"),
    status,
  };
  setStatus(statusEl, status === "published" ? "Publishing…" : "Saving draft…");
  const response = await fetch(id ? `/api/watson/studio/${encodeURIComponent(id)}` : "/api/watson/studio", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  let payload: SaveResponse = {};
  try {
    payload = (await response.json()) as SaveResponse;
  } catch {
    payload = {};
  }
  if (!response.ok || !payload.ok || !payload.session) {
    setStatus(statusEl, payload.error || "Unable to save this session.", true);
    return null;
  }
  queueFlash(status === "published" ? "Published." : "Draft saved.");
  const next = new URL(window.location.href);
  next.searchParams.set("edit", payload.session.id);
  window.location.assign(next.toString());
  return payload.session;
}

export function initWatsonStudioSessions(root: ParentNode = document): void {
  const form = root.querySelector<HTMLFormElement>("[data-studio-form]");
  const statusEl = root.querySelector<HTMLElement>("[data-studio-form-status]");
  if (!form) return;
  showQueuedFlash(statusEl);

  const sessions = readSessions();
  const requested = new URL(window.location.href).searchParams.get("edit");
  const initial = sessions.find((session) => session.id === requested) ?? null;
  fillForm(form, initial);

  const title = form.elements.namedItem("title");
  const slug = form.elements.namedItem("slug");
  title?.addEventListener("input", () => {
    if (!(title instanceof HTMLInputElement) || !(slug instanceof HTMLInputElement)) return;
    if (slug.dataset.touched === "true") return;
    slug.value = studioSlugFromTitle(title.value);
  });
  slug?.addEventListener("input", () => {
    if (slug instanceof HTMLInputElement) slug.dataset.touched = "true";
  });

  root.querySelector("[data-studio-new]")?.addEventListener("click", () => {
    fillForm(form, null);
    const next = new URL(window.location.href);
    next.searchParams.delete("edit");
    window.history.replaceState(null, "", next.toString());
    setStatus(statusEl, "");
    title instanceof HTMLInputElement && title.focus();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-studio-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const session = sessions.find((item) => item.id === button.dataset.studioEdit);
      if (!session) return;
      fillForm(form, session);
      setStatus(statusEl, "");
      form.scrollIntoView({ block: "nearest" });
    });
  });

  form.querySelectorAll<HTMLButtonElement>("[data-studio-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const status = button.dataset.studioSave === "published" ? "published" : "draft";
      void saveSession(form, status);
    });
  });

  form.querySelector("[data-studio-preview]")?.addEventListener("click", () => {
    const action = studioPreviewAction({
      id: form.dataset.id || "",
      dirty: snapshot(form) !== (form.dataset.saved || ""),
      status: form.dataset.status === "published" ? "published" : form.dataset.status === "draft" ? "draft" : "",
      slug: field(form, "slug"),
    });
    if (action.type === "blocked") {
      setStatus(statusEl, action.message, true);
      return;
    }
    window.open(action.href, "_blank", "noopener");
  });
}
