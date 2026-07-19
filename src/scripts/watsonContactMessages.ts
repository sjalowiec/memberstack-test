export function initWatsonContactMessageActions(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-contact-id]").forEach((item) => {
    const messageId = item.getAttribute("data-contact-id");
    if (!messageId) return;

    const statusEl = item.querySelector<HTMLSelectElement>("[data-contact-status]");
    const notesEl = item.querySelector<HTMLTextAreaElement>("[data-contact-notes]");
    const statusMsg = item.querySelector<HTMLElement>("[data-contact-action-status]");
    const saveBtn = item.querySelector<HTMLButtonElement>("[data-contact-save]");
    const resolveBtn = item.querySelector<HTMLButtonElement>("[data-contact-resolve]");
    const reopenBtn = item.querySelector<HTMLButtonElement>("[data-contact-reopen]");
    const idForUrl: string = messageId;

    async function patchMessage(body: Record<string, unknown>): Promise<boolean> {
      if (statusMsg) {
        statusMsg.hidden = true;
        statusMsg.removeAttribute("data-error");
      }

      const res = await fetch(
        `/api/watson/contact-messages/${encodeURIComponent(idForUrl)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok) {
        if (statusMsg) {
          statusMsg.textContent = data?.error || "Unable to save changes.";
          statusMsg.setAttribute("data-error", "true");
          statusMsg.hidden = false;
        }
        return false;
      }

      if (statusMsg) {
        statusMsg.textContent = "Saved.";
        statusMsg.hidden = false;
      }
      return true;
    }

    saveBtn?.addEventListener("click", async () => {
      const body: Record<string, unknown> = {};
      if (statusEl) body.status = statusEl.value;
      if (notesEl) body.admin_notes = notesEl.value;
      const ok = await patchMessage(body);
      if (ok) window.location.reload();
    });

    resolveBtn?.addEventListener("click", async () => {
      if (statusEl) statusEl.value = "resolved";
      const ok = await patchMessage({
        status: "resolved",
        admin_notes: notesEl?.value ?? "",
      });
      if (ok) window.location.reload();
    });

    reopenBtn?.addEventListener("click", async () => {
      if (statusEl) statusEl.value = "in_progress";
      const ok = await patchMessage({
        status: "in_progress",
        admin_notes: notesEl?.value ?? "",
      });
      if (ok) window.location.reload();
    });
  });
}
