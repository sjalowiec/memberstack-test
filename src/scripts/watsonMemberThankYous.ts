type SavedStatus = {
  stripeChargeId: string;
  videoSentAt: string | null;
  cardSentAt: string | null;
  videoSentLabel: string | null;
  cardSentLabel: string | null;
  videoReplyId?: string | null;
  completedAt?: string | null;
  completedLabel?: string | null;
};

type SavedVideo = {
  id: string;
  publicViewingUrl: string;
  originalVimeoUrl: string;
  emailSubject: string;
  emailMessage: string;
};

type SaveResult =
  | { ok: true; status: SavedStatus; video?: SavedVideo }
  | { ok: false; error: string };

const WORK_VIEWS = new Set(["todo", "video", "card", "address"]);

async function copyThankYouText(text: string): Promise<boolean> {
  const value = String(text || "");
  if (!value) return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return fallbackCopy(value);
    }
  }
  return fallbackCopy(value);
}

function fallbackCopy(text: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function fieldDate(card: HTMLElement, field: "video" | "card"): HTMLElement | null {
  return card.querySelector<HTMLElement>(`[data-thanks-${field}-date]`);
}

function fieldBox(card: HTMLElement, field: "video" | "card"): HTMLInputElement | null {
  return card.querySelector<HTMLInputElement>(`input[data-thanks-field="${field}"]`);
}

function setSaveStatus(card: HTMLElement, message: string, state: "saving" | "saved" | "error") {
  const status = card.querySelector<HTMLElement>("[data-thanks-save]");
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle("watson-thanks__save--error", state === "error");
  status.classList.toggle("watson-thanks__save--ok", state === "saved");
}

function setVideoStatus(card: HTMLElement, message: string, state: "saving" | "saved" | "error") {
  const status = card.querySelector<HTMLElement>("[data-thanks-video-status]");
  if (!status) return;
  status.hidden = !message;
  status.textContent = message;
  status.classList.toggle("watson-thanks__save--error", state === "error");
  status.classList.toggle("watson-thanks__save--ok", state === "saved");
}

async function saveThankYouAction(
  body: Record<string, unknown>,
): Promise<SaveResult> {
  try {
    const response = await fetch("/api/watson/member-thank-yous", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string; status?: SavedStatus; video?: SavedVideo }
      | null;
    if (!response.ok || !payload?.ok || !payload.status) {
      return { ok: false, error: payload?.error || "The thank-you could not be saved." };
    }
    return { ok: true, status: payload.status, video: payload.video };
  } catch {
    return { ok: false, error: "The thank-you could not be saved. Check the connection and try again." };
  }
}

function applyStatus(card: HTMLElement, status: SavedStatus) {
  for (const field of ["video", "card"] as const) {
    const box = fieldBox(card, field);
    const date = fieldDate(card, field);
    const sentAt = field === "video" ? status.videoSentAt : status.cardSentAt;
    const label = field === "video" ? status.videoSentLabel : status.cardSentLabel;
    if (box) box.checked = Boolean(sentAt);
    if (date) {
      date.textContent = label ?? "";
      date.hidden = !label;
    }
  }
  const sentButton = card.querySelector<HTMLButtonElement>("[data-thanks-mark-video-sent]");
  if (sentButton) sentButton.disabled = Boolean(status.videoSentAt);
}

function applyVideo(card: HTMLElement, video: SavedVideo) {
  const ready = card.querySelector<HTMLElement>("[data-thanks-video-ready]");
  const link = card.querySelector<HTMLInputElement>("[data-thanks-video-link]");
  const preview = card.querySelector<HTMLAnchorElement>("[data-thanks-video-preview]");
  const subject = card.querySelector<HTMLInputElement>("[data-thanks-subject]");
  const message = card.querySelector<HTMLTextAreaElement>("[data-thanks-message]");
  const vimeo = card.querySelector<HTMLInputElement>("[data-thanks-vimeo-url]");
  const submit = card.querySelector<HTMLButtonElement>("[data-thanks-video-submit]");
  if (ready) ready.hidden = false;
  if (link) link.value = video.publicViewingUrl;
  if (preview) preview.href = video.publicViewingUrl;
  if (subject) subject.value = video.emailSubject;
  if (vimeo) vimeo.value = video.originalVimeoUrl;
  if (message && (message.value.trim() === "" || message.value === message.defaultValue)) {
    message.value = video.emailMessage;
    message.defaultValue = video.emailMessage;
  }
  if (submit) submit.textContent = "Update thank-you video";
  const sentButton = card.querySelector<HTMLButtonElement>("[data-thanks-mark-video-sent]");
  const videoBox = fieldBox(card, "video");
  if (sentButton) sentButton.disabled = Boolean(videoBox?.checked);
}

function showCompletion(card: HTMLElement, status: SavedStatus) {
  const completed = Boolean(status.completedAt);
  card.dataset.completed = completed ? "true" : "false";
  const box = card.querySelector<HTMLInputElement>("[data-thanks-completed]");
  const label = card.querySelector<HTMLElement>("[data-thanks-completed-label]");
  if (box) box.checked = completed;
  if (label) {
    label.textContent = status.completedLabel ?? "";
    label.hidden = !status.completedLabel;
  }
}

function removeFromCurrentView(root: HTMLElement, card: HTMLElement, completed: boolean) {
  const view = root.getAttribute("data-thanks-view") || "todo";
  const remove = completed ? WORK_VIEWS.has(view) : view === "completed";
  if (!remove) return;
  card.remove();
  const count = root.querySelector<HTMLElement>(".watson-thanks__count");
  const remaining = root.querySelectorAll("[data-thanks-card]").length;
  if (count) {
    const total = count.textContent?.match(/of (\d+)/)?.[1];
    count.textContent = `Showing ${remaining} of ${total ?? remaining} payment${total === "1" ? "" : "s"} in this date range.`;
  }
  if (remaining === 0 && !root.querySelector(".watson-thanks__empty")) {
    const list = root.querySelector(".watson-thanks__list");
    const empty = document.createElement("p");
    empty.className = "watson-thanks__empty";
    empty.textContent = "No annual membership payments match this view.";
    list?.before(empty);
  }
}

function copyTargetText(card: HTMLElement, target: string): string {
  if (target === "link") {
    return card.querySelector<HTMLInputElement>("[data-thanks-video-link]")?.value || "";
  }
  if (target === "email") return card.getAttribute("data-member-email") || "";
  if (target === "subject") {
    return card.querySelector<HTMLInputElement>("[data-thanks-subject]")?.value || "";
  }
  if (target === "message") {
    return card.querySelector<HTMLTextAreaElement>("[data-thanks-message]")?.value || "";
  }
  return "";
}

export function initWatsonMemberThankYous(): void {
  const root = document.querySelector<HTMLElement>("[data-member-thank-yous]");
  if (!root) return;

  root.querySelectorAll<HTMLElement>("[data-thanks-card]").forEach((card) => {
    const chargeId = card.getAttribute("data-charge-id") || "";
    card.querySelectorAll<HTMLInputElement>("input[data-thanks-field]").forEach((box) => {
      box.addEventListener("change", async () => {
        const field = box.getAttribute("data-thanks-field");
        if (field !== "video" && field !== "card") return;
        const sent = box.checked;
        const other = field === "video" ? "card" : "video";
        const otherBefore = fieldBox(card, other)?.checked ?? false;
        box.disabled = true;
        setSaveStatus(card, "Saving…", "saving");

        const result = await saveThankYouAction({ stripeChargeId: chargeId, field, sent });
        box.disabled = false;
        if (!result.ok) {
          box.checked = !sent;
          setSaveStatus(card, result.error, "error");
          return;
        }

        const savedOn = field === "video" ? Boolean(result.status.videoSentAt) : Boolean(result.status.cardSentAt);
        const otherAfter = other === "video" ? Boolean(result.status.videoSentAt) : Boolean(result.status.cardSentAt);
        applyStatus(card, result.status);
        if (savedOn !== sent || otherAfter !== otherBefore) {
          setSaveStatus(
            card,
            "The save did not match what you checked. Refresh the page before continuing.",
            "error",
          );
          return;
        }
        setSaveStatus(card, "Saved", "saved");
      });
    });

    card.querySelector<HTMLFormElement>("[data-thanks-video-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const vimeoUrl = card.querySelector<HTMLInputElement>("[data-thanks-vimeo-url]")?.value || "";
      const submit = card.querySelector<HTMLButtonElement>("[data-thanks-video-submit]");
      if (submit) submit.disabled = true;
      setVideoStatus(card, "Saving…", "saving");
      const result = await saveThankYouAction({
        action: "save_video",
        stripeChargeId: chargeId,
        vimeoUrl,
        memberName: card.getAttribute("data-member-name") || "",
        memberEmail: card.getAttribute("data-member-email") || "",
      });
      if (submit) submit.disabled = false;
      if (!result.ok || !result.video) {
        setVideoStatus(card, result.ok ? "The viewing link was not returned." : result.error, "error");
        return;
      }
      applyVideo(card, result.video);
      setVideoStatus(card, "Saved. The video email is not marked sent.", "saved");
    });

    card.querySelector<HTMLButtonElement>("[data-thanks-mark-video-sent]")?.addEventListener("click", async () => {
      const button = card.querySelector<HTMLButtonElement>("[data-thanks-mark-video-sent]");
      if (button) button.disabled = true;
      setVideoStatus(card, "Saving…", "saving");
      const result = await saveThankYouAction({
        action: "mark_video_email_sent",
        stripeChargeId: chargeId,
      });
      if (!result.ok) {
        if (button) button.disabled = false;
        setVideoStatus(card, result.error, "error");
        return;
      }
      applyStatus(card, result.status);
      setVideoStatus(card, "Video email marked sent.", "saved");
    });

    card.querySelector<HTMLInputElement>("[data-thanks-completed]")?.addEventListener("change", async () => {
      const box = card.querySelector<HTMLInputElement>("[data-thanks-completed]");
      if (!box) return;
      const completed = box.checked;
      const videoBefore = fieldBox(card, "video")?.checked ?? false;
      const cardBefore = fieldBox(card, "card")?.checked ?? false;
      box.disabled = true;
      setSaveStatus(card, "Saving…", "saving");
      const result = await saveThankYouAction({
        action: completed ? "complete" : "reopen",
        stripeChargeId: chargeId,
      });
      box.disabled = false;
      if (!result.ok) {
        box.checked = !completed;
        setSaveStatus(card, result.error, "error");
        return;
      }
      const videoAfter = Boolean(result.status.videoSentAt);
      const cardAfter = Boolean(result.status.cardSentAt);
      if (Boolean(result.status.completedAt) !== completed || videoAfter !== videoBefore || cardAfter !== cardBefore) {
        box.checked = !completed;
        setSaveStatus(
          card,
          "The save did not match what you checked. Refresh the page before continuing.",
          "error",
        );
        return;
      }
      showCompletion(card, result.status);
      setSaveStatus(card, completed ? "Marked complete" : "Reopened", "saved");
      removeFromCurrentView(root, card, completed);
    });

    card.querySelectorAll<HTMLButtonElement>("[data-thanks-copy-target]").forEach((button) => {
      button.addEventListener("click", async () => {
        const target = button.getAttribute("data-thanks-copy-target") || "";
        const note = card.querySelector<HTMLElement>("[data-thanks-video-copy-note]");
        const ok = await copyThankYouText(copyTargetText(card, target));
        if (note) note.textContent = ok ? "Copied" : "Select the text and copy it manually.";
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-thanks-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const email = button.getAttribute("data-email") || "";
      const note = button.parentElement?.querySelector<HTMLElement>("[data-thanks-copy-note]");
      const ok = await copyThankYouText(email);
      if (note) note.textContent = ok ? "Copied" : "Copy the email from the address shown.";
    });
  });
}
