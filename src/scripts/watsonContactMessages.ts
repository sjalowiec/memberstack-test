import {
  RESPONDED_CONTACT_MESSAGE_NOTICE,
  contactFilterHidesResponded,
  contactListHrefAfterRespond,
  parseContactMessageFilter,
  parseContactMessagePage,
  respondedContactNoticeLinks,
  type ContactMessageListLocation,
} from "../lib/contact/contactMessageRecord";

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

  async function patchMessage(
    body: Record<string, unknown>,
    afterSave: "reload" | "list" = "reload",
  ): Promise<boolean> {
    if (statusMsg) {
      statusMsg.hidden = true;
      statusMsg.removeAttribute("data-error");
    }
    buttons.forEach((button) => {
      button.disabled = true;
    });

    let navigating = false;
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

      if (afterSave === "list") {
        navigating = true;
        const filter = parseContactMessageFilter(item.getAttribute("data-contact-filter"));
        const page = parseContactMessagePage(item.getAttribute("data-contact-page"));
        window.location.assign(contactListHrefAfterRespond(messageId as string, { filter, page }));
        return true;
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
      if (!navigating) {
        buttons.forEach((button) => {
          button.disabled = false;
        });
      }
    }
  }

  item.querySelector("[data-contact-respond]")?.addEventListener("click", () => {
    void patchMessage({ status: "responded" }, "list");
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

export type ContactSelectionRow = {
  visible: boolean;
  checked: boolean;
  id: string;
};

/** Checked rows on the current page only. Hidden rows belong to another page. */
export function selectedContactMessageIds(rows: readonly ContactSelectionRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (!row.visible || !row.checked) continue;
    const id = row.id.trim();
    if (!id || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

export function deleteSelectedButtonLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  return `Delete selected (${n})`;
}

export function deleteSelectedContactMessagesPrompt(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  const noun = n === 1 ? "message" : "messages";
  return `Permanently delete ${n} contact ${noun}? This cannot be undone.`;
}

export function bulkDeleteFollowUp(input: {
  ok: boolean;
  deletedCount: number;
  selectedIds: readonly string[];
}): { refresh: boolean; selectedIds: readonly string[] } {
  if (!input.ok || input.deletedCount <= 0) {
    return { refresh: false, selectedIds: input.selectedIds };
  }
  return { refresh: true, selectedIds: [] };
}

export function contactSelectionState(
  rows: readonly ContactSelectionRow[],
  busy: boolean,
): {
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  deleteDisabled: boolean;
  label: string;
} {
  const visible = rows.filter((row) => row.visible);
  const selectedCount = selectedContactMessageIds(rows).length;
  const checkedVisible = visible.filter((row) => row.checked && row.id.trim()).length;
  const allSelected = visible.length > 0 && checkedVisible === visible.length;
  return {
    selectedCount,
    allSelected,
    someSelected: selectedCount > 0 && !allSelected,
    deleteDisabled: busy || selectedCount === 0,
    label: deleteSelectedButtonLabel(selectedCount),
  };
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

function readListLocation(list: HTMLElement): ContactMessageListLocation {
  return {
    filter: parseContactMessageFilter(list.getAttribute("data-contact-filter")),
    page: parseContactMessagePage(list.getAttribute("data-contact-page")),
  };
}

function showRespondedContactNotice(
  doc: Document,
  links: { viewMessageHref: string; viewRespondedHref: string },
): void {
  const host = doc.querySelector("[data-contact-notices]");
  if (!host) return;
  const existing = host.querySelector("[data-contact-responded-notice]");
  existing?.remove();

  const notice = doc.createElement("p");
  notice.className = "watson__status watson__status--success";
  notice.setAttribute("role", "status");
  notice.setAttribute("data-contact-responded-notice", "");
  notice.append(doc.createTextNode(`${RESPONDED_CONTACT_MESSAGE_NOTICE} `));

  const viewMessage = doc.createElement("a");
  viewMessage.href = links.viewMessageHref;
  viewMessage.textContent = "View message";
  viewMessage.setAttribute("data-contact-view-message", "");

  const viewResponded = doc.createElement("a");
  viewResponded.href = links.viewRespondedHref;
  viewResponded.textContent = "View responded messages";
  viewResponded.setAttribute("data-contact-view-responded", "");

  notice.append(viewMessage, doc.createTextNode(" "), viewResponded);
  host.append(notice);
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
  const listBusy =
    row.closest<HTMLElement>("[data-contact-list]")?.getAttribute("data-contact-bulk-busy") ===
    "true";
  row.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.disabled = busy || listBusy;
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
  syncContactSelection(list);
  if (list.querySelector("[data-contact-row]")) return;
  const table = list.querySelector<HTMLElement>("[data-contact-table-wrap]");
  const empty = list.querySelector<HTMLElement>("[data-contact-list-empty]");
  const bulk = list.querySelector<HTMLElement>(".watson-contact__bulk");
  if (table) table.hidden = true;
  if (bulk) bulk.hidden = true;
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
    const location = readListLocation(list);
    if (contactFilterHidesResponded(location.filter)) {
      const links = respondedContactNoticeLinks(messageId, location);
      if (links) showRespondedContactNotice(list.ownerDocument, links);
    }
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

function selectionRows(list: HTMLElement): ContactSelectionRow[] {
  return [...list.querySelectorAll<HTMLElement>("[data-contact-row]")].map((row) => {
    const box = row.querySelector<HTMLInputElement>("[data-contact-select]");
    return {
      visible: !row.hidden,
      checked: box?.checked === true,
      id: box?.value || row.getAttribute("data-contact-row-id") || "",
    };
  });
}

function pageContactCheckboxes(list: HTMLElement): HTMLInputElement[] {
  return [...list.querySelectorAll<HTMLElement>("[data-contact-row]")].flatMap((row) => {
    if (row.hidden) return [];
    const box = row.querySelector<HTMLInputElement>("[data-contact-select]");
    return box ? [box] : [];
  });
}

function syncContactSelection(list: HTMLElement): void {
  const state = contactSelectionState(
    selectionRows(list),
    list.getAttribute("data-contact-bulk-busy") === "true",
  );
  const selectAll = list.querySelector<HTMLInputElement>("[data-contact-select-all]");
  if (selectAll) {
    selectAll.checked = state.allSelected;
    selectAll.indeterminate = state.someSelected;
  }
  const button = list.querySelector<HTMLButtonElement>("[data-contact-delete-selected]");
  if (button) {
    button.disabled = state.deleteDisabled;
    button.textContent = state.label;
  }
}

function setBulkStatus(list: HTMLElement, message: string | null): void {
  const el = list.querySelector<HTMLElement>("[data-contact-bulk-status]");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function setBulkBusy(list: HTMLElement, busy: boolean): void {
  if (busy) list.setAttribute("data-contact-bulk-busy", "true");
  else list.removeAttribute("data-contact-bulk-busy");
  list.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    if (button.hasAttribute("data-contact-delete-selected")) return;
    button.disabled = busy;
  });
  list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => {
    box.disabled = busy;
  });
  syncContactSelection(list);
}

type BulkDeleteResult =
  | { ok: true; deletedCount: number }
  | { ok: false; error: string };

async function readBulkDeleteResult(res: Response): Promise<BulkDeleteResult> {
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    deletedCount?: unknown;
  } | null;
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error || "Could not delete the selected messages." };
  }
  const deletedCount =
    typeof data.deletedCount === "number" && Number.isInteger(data.deletedCount)
      ? data.deletedCount
      : 0;
  if (deletedCount <= 0) {
    return { ok: false, error: "Could not delete the selected messages." };
  }
  return { ok: true, deletedCount };
}

async function deleteSelectedContactRows(list: HTMLElement): Promise<void> {
  if (list.getAttribute("data-contact-bulk-busy") === "true") return;
  const ids = selectedContactMessageIds(selectionRows(list));
  if (ids.length === 0) return;
  const confirmed = window.confirm(deleteSelectedContactMessagesPrompt(ids.length));
  if (!confirmed) return;

  setBulkStatus(list, null);
  setBulkBusy(list, true);
  let refresh = false;
  try {
    const res = await fetch("/api/watson/contact-messages/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const result = await readBulkDeleteResult(res);
    const followUp = bulkDeleteFollowUp({
      ok: result.ok,
      deletedCount: result.ok ? result.deletedCount : 0,
      selectedIds: ids,
    });
    if (!result.ok || !followUp.refresh) {
      setBulkStatus(list, result.ok ? "Could not delete the selected messages." : result.error);
      return;
    }
    refresh = true;
    const next = new URL(window.location.href);
    next.searchParams.set("deleted", String(result.deletedCount));
    window.location.assign(`${next.pathname}${next.search}${next.hash}`);
  } catch {
    setBulkStatus(list, "Could not delete the selected messages.");
  } finally {
    if (!refresh && list.isConnected) setBulkBusy(list, false);
  }
}

function clearNoticeParams(): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ["deleted", "responded"]) {
    if (!url.searchParams.has(key)) continue;
    url.searchParams.delete(key);
    changed = true;
  }
  if (!changed) return;
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function initWatsonContactMessageList(root: ParentNode = document): void {
  clearNoticeParams();
  const list = root.querySelector<HTMLElement>("[data-contact-list]");
  if (!list || list.getAttribute(LIST_BOUND_ATTR) === "true") return;
  list.setAttribute(LIST_BOUND_ATTR, "true");
  syncContactSelection(list);

  list.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.matches("[data-contact-select-all]")) {
      const checked = target.checked;
      pageContactCheckboxes(list).forEach((box) => {
        box.checked = checked;
      });
      syncContactSelection(list);
      return;
    }
    if (target.matches("[data-contact-select]")) syncContactSelection(list);
  });

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-contact-delete-selected]")) {
      void deleteSelectedContactRows(list);
      return;
    }
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
