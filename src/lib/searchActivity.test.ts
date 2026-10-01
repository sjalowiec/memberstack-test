import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SEARCH_COMMIT_IDLE_MS,
  SEARCH_SETTLE_NOTE,
  SEARCH_TRACKING_START_NOTE,
  classifySearchTerm,
  containsPersonalInformation,
  normalizeSearchTerm,
  resolveSearchActivityEnvironment,
  resolveStoredIdentity,
  searchActivityAreaLabel,
  summarizeSearchActivity,
  type SearchActivityEvent,
} from "./searchActivity";
import { createSearchCommitScheduler } from "./searchActivityClient";
import {
  appendSearchActivityEvent,
  buildSearchActivityEvent,
  listSearchActivityEvents,
  resetSearchActivityBackendForTests,
  searchActivityEventKey,
  useFileSearchActivityBackendForTests,
  useSearchActivityConnectorForTests,
} from "./searchActivityStore";

describe("search term normalization", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeSearchTerm("  Tuck   Stitch ")).toBe("tuck stitch");
  });

  it("keeps machine terms and drops emails, phones, and member ids", () => {
    expect(containsPersonalInformation("lk150")).toBe(false);
    expect(containsPersonalInformation("tuck stitch")).toBe(false);
    const email = classifySearchTerm("sue@knititnow.com");
    expect(email.empty).toBe(false);
    if (!email.empty) expect(email.omit).toBe(true);
    expect(containsPersonalInformation("555-123-4567")).toBe(true);
    expect(containsPersonalInformation("mem_cms4tl24v00eb0sqx143i4a9r")).toBe(true);
    expect(containsPersonalInformation("mem_sb_cms4tl24v00eb0sqx143i4a9r")).toBe(true);
  });
});

describe("search activity records", () => {
  it("stores a normalized term, server time, area, count, guest, and dev", () => {
    const built = buildSearchActivityEvent(
      { area: "video", term: "  Ribbing ", resultCount: 3, identity: "guest", environment: "production" },
      { now: "2026-09-29T15:00:00.000Z", env: {} },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.event.term).toBe("ribbing");
    expect(built.event.createdAt).toBe("2026-09-29T15:00:00.000Z");
    expect(built.event.area).toBe("video");
    expect(built.event.resultCount).toBe(3);
    expect(built.event.identity).toBe("guest");
    expect(built.event.memberId).toBeUndefined();
    expect(built.event.environment).toBe("dev");
    expect(JSON.stringify(built.event)).not.toContain("production");
  });

  it("keeps a verified member id and labels kin-dev as dev", () => {
    const built = buildSearchActivityEvent(
      { area: "global", term: "tuck", resultCount: 0, identity: "guest", memberId: "mem_spoofed" },
      {
        verifiedMemberId: "mem_abc123",
        env: { SITE_NAME: "kin-dev", CONTEXT: "production" },
      },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.event.identity).toBe("member");
    expect(built.event.memberId).toBe("mem_abc123");
    const sandbox = buildSearchActivityEvent(
      { area: "video", term: "ribbing", resultCount: 3, identity: "guest" },
      { now: "2026-09-29T12:00:00.000Z", env: {}, verifiedMemberId: "mem_sb_abc123" },
    );
    expect(sandbox.ok).toBe(true);
    if (sandbox.ok) expect(sandbox.event.memberId).toBe("mem_sb_abc123");
    expect(built.event.environment).toBe("dev");
    expect(JSON.stringify(built.event)).not.toContain("spoofed");
  });

  it("stores a Help Hub search, including a zero-result count", () => {
    const built = buildSearchActivityEvent(
      { area: "help-hub", term: "  Fair Isle ", resultCount: 0, identity: "guest" },
      { now: "2026-10-01T12:00:00.000Z", env: { SITE_NAME: "kin-dev" } },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.event.area).toBe("help-hub");
    expect(built.event.term).toBe("fair isle");
    expect(built.event.resultCount).toBe(0);
    expect(built.event.identity).toBe("guest");
    expect(built.event.environment).toBe("dev");
    expect(searchActivityAreaLabel("help-hub")).toBe("Help Hub");
    const rejected = buildSearchActivityEvent(
      { area: "patterns", term: "tuck", resultCount: 1, identity: "guest" },
      { env: {} },
    );
    expect(rejected.ok).toBe(false);
  });

  it("does not store an email address", () => {
    const built = buildSearchActivityEvent(
      { area: "global", term: "sue@knititnow.com", resultCount: 0, identity: "unknown" },
      { env: {} },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.event.term).toBeUndefined();
    expect(built.event.termOmitted).toBe("personal");
    expect(JSON.stringify(built.event)).not.toContain("sue@");
  });

  it("labels the live site as production", () => {
    expect(resolveSearchActivityEnvironment({ URL: "https://knititnow.com" })).toBe("production");
    expect(
      resolveSearchActivityEnvironment({
        SITE_NAME: "knititnow",
        CONTEXT: "production",
        ALLOW_DEV_PATTERN_USER: "true",
      }),
    ).toBe("production");
    expect(resolveStoredIdentity({ clientIdentity: "guest" }).identity).toBe("guest");
    expect(resolveStoredIdentity({ clientIdentity: "member" }).identity).toBe("unknown");
  });
});

describe("search activity summary", () => {
  const events: SearchActivityEvent[] = [
    {
      id: "1",
      createdAt: "2026-09-29T12:00:00.000Z",
      area: "video",
      term: "tuck",
      resultCount: 4,
      identity: "guest",
      environment: "dev",
    },
    {
      id: "2",
      createdAt: "2026-09-29T13:00:00.000Z",
      area: "video",
      term: "tuck",
      resultCount: 4,
      identity: "member",
      memberId: "mem_abc",
      environment: "dev",
    },
    {
      id: "3",
      createdAt: "2026-09-28T13:00:00.000Z",
      area: "global",
      term: "zzzz-none",
      resultCount: 0,
      identity: "unknown",
      environment: "dev",
    },
    {
      id: "4",
      createdAt: "2026-09-29T14:00:00.000Z",
      area: "global",
      termOmitted: "personal",
      resultCount: 0,
      identity: "guest",
      environment: "dev",
    },
  ];

  it("counts common terms and zero-result terms without personal text", () => {
    const summary = summarizeSearchActivity(events, { area: "all" });
    expect(summary.commonTerms[0]).toMatchObject({ term: "tuck", area: "video", count: 2 });
    expect(summary.zeroResultTerms).toEqual([
      { term: "zzzz-none", area: "global", count: 1 },
    ]);
    expect(summary.omittedPersonal).toBe(1);
    expect(JSON.stringify(summary)).not.toContain("@");
    expect(summary.earliestDay).toBe("2026-09-28");
  });

  it("filters by area and date", () => {
    const videoOnly = summarizeSearchActivity(events, { area: "video" });
    expect(videoOnly.commonTerms).toHaveLength(1);
    expect(videoOnly.zeroResultTerms).toHaveLength(0);
    const today = summarizeSearchActivity(events, { from: "2026-09-29", to: "2026-09-29" });
    expect(today.commonTerms.map((row) => row.term)).toEqual(["tuck"]);
    expect(today.zeroResultTerms).toHaveLength(0);
  });

  it("keeps Help Hub terms in the same report and date filter", () => {
    const helpHub: SearchActivityEvent = {
      id: "hh-1",
      createdAt: "2026-09-29T18:00:00.000Z",
      area: "help-hub",
      term: "sponge bar",
      resultCount: 0,
      identity: "member",
      memberId: "mem_abc123",
      environment: "dev",
    };
    const summary = summarizeSearchActivity([...events, helpHub], { area: "help-hub" });
    expect(summary.searched).toBe(1);
    expect(summary.commonTerms).toEqual([{ term: "sponge bar", area: "help-hub", count: 1 }]);
    expect(summary.zeroResultTerms).toEqual([{ term: "sponge bar", area: "help-hub", count: 1 }]);
    const allAreas = summarizeSearchActivity([...events, helpHub], { area: "all" });
    expect(allAreas.commonTerms.some((row) => row.area === "help-hub" && row.term === "sponge bar")).toBe(
      true,
    );
  });
});

describe("committed search scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("records one event after typing pauses, not one per keystroke", async () => {
    vi.useFakeTimers();
    const posts: Record<string, unknown>[] = [];
    const scheduler = createSearchCommitScheduler({
      idleMs: 700,
      post: async (body) => {
        posts.push(body);
        return true;
      },
    });
    scheduler.schedule({ area: "global", term: "t", resultCount: 0 });
    scheduler.schedule({ area: "global", term: "tu", resultCount: 0 });
    scheduler.schedule({ area: "global", term: "tuck", resultCount: 6 });
    await vi.advanceTimersByTimeAsync(699);
    expect(posts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(posts).toEqual([{ area: "global", term: "tuck", resultCount: 6, identity: "unknown" }]);
    scheduler.schedule({ area: "global", term: "tuck", resultCount: 6 });
    await vi.advanceTimersByTimeAsync(700);
    expect(posts).toHaveLength(1);
  });

  it("records a zero-result search once, and Enter does not add a second event", async () => {
    vi.useFakeTimers();
    const posts: Record<string, unknown>[] = [];
    const scheduler = createSearchCommitScheduler({
      idleMs: 700,
      post: async (body) => {
        posts.push(body);
        return true;
      },
    });
    scheduler.schedule({ area: "video", term: "zzzz-none", resultCount: 0 });
    scheduler.flush();
    await vi.advanceTimersByTimeAsync(700);
    expect(posts).toEqual([
      { area: "video", term: "zzzz-none", resultCount: 0, identity: "unknown" },
    ]);
  });

  it("does not record a term already kept from a preserved query", async () => {
    vi.useFakeTimers();
    const posts: Record<string, unknown>[] = [];
    const scheduler = createSearchCommitScheduler({
      post: async (body) => {
        posts.push(body);
        return true;
      },
    });
    scheduler.remember({ area: "video", term: "tuck", resultCount: 2 });
    scheduler.schedule({ area: "video", term: "tuck", resultCount: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(posts).toHaveLength(0);
  });

  it("sends an email search without the address", async () => {
    vi.useFakeTimers();
    const posts: Record<string, unknown>[] = [];
    const scheduler = createSearchCommitScheduler({
      idleMs: 700,
      post: async (body) => {
        posts.push(body);
        return true;
      },
    });
    scheduler.schedule({ area: "video", term: "sue@knititnow.com", resultCount: 0 });
    await vi.advanceTimersByTimeAsync(700);
    expect(posts).toEqual([
      { area: "video", resultCount: 0, identity: "unknown", termOmitted: "personal" },
    ]);
    expect(JSON.stringify(posts)).not.toContain("sue@");
  });
});

describe("search activity file store", () => {
  afterEach(() => {
    resetSearchActivityBackendForTests();
  });

  it("writes one event and reads it back", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "kin-search-"));
    useFileSearchActivityBackendForTests(dir);
    const built = buildSearchActivityEvent(
      { area: "video", term: "ribbing", resultCount: 0, identity: "guest" },
      { now: "2026-09-29T16:00:00.000Z", env: {} },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    await appendSearchActivityEvent(built.event);
    const listed = await listSearchActivityEvents();
    expect(listed.events).toHaveLength(1);
    expect(listed.unreadable).toBe(0);
    expect(listed.events[0].term).toBe("ribbing");
    expect(listed.events[0].resultCount).toBe(0);
    const raw = await readFile(path.join(dir, searchActivityEventKey(built.event)), "utf8");
    expect(raw).toContain("ribbing");
    expect(raw).not.toContain("console");
    await rm(dir, { recursive: true, force: true });
  });

  it("retries a failed store connection and still reads saved events", async () => {
    let connects = 0;
    useSearchActivityConnectorForTests(async () => {
      connects += 1;
      if (connects === 1) throw new Error("BlobsInternalError");
      return {
        async set() {},
        async list() {
          return { blobs: [{ key: "events/2026-09-29/saved.json" }] };
        },
        async get() {
          return JSON.stringify({
            id: "saved",
            createdAt: "2026-09-29T12:00:00.000Z",
            area: "global",
            term: "band pickup",
            resultCount: 3,
            identity: "guest",
            environment: "production",
          });
        },
      };
    });
    const listed = await listSearchActivityEvents();
    expect(connects).toBe(2);
    expect(listed.events.map((event) => event.term)).toEqual(["band pickup"]);
    expect(listed.unreadable).toBe(0);
  });

  it("keeps readable events when one record cannot be read", async () => {
    useSearchActivityConnectorForTests(async () => ({
      async set() {},
      async list() {
        return {
          blobs: [{ key: "events/2026-09-29/good.json" }, { key: "events/2026-09-29/bad.json" }],
        };
      },
      async get(key) {
        if (key.endsWith("bad.json")) throw new Error("BlobsInternalError");
        return JSON.stringify({
          id: "good",
          createdAt: "2026-09-29T12:00:00.000Z",
          area: "video",
          term: "ribbing",
          resultCount: 43,
          identity: "guest",
          environment: "production",
        });
      },
    }));
    const listed = await listSearchActivityEvents();
    expect(listed.events).toHaveLength(1);
    expect(listed.events[0].term).toBe("ribbing");
    expect(listed.unreadable).toBe(1);
  });

  it("does not report zero searches when every listed record fails to read", async () => {
    useSearchActivityConnectorForTests(async () => ({
      async set() {},
      async list() {
        return { blobs: [{ key: "events/2026-09-29/bad.json" }] };
      },
      async get() {
        throw new Error("BlobsInternalError");
      },
    }));
    await expect(listSearchActivityEvents()).rejects.toThrow(/could not be read/i);
  });
});

describe("search tracking copy", () => {
  it("does not imply older searches were recorded", () => {
    expect(SEARCH_TRACKING_START_NOTE).toMatch(/deployed/i);
    expect(SEARCH_TRACKING_START_NOTE).toMatch(/before that were not recorded/i);
    expect(SEARCH_COMMIT_IDLE_MS).toBe(2000);
    expect(SEARCH_SETTLE_NOTE).toMatch(/2 seconds/);
    expect(SEARCH_SETTLE_NOTE).toMatch(/Enter/);
    expect(SEARCH_SETTLE_NOTE).toMatch(/not counted/i);
  });

  it("updates the unsent result count when the same words are shown again", async () => {
    vi.useFakeTimers();
    const posts: Record<string, unknown>[] = [];
    const scheduler = createSearchCommitScheduler({
      post: async (body) => {
        posts.push(body);
        return true;
      },
    });
    scheduler.schedule({ area: "video", term: "cast", resultCount: 56 });
    await vi.advanceTimersByTimeAsync(500);
    scheduler.schedule({ area: "video", term: "cast", resultCount: 6 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(posts).toEqual([{ area: "video", term: "cast", resultCount: 6, identity: "unknown" }]);
    vi.useRealTimers();
  });

  it("keeps replacing an unsent search until the words settle", async () => {
    vi.useFakeTimers();
    const posts: Record<string, unknown>[] = [];
    const scheduler = createSearchCommitScheduler({
      post: async (body) => {
        posts.push(body);
        return true;
      },
    });
    scheduler.schedule({ area: "global", term: "tu", resultCount: 1 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(posts).toHaveLength(0);
    scheduler.schedule({ area: "global", term: "tuck", resultCount: 4 });
    await vi.advanceTimersByTimeAsync(1999);
    expect(posts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(posts).toEqual([{ area: "global", term: "tuck", resultCount: 4, identity: "unknown" }]);
    vi.useRealTimers();
  });
});
