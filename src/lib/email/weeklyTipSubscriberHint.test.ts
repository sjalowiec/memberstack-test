import { describe, expect, it, vi } from "vitest";
import {
  WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY,
  WEEKLY_TIP_SUBSCRIBER_TTL_MS,
  applyWeeklyTipSubscriberQueryHint,
  isWeeklyTipSubscriberRecognized,
  isWeeklyTipSubscriberRecognizedAt,
  markWeeklyTipSubscriberRecognized,
  parseWeeklyTipSubscriberRecognizedAt,
  readWeeklyTipSubscriberRecognizedAt,
  stripWeeklyTipSubscriberParam,
  urlHasWeeklyTipSubscriberHint,
} from "./weeklyTipSubscriberHint";

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe("weeklyTipSubscriberHint", () => {
  it("parses numeric timestamps and rejects invalid values", () => {
    expect(parseWeeklyTipSubscriberRecognizedAt("1700000000000")).toBe(1700000000000);
    expect(parseWeeklyTipSubscriberRecognizedAt("not-a-date")).toBeNull();
    expect(parseWeeklyTipSubscriberRecognizedAt("")).toBeNull();
  });

  it("treats a current timestamp as recognized and an expired one as not", () => {
    const now = 1_700_000_000_000;
    expect(isWeeklyTipSubscriberRecognizedAt(now - 1000, now)).toBe(true);
    expect(
      isWeeklyTipSubscriberRecognizedAt(now - WEEKLY_TIP_SUBSCRIBER_TTL_MS - 1, now),
    ).toBe(false);
    expect(isWeeklyTipSubscriberRecognizedAt(null, now)).toBe(false);
    expect(isWeeklyTipSubscriberRecognizedAt(Number.NaN, now)).toBe(false);
  });

  it("stores only a recognition timestamp — never name or email", () => {
    const storage = memoryStorage();
    const now = 1_700_000_000_000;
    expect(markWeeklyTipSubscriberRecognized(now, storage)).toBe(true);
    expect(storage.getItem(WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY)).toBe(String(now));
    expect(storage.getItem(WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY)).not.toMatch(/@/);
    expect(isWeeklyTipSubscriberRecognized(now, storage)).toBe(true);
  });

  it("fails safely when localStorage throws", () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {},
      clear() {},
      key() {
        return null;
      },
      length: 0,
    } as Storage;

    expect(readWeeklyTipSubscriberRecognizedAt(storage)).toBeNull();
    expect(markWeeklyTipSubscriberRecognized(Date.now(), storage)).toBe(false);
    expect(isWeeklyTipSubscriberRecognized(Date.now(), storage)).toBe(false);
  });

  it("detects subscriber=1 and strips only that param while preserving others and hash", () => {
    expect(urlHasWeeklyTipSubscriberHint("?preview=abc&subscriber=1")).toBe(true);
    expect(urlHasWeeklyTipSubscriberHint("?subscriber=0")).toBe(false);
    expect(
      stripWeeklyTipSubscriberParam(
        "/tip-of-the-week",
        "?preview=abc&subscriber=1&utm=x",
        "#lesson",
      ),
    ).toBe("/tip-of-the-week?preview=abc&utm=x#lesson");
  });

  it("applies subscriber=1 by storing a timestamp and replacing the visible URL", () => {
    const storage = memoryStorage();
    const replaceState = vi.fn();
    const now = 1_700_000_000_000;

    const applied = applyWeeklyTipSubscriberQueryHint({
      pathname: "/tip-of-the-week",
      search: "?subscriber=1&preview=xyz",
      hash: "#top",
      now,
      storage,
      replaceState,
    });

    expect(applied).toBe(true);
    expect(storage.getItem(WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY)).toBe(String(now));
    expect(replaceState).toHaveBeenCalledWith("/tip-of-the-week?preview=xyz#top");
  });
});
