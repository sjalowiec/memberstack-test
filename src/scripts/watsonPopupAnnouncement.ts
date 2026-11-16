import { announcementButtonLabel } from "../lib/whatsNew/announcement";
import { normalizeWhatsNewDestinationUrl } from "../lib/whatsNew/destinationUrl";
import { popupReadMoreHref } from "../lib/whatsNew/popupAnnouncement";
import { WHATS_NEW_BUTTON_TEXT_MAX_LENGTH } from "../lib/whatsNew/types";
import { sanitizeCardDescriptionHtml } from "../lib/whatsNew/sanitizeBillboardHtml";
import {
  initCompactRichText,
  syncCompactRichText,
  writeCompactRichTextValue,
} from "./watsonRichTextEditor";
import { openWhatsNewAnnouncementPreview } from "./whatsNewAnnouncement";

type PopupEntry = {
  id: string;
  title: string;
  description: string;
  status: string;
  archived: boolean;
};

const DRAFT_BILLBOARD_NOTE =
  "This entry is a draft. Making it the live billboard does not publish it. Visitors can see the pop-up, and this entry stays off the public What's New board.";
const PUBLISHED_BILLBOARD_NOTE =
  "This entry is already published. Making it the live billboard does not change the What's New entry.";
const ARCHIVED_BILLBOARD_NOTE =
  "This entry is archived. Making it the live billboard does not restore it or publish it. The What's New board stays unchanged.";

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
          archived: row.archived === true,
        },
      ];
    });
  } catch {
    return [];
  }
}

function popupRichText(form: HTMLFormElement): HTMLElement | null {
  return form.querySelector<HTMLElement>("[data-wn-popup-rte]");
}

function setIntroduction(form: HTMLFormElement, value: string): void {
  const wrap = popupRichText(form);
  if (!wrap) return;
  writeCompactRichTextValue(wrap, sanitizeCardDescriptionHtml(value || ""));
}

function syncIntroduction(form: HTMLFormElement): void {
  const wrap = popupRichText(form);
  if (!wrap) return;
  syncCompactRichText(wrap, sanitizeCardDescriptionHtml);
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
    initCompactRichText(rte, { sanitize: sanitizeCardDescriptionHtml, htmlSource: true });
  }

  const status = panel.querySelector<HTMLElement>("[data-wn-popup-status]");
  const publishNote = form.querySelector<HTMLElement>("[data-wn-popup-publish-note]");
  const search = panel.querySelector<HTMLInputElement>("[data-wn-popup-search]");
  const results = panel.querySelector<HTMLElement>("[data-wn-popup-results]");
  const entries = readEntries(root);

  const explainPublishing = (entry: PopupEntry): void => {
    if (!publishNote) return;
    publishNote.hidden = false;
    if (entry.archived) {
      publishNote.textContent = ARCHIVED_BILLBOARD_NOTE;
      return;
    }
    publishNote.textContent =
      entry.status === "draft" ? DRAFT_BILLBOARD_NOTE : PUBLISHED_BILLBOARD_NOTE;
  };

  const previewForm = (): void => {
    syncIntroduction(form);
    const title = fieldValue(form, "title").trim();
    if (!title) {
      showForm();
      setStatus(status, "Add a title before previewing the pop-up.", true);
      return;
    }
    const sourceCardId = fieldValue(form, "sourceCardId").trim();
    const savedId = fieldValue(form, "announcementId").trim();
    const buttonText = fieldValue(form, "buttonText").trim();
    if (buttonText.length > WHATS_NEW_BUTTON_TEXT_MAX_LENGTH) {
      showForm();
      setStatus(
        status,
        `Button text must be ${WHATS_NEW_BUTTON_TEXT_MAX_LENGTH} characters or fewer.`,
        true,
      );
      return;
    }
    const destination = normalizeWhatsNewDestinationUrl(fieldValue(form, "buttonDestinationUrl"));
    if (!destination.ok) {
      showForm();
      setStatus(status, destination.error, true);
      return;
    }
    openWhatsNewAnnouncementPreview({
      id: savedId || "preview",
      title,
      introductionHtml: fieldValue(form, "introduction"),
      href: popupReadMoreHref(sourceCardId, destination.value),
      buttonLabel: announcementButtonLabel(buttonText),
    });
  };

  const showForm = (): void => {
    form.hidden = false;
  };

  const fillFromEntry = (entry: PopupEntry): void => {
    setField(form, "title", entry.title);
    setField(form, "sourceCardId", entry.id);
    setIntroduction(form, entry.description);
    showForm();
    explainPublishing(entry);
    setStatus(
      status,
      "Loaded from that entry. It is not live until you choose Make this the live billboard. The What's New entry is not changed.",
    );
    form.querySelector<HTMLElement>("[name='title']")?.focus();
  };

  const useEntryAsBillboard = (entry: PopupEntry): void => {
    fillFromEntry(entry);
    setField(form, "expiresAtLocal", "");
    setField(form, "buttonText", "");
    setField(form, "buttonDestinationUrl", "");
    setStatus(
      status,
      "Loaded into the billboard preview. It is not live until you choose Make this the live billboard. The previous expiration and button were cleared.",
    );
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    previewForm();
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
      .filter((entry) => !entry.archived && entry.title.toLowerCase().includes(needle))
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
    previewForm();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-wn-use-billboard]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-wn-use-billboard") || "";
      const entry = entries.find((item) => item.id === id);
      if (!entry) {
        setStatus(status, "That What's New entry could not be loaded.", true);
        return;
      }
      useEntryAsBillboard(entry);
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
          buttonText: fieldValue(form, "buttonText"),
          buttonDestinationUrl: fieldValue(form, "buttonDestinationUrl"),
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
