type SavedStatus = {
  stripeChargeId: string;
  videoSentAt: string | null;
  cardSentAt: string | null;
  videoSentLabel: string | null;
  cardSentLabel: string | null;
};

type SaveResult =
  | { ok: true; status: SavedStatus }
  | { ok: false; error: string };

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

async function saveField(
  stripeChargeId: string,
  field: "video" | "card",
  sent: boolean,
): Promise<SaveResult> {
  try {
    const response = await fetch("/api/watson/member-thank-yous", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ stripeChargeId, field, sent }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string; status?: SavedStatus }
      | null;
    if (!response.ok || !payload?.ok || !payload.status) {
      return {
        ok: false,
        error: payload?.error || "The thank-you box could not be saved.",
      };
    }
    return { ok: true, status: payload.status };
  } catch {
    return { ok: false, error: "The thank-you box could not be saved. Check the connection and try again." };
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

        const result = await saveField(chargeId, field, sent);
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
  });

  root.querySelectorAll<HTMLButtonElement>("[data-thanks-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const email = button.getAttribute("data-email") || "";
      const note = button.parentElement?.querySelector<HTMLElement>("[data-thanks-copy-note]");
      if (!email || !navigator.clipboard) {
        if (note) note.textContent = "Copy the email from the address shown.";
        return;
      }
      try {
        await navigator.clipboard.writeText(email);
        if (note) note.textContent = "Copied";
      } catch {
        if (note) note.textContent = "Could not copy. Use the email link instead.";
      }
    });
  });
}
