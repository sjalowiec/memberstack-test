import { matchesTextQuery } from "../lib/watson/reportClientFilters";

type VideoReplyAdmin = {
  id: string;
  publicToken: string;
  memberName: string;
  memberEmail: string;
  topic: string;
  originalVimeoUrl: string;
  privateNotes: string;
  publicViewingUrl?: string;
  defaultEmailMessage?: string;
  sentAt: string | null;
  sentCount: number;
  status: string;
};

function copyText(text: string): Promise<boolean> {
  const value = String(text || "");
  if (!value) return Promise.resolve(false);

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(value)
      .then(() => true)
      .catch(() => fallbackCopy(value));
  }
  return Promise.resolve(fallbackCopy(value));
}

function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function setStatus(el: HTMLElement | null, message: string, isError = false): void {
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
  if (isError) el.setAttribute("data-error", "true");
  else el.removeAttribute("data-error");
}

async function patchReply(
  id: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; reply?: VideoReplyAdmin; error?: string }> {
  const res = await fetch(`/api/watson/video-replies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    reply?: VideoReplyAdmin;
    error?: string;
  } | null;
  if (!res.ok || !data?.ok || !data.reply) {
    return { ok: false, error: data?.error || "Unable to update video reply." };
  }
  return { ok: true, reply: data.reply };
}

function fillResultPanel(root: HTMLElement, reply: VideoReplyAdmin): void {
  const panel = root.querySelector<HTMLElement>("[data-vr-result]");
  const linkInput = root.querySelector<HTMLInputElement>("[data-vr-result-link]");
  const messageEl = root.querySelector<HTMLTextAreaElement>("[data-vr-result-message]");
  const markSentBtn = root.querySelector<HTMLButtonElement>("[data-vr-mark-sent]");
  if (!panel || !linkInput || !messageEl || !markSentBtn) return;

  panel.hidden = false;
  panel.dataset.replyId = reply.id;
  linkInput.value = reply.publicViewingUrl || "";
  messageEl.value = reply.defaultEmailMessage || "";
  markSentBtn.textContent = reply.sentAt ? "Mark Sent Again" : "Mark Sent";
  markSentBtn.dataset.force = reply.sentAt ? "true" : "false";
}

const LAST_CREATED_KEY = "watson-video-reply-last-created";

export function initWatsonVideoReplies(root: ParentNode = document): void {
  const page = root.querySelector<HTMLElement>("[data-video-replies-page]");
  if (!page) return;

  const form = page.querySelector<HTMLFormElement>("[data-vr-create-form]");
  const formStatus = page.querySelector<HTMLElement>("[data-vr-form-status]");
  const searchInput = page.querySelector<HTMLInputElement>("[data-vr-search]");
  const table = page.querySelector<HTMLTableElement>("[data-vr-history-table]");
  const editDialog = page.querySelector<HTMLDialogElement>("[data-vr-edit-dialog]");
  const editForm = page.querySelector<HTMLFormElement>("[data-vr-edit-form]");
  const editStatus = page.querySelector<HTMLElement>("[data-vr-edit-status]");

  try {
    const raw = sessionStorage.getItem(LAST_CREATED_KEY);
    if (raw) {
      sessionStorage.removeItem(LAST_CREATED_KEY);
      const reply = JSON.parse(raw) as VideoReplyAdmin;
      if (reply?.id && reply.publicViewingUrl) {
        fillResultPanel(page, reply);
        setStatus(
          formStatus,
          "Saved. Copy the link or message below, then mark sent when emailed.",
        );
        window.location.hash = "vr-result";
      }
    }
  } catch {
    // ignore restore failures
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(formStatus, "");

    const fd = new FormData(form);
    const payload = {
      memberName: String(fd.get("memberName") || ""),
      memberEmail: String(fd.get("memberEmail") || ""),
      topic: String(fd.get("topic") || ""),
      vimeoUrl: String(fd.get("vimeoUrl") || ""),
      privateNotes: String(fd.get("privateNotes") || ""),
    };

    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch("/api/watson/video-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        reply?: VideoReplyAdmin;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok || !data.reply) {
        setStatus(formStatus, data?.error || "Unable to save video reply.", true);
        return;
      }

      try {
        sessionStorage.setItem(LAST_CREATED_KEY, JSON.stringify(data.reply));
      } catch {
        // If storage is unavailable, still show the result without a history refresh.
        fillResultPanel(page, data.reply);
        setStatus(
          formStatus,
          "Saved. Copy the link or message below, then mark sent when emailed.",
        );
        return;
      }
      window.location.reload();
    } catch {
      setStatus(formStatus, "Unable to save video reply.", true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  page.querySelectorAll<HTMLButtonElement>("[data-vr-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const target = btn.getAttribute("data-vr-copy");
      let text = "";
      if (target === "link") {
        text =
          page.querySelector<HTMLInputElement>("[data-vr-result-link]")?.value ||
          btn.getAttribute("data-copy-text") ||
          "";
      } else if (target === "message") {
        text =
          page.querySelector<HTMLTextAreaElement>("[data-vr-result-message]")?.value ||
          btn.getAttribute("data-copy-text") ||
          "";
      } else {
        text = btn.getAttribute("data-copy-text") || "";
      }

      const statusEl = btn.parentElement?.querySelector<HTMLElement>("[data-vr-copy-status]");
      const ok = await copyText(text);
      if (statusEl) {
        statusEl.textContent = ok ? "Copied" : "Select and copy manually";
        window.setTimeout(() => {
          statusEl.textContent = "";
        }, 2000);
      }
    });
  });

  page.querySelector<HTMLButtonElement>("[data-vr-mark-sent]")?.addEventListener("click", async () => {
    const panel = page.querySelector<HTMLElement>("[data-vr-result]");
    const id = panel?.dataset.replyId;
    if (!id) return;
    const btn = page.querySelector<HTMLButtonElement>("[data-vr-mark-sent]");
    const force = btn?.dataset.force === "true";
    const result = await patchReply(id, { action: "mark_sent", force });
    const status = page.querySelector<HTMLElement>("[data-vr-result-status]");
    if (!result.ok) {
      setStatus(status, result.error || "Unable to mark sent.", true);
      return;
    }
    setStatus(status, "Marked as sent.");
    window.location.reload();
  });

  searchInput?.addEventListener("input", () => {
    const query = searchInput.value;
    table?.querySelectorAll<HTMLTableRowElement>("tbody tr[data-vr-row]").forEach((row) => {
      const haystack = row.getAttribute("data-vr-search") || "";
      row.hidden = !matchesTextQuery(haystack, query);
    });
  });

  page.querySelectorAll<HTMLButtonElement>("[data-vr-row-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-vr-row-action");
      const row = btn.closest<HTMLElement>("[data-vr-row]");
      const id = row?.getAttribute("data-reply-id");
      if (!row || !id || !action) return;

      if (action === "copy-link") {
        const text = btn.getAttribute("data-copy-text") || "";
        await copyText(text);
        return;
      }

      if (action === "copy-message") {
        const text = btn.getAttribute("data-copy-text") || "";
        await copyText(text);
        return;
      }

      if (action === "view") {
        const url = btn.getAttribute("data-view-url");
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        return;
      }

      if (action === "mark-sent") {
        const force = btn.getAttribute("data-force") === "true";
        if (force && !window.confirm("Mark this video reply as sent again?")) return;
        const result = await patchReply(id, { action: "mark_sent", force });
        if (!result.ok) {
          window.alert(result.error || "Unable to mark sent.");
          return;
        }
        window.location.reload();
        return;
      }

      if (action === "disable") {
        if (
          !window.confirm(
            "Disable this viewing link? The history record will be kept, but the public page will become unavailable.",
          )
        ) {
          return;
        }
        const result = await patchReply(id, { action: "disable" });
        if (!result.ok) {
          window.alert(result.error || "Unable to disable link.");
          return;
        }
        window.location.reload();
        return;
      }

      if (action === "edit" && editDialog && editForm) {
        editForm.dataset.replyId = id;
        (editForm.elements.namedItem("memberName") as HTMLInputElement).value =
          row.getAttribute("data-member-name") || "";
        (editForm.elements.namedItem("memberEmail") as HTMLInputElement).value =
          row.getAttribute("data-member-email") || "";
        (editForm.elements.namedItem("topic") as HTMLInputElement).value =
          row.getAttribute("data-topic") || "";
        (editForm.elements.namedItem("vimeoUrl") as HTMLInputElement).value =
          row.getAttribute("data-vimeo-url") || "";
        (editForm.elements.namedItem("privateNotes") as HTMLTextAreaElement).value =
          row.getAttribute("data-private-notes") || "";
        setStatus(editStatus, "");
        editDialog.showModal();
      }
    });
  });

  editForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = editForm.dataset.replyId;
    if (!id) return;
    const fd = new FormData(editForm);
    const result = await patchReply(id, {
      action: "update",
      memberName: String(fd.get("memberName") || ""),
      memberEmail: String(fd.get("memberEmail") || ""),
      topic: String(fd.get("topic") || ""),
      vimeoUrl: String(fd.get("vimeoUrl") || ""),
      privateNotes: String(fd.get("privateNotes") || ""),
    });
    if (!result.ok) {
      setStatus(editStatus, result.error || "Unable to save changes.", true);
      return;
    }
    editDialog?.close();
    window.location.reload();
  });

  page.querySelectorAll<HTMLButtonElement>("[data-vr-edit-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => editDialog?.close());
  });
}
