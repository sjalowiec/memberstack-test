import { IMPORT_START_DATE, IMPORT_TIME_ZONE } from "./constants";

export type ParsedDate =
  | { kind: "empty" }
  | { kind: "instant"; instant: Date }
  | { kind: "unparsed"; reason: "invalid" | "date-without-time" | "missing-timezone" | "ambiguous" };

const EMPTY_PREFIX = "0000-00-00";

export function isEmptyDate(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  return !trimmed || trimmed === "null" || trimmed.startsWith(EMPTY_PREFIX);
}

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

export function wallTime(instant: Date, timeZone: string): WallTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  let hour = read("hour");
  if (hour === 24) hour = 0;
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
    second: read("second"),
  };
}

export function losAngelesDate(instant: Date): string {
  const wall = wallTime(instant, IMPORT_TIME_ZONE);
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`;
}

export function isOnOrAfterImportStart(instant: Date): boolean {
  return losAngelesDate(instant) >= IMPORT_START_DATE;
}

/** Minutes east of UTC. GMT-07:00 is -420. */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  if (name === "GMT") return 0;
  const match = name.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Unable to read the UTC offset for ${timeZone}.`);
  }
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function sameWall(left: WallTime, right: WallTime): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

/**
 * Convert a wall-clock time in an IANA zone to an absolute instant.
 * A daylight-saving gap is invalid. A daylight-saving overlap is ambiguous.
 */
export function zonedWallTimeToUtc(
  wall: WallTime,
  timeZone: string,
): Date | "ambiguous" | "invalid" {
  const utcGuess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const candidates = new Set<number>();
  for (const probe of [utcGuess - 14 * 3_600_000, utcGuess, utcGuess + 14 * 3_600_000]) {
    let offset: number;
    try {
      offset = offsetMinutes(new Date(probe), timeZone);
    } catch {
      return "invalid";
    }
    const instant = utcGuess - offset * 60_000;
    if (sameWall(wallTime(new Date(instant), timeZone), wall)) {
      candidates.add(instant);
    }
  }
  if (candidates.size === 0) return "invalid";
  if (candidates.size > 1) return "ambiguous";
  return new Date([...candidates][0]);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function parseAcDateTime(
  value: string | null | undefined,
  accountTimeZone: string | null,
): ParsedDate {
  if (isEmptyDate(value)) return { kind: "empty" };
  const trimmed = value!.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { kind: "unparsed", reason: "date-without-time" };
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (!match || match[1] === "0000") return { kind: "unparsed", reason: "invalid" };

  const wall: WallTime = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };
  const zoneSuffix = match[7];
  if (!zoneSuffix) {
    if (!accountTimeZone || !isValidTimeZone(accountTimeZone)) {
      return { kind: "unparsed", reason: "missing-timezone" };
    }
    const instant = zonedWallTimeToUtc(wall, accountTimeZone);
    if (instant === "invalid") return { kind: "unparsed", reason: "invalid" };
    if (instant === "ambiguous") return { kind: "unparsed", reason: "ambiguous" };
    return { kind: "instant", instant };
  }

  const normalized = `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}${zoneSuffix === "Z" ? "Z" : normalizeOffset(zoneSuffix)}`;
  const instant = new Date(normalized);
  if (Number.isNaN(instant.getTime())) return { kind: "unparsed", reason: "invalid" };
  return { kind: "instant", instant };
}

function normalizeOffset(offset: string): string {
  const match = offset.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return offset;
  return `${match[1]}${match[2]}:${match[3]}`;
}

export function formatGoogleDateTime(
  instant: Date,
  timeZone: string,
): { dateTime: string; timeZone: string } {
  const wall = wallTime(instant, timeZone);
  const offset = offsetMinutes(instant, timeZone);
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  const dateTime = `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
  return { dateTime, timeZone };
}
