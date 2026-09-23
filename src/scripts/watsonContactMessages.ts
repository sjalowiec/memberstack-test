export function initWatsonContactMessageActions(root: ParentNode = document): void {
  const item = root.querySelector<HTMLElement>("[data-contact-id]");
  if (!item) return;

  const messageId = item.getAttribute("data-contact-id");
  if (!messageId) return;

  const notesEl = item.querySelector<HTMLTextAreaElement>("[data-contact-notes]");
  const statusMsg = item.querySelector<HTMLElement>("[data-contact-action-status]");
  const buttons = item.querySelectorAll<HTMLButtonElement>("button");

  async function patchMessage(body: Record<string, unknown>): Promise<boolean> {
    if (statusMsg) {
      statusMsg.hidden = true;
      statusMsg.removeAttribute("data-error");
    }
    buttons.forEach((button) => {
      button.disabled = true;
    });

    try {
      const res = await fetch(
        `/api/watson/contact-messages/${encodeURIComponent(messageId as string)}`,
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

      window.location.reload();
      return true;
    } catch {
      if (statusMsg) {
        statusMsg.textContent = "Unable to save changes.";
        statusMsg.setAttribute("data-error", "true");
        statusMsg.hidden = false;
      }
      return false;
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  }

  item.querySelector("[data-contact-respond]")?.addEventListener("click", () => {
    void patchMessage({ status: "responded" });
  });
  item.querySelector("[data-contact-close]")?.addEventListener("click", () => {
    void patchMessage({ status: "closed" });
  });
  item.querySelector("[data-contact-reopen]")?.addEventListener("click", () => {
    void patchMessage({ status: "new" });
  });
  item.querySelector("[data-contact-save-notes]")?.addEventListener("click", () => {
    void patchMessage({ internal_notes: notesEl?.value ?? "" });
  });
}
