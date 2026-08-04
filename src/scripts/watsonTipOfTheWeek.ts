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

type TipStatus = "draft" | "scheduled" | "active" | "archived";

type RelatedLink = { label: string; href: string; note?: string };

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
  learnPoints: string[];
  relatedLinks: RelatedLink[];
  eyebrow: string;
};

type CatalogVideo = {
  contentId: string;
  catalogTitle: string;
  vimeoId: string;
  posterUrl: string;
};

const API = "/api/watson/tip-of-the-week";

/** Tracks whether Available Through was manually edited in this form session. */
let tipDateState: TipDateFormState = initTipDateFormState(null);

function el<T extends HTMLElement>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector(sel) as T | null;
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

function readRelatedLinks(form: HTMLFormElement): RelatedLink[] {
  const rows = form.querySelectorAll<HTMLElement>("[data-related-row]");
  const links: RelatedLink[] = [];
  rows.forEach((row) => {
    const label = el<HTMLInputElement>("[data-related-label]", row)?.value.trim() || "";
    const href = el<HTMLInputElement>("[data-related-href]", row)?.value.trim() || "";
    const note = el<HTMLInputElement>("[data-related-note]", row)?.value.trim() || "";
    if (!label && !href) return;
    links.push({ label, href, note: note || undefined });
  });
  return links;
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

function renderRelatedLinks(container: HTMLElement, links: RelatedLink[]) {
  container.innerHTML = "";
  const list = links.length ? links : [{ label: "", href: "", note: "" }];
  list.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "watson-totw__related-row";
    row.setAttribute("data-related-row", "");
    row.innerHTML = `
      <input type="text" data-related-label maxlength="120" placeholder="Title" aria-label="Related link title ${index + 1}" />
      <input type="text" data-related-href maxlength="300" placeholder="/path" aria-label="Related link URL ${index + 1}" />
      <input type="text" data-related-note maxlength="240" placeholder="Short description (optional)" aria-label="Related link note ${index + 1}" />
      <button type="button" class="watson-totw__icon-btn" data-related-remove aria-label="Remove related link">×</button>
    `;
    const label = row.querySelector<HTMLInputElement>("[data-related-label]");
    const href = row.querySelector<HTMLInputElement>("[data-related-href]");
    const note = row.querySelector<HTMLInputElement>("[data-related-note]");
    if (label) label.value = link.label || "";
    if (href) href.value = link.href || "";
    if (note) note.value = link.note || "";
    container.appendChild(row);
  });
}

function fillForm(form: HTMLFormElement, tip: TipRecord | null) {
  const set = (name: string, value: string) => {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (field) field.value = value;
  };

  set("id", tip?.id || "");
  set("tipId", tip?.tipId || "");
  set("title", tip?.title || "");
  set("intro", tip?.intro || "");
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
  set("tryCopy", tip?.tryCopy || "");
  set("sueTipCopy", tip?.sueTipCopy || "");
  set("eyebrow", tip?.eyebrow || "TIP OF THE WEEK");

  const learnBox = el<HTMLElement>("[data-learn-points]", form);
  const relatedBox = el<HTMLElement>("[data-related-links]", form);
  if (learnBox) renderLearnPoints(learnBox, tip?.learnPoints || []);
  if (relatedBox) renderRelatedLinks(relatedBox, tip?.relatedLinks || []);

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
  const get = (name: string) => {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    return field?.value ?? "";
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
      preview.innerHTML = `<p class="watson-totw__preview-error">${data?.error || "Video not found."}</p>`;
      return;
    }
    const video = data.video as CatalogVideo;
    preview.hidden = false;
    preview.innerHTML = `
      <div class="watson-totw__preview-card">
        ${video.posterUrl ? `<img src="${video.posterUrl}" alt="" width="160" height="90" />` : ""}
        <div>
          <strong>${video.catalogTitle}</strong>
          <p>content_id ${video.contentId} · Vimeo ${video.vimeoId}</p>
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
      box.innerHTML = `<p>${data?.error || "Unable to load reactions."}</p>`;
      return;
    }
    const rows = Array.isArray(data.rows) ? data.rows : [];
    box.innerHTML = `
      <ul class="watson-totw__reaction-list">
        ${rows
          .map(
            (row: { label: string; count: number }) =>
              `<li><span>${row.label}</span><strong>${row.count}</strong></li>`,
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
      renderRelatedLinks(relatedBox, [
        ...readRelatedLinks(form),
        { label: "", href: "", note: "" },
      ]);
    }
    if (target.matches("[data-related-remove]") && relatedBox) {
      target.closest("[data-related-row]")?.remove();
      if (!relatedBox.querySelector("[data-related-row]")) {
        renderRelatedLinks(relatedBox, [{ label: "", href: "", note: "" }]);
      }
    }
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
    renderRelatedLinks(relatedBox, [{ label: "", href: "", note: "" }]);
  }

  // New-form default: end date stays auto-linked until manually edited.
  tipDateState = initTipDateFormState(null);
}
