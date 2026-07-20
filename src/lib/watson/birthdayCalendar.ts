import type { BirthdayMember } from "./birthdayMemberSource";
import type { BirthdayCardStatus, BirthdayCardStatusRecord } from "./birthdayCardsStore";

export type BirthdayCalendarEntry = BirthdayMember & {
  occurrenceYear: number;
  cardStatus: BirthdayCardStatus;
  sentAt: string | null;
};

export type BirthdayCalendarDay = {
  year: number;
  month: number;
  day: number;
  dateKey: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  entries: BirthdayCalendarEntry[];
};

export type BirthdayMonthView = {
  year: number;
  month: number;
  label: string;
  weeks: BirthdayCalendarDay[][];
  entryCount: number;
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function getBirthdayWeekdayLabels(): readonly string[] {
  return WEEKDAY_LABELS;
}

export function cardStatusKey(memberId: string, occurrenceYear: number): string {
  return `${memberId}::${occurrenceYear}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Calendar day of month where a birthday should appear for a given year.
 * Feb 29 birthdays fall on Feb 28 in non-leap years.
 */
export function birthdayDayInYear(birthMonth: number, birthDay: number, year: number): number {
  if (birthMonth === 2 && birthDay === 29 && !isLeapYear(year)) {
    return 28;
  }
  const maxDay = daysInMonth(year, birthMonth);
  return Math.min(birthDay, maxDay);
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

export function compareBirthdayMembersByName(a: BirthdayMember, b: BirthdayMember): number {
  const byLast = (a.lastName || "").localeCompare(b.lastName || "", undefined, {
    sensitivity: "base",
  });
  if (byLast !== 0) return byLast;
  const byFirst = (a.firstName || "").localeCompare(b.firstName || "", undefined, {
    sensitivity: "base",
  });
  if (byFirst !== 0) return byFirst;
  const byDisplay = a.displayName.localeCompare(b.displayName, undefined, {
    sensitivity: "base",
  });
  if (byDisplay !== 0) return byDisplay;
  return a.memberId.localeCompare(b.memberId);
}

export function buildCardStatusLookup(
  records: BirthdayCardStatusRecord[],
): Map<string, BirthdayCardStatusRecord> {
  const map = new Map<string, BirthdayCardStatusRecord>();
  for (const record of records) {
    map.set(cardStatusKey(record.memberId, record.birthdayYear), record);
  }
  return map;
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayParts(now: Date): { year: number; month: number; day: number } {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

/**
 * Build a Sunday-start month grid.
 * Card status is keyed by member ID + the occurrence year of the displayed day
 * (the calendar year for that cell), not "today's" year.
 */
export function buildBirthdayMonthView(input: {
  year: number;
  month: number;
  members: BirthdayMember[];
  cardStatuses?: Iterable<BirthdayCardStatusRecord>;
  now?: Date;
}): BirthdayMonthView {
  const { year, month, members } = input;
  const now = input.now ?? new Date();
  const today = todayParts(now);
  const statusLookup = buildCardStatusLookup([...(input.cardStatuses ?? [])]);

  const membersForMonth = members
    .filter((member) => member.birthMonth === month)
    .slice()
    .sort(compareBirthdayMembersByName);

  const byDay = new Map<number, BirthdayCalendarEntry[]>();
  for (const member of membersForMonth) {
    const day = birthdayDayInYear(member.birthMonth, member.birthDay, year);
    const occurrenceYear = year;
    const statusRecord = statusLookup.get(cardStatusKey(member.memberId, occurrenceYear));
    const entry: BirthdayCalendarEntry = {
      ...member,
      occurrenceYear,
      cardStatus: statusRecord?.status === "sent" ? "sent" : "not_sent",
      sentAt: statusRecord?.sentAt ?? null,
    };
    const list = byDay.get(day) ?? [];
    list.push(entry);
    byDay.set(day, list);
  }

  for (const list of byDay.values()) {
    list.sort(compareBirthdayMembersByName);
  }

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysThisMonth = daysInMonth(year, month);
  const prev = shiftMonth(year, month, -1);
  const prevMonthDays = daysInMonth(prev.year, prev.month);

  const cells: BirthdayCalendarDay[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const day = prevMonthDays - firstWeekday + 1 + i;
    cells.push({
      year: prev.year,
      month: prev.month,
      day,
      dateKey: toDateKey(prev.year, prev.month, day),
      inCurrentMonth: false,
      isToday:
        prev.year === today.year && prev.month === today.month && day === today.day,
      entries: [],
    });
  }

  let entryCount = 0;
  for (let day = 1; day <= daysThisMonth; day += 1) {
    const entries = byDay.get(day) ?? [];
    entryCount += entries.length;
    cells.push({
      year,
      month,
      day,
      dateKey: toDateKey(year, month, day),
      inCurrentMonth: true,
      isToday: year === today.year && month === today.month && day === today.day,
      entries,
    });
  }

  const next = shiftMonth(year, month, 1);
  while (cells.length % 7 !== 0) {
    const day = cells.length - (firstWeekday + daysThisMonth) + 1;
    cells.push({
      year: next.year,
      month: next.month,
      day,
      dateKey: toDateKey(next.year, next.month, day),
      inCurrentMonth: false,
      isToday:
        next.year === today.year && next.month === today.month && day === today.day,
      entries: [],
    });
  }

  const weeks: BirthdayCalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return {
    year,
    month,
    label: MONTH_LABEL.format(new Date(year, month - 1, 1)),
    weeks,
    entryCount,
  };
}

export function findMemberInList(
  members: BirthdayMember[],
  memberId: string,
): BirthdayMember | null {
  return members.find((member) => member.memberId === memberId) ?? null;
}
