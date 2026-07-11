/**
 * Generic DOM-fill helpers for /admin/reports/* pages, paired with AdminReportPage.astro /
 * AdminReportTable.astro. Extracted so each new report page writes "fetch + map data" only,
 * instead of re-implementing the same status/stat-card/table rendering loop every time (the
 * duplication flagged in docs/admin-reporting-architecture.md).
 */

export function setStatus(message: string, isError = false): void {
  const el = document.querySelector("[data-status]");
  if (el instanceof HTMLElement) {
    el.textContent = message;
    el.hidden = !message;
    el.classList.toggle("admin-report__status--error", isError);
  }
}

export function setNote(message: string | null | undefined): void {
  const el = document.querySelector("[data-note]");
  if (el instanceof HTMLElement) {
    el.textContent = message || "";
    el.hidden = !message;
  }
}

export function showReport(show: boolean): void {
  const el = document.querySelector("[data-report]");
  if (el instanceof HTMLElement) el.hidden = !show;
}

export function setStat(key: string, value: string | number): void {
  const el = document.querySelector(`[data-stat="${key}"]`);
  if (el instanceof HTMLElement) el.textContent = String(value);
}

export function setStats(values: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(values)) setStat(key, value);
}

/**
 * Fills a `<tbody data-table={tableId}>` (from AdminReportTable.astro) with one `<tr>` per row.
 * `toCells` maps a row to its display strings, left-to-right in column order.
 */
export function renderTableRows<T>(
  tableId: string,
  rows: T[],
  toCells: (row: T) => string[],
  emptyMessage = "No data yet.",
): void {
  const tbody = document.querySelector(`[data-table="${tableId}"]`);
  if (!(tbody instanceof HTMLElement)) return;
  tbody.replaceChildren();

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    const columnCount = tbody.closest("table")?.querySelectorAll("thead th").length || 1;
    td.colSpan = columnCount;
    td.textContent = emptyMessage;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const value of toCells(row)) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

/** Locale-formatted date/time, falling back to the raw ISO string when unparseable. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** USD currency formatting for revenue stat cards / tables. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
