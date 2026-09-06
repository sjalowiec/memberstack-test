/**
 * Watson Tip of the Week admin UI (create / edit / schedule / archive + reaction totals).
 */
import {
  initTipDateFormState,
  onTipAvailableFromChanged,
  onTipAvailableThroughChanged,
  resetTipAvailableThroughToSevenDays,
  type TipDateFormState,
} from "../lib/tipOfTheWeek/schedule";
import { sanitizeBillboardHtml } from "../lib/whatsNew/sanitizeBillboardHtml";
import { initWatsonTipTryItRichText } from "./watsonTipTryItRichText";

type TipStatus = "draft" | "scheduled" | "active" | "archived";

type RelatedResource =
  | { type: "video"; videoId: string; title: string; note?: string }
  | { type: "link"; title: string; url: string; note?: string };

type TipRecord = {
  id: string;
  tipId: string;
  title: string;
  intro: string;
  videoContentId: string;
  availableFrom: string;
  availableThrough: string;
  status: TipStatus;
  availabilityNotice: string;
  availabilityFooterTemplate: string;
  tryCopy: string;
  sueTipCopy: string;
  ctaText: string;
  ctaUrl: string;
  learnPoints: string[];
  relatedLinks: RelatedResource[];
  eyebrow: string;
};

type CatalogVideo = {
  contentId: string;
  catalogTitle: string;
  vimeoId: string;
  posterUrl: string;
};

const API = "/api/watson/tip-of-the-week";
const RELATED_MAX = 8;

/** Tracks whether Available Through was manually edited in this form session. */
let tipDateState: TipDateFormState = initTipDateFormState(null);

function el<T extends HTMLElement>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector(sel) as T | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyTipDateStateToForm(form: HTMLFormElement, state: TipDateFormState) {
  tipDateState = state;
  const from = form.elements.namedItem("availableFrom") as HTMLInputElement | null;
  const through = form.elements.namedItem("availableThrough") as HTMLInputElement | null;
  if (from) from.value = state.availableFrom;
  if (through) through.value = state.availableThrough;
}

function showStatus(message: string, kind: "ok" | "error" | "warn" = "ok") {
  const box = el<HTMLElement>("[data-totw-status]");
  if (!box) return;
  box.hidden = false;
  box.textContent = message;
  box.dataset.kind = kind;
}

function readLearnPoints(form: HTMLFormElement): string[] {
  return Array.from(form.querySelectorAll<HTMLInputElement>("[data-learn-point]"))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function emptyRelatedResource(): RelatedResource {
  return { type: "video", videoId: "", title: "", note: "" };
}

function rteParts(
  form: HTMLFormElement,
  wrapSelector: string,
): {
  editor: HTMLElement;
  hidden: HTMLTextAreaElement;
} | null {
  const wrap = form.querySelector<HTMLElement>(wrapSelector);
  if (!wrap) return null;
  const editor = wrap.querySelector<HTMLElement>("[data-wn-rte-editor]");
  const hidden = wrap.querySelector<HTMLTextAreaElement>("[data-wn-rte-input]");
  if (!editor || !hidden) return null;
  return { editor, hidden };
}

/** Seed a rich-text editor (and its hidden input) from stored plain text or HTML. */
function setRteCopy(form: HTMLFormElement, wrapSelector: string, value: string): void {
  const parts = rteParts(form, wrapSelector);
  if (!parts) return;
  const clean = sanitizeBillboardHtml(value || "");
  parts.editor.innerHTML = clean || "<p><br></p>";
  parts.hidden.value = clean;
}

/** Seed the Try It editor (and its hidden input) from stored plain text or HTML. */
function setTryCopy(form: HTMLFormElement, value: string): void {
  setRteCopy(form, "[data-totw-try-rte]", value);
}

function syncRteCopy(form: HTMLFormElement, wrapSelector: string): void {
  const parts = rteParts(form, wrapSelector);
  if (!parts) return;
  parts.hidden.value = sanitizeBillboardHtml(parts.editor.innerHTML);
}

/** Push the current editor HTML into the hidden field before reading the form. */
function syncTryCopy(form: HTMLFormElement): void {
  syncRteCopy(form, "[data-totw-try-rte]");
}

/** Sync Intro, Try It, and Sue’s Tip editors into their hidden fields. */
function syncAllRteCopy(form: HTMLFormElement): void {
  syncRteCopy(form, "[data-totw-intro-rte]");
  syncTryCopy(form);
  syncRteCopy(form, "[data-totw-sue-rte]");
}

function normalizeIncomingRelated(raw: unknown): RelatedResource {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyRelatedResource();
  }
  const row = raw as Record<string, unknown>;
  const type =
    typeof row.type === "string" && row.type.trim().toLowerCase() === "link"
      ? "link"
      : typeof row.type === "string" && row.type.trim().toLowerCase() === "video"
        ? "video"
        : null;
  const note =
    typeof row.note === "string" && row.note.trim() ? row.note.trim() : undefined;

  if (type === "video") {
    return {
      type: "video",
      videoId: String(row.videoId ?? row.video_id ?? "").trim(),
      title: String(row.title ?? "").trim(),
      note,
    };
  }
  if (type === "link") {
    return {
      type: "link",
      title: String(row.title ?? row.label ?? "").trim(),
      url: String(row.url ?? row.href ?? "").trim(),
      note,
    };
  }

  // Legacy { label, href, note? }
  const label = String(row.label ?? row.title ?? "").trim();
  const href = String(row.href ?? row.url ?? "").trim();
  const videoMatch = /^\/videos\/(\d{1,12})\/?$/i.exec(href);
  if (videoMatch) {
    return { type: "video", videoId: videoMatch[1], title: label, note };
  }
  if (label || href) {
    return { type: "link", title: label, url: href, note };
  }
  return emptyRelatedResource();
}

function readRelatedLinks(form: HTMLFormElement): RelatedResource[] {
  const rows = form.querySelectorAll<HTMLElement>("[data-related-row]");
  const links: RelatedResource[] = [];
  rows.forEach((row) => {
    const typeSelect = el<HTMLSelectElement>("[data-related-type]", row);
    const type = typeSelect?.value === "link" ? "link" : "video";
    const note =
      el<HTMLInputElement>("[data-related-note]", row)?.value.trim() || undefined;

    if (type === "video") {
      const videoId =
        el<HTMLInputElement>("[data-related-video-id]", row)?.value.trim() || "";
      const title =
        el<HTMLInputElement>("[data-related-video-title]", row)?.value.trim() || "";
      if (!videoId && !title && !note) return;
      links.push({ type: "video", videoId, title, note });
      return;
    }

    const title = el<HTMLInputElement>("[data-related-title]", row)?.value.trim() || "";
    const url = el<HTMLInputElement>("[data-related-url]", row)?.value.trim() || "";
    if (!title && !url && !note) return;
    links.push({ type: "link", title, url, note });
  });
  return links;
}

function setRelatedStatus(
  row: HTMLElement,
  message: string,
  kind: "ok" | "error" | "muted" = "muted",
) {
  const status = el<HTMLElement>("[data-related-status]", row);
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind === "muted" ? "" : kind;
}

function updateRelatedFieldsVisibility(row: HTMLElement) {
  const type = el<HTMLSelectElement>("[data-related-type]", row)?.value || "video";
  const videoFields = el<HTMLElement>("[data-related-video-fields]", row);
  const linkFields = el<HTMLElement>("[data-related-link-fields]", row);
  if (videoFields) videoFields.hidden = type !== "video";
  if (linkFields) linkFields.hidden = type !== "link";
}

async function resolveRelatedVideoRow(row: HTMLElement) {
  const videoId =
    el<HTMLInputElement>("[data-related-video-id]", row)?.value.trim() || "";
  const titleInput = el<HTMLInputElement>("[data-related-video-title]", row);
  const dest = el<HTMLElement>("[data-related-video-dest]", row);

  if (!videoId) {
    if (titleInput) titleInput.value = "";
    if (dest) dest.textContent = "";
    setRelatedStatus(row, "Enter a Learning Library content ID.", "muted");
    return;
  }

  if (!/^\d{1,12}$/.test(videoId)) {
    if (titleInput) titleInput.value = "";
    if (dest) dest.textContent = "";
    setRelatedStatus(row, "Content ID must be numeric.", "error");
    return;
  }

  setRelatedStatus(row, "Looking up video…", "muted");
  try {
    const res = await fetch(`${API}/video/${encodeURIComponent(videoId)}`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok || !data?.ok || !data.video) {
      if (titleInput) titleInput.value = "";
      if (dest) dest.textContent = "";
      setRelatedStatus(
        row,
        data?.error || `No Learning Library video found for content ID ${videoId}.`,
        "error",
      );
      return;
    }
    const video = data.video as CatalogVideo;
    if (titleInput) titleInput.value = video.catalogTitle || "";
    if (dest) dest.textContent = `Destination: /videos/${video.contentId}`;
    setRelatedStatus(
      row,
      `Video title: ${video.catalogTitle || video.contentId}`,
      "ok",
    );
  } catch {
    if (titleInput) titleInput.value = "";
    if (dest) dest.textContent = "";
    setRelatedStatus(row, "Unable to resolve video.", "error");
  }
}

function renderLearnPoints(container: HTMLElement, points: string[]) {
  container.innerHTML = "";
  const list = points.length ? points : [""];
  list.forEach((point, index) => {
    const row = document.createElement("div");
    row.className = "watson-totw__list-row";
    row.innerHTML = `
      <input type="text" data-learn-point maxlength="240" value="" aria-label="Learning point ${index + 1}" />
      <button type="button" class="watson-totw__icon-btn" data-learn-remove aria-label="Remove learning point">×</button>
    `;
    const input = row.querySelector("input");
    if (input) input.value = point;
    container.appendChild(row);
  });
}

function renderRelatedLinks(container: HTMLElement, links: RelatedResource[]) {
  container.innerHTML = "";
  const list = links.length ? links : [emptyRelatedResource()];
  list.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "watson-totw__related-row";
    row.setAttribute("data-related-row", "");
    const n = index + 1;
    row.innerHTML = `
      <div class="watson-totw__related-row-header">
        <label>
          Type
          <select class="watson-totw__related-type" data-related-type aria-label="Related resource type ${n}">
            <option value="video">Knit It Now Video</option>
            <option value="link">Link or Document</option>
          </select>
        </label>
        <div class="watson-totw__related-actions">
          <button type="button" class="watson-totw__btn watson-totw__btn--small" data-related-up aria-label="Move related resource ${n} up">Move Up</button>
          <button type="button" class="watson-totw__btn watson-totw__btn--small" data-related-down aria-label="Move related resource ${n} down">Move Down</button>
          <button type="button" class="watson-totw__icon-btn" data-related-remove aria-label="Remove related resource ${n}">×</button>
        </div>
      </div>
      <div class="watson-totw__related-fields" data-related-video-fields>
        <label>
          Learning Library content ID
          <input type="text" data-related-video-id maxlength="12" inputmode="numeric" placeholder="e.g. 456" aria-label="Related video content ID ${n}" />
        </label>
        <input type="hidden" data-related-video-title value="" />
        <p class="watson-totw__related-status" data-related-status></p>
        <p class="watson-totw__related-dest" data-related-video-dest></p>
      </div>
      <div class="watson-totw__related-fields" data-related-link-fields hidden>
        <label>
          Display title
          <input type="text" data-related-title maxlength="120" placeholder="Title" aria-label="Related link title ${n}" />
        </label>
        <label>
          Destination URL
          <input type="text" data-related-url maxlength="300" placeholder="/path, /downloads/file.pdf, or https://…" aria-label="Related link URL ${n}" />
        </label>
      </div>
      <label>
        Short description (optional)
        <input type="text" data-related-note maxlength="240" placeholder="Optional note" aria-label="Related resource note ${n}" />
      </label>
    `;

    const typeSelect = row.querySelector<HTMLSelectElement>("[data-related-type]");
    const note = row.querySelector<HTMLInputElement>("[data-related-note]");
    if (note) note.value = link.note || "";

    if (link.type === "link") {
      if (typeSelect) typeSelect.value = "link";
      const title = row.querySelector<HTMLInputElement>("[data-related-title]");
      const url = row.querySelector<HTMLInputElement>("[data-related-url]");
      if (title) title.value = link.title || "";
      if (url) url.value = link.url || "";
    } else {
      if (typeSelect) typeSelect.value = "video";
      const videoId = row.querySelector<HTMLInputElement>("[data-related-video-id]");
      const title = row.querySelector<HTMLInputElement>("[data-related-video-title]");
      if (videoId) videoId.value = link.videoId || "";
      if (title) title.value = link.title || "";
      if (link.videoId && link.title) {
        setRelatedStatus(row, `Video title: ${link.title}`, "ok");
        const dest = row.querySelector<HTMLElement>("[data-related-video-dest]");
        if (dest) dest.textContent = `Destination: /videos/${link.videoId}`;
      }
    }

    updateRelatedFieldsVisibility(row);
    container.appendChild(row);

    if (link.type === "video" && link.videoId && !link.title) {
      void resolveRelatedVideoRow(row);
    }
  });
}

function moveRelatedRow(container: HTMLElement, row: HTMLElement, direction: -1 | 1) {
  const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-related-row]"));
  const index = rows.indexOf(row);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) return;
  if (direction < 0) {
    container.insertBefore(row, rows[target]);
  } else {
    container.insertBefore(rows[target], row);
  }
}

/** Prefer the actual input. `namedItem` can return a RadioNodeList whose `.value` is blank. */
function namedField(
  form: HTMLFormElement,
  name: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  const fromDom = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`,
  );
  if (fromDom) return fromDom;
  const named = form.elements.namedItem(name);
  if (
    named instanceof HTMLInputElement ||
    named instanceof HTMLTextAreaElement ||
    named instanceof HTMLSelectElement
  ) {
    return named;
  }
  return null;
}

function fillForm(form: HTMLFormElement, tip: TipRecord | null) {
  const set = (name: string, value: string) => {
    const field = namedField(form, name);
    if (field) field.value = value;
  };

  set("id", tip?.id || "");
  set("tipId", tip?.tipId || "");
  set("title", tip?.title || "");
  setRteCopy(form, "[data-totw-intro-rte]", tip?.intro || "");
  set("videoContentId", tip?.videoContentId || "");
  set("availableFrom", tip?.availableFrom || "");
  set("availableThrough", tip?.availableThrough || "");
  set("status", tip?.status || "draft");
  set("availabilityNotice", tip?.availabilityNotice || "Free to watch this week");
  set(
    "availabilityFooterTemplate",
    tip?.availabilityFooterTemplate ||
      "This Learning Library video is free for everyone through {date}. After that, it returns to the member Learning Library.",
  );
  setTryCopy(form, tip?.tryCopy || "");
  setRteCopy(form, "[data-totw-sue-rte]", tip?.sueTipCopy || "");
  set("ctaText", tip?.ctaText || "");
  set("ctaUrl", tip?.ctaUrl || "");
  set("eyebrow", tip?.eyebrow || "TIP OF THE WEEK");

  const learnBox = el<HTMLElement>("[data-learn-points]", form);
  const relatedBox = el<HTMLElement>("[data-related-links]", form);
  if (learnBox) renderLearnPoints(learnBox, tip?.learnPoints || []);
  if (relatedBox) {
    const related = (tip?.relatedLinks || []).map(normalizeIncomingRelated);
    renderRelatedLinks(relatedBox, related);
  }

  const heading = el<HTMLElement>("[data-totw-form-heading]");
  if (heading) heading.textContent = tip?.id ? "Edit tip" : "New tip";

  // Existing tips preserve stored end date; new tips auto-calculate from start.
  tipDateState = initTipDateFormState({
    availableFrom: tip?.availableFrom || "",
    availableThrough: tip?.availableThrough || "",
    isExisting: Boolean(tip?.id),
  });

  void refreshVideoPreview(form);
  void refreshReactions(tip?.tipId || "");
}

function formPayload(form: HTMLFormElement): Record<string, unknown> {
  const data = new FormData(form);
  const get = (name: string) => {
    if (data.has(name)) return String(data.get(name) ?? "");
    return namedField(form, name)?.value ?? "";
  };
  return {
    tipId: get("tipId"),
    title: get("title"),
    intro: get("intro"),
    videoContentId: get("videoContentId"),
    availableFrom: get("availableFrom"),
    availableThrough: get("availableThrough"),
    status: get("status"),
    availabilityNotice: get("availabilityNotice"),
    availabilityFooterTemplate: get("availabilityFooterTemplate"),
    tryCopy: get("tryCopy"),
    sueTipCopy: get("sueTipCopy"),
    ctaText: get("ctaText"),
    ctaUrl: get("ctaUrl"),
    eyebrow: get("eyebrow"),
    learnPoints: readLearnPoints(form),
    relatedLinks: readRelatedLinks(form),
  };
}

async function refreshVideoPreview(form: HTMLFormElement) {
  const preview = el<HTMLElement>("[data-video-preview]");
  if (!preview) return;
  const contentId = (
    form.elements.namedItem("videoContentId") as HTMLInputElement | null
  )?.value.trim();
  if (!contentId) {
    preview.hidden = true;
    preview.textContent = "";
    return;
  }
  try {
    const res = await fetch(`${API}/video/${encodeURIComponent(contentId)}`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok || !data?.ok || !data.video) {
      preview.hidden = false;
      preview.innerHTML = `<p class="watson-totw__preview-error">${escapeHtml(data?.error || "Video not found.")}</p>`;
      return;
    }
    const video = data.video as CatalogVideo;
    preview.hidden = false;
    preview.innerHTML = `
      <div class="watson-totw__preview-card">
        ${video.posterUrl ? `<img src="${escapeHtml(video.posterUrl)}" alt="" width="160" height="90" />` : ""}
        <div>
          <strong>${escapeHtml(video.catalogTitle)}</strong>
          <p>content_id ${escapeHtml(video.contentId)} · Vimeo ${escapeHtml(video.vimeoId)}</p>
        </div>
      </div>
    `;
  } catch {
    preview.hidden = false;
    preview.innerHTML = `<p class="watson-totw__preview-error">Unable to resolve video.</p>`;
  }
}

async function refreshReactions(tipId: string) {
  const box = el<HTMLElement>("[data-reaction-totals]");
  if (!box) return;
  if (!tipId) {
    box.innerHTML = "<p>Save a tip to see reaction totals.</p>";
    return;
  }
  try {
    const res = await fetch(`${API}/reactions/${encodeURIComponent(tipId)}`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      box.innerHTML = `<p>${escapeHtml(data?.error || "Unable to load reactions.")}</p>`;
      return;
    }
    const rows = Array.isArray(data.rows) ? data.rows : [];
    box.innerHTML = `
      <ul class="watson-totw__reaction-list">
        ${rows
          .map(
            (row: { label: string; count: number }) =>
              `<li><span>${escapeHtml(row.label)}</span><strong>${row.count}</strong></li>`,
          )
          .join("")}
      </ul>
      <p class="watson-totw__muted">Total responses: ${data.total ?? 0} (one per visitor)</p>
    `;
  } catch {
    box.innerHTML = "<p>Unable to load reactions.</p>";
  }
}

async function saveTip(form: HTMLFormElement, statusOverride?: TipStatus) {
  // Ensure rich-text editors have synced into their hidden fields.
  syncAllRteCopy(form);
  const id = (form.elements.namedItem("id") as HTMLInputElement | null)?.value.trim();
  const payload = formPayload(form);
  if (statusOverride) payload.status = statusOverride;

  const url = id ? `${API}/${encodeURIComponent(id)}` : API;
  const method = id ? "PATCH" : "POST";

  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data?.ok) {
    showStatus(data?.error || "Unable to save tip.", "error");
    return null;
  }
  if (data.warning) showStatus(data.warning, "warn");
  else showStatus("Saved.", "ok");
  return data.tip as TipRecord;
}

export function initWatsonTipOfTheWeek() {
  const form = el<HTMLFormElement>("[data-totw-form]");
  if (!form) return;

  initWatsonTipTryItRichText(form);

  const learnBox = el<HTMLElement>("[data-learn-points]", form);
  const relatedBox = el<HTMLElement>("[data-related-links]", form);

  form.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.matches("[data-learn-add]") && learnBox) {
      renderLearnPoints(learnBox, [...readLearnPoints(form), ""]);
    }
    if (target.matches("[data-learn-remove]") && learnBox) {
      target.closest(".watson-totw__list-row")?.remove();
      if (!learnBox.querySelector("[data-learn-point]")) renderLearnPoints(learnBox, [""]);
    }
    if (target.matches("[data-related-add]") && relatedBox) {
      const current = readRelatedLinks(form);
      if (current.length >= RELATED_MAX) {
        showStatus(`At most ${RELATED_MAX} related resources are allowed.`, "error");
        return;
      }
      renderRelatedLinks(relatedBox, [...current, emptyRelatedResource()]);
    }
    if (target.matches("[data-related-remove]") && relatedBox) {
      target.closest("[data-related-row]")?.remove();
      if (!relatedBox.querySelector("[data-related-row]")) {
        renderRelatedLinks(relatedBox, [emptyRelatedResource()]);
      }
    }
    if (target.matches("[data-related-up]") && relatedBox) {
      const row = target.closest<HTMLElement>("[data-related-row]");
      if (row) moveRelatedRow(relatedBox, row, -1);
    }
    if (target.matches("[data-related-down]") && relatedBox) {
      const row = target.closest<HTMLElement>("[data-related-row]");
      if (row) moveRelatedRow(relatedBox, row, 1);
    }
  });

  form.addEventListener("change", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const row = target.closest<HTMLElement>("[data-related-row]");
    if (!row) return;

    if (target.matches("[data-related-type]")) {
      updateRelatedFieldsVisibility(row);
      if ((target as HTMLSelectElement).value === "video") {
        void resolveRelatedVideoRow(row);
      } else {
        setRelatedStatus(row, "", "muted");
      }
    }
  });

  form.addEventListener("blur", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.matches("[data-related-video-id]")) return;
    const row = target.closest<HTMLElement>("[data-related-row]");
    if (row) void resolveRelatedVideoRow(row);
  }, true);

  form.addEventListener("input", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.matches("[data-related-video-id]")) return;
    const row = target.closest<HTMLElement>("[data-related-row]");
    if (!row) return;
    // Clear stale title while typing; resolve on blur.
    const title = el<HTMLInputElement>("[data-related-video-title]", row);
    if (title) title.value = "";
    setRelatedStatus(row, "Press Tab or click away to look up the video title.", "muted");
    const dest = el<HTMLElement>("[data-related-video-dest]", row);
    if (dest) dest.textContent = "";
  });

  el<HTMLButtonElement>("[data-video-resolve]", form)?.addEventListener("click", () => {
    void refreshVideoPreview(form);
  });

  const fromInput = form.elements.namedItem("availableFrom") as HTMLInputElement | null;
  const throughInput = form.elements.namedItem("availableThrough") as HTMLInputElement | null;

  fromInput?.addEventListener("change", () => {
    applyTipDateStateToForm(
      form,
      onTipAvailableFromChanged(tipDateState, fromInput.value),
    );
  });

  throughInput?.addEventListener("change", () => {
    applyTipDateStateToForm(
      form,
      onTipAvailableThroughChanged(tipDateState, throughInput.value),
    );
  });

  el<HTMLButtonElement>("[data-totw-reset-seven-days]", form)?.addEventListener(
    "click",
    () => {
      applyTipDateStateToForm(
        form,
        resetTipAvailableThroughToSevenDays({
          ...tipDateState,
          availableFrom: fromInput?.value.trim() || tipDateState.availableFrom,
        }),
      );
    },
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tip = await saveTip(form);
    if (tip) {
      fillForm(form, tip);
      window.setTimeout(() => window.location.reload(), 400);
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-totw-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = btn.getAttribute("data-totw-edit");
      if (!raw) return;
      try {
        const tip = JSON.parse(decodeURIComponent(raw)) as TipRecord;
        fillForm(form, tip);
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        showStatus("Unable to load tip into the form.", "error");
      }
    });
  });

  el<HTMLButtonElement>("[data-totw-new]")?.addEventListener("click", () => {
    fillForm(form, null);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  el<HTMLButtonElement>("[data-totw-save-draft]")?.addEventListener("click", async () => {
    const tip = await saveTip(form, "draft");
    if (tip) window.setTimeout(() => window.location.reload(), 400);
  });

  el<HTMLButtonElement>("[data-totw-schedule]")?.addEventListener("click", async () => {
    const tip = await saveTip(form, "scheduled");
    if (tip) window.setTimeout(() => window.location.reload(), 400);
  });

  el<HTMLButtonElement>("[data-totw-activate]")?.addEventListener("click", async () => {
    const tip = await saveTip(form, "active");
    if (tip) window.setTimeout(() => window.location.reload(), 400);
  });

  el<HTMLButtonElement>("[data-totw-archive]")?.addEventListener("click", async () => {
    const id = (form.elements.namedItem("id") as HTMLInputElement | null)?.value.trim();
    if (!id) {
      showStatus("Save the tip before archiving.", "error");
      return;
    }
    if (!window.confirm("Archive this tip? It will no longer appear as the featured Tip of the Week.")) {
      return;
    }
    const tip = await saveTip(form, "archived");
    if (tip) window.setTimeout(() => window.location.reload(), 400);
  });

  // Initial empty list rows
  if (learnBox && !learnBox.querySelector("[data-learn-point]")) {
    renderLearnPoints(learnBox, [""]);
  }
  if (relatedBox && !relatedBox.querySelector("[data-related-row]")) {
    renderRelatedLinks(relatedBox, [emptyRelatedResource()]);
  }

  // New-form default: end date stays auto-linked until manually edited.
  tipDateState = initTipDateFormState(null);
}
