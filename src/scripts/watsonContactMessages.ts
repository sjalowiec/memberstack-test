const ACTIONS_BOUND_ATTR = "data-contact-actions-bound";

export function initWatsonContactMessageActions(root: ParentNode = document): void {
  const item = root.querySelector<HTMLElement>("[data-contact-id]");
  if (!item || item.getAttribute(ACTIONS_BOUND_ATTR) === "true") return;

  const messageId = item.getAttribute("data-contact-id");
  if (!messageId) return;

  item.setAttribute(ACTIONS_BOUND_ATTR, "true");

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

const LIST_BOUND_ATTR = "data-contact-list-bound";

export type ContactListMutation = {
  removeRow: boolean;
  nextStatus: "responded" | null;
  nextNewCount: number | null;
};

export function deleteContactMessagePrompt(label: string): string {
  const trimmed = label.trim().replace(/\s+/g, " ");
  const who = trimmed ? trimmed.slice(0, 80) : "this sender";
  return `Delete the contact message from ${who}? This cannot be undone.`;
}

export function planContactListMutation(input: {
  filter: string;
  status: string;
  action: "respond" | "delete";
  newCount: number | null;
  responseNewCount?: number | null;
}): ContactListMutation {
  const wasNew = input.status === "new";
  const removeRow =
    input.action === "delete" ||
    (input.action === "respond" && (input.filter === "new" || input.filter === "closed"));
  const nextStatus = input.action === "respond" && !removeRow ? "responded" : null;
  let nextNewCount = input.newCount;
  if (
    typeof input.responseNewCount === "number" &&
    Number.isFinite(input.responseNewCount)
  ) {
    nextNewCount = Math.max(0, Math.trunc(input.responseNewCount));
  } else if (wasNew && input.newCount != null) {
    nextNewCount = Math.max(0, input.newCount - 1);
  }
  return { removeRow, nextStatus, nextNewCount };
}

function readNewCount(root: ParentNode): number | null {
  const el = root.querySelector<HTMLElement>("[data-contact-new-count]");
  if (!el) return null;
  const value = Number(el.textContent?.trim());
  return Number.isFinite(value) ? value : null;
}

function writeNewCount(root: ParentNode, count: number | null): void {
  if (count == null) return;
  const link = root.querySelector<HTMLAnchorElement>('a[href="/watson/contact-messages"]');
  let el = root.querySelector<HTMLElement>("[data-contact-new-count]");
  if (!el && link) {
    el = link.ownerDocument.createElement("span");
    el.className = "watson-nav__count";
    el.setAttribute("data-contact-new-count", "");
    link.append(" ", el);
  }
  if (!el) return;
  el.textContent = String(count);
}

function setRowError(row: HTMLElement, message: string | null): void {
  const el = row.querySelector<HTMLElement>("[data-contact-row-error]");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function setRowBusy(row: HTMLElement, busy: boolean): void {
  if (busy) row.setAttribute("data-contact-row-busy", "true");
  else row.removeAttribute("data-contact-row-busy");
  row.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.disabled = busy;
  });
}

function markContactRowResponded(row: HTMLElement): void {
  row.classList.remove("watson-contact__row--new");
  row.setAttribute("data-contact-status", "responded");
  const badge = row.querySelector<HTMLElement>("[data-contact-status-badge]");
  if (badge) {
    badge.textContent = "Responded";
    badge.className = "watson-contact__badge watson-contact__badge--responded";
  }
  row.querySelector("[data-contact-list-respond]")?.remove();
}

function removeContactRow(list: HTMLElement, row: HTMLElement): void {
  row.remove();
  if (list.querySelector("[data-contact-row]")) return;
  const table = list.querySelector<HTMLElement>("[data-contact-table-wrap]");
  const empty = list.querySelector<HTMLElement>("[data-contact-list-empty]");
  if (table) table.hidden = true;
  if (empty) empty.hidden = false;
}

function applyContactListMutation(
  list: HTMLElement,
  row: HTMLElement,
  plan: ContactListMutation,
): void {
  writeNewCount(list.ownerDocument, plan.nextNewCount);
  if (plan.removeRow) {
    removeContactRow(list, row);
    return;
  }
  if (plan.nextStatus === "responded") markContactRowResponded(row);
}

type ContactActionResult =
  | { ok: true; newCount: number | null }
  | { ok: false; error: string };

async function readContactActionResult(
  res: Response,
  fallback: string,
): Promise<ContactActionResult> {
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    newCount?: unknown;
  } | null;
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error || fallback };
  }
  const newCount =
    typeof data.newCount === "number" && Number.isFinite(data.newCount) ? data.newCount : null;
  return { ok: true, newCount };
}

async function respondToContactRow(list: HTMLElement, row: HTMLElement): Promise<void> {
  if (row.getAttribute("data-contact-row-busy") === "true") return;
  const messageId = row.getAttribute("data-contact-row-id");
  if (!messageId) return;
  setRowError(row, null);
  setRowBusy(row, true);
  try {
    const res = await fetch(
      `/api/watson/contact-messages/${encodeURIComponent(messageId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "responded" }),
      },
    );
    const result = await readContactActionResult(
      res,
      "Could not mark this message as responded.",
    );
    if (!result.ok) {
      setRowError(row, result.error);
      return;
    }
    applyContactListMutation(
      list,
      row,
      planContactListMutation({
        filter: list.getAttribute("data-contact-filter") || "new",
        status: row.getAttribute("data-contact-status") || "",
        action: "respond",
        newCount: readNewCount(list.ownerDocument),
        responseNewCount: result.newCount,
      }),
    );
  } catch {
    setRowError(row, "Could not mark this message as responded.");
  } finally {
    setRowBusy(row, false);
  }
}

async function deleteContactRow(list: HTMLElement, row: HTMLElement): Promise<void> {
  if (row.getAttribute("data-contact-row-busy") === "true") return;
  const messageId = row.getAttribute("data-contact-row-id");
  if (!messageId) return;
  const confirmed = window.confirm(
    deleteContactMessagePrompt(row.getAttribute("data-contact-label") || ""),
  );
  if (!confirmed) return;

  setRowError(row, null);
  setRowBusy(row, true);
  try {
    const res = await fetch(
      `/api/watson/contact-messages/${encodeURIComponent(messageId)}`,
      { method: "DELETE" },
    );
    const result = await readContactActionResult(res, "Could not delete this message.");
    if (!result.ok) {
      setRowError(row, result.error);
      return;
    }
    applyContactListMutation(
      list,
      row,
      planContactListMutation({
        filter: list.getAttribute("data-contact-filter") || "new",
        status: row.getAttribute("data-contact-status") || "",
        action: "delete",
        newCount: readNewCount(list.ownerDocument),
        responseNewCount: result.newCount,
      }),
    );
  } catch {
    setRowError(row, "Could not delete this message.");
  } finally {
    setRowBusy(row, false);
  }
}

export function initWatsonContactMessageList(root: ParentNode = document): void {
  const list = root.querySelector<HTMLElement>("[data-contact-list]");
  if (!list || list.getAttribute(LIST_BOUND_ATTR) === "true") return;
  list.setAttribute(LIST_BOUND_ATTR, "true");

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const respond = target.closest<HTMLButtonElement>("[data-contact-list-respond]");
    const remove = target.closest<HTMLButtonElement>("[data-contact-list-delete]");
    if (!respond && !remove) return;
    const row = (respond || remove)?.closest<HTMLElement>("[data-contact-row]");
    if (!row) return;
    if (respond) {
      void respondToContactRow(list, row);
      return;
    }
    void deleteContactRow(list, row);
  });
}
