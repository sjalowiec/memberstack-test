import { describe, expect, it } from "vitest";
import {
  expireHostOnlyCookie,
  isKnitItNowHost,
  prepareMemberstackRootCookieSession,
  shouldClearMemberstackStorageKey,
} from "./memberstackOriginSession";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    get length() {
      return data.size;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    snapshot() {
      return Object.fromEntries(data);
    },
  };
  return storage;
}

describe("Memberstack origin-scoped session cleanup", () => {
  it("only runs on Knit It Now production hosts", () => {
    expect(isKnitItNowHost("www.knititnow.com")).toBe(true);
    expect(isKnitItNowHost("courses.knititnow.com")).toBe(true);
    expect(isKnitItNowHost("knititnow.com")).toBe(true);
    expect(isKnitItNowHost("localhost")).toBe(false);
    expect(isKnitItNowHost("kin-staging.netlify.app")).toBe(false);
  });

  it("expires host-only Memberstack cookies without touching the root Domain", () => {
    expect(expireHostOnlyCookie("_ms-mid")).toBe("_ms-mid=; Max-Age=0; Path=/");
    expect(expireHostOnlyCookie("_ms-mid")).not.toContain("Domain=");
  });

  it("clears leftover Memberstack storage keys and host-only cookies", () => {
    const cookies: string[] = [];
    const localStorage = memoryStorage({
      "_ms-mid": "host-session",
      memberstack: '{"id":"old"}',
      theme: "keep",
    });

    const ran = prepareMemberstackRootCookieSession({
      hostname: "www.knititnow.com",
      setCookie: (value) => cookies.push(value),
      localStorage,
    });

    expect(ran).toBe(true);
    expect(cookies).toEqual([
      "_ms-mid=; Max-Age=0; Path=/",
      "_ms_mid=; Max-Age=0; Path=/",
      "_ms_cookie=; Max-Age=0; Path=/",
    ]);
    expect(localStorage.snapshot()).toEqual({ theme: "keep" });
  });

  it("does not clear storage on unrelated hosts", () => {
    const localStorage = memoryStorage({ memberstack: '{"id":"dev"}' });
    const ran = prepareMemberstackRootCookieSession({
      hostname: "localhost",
      setCookie: () => {
        throw new Error("should not expire cookies on localhost");
      },
      localStorage,
    });

    expect(ran).toBe(false);
    expect(localStorage.snapshot()).toEqual({ memberstack: '{"id":"dev"}' });
    expect(shouldClearMemberstackStorageKey("theme")).toBe(false);
  });
});
