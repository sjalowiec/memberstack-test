import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyKnitAbleCacheHeaders, decideKnitAbleVisibility, loadKnitAblePageAccess } from "./pageAccess";
import {
  KNIT_ABLE_INITIAL_PUBLISH_DATES,
  KNIT_ABLE_TIME_ZONE,
  buildKnitAbleAdminRows,
  formatKnitAblePublishDate,
  knitAbleLosAngelesCalendarDate,
  knitAblePreviewPath,
  knitAblePublicationStatus,
  knitAblePublishDateFromDb,
  knitAbleSaveMessage,
  knitAbleScheduleSeedSql,
  knitAbleSlugFromPath,
  parseKnitAblePublishDate,
  selectPublishedKnitAbleCards,
} from "./schedule";
import { updateKnitAblePublishDate } from "./scheduleStore";
import { parseKnitAbleScheduleSaveResponse } from "../../scripts/watsonKnitAbleSchedule";

/** 2026-09-29 12:00 p.m. Pacific (PDT, UTC-7). */
const SEP_29_NOON_PACIFIC = new Date("2026-09-29T19:00:00.000Z");
/** 2026-09-30 11:59:59 p.m. Pacific. */
const BEFORE_OCT_1_MIDNIGHT = new Date("2026-10-01T06:59:59.000Z");
/** 2026-10-01 12:00:00 a.m. Pacific. */
const AT_OCT_1_MIDNIGHT = new Date("2026-10-01T07:00:00.000Z");
/** 2026-10-01 12:00:01 a.m. Pacific. */
const AFTER_OCT_1_MIDNIGHT = new Date("2026-10-01T07:00:01.000Z");
/** 2026-01-14 11:59:59 p.m. Pacific (PST, UTC-8). */
const BEFORE_JAN_15_MIDNIGHT = new Date("2026-01-15T07:59:59.000Z");
/** 2026-01-15 12:00:00 a.m. Pacific. */
const AT_JAN_15_MIDNIGHT = new Date("2026-01-15T08:00:00.000Z");

const cookies = { get: () => undefined };

describe("Knit-able Pacific publish dates", () => {
  it("uses the America/Los_Angeles calendar day, including standard time", () => {
    expect(KNIT_ABLE_TIME_ZONE).toBe("America/Los_Angeles");
    expect(knitAbleLosAngelesCalendarDate(BEFORE_OCT_1_MIDNIGHT)).toBe("2026-09-30");
    expect(knitAbleLosAngelesCalendarDate(AT_OCT_1_MIDNIGHT)).toBe("2026-10-01");
    expect(knitAbleLosAngelesCalendarDate(AFTER_OCT_1_MIDNIGHT)).toBe("2026-10-01");
    expect(knitAbleLosAngelesCalendarDate(BEFORE_JAN_15_MIDNIGHT)).toBe("2026-01-14");
    expect(knitAbleLosAngelesCalendarDate(AT_JAN_15_MIDNIGHT)).toBe("2026-01-15");
  });

  it("stays unpublished with no date, scheduled before midnight, and published at midnight", () => {
    expect(knitAblePublicationStatus(null, AT_OCT_1_MIDNIGHT)).toBe("unpublished");
    expect(knitAblePublicationStatus("", BEFORE_OCT_1_MIDNIGHT)).toBe("unpublished");
    expect(knitAblePublicationStatus("2026-10-01", BEFORE_OCT_1_MIDNIGHT)).toBe("scheduled");
    expect(knitAblePublicationStatus("2026-10-01", AT_OCT_1_MIDNIGHT)).toBe("published");
    expect(knitAblePublicationStatus("2026-10-01", AFTER_OCT_1_MIDNIGHT)).toBe("published");
    expect(knitAblePublicationStatus("2026-01-15", BEFORE_JAN_15_MIDNIGHT)).toBe("scheduled");
    expect(knitAblePublicationStatus("2026-01-15", AT_JAN_15_MIDNIGHT)).toBe("published");
  });

  it("keeps the sock Knit-ables public and schedules the Branch Out Tank for October 1, 2026", () => {
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["teenage-kicks-socks"]).toBe("2026-09-14");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["worsted-color-block-socks"]).toBe("2026-09-21");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["cap-sleeve-tank"]).toBe("2026-10-01");
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["coco-loco-tank"]).toBeUndefined();
    expect(KNIT_ABLE_INITIAL_PUBLISH_DATES["vest-in-show"]).toBeUndefined();

    const rows = buildKnitAbleAdminRows(KNIT_ABLE_INITIAL_PUBLISH_DATES, SEP_29_NOON_PACIFIC);
    expect(rows.map((row) => [row.slug, row.status])).toEqual([
      ["vest-in-show", "unpublished"],
      ["coco-loco-tank", "unpublished"],
      ["cap-sleeve-tank", "scheduled"],
      ["teenage-kicks-socks", "published"],
      ["worsted-color-block-socks", "published"],
    ]);
    expect(selectPublishedKnitAbleCards(KNIT_ABLE_INITIAL_PUBLISH_DATES, SEP_29_NOON_PACIFIC).map((card) => card.href)).toEqual([
      "/knit-ables/teenage-kicks-socks",
      "/knit-ables/worsted-color-block-socks",
    ]);
    expect(
      selectPublishedKnitAbleCards(KNIT_ABLE_INITIAL_PUBLISH_DATES, AT_OCT_1_MIDNIGHT).map(
        (card) => card.href,
      ),
    ).toEqual([
      "/knit-ables/cap-sleeve-tank",
      "/knit-ables/teenage-kicks-socks",
      "/knit-ables/worsted-color-block-socks",
    ]);
  });

  it("omits a Knit-able that has no stored date", () => {
    const dates = {
      "teenage-kicks-socks": "2026-09-14",
      "worsted-color-block-socks": null,
    };
    expect(
      selectPublishedKnitAbleCards(dates, SEP_29_NOON_PACIFIC).map((card) => card.href),
    ).toEqual(["/knit-ables/teenage-kicks-socks"]);
    const tank = buildKnitAbleAdminRows(dates, SEP_29_NOON_PACIFIC).find(
      (row) => row.slug === "cap-sleeve-tank",
    );
    expect(tank?.status).toBe("unpublished");
    expect(tank?.publishDate).toBeNull();
  });

  it("validates calendar dates and treats a blank value as unpublished", () => {
    expect(parseKnitAblePublishDate(null)).toEqual({ ok: true, publishDate: null });
    expect(parseKnitAblePublishDate("  ")).toEqual({ ok: true, publishDate: null });
    expect(parseKnitAblePublishDate("2026-10-01")).toEqual({
      ok: true,
      publishDate: "2026-10-01",
    });
    expect(parseKnitAblePublishDate("2026-02-31").ok).toBe(false);
    expect(parseKnitAblePublishDate("10/01/2026").ok).toBe(false);
    expect(parseKnitAblePublishDate("2026-10-01T00:00:00").ok).toBe(false);
    expect(parseKnitAblePublishDate(20261001).ok).toBe(false);
  });

  it("formats a date without shifting the calendar day", () => {
    expect(formatKnitAblePublishDate("2026-10-01")).toBe("October 1, 2026");
    expect(knitAblePublishDateFromDb("2026-10-01")).toBe("2026-10-01");
    expect(knitAblePublishDateFromDb(new Date(2026, 9, 1))).toBe("2026-10-01");
    expect(knitAblePublishDateFromDb(null)).toBeNull();
  });

  it("describes the saved state in Pacific time", () => {
    expect(knitAbleSaveMessage("Branch Out Tank", "scheduled", "2026-10-01")).toContain(
      "12:00 a.m. Pacific on October 1, 2026",
    );
    expect(knitAbleSaveMessage("Branch Out Tank", "unpublished", null)).toContain("unpublished");
    expect(knitAblePreviewPath("/knit-ables/cap-sleeve-tank")).toBe(
      "/knit-ables/cap-sleeve-tank?preview=1",
    );
    expect(knitAbleSlugFromPath("/knit-ables/cap-sleeve-tank")).toBe("cap-sleeve-tank");
  });

  it("keeps every Knit-able detail page on the request-time gate", () => {
    const detailPages = readdirSync(resolve("src/pages/knit-ables")).filter(
      (name) => name.endsWith(".astro") && name !== "index.astro",
    );
    expect(detailPages.length).toBeGreaterThan(0);
    for (const name of detailPages) {
      const source = readFileSync(resolve("src/pages/knit-ables", name), "utf8");
      expect(source).toContain("export const prerender = false");
      expect(source).toContain("loadKnitAblePageAccess");
      expect(source).toContain("applyKnitAbleCacheHeaders");
      expect(source).toContain("knitAbleAccess.visible");
    }
  });

  it("seeds with ON CONFLICT DO NOTHING so a later edit is kept", () => {
    const sql = readFileSync(resolve("scripts/sql/watson-knit-able-schedules.sql"), "utf8").replace(
      /\r\n/g,
      "\n",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS watson_knit_able_schedules");
    expect(sql).toContain(knitAbleScheduleSeedSql());
    expect(knitAbleScheduleSeedSql()).toContain("ON CONFLICT (slug) DO NOTHING");
    expect(knitAbleScheduleSeedSql()).not.toContain("coco-loco-tank");
    expect(knitAbleScheduleSeedSql()).not.toContain("vest-in-show");
    expect(sql).not.toContain("coco-loco-tank");
    expect(sql).not.toContain("vest-in-show");
    expect(sql).toContain("Do not apply this on production until the scheduler release is approved");
  });
});

describe("Knit-able request access", () => {
  const tankUrl = new URL("http://localhost/knit-ables/cap-sleeve-tank");
  const previewUrl = new URL("http://localhost/knit-ables/cap-sleeve-tank?preview=1");

  function queryFn(rows: { slug: string; publish_date: string | null }[]) {
    return async () => rows;
  }

  it("returns a real 404 for a scheduled page, including a preview link without Watson auth", async () => {
    const scheduled = queryFn([{ slug: "cap-sleeve-tank", publish_date: "2026-10-01" }]);
    const direct = await loadKnitAblePageAccess({
      path: "/knit-ables/cap-sleeve-tank",
      url: tankUrl,
      cookies,
      now: BEFORE_OCT_1_MIDNIGHT,
      queryFn: scheduled,
      isAuthenticated: false,
    });
    const preview = await loadKnitAblePageAccess({
      path: "/knit-ables/cap-sleeve-tank",
      url: previewUrl,
      cookies,
      now: BEFORE_OCT_1_MIDNIGHT,
      queryFn: scheduled,
      isAuthenticated: false,
    });
    expect(direct).toMatchObject({ visible: false, httpStatus: 404 });
    expect(preview).toMatchObject({ visible: false, httpStatus: 404 });
    expect(decideKnitAbleVisibility({
      status: "scheduled",
      previewRequested: true,
      authenticated: true,
    })).toBe("preview");
  });

  it("lets a Watson admin preview before midnight and publishes at midnight", async () => {
    const scheduled = queryFn([{ slug: "cap-sleeve-tank", publish_date: "2026-10-01" }]);
    const adminPreview = await loadKnitAblePageAccess({
      path: "/knit-ables/cap-sleeve-tank",
      url: previewUrl,
      cookies,
      now: BEFORE_OCT_1_MIDNIGHT,
      queryFn: scheduled,
      isAuthenticated: true,
    });
    const atMidnight = await loadKnitAblePageAccess({
      path: "/knit-ables/cap-sleeve-tank",
      url: tankUrl,
      cookies,
      now: AT_OCT_1_MIDNIGHT,
      queryFn: scheduled,
      isAuthenticated: false,
    });
    const afterMidnight = await loadKnitAblePageAccess({
      path: "/knit-ables/cap-sleeve-tank",
      url: tankUrl,
      cookies,
      now: AFTER_OCT_1_MIDNIGHT,
      queryFn: scheduled,
      isAuthenticated: false,
    });
    expect(adminPreview).toMatchObject({
      visible: true,
      preview: true,
      httpStatus: 200,
      status: "scheduled",
    });
    expect(atMidnight).toMatchObject({ visible: true, preview: false, status: "published" });
    expect(afterMidnight).toMatchObject({ visible: true, preview: false, status: "published" });
  });

  it("keeps a logged-in admin on the public 404 unless preview=1 is requested", async () => {
    const access = await loadKnitAblePageAccess({
      path: "/knit-ables/cap-sleeve-tank",
      url: tankUrl,
      cookies,
      now: BEFORE_OCT_1_MIDNIGHT,
      queryFn: queryFn([{ slug: "cap-sleeve-tank", publish_date: "2026-10-01" }]),
      isAuthenticated: true,
    });
    expect(access).toMatchObject({ visible: false, httpStatus: 404 });
  });

  it("does not turn a database failure into a 404 or a public page", async () => {
    const access = await loadKnitAblePageAccess({
      path: "/knit-ables/teenage-kicks-socks",
      url: new URL("http://localhost/knit-ables/teenage-kicks-socks"),
      cookies,
      now: SEP_29_NOON_PACIFIC,
      queryFn: async () => {
        throw new Error("connection refused");
      },
      isAuthenticated: false,
    });
    expect(access).toMatchObject({ visible: false, httpStatus: 503 });
  });

  it("refuses unknown slugs and impossible dates, and saves a valid date", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const queryFn = async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      return [{ slug: params?.[0], publish_date: params?.[1] ?? null }];
    };
    const unknown = await updateKnitAblePublishDate("not-a-knit-able", "2026-10-01", queryFn);
    const impossible = await updateKnitAblePublishDate("cap-sleeve-tank", "2026-02-31", queryFn);
    const saved = await updateKnitAblePublishDate(
      "cap-sleeve-tank",
      "2026-10-01",
      queryFn,
      SEP_29_NOON_PACIFIC,
    );
    expect(unknown).toEqual({ ok: false, error: "Unknown Knit-able." });
    expect(impossible.ok).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.params).toEqual(["cap-sleeve-tank", "2026-10-01"]);
    expect(calls[0]?.sql).toContain("to_char(publish_date, 'YYYY-MM-DD')");
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.status).toBe("scheduled");
    expect(saved.value.message).toContain("October 1, 2026");
  });

  it("sends no-store cache headers so a CDN cannot freeze publication", () => {
    const headers = new Headers();
    applyKnitAbleCacheHeaders(headers);
    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("CDN-Cache-Control")).toBe("no-store");
    expect(headers.get("Netlify-CDN-Cache-Control")).toBe("no-store");
  });

  it("reads the API save payload without hiding an error", () => {
    expect(parseKnitAbleScheduleSaveResponse(false, { ok: false, error: "Unknown Knit-able." })).toEqual({
      ok: false,
      error: "Unknown Knit-able.",
    });
    expect(parseKnitAbleScheduleSaveResponse(false, "<html>nope</html>").ok).toBe(false);
    const saved = parseKnitAbleScheduleSaveResponse(true, {
      ok: true,
      knitAble: {
        slug: "cap-sleeve-tank",
        title: "Tank",
        path: "/knit-ables/cap-sleeve-tank",
        publishDate: "2026-10-01",
        status: "scheduled",
        statusLabel: "Scheduled",
        previewPath: "/knit-ables/cap-sleeve-tank?preview=1",
        message: "Saved. Tank is scheduled.",
      },
    });
    expect(saved.ok).toBe(true);
  });
});
