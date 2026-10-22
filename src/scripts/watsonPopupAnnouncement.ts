import { whatsNewEntryHref } from "../lib/whatsNew/announcement";
import { sanitizeCardDescriptionHtml } from "../lib/whatsNew/sanitizeBillboardHtml";
import { initCompactRichText } from "./watsonRichTextEditor";
import { openWhatsNewAnnouncementPreview } from "./whatsNewAnnouncement";

type PopupEntry = {
  id: string;
  title: string;
  description: string;
  status: string;
};

function setStatus(el: HTMLElement | null, message: string, isError = false): void {
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
  el.classList.toggle("watson__status--error", Boolean(message) && isError);
  el.classList.toggle("watson__status--success", Boolean(message) && !isError);
}

function readEntries(root: ParentNode): PopupEntry[] {
  const node = root.querySelector<HTMLElement>("#wn-popup-entries");
  if (!node?.textContent) return [];
  try {
    const parsed = JSON.parse(node.textContent) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.title !== "string") return [];
      return [
        {
          id: row.id,
          title: row.title,
          description: typeof row.description === "string" ? row.description : "",
          status: typeof row.status === "string" ? row.status : "",
        },
      ];
    });
  } catch {
    return [];
  }
}

function introductionParts(form: HTMLFormElement): {
  editor: HTMLElement;
  hidden: HTMLTextAreaElement;
} | null {
  const wrap = form.querySelector<HTMLElement>("[data-wn-popup-rte]");
  if (!wrap) return null;
  const editor = wrap.querySelector<HTMLElement>("[data-wn-rte-editor]");
  const hidden = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-input]");
  if (!editor || !hidden) return null;
  return { editor, hidden };
}

function setIntroduction(form: HTMLFormElement, value: string): void {
  const parts = introductionParts(form);
  if (!parts) return;
  const clean = sanitizeCardDescriptionHtml(value || "");
  parts.editor.innerHTML = clean || "<p><br></p>";
  parts.hidden.value = clean;
}

function syncIntroduction(form: HTMLFormElement): void {
  const parts = introductionParts(form);
  if (!parts) return;
  parts.hidden.value = sanitizeCardDescriptionHtml(parts.editor.innerHTML);
}

function fieldValue(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return el.value;
  }
  return "";
}

function setField(form: HTMLFormElement, name: string, value: string): void {
  const el = form.elements.namedItem(name);
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    el.value = value;
  }
}

export function initWatsonPopupAnnouncement(root: ParentNode = document): void {
  const panel = root.querySelector<HTMLElement>("[data-wn-popup-panel]");
  const form = panel?.querySelector<HTMLFormElement>("[data-wn-popup-form]");
  if (!panel || !form) return;

  const rte = form.querySelector<HTMLElement>("[data-wn-popup-rte]");
  if (rte) {
    initCompactRichText(rte, { sanitize: sanitizeCardDescriptionHtml });
  }

  const status = panel.querySelector<HTMLElement>("[data-wn-popup-status]");
  const search = panel.querySelector<HTMLInputElement>("[data-wn-popup-search]");
  const results = panel.querySelector<HTMLElement>("[data-wn-popup-results]");
  const entries = readEntries(root);

  const showForm = (): void => {
    form.hidden = false;
  };

  const fillFromEntry = (entry: PopupEntry): void => {
    setField(form, "title", entry.title);
    setField(form, "sourceCardId", entry.id);
    setIntroduction(form, entry.description);
    showForm();
    setStatus(
      status,
      "Draft filled from that entry. Preview, Save, or Enable when it looks right. The What's New entry is not changed.",
    );
    form.querySelector<HTMLElement>("[name='title']")?.focus();
  };

  const renderResults = (query: string): void => {
    if (!results) return;
    const needle = query.trim().toLowerCase();
    results.replaceChildren();
    if (!needle) {
      results.hidden = true;
      return;
    }
    const matches = entries
      .filter((entry) => entry.title.toLowerCase().includes(needle))
      .slice(0, 8);
    if (matches.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No matching What's New entry.";
      results.append(empty);
      results.hidden = false;
      return;
    }
    for (const entry of matches) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "watson-wn__announce-result";
      button.textContent = entry.status === "draft" ? `${entry.title} (Draft)` : entry.title;
      button.addEventListener("click", () => {
        fillFromEntry(entry);
        if (search) search.value = entry.title;
        results.hidden = true;
      });
      item.append(button);
      results.append(item);
    }
    results.hidden = false;
  };

  search?.addEventListener("input", () => {
    renderResults(search.value);
  });

  panel.querySelector("[data-wn-popup-edit]")?.addEventListener("click", () => {
    showForm();
    form.querySelector<HTMLElement>("[name='title']")?.focus();
  });

  panel.querySelector("[data-wn-popup-preview]")?.addEventListener("click", () => {
    syncIntroduction(form);
    const title = fieldValue(form, "title").trim();
    if (!title) {
      showForm();
      setStatus(status, "Add a title before previewing the pop-up.", true);
      return;
    }
    const sourceCardId = fieldValue(form, "sourceCardId").trim();
    const savedId = fieldValue(form, "announcementId").trim();
    openWhatsNewAnnouncementPreview({
      id: savedId || "preview",
      title,
      introductionHtml: fieldValue(form, "introduction"),
      href: sourceCardId ? whatsNewEntryHref(sourceCardId) : "/whats-new",
    });
  });

  const persist = async (enabled: boolean): Promise<void> => {
    syncIntroduction(form);
    setField(form, "enabled", enabled ? "true" : "false");
    const buttons = form.querySelectorAll<HTMLButtonElement>("button");
    for (const button of buttons) button.disabled = true;
    setStatus(status, "Saving…");
    try {
      const response = await fetch("/api/watson/whats-new/announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fieldValue(form, "title"),
          introductionHtml: fieldValue(form, "introduction"),
          audience: fieldValue(form, "audience") || "everyone",
          expiresAtLocal: fieldValue(form, "expiresAtLocal"),
          sourceCardId: fieldValue(form, "sourceCardId"),
          enabled,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        for (const button of buttons) button.disabled = false;
        setStatus(status, data?.error || "Unable to save the pop-up announcement.", true);
        return;
      }
      window.location.reload();
    } catch {
      for (const button of buttons) button.disabled = false;
      setStatus(status, "Unable to save the pop-up announcement.", true);
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void persist(fieldValue(form, "enabled") === "true");
  });
  form.querySelector("[data-wn-popup-enable]")?.addEventListener("click", () => {
    void persist(true);
  });
  form.querySelector("[data-wn-popup-disable]")?.addEventListener("click", () => {
    void persist(false);
  });
}
