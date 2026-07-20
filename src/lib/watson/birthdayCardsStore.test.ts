import { describe, expect, it } from "vitest";

import {
  birthdayCardBlobKey,
  getBirthdayCardStatus,
  listBirthdayCardStatusesForYear,
  setBirthdayCardStatus,
} from "./birthdayCardsStore";

function createMemoryStore() {
  const data = new Map<string, unknown>();
  return {
    data,
    async get(key: string, opts?: { type?: string }) {
      if (!data.has(key)) return null;
      const value = data.get(key);
      if (opts?.type === "json") return value;
      return value;
    },
    async setJSON(key: string, value: unknown) {
      data.set(key, value);
    },
    async list({ prefix }: { prefix?: string } = {}) {
      const blobs = [...data.keys()]
        .filter((key) => !prefix || key.startsWith(prefix))
        .map((key) => ({ key }));
      return { blobs };
    },
    async delete(key: string) {
      data.delete(key);
    },
  };
}

describe("birthdayCardsStore", () => {
  it("stores card status by member ID plus birthday year", async () => {
    const store = createMemoryStore();
    const saved = await setBirthdayCardStatus(store, {
      memberId: "M-1",
      birthdayYear: 2026,
      status: "sent",
      now: "2026-07-20T15:00:00.000Z",
    });

    expect(birthdayCardBlobKey("M-1", 2026)).toBe("cards/2026/M-1.json");
    expect(saved.status).toBe("sent");
    expect(saved.sentAt).toBe("2026-07-20T15:00:00.000Z");

    const loaded = await getBirthdayCardStatus(store, "M-1", 2026);
    expect(loaded).toEqual(saved);
  });

  it("keeps 2026 sent separate from 2027", async () => {
    const store = createMemoryStore();
    await setBirthdayCardStatus(store, {
      memberId: "M-1",
      birthdayYear: 2026,
      status: "sent",
      now: "2026-12-10T12:00:00.000Z",
    });

    const year2026 = await listBirthdayCardStatusesForYear(store, 2026);
    const year2027 = await listBirthdayCardStatusesForYear(store, 2027);
    const status2027 = await getBirthdayCardStatus(store, "M-1", 2027);

    expect(year2026).toHaveLength(1);
    expect(year2026[0]?.status).toBe("sent");
    expect(year2027).toHaveLength(0);
    expect(status2027).toBeNull();
  });

  it("supports undoing sent status", async () => {
    const store = createMemoryStore();
    await setBirthdayCardStatus(store, {
      memberId: "M-2",
      birthdayYear: 2026,
      status: "sent",
      now: "2026-07-20T15:00:00.000Z",
    });

    const undone = await setBirthdayCardStatus(store, {
      memberId: "M-2",
      birthdayYear: 2026,
      status: "not_sent",
      now: "2026-07-20T16:00:00.000Z",
    });

    expect(undone.status).toBe("not_sent");
    expect(undone.sentAt).toBeNull();
    expect(await getBirthdayCardStatus(store, "M-2", 2026)).toBeNull();
    expect(await listBirthdayCardStatusesForYear(store, 2026)).toHaveLength(0);
  });
});
