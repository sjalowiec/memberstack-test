function formatPublishDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export type KnitAbleScheduleSaveRecord = {
  slug: string;
  title: string;
  path: string;
  publishDate: string | null;
  status: "unpublished" | "scheduled" | "published";
  statusLabel: string;
  previewPath: string;
  message: string;
};

export function parseKnitAbleScheduleSaveResponse(
  responseOk: boolean,
  body: unknown,
): { ok: true; knitAble: KnitAbleScheduleSaveRecord } | { ok: false; error: string } {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return { ok: false, error: error.trim() };
    }
  }
  if (!responseOk || !body || typeof body !== "object" || !("knitAble" in body)) {
    return {
      ok: false,
      error: "Watson did not return a usable response. Nothing was saved.",
    };
  }
  const knitAble = (body as { knitAble?: unknown }).knitAble;
  if (!knitAble || typeof knitAble !== "object") {
    return { ok: false, error: "Watson did not return the saved Knit-able." };
  }
  const record = knitAble as Partial<KnitAbleScheduleSaveRecord>;
  if (typeof record.message !== "string" || typeof record.statusLabel !== "string") {
    return { ok: false, error: "Watson did not return the saved Knit-able." };
  }
  return { ok: true, knitAble: record as KnitAbleScheduleSaveRecord };
}

async function savePublishDate(form: HTMLFormElement, publishDate: string | null): Promise<void> {
  const slug = form.dataset.knitAbleSlug || "";
  const feedback = form.querySelector<HTMLElement>("[data-knit-able-feedback]");
  const status = form.closest("tr")?.querySelector<HTMLElement>("[data-knit-able-status]");
  const dateLabel = form.closest("tr")?.querySelector<HTMLElement>("[data-knit-able-date]");
  const dateInput = form.querySelector<HTMLInputElement>('input[name="publishDate"]');
  const buttons = [...form.querySelectorAll<HTMLButtonElement>("button")];

  function show(message: string, kind: "success" | "error"): void {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.setAttribute("role", kind === "error" ? "alert" : "status");
    feedback.classList.toggle("watson__status--error", kind === "error");
    feedback.classList.toggle("watson__status--success", kind === "success");
  }

  buttons.forEach((button) => {
    button.disabled = true;
  });
  show("Saving…", "success");

  try {
    const response = await fetch(`/api/watson/knit-ables/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishDate }),
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    const result = parseKnitAbleScheduleSaveResponse(response.ok, body);
    if (!result.ok) {
      show(result.error, "error");
      return;
    }
    if (dateInput) dateInput.value = result.knitAble.publishDate ?? "";
    if (status) status.textContent = result.knitAble.statusLabel;
    if (dateLabel) {
      dateLabel.textContent = result.knitAble.publishDate
        ? formatPublishDate(result.knitAble.publishDate)
        : "No date";
    }
    show(result.knitAble.message, "success");
  } catch {
    show("Could not save. Check your connection and try again.", "error");
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

export function initKnitAbleScheduleAdmin(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>("[data-knit-able-schedule]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const dateInput = form.querySelector<HTMLInputElement>('input[name="publishDate"]');
      const value = dateInput?.value.trim() || null;
      void savePublishDate(form, value);
    });
    form.querySelector<HTMLButtonElement>("[data-knit-able-clear]")?.addEventListener("click", () => {
      const dateInput = form.querySelector<HTMLInputElement>('input[name="publishDate"]');
      if (dateInput) dateInput.value = "";
      void savePublishDate(form, null);
    });
  });
}
