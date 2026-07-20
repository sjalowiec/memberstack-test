import {
  buildBirthdayMonthView,
  cardStatusKey,
  findMemberInList,
  getBirthdayWeekdayLabels,
  shiftMonth,
  type BirthdayCalendarEntry,
  type BirthdayMonthView,
} from "../lib/watson/birthdayCalendar";
import type { BirthdayCardStatusRecord } from "../lib/watson/birthdayCardsStore";
import type { BirthdayMember } from "../lib/watson/birthdayMemberSource";

type PageState = {
  year: number;
  month: number;
  members: BirthdayMember[];
  statusesByYear: Map<number, Map<string, BirthdayCardStatusRecord>>;
  loadingYear: number | null;
  loadError: string | null;
  activeEntry: BirthdayCalendarEntry | null;
  lastTrigger: HTMLButtonElement | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMailedDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchCardStatusesForYear(
  year: number,
): Promise<{ ok: true; cards: BirthdayCardStatusRecord[] } | { ok: false; error: string }> {
  const res = await fetch(`/api/watson/birthday-cards?year=${encodeURIComponent(String(year))}`, {
    headers: { Accept: "application/json" },
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    cards?: BirthdayCardStatusRecord[];
    error?: string;
  } | null;

  if (!res.ok || !data?.ok || !Array.isArray(data.cards)) {
    return { ok: false, error: data?.error || "Unable to load card statuses." };
  }
  return { ok: true, cards: data.cards };
}

async function patchCardStatus(input: {
  memberId: string;
  birthdayYear: number;
  status: "sent" | "not_sent";
}): Promise<{ ok: true; card: BirthdayCardStatusRecord } | { ok: false; error: string }> {
  const res = await fetch("/api/watson/birthday-cards", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    card?: BirthdayCardStatusRecord;
    error?: string;
  } | null;

  if (!res.ok || !data?.ok || !data.card) {
    return { ok: false, error: data?.error || "Unable to update card status." };
  }
  return { ok: true, card: data.card };
}

function statusesForYear(
  state: PageState,
  year: number,
): BirthdayCardStatusRecord[] {
  const map = state.statusesByYear.get(year);
  return map ? [...map.values()] : [];
}

function rememberStatuses(state: PageState, year: number, cards: BirthdayCardStatusRecord[]): void {
  const map = new Map<string, BirthdayCardStatusRecord>();
  for (const card of cards) {
    map.set(cardStatusKey(card.memberId, card.birthdayYear), card);
  }
  state.statusesByYear.set(year, map);
}

function upsertStatus(state: PageState, card: BirthdayCardStatusRecord): void {
  let map = state.statusesByYear.get(card.birthdayYear);
  if (!map) {
    map = new Map();
    state.statusesByYear.set(card.birthdayYear, map);
  }
  const key = cardStatusKey(card.memberId, card.birthdayYear);
  if (card.status === "not_sent") {
    map.delete(key);
  } else {
    map.set(key, card);
  }
}

function renderEntryButton(entry: BirthdayCalendarEntry): string {
  const sent = entry.cardStatus === "sent";
  const statusLabel = sent ? "Card sent" : "Card not sent";
  return `
    <button
      type="button"
      class="watson-bday__entry${sent ? " watson-bday__entry--sent" : ""}"
      data-bday-entry
      data-member-id="${escapeHtml(entry.memberId)}"
      data-occurrence-year="${entry.occurrenceYear}"
      aria-label="${escapeHtml(`${entry.displayName}, ${entry.birthdayLabel}. ${statusLabel}.`)}"
    >
      <span class="watson-bday__entry-name">${escapeHtml(entry.displayName)}</span>
      <span class="watson-bday__entry-status">${sent ? "Sent" : "Needs card"}</span>
    </button>
  `;
}

function renderMonthView(view: BirthdayMonthView): string {
  const weekdayHeader = getBirthdayWeekdayLabels()
    .map((label) => `<div class="watson-bday__weekday" role="columnheader">${label}</div>`)
    .join("");

  const weeks = view.weeks
    .map((week) => {
      const days = week
        .map((day) => {
          const classes = [
            "watson-bday__day",
            day.inCurrentMonth ? "" : "watson-bday__day--outside",
            day.isToday ? "watson-bday__day--today" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const entries =
            day.entries.length > 0
              ? `<div class="watson-bday__entries">${day.entries.map(renderEntryButton).join("")}</div>`
              : "";

          return `
            <div
              class="${classes}"
              role="gridcell"
              aria-label="${day.dateKey}${day.isToday ? ", today" : ""}"
              data-date-key="${day.dateKey}"
            >
              <div class="watson-bday__daynum">${day.day}</div>
              ${entries}
            </div>
          `;
        })
        .join("");
      return `<div class="watson-bday__week" role="row">${days}</div>`;
    })
    .join("");

  const empty =
    view.entryCount === 0
      ? `<p class="watson-bday__empty" data-bday-empty>
          No active-member birthdays in ${escapeHtml(view.label)}.
        </p>`
      : "";

  return `
    <div class="watson-bday__weekdays" role="row">${weekdayHeader}</div>
    <div class="watson-bday__weeks">${weeks}</div>
    ${empty}
  `;
}

function fillDialog(root: HTMLElement, entry: BirthdayCalendarEntry | null): void {
  const dialog = root.querySelector<HTMLDialogElement>("[data-bday-dialog]");
  if (!dialog) return;

  const setText = (selector: string, value: string, hideIfEmpty = false) => {
    const el = dialog.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.textContent = value;
    if (hideIfEmpty) {
      const row = el.closest<HTMLElement>("[data-bday-field]");
      if (row) row.hidden = !value;
    }
  };

  if (!entry) {
    setText("[data-bday-dialog-name]", "Member unavailable");
    setText("[data-bday-dialog-birthday]", "");
    setText("[data-bday-dialog-since]", "", true);
    setText("[data-bday-dialog-plan]", "", true);
    setText("[data-bday-dialog-address]", "");
    setText("[data-bday-dialog-country]", "", true);
    const warn = dialog.querySelector<HTMLElement>("[data-bday-no-address]");
    if (warn) warn.hidden = true;
    const profile = dialog.querySelector<HTMLAnchorElement>("[data-bday-profile-link]");
    const notes = dialog.querySelector<HTMLAnchorElement>("[data-bday-notes-link]");
    if (profile) {
      profile.href = "/watson/customers";
      profile.textContent = "Search customers";
    }
    if (notes) {
      notes.hidden = true;
    }
    const checkbox = dialog.querySelector<HTMLInputElement>("[data-bday-card-sent]");
    if (checkbox) {
      checkbox.checked = false;
      checkbox.disabled = true;
    }
    setText("[data-bday-mailed-date]", "");
    const mailed = dialog.querySelector<HTMLElement>("[data-bday-mailed-row]");
    if (mailed) mailed.hidden = true;
    const missing = dialog.querySelector<HTMLElement>("[data-bday-missing-member]");
    if (missing) missing.hidden = false;
    return;
  }

  const missing = dialog.querySelector<HTMLElement>("[data-bday-missing-member]");
  if (missing) missing.hidden = true;

  setText("[data-bday-dialog-name]", entry.displayName);
  setText("[data-bday-dialog-birthday]", entry.birthdayLabel);
  setText("[data-bday-dialog-since]", entry.memberSinceDisplay || "", true);
  setText("[data-bday-dialog-plan]", entry.planDisplay || "", true);
  setText(
    "[data-bday-dialog-address]",
    entry.mailingAddressDisplay || "No mailing address on file.",
  );
  setText("[data-bday-dialog-country]", entry.mailingCountry || "", true);

  const warn = dialog.querySelector<HTMLElement>("[data-bday-no-address]");
  if (warn) warn.hidden = entry.hasMailingAddress;

  const profile = dialog.querySelector<HTMLAnchorElement>("[data-bday-profile-link]");
  const notes = dialog.querySelector<HTMLAnchorElement>("[data-bday-notes-link]");
  if (profile) {
    profile.href = entry.profileHref;
    profile.textContent = "Open Member Record";
  }
  if (notes) {
    notes.hidden = false;
    notes.href = entry.notesHref;
  }

  const checkbox = dialog.querySelector<HTMLInputElement>("[data-bday-card-sent]");
  if (checkbox) {
    checkbox.disabled = false;
    checkbox.checked = entry.cardStatus === "sent";
    checkbox.dataset.memberId = entry.memberId;
    checkbox.dataset.occurrenceYear = String(entry.occurrenceYear);
  }

  const mailedDate = formatMailedDate(entry.sentAt);
  setText("[data-bday-mailed-date]", mailedDate ? `Mailed ${mailedDate}` : "");
  const mailed = dialog.querySelector<HTMLElement>("[data-bday-mailed-row]");
  if (mailed) mailed.hidden = entry.cardStatus !== "sent";

  const status = dialog.querySelector<HTMLElement>("[data-bday-dialog-status]");
  if (status) {
    status.textContent = "";
    status.hidden = true;
    status.removeAttribute("data-error");
  }
}

function setDialogStatus(root: HTMLElement, message: string, isError = false): void {
  const status = root.querySelector<HTMLElement>("[data-bday-dialog-status]");
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
  if (isError) status.setAttribute("data-error", "true");
  else status.removeAttribute("data-error");
}

function openEntryDialog(root: HTMLElement, state: PageState, entry: BirthdayCalendarEntry | null, trigger: HTMLButtonElement | null): void {
  const dialog = root.querySelector<HTMLDialogElement>("[data-bday-dialog]");
  if (!dialog) return;
  state.activeEntry = entry;
  state.lastTrigger = trigger;
  fillDialog(root, entry);
  if (!dialog.open) {
    dialog.showModal();
  }
  const closeBtn = dialog.querySelector<HTMLButtonElement>("[data-bday-dialog-close]");
  closeBtn?.focus();
}

function closeDialog(root: HTMLElement, state: PageState): void {
  const dialog = root.querySelector<HTMLDialogElement>("[data-bday-dialog]");
  dialog?.close();
  state.activeEntry = null;
  const trigger = state.lastTrigger;
  state.lastTrigger = null;
  trigger?.focus();
}

async function ensureYearStatuses(root: HTMLElement, state: PageState, year: number): Promise<boolean> {
  if (state.statusesByYear.has(year)) {
    return true;
  }

  state.loadingYear = year;
  render(root, state);

  const result = await fetchCardStatusesForYear(year);
  state.loadingYear = null;

  if (!result.ok) {
    state.loadError = result.error;
    render(root, state);
    return false;
  }

  state.loadError = null;
  rememberStatuses(state, year, result.cards);
  return true;
}

function render(root: HTMLElement, state: PageState): void {
  const labelEl = root.querySelector<HTMLElement>("[data-bday-month-label]");
  const gridEl = root.querySelector<HTMLElement>("[data-bday-grid]");
  const loadingEl = root.querySelector<HTMLElement>("[data-bday-loading]");
  const errorEl = root.querySelector<HTMLElement>("[data-bday-error]");

  const view = buildBirthdayMonthView({
    year: state.year,
    month: state.month,
    members: state.members,
    cardStatuses: statusesForYear(state, state.year),
  });

  if (labelEl) labelEl.textContent = view.label;
  root.setAttribute("data-view-year", String(state.year));
  root.setAttribute("data-view-month", String(state.month));

  if (loadingEl) {
    loadingEl.hidden = state.loadingYear == null;
    loadingEl.textContent =
      state.loadingYear != null
        ? `Loading card statuses for ${state.loadingYear}…`
        : "";
  }

  if (errorEl) {
    errorEl.hidden = !state.loadError;
    errorEl.textContent = state.loadError || "";
  }

  if (gridEl) {
    gridEl.innerHTML = renderMonthView(view);
    gridEl.setAttribute("aria-label", `Birthdays for ${view.label}`);
  }

  // Keep dialog in sync if open for current view year.
  if (state.activeEntry) {
    const refreshed = view.weeks
      .flat()
      .flatMap((day) => day.entries)
      .find(
        (entry) =>
          entry.memberId === state.activeEntry?.memberId &&
          entry.occurrenceYear === state.activeEntry?.occurrenceYear,
      );
    if (refreshed) {
      state.activeEntry = refreshed;
      fillDialog(root, refreshed);
    }
  }
}

async function goToMonth(root: HTMLElement, state: PageState, year: number, month: number): Promise<void> {
  const ok = await ensureYearStatuses(root, state, year);
  if (!ok) {
    // Still update the month label/grid using cached or empty statuses.
  }
  state.year = year;
  state.month = month;
  render(root, state);
}

export function initWatsonBirthdays(root: HTMLElement = document.querySelector("[data-birthdays-page]") as HTMLElement): void {
  if (!root) return;

  let members: BirthdayMember[] = [];
  try {
    const raw = root.getAttribute("data-members-json") || "[]";
    members = JSON.parse(raw) as BirthdayMember[];
  } catch {
    members = [];
  }

  const initialYear = Number(root.getAttribute("data-initial-year")) || new Date().getFullYear();
  const initialMonth = Number(root.getAttribute("data-initial-month")) || new Date().getMonth() + 1;

  let initialStatuses: BirthdayCardStatusRecord[] = [];
  try {
    const raw = root.getAttribute("data-initial-statuses-json") || "[]";
    initialStatuses = JSON.parse(raw) as BirthdayCardStatusRecord[];
  } catch {
    initialStatuses = [];
  }

  const membersError = root.getAttribute("data-members-error");

  const state: PageState = {
    year: initialYear,
    month: initialMonth,
    members,
    statusesByYear: new Map(),
    loadingYear: null,
    loadError: membersError || null,
    activeEntry: null,
    lastTrigger: null,
  };

  rememberStatuses(state, initialYear, initialStatuses);
  render(root, state);

  root.querySelector<HTMLButtonElement>("[data-bday-prev]")?.addEventListener("click", () => {
    const next = shiftMonth(state.year, state.month, -1);
    void goToMonth(root, state, next.year, next.month);
  });

  root.querySelector<HTMLButtonElement>("[data-bday-next]")?.addEventListener("click", () => {
    const next = shiftMonth(state.year, state.month, 1);
    void goToMonth(root, state, next.year, next.month);
  });

  root.querySelector<HTMLButtonElement>("[data-bday-today]")?.addEventListener("click", () => {
    const now = new Date();
    void goToMonth(root, state, now.getFullYear(), now.getMonth() + 1);
  });

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const entryBtn = target?.closest<HTMLButtonElement>("[data-bday-entry]");
    if (!entryBtn || !root.contains(entryBtn)) return;

    const memberId = entryBtn.getAttribute("data-member-id") || "";
    const occurrenceYear = Number(entryBtn.getAttribute("data-occurrence-year"));
    const member = findMemberInList(state.members, memberId);
    if (!member || !Number.isFinite(occurrenceYear)) {
      openEntryDialog(root, state, null, entryBtn);
      return;
    }

    const statusMap = state.statusesByYear.get(occurrenceYear);
    const statusRecord = statusMap?.get(cardStatusKey(memberId, occurrenceYear));
    const entry: BirthdayCalendarEntry = {
      ...member,
      occurrenceYear,
      cardStatus: statusRecord?.status === "sent" ? "sent" : "not_sent",
      sentAt: statusRecord?.sentAt ?? null,
    };
    openEntryDialog(root, state, entry, entryBtn);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-bday-dialog-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeDialog(root, state));
  });

  const dialog = root.querySelector<HTMLDialogElement>("[data-bday-dialog]");
  dialog?.addEventListener("close", () => {
    state.activeEntry = null;
    const trigger = state.lastTrigger;
    state.lastTrigger = null;
    trigger?.focus();
  });

  const checkbox = root.querySelector<HTMLInputElement>("[data-bday-card-sent]");
  checkbox?.addEventListener("change", async () => {
    if (!checkbox || checkbox.disabled) return;
    const memberId = checkbox.dataset.memberId || "";
    const birthdayYear = Number(checkbox.dataset.occurrenceYear);
    if (!memberId || !Number.isFinite(birthdayYear)) return;

    const nextStatus = checkbox.checked ? "sent" : "not_sent";
    checkbox.disabled = true;
    setDialogStatus(root, "Saving…");

    const result = await patchCardStatus({
      memberId,
      birthdayYear,
      status: nextStatus,
    });

    checkbox.disabled = false;

    if (!result.ok) {
      checkbox.checked = !checkbox.checked;
      setDialogStatus(root, result.error, true);
      return;
    }

    upsertStatus(state, result.card);
    setDialogStatus(
      root,
      result.card.status === "sent" ? "Card marked sent." : "Card marked not sent.",
    );
    render(root, state);
  });
}
