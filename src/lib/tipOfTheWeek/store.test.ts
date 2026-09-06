import { describe, expect, it, vi } from "vitest";

import { buildTipOfTheWeekRecord } from "./map";
import {
  createTipOfTheWeek,
  getTipOfTheWeekById,
  TIP_OF_THE_WEEK_ALL_SQL,
  updateTipOfTheWeek,
} from "./store";
import type { TipOfTheWeekRow } from "./types";

const CTA_TEXT = "Build Your Sock Pattern";
const CTA_URL = "/patterns/socks/builder?new=1";

const createInput = {
  tipId: "socks-cta-2026-09",
  title: "Build a sock that fits",
  intro: "Start with a new sock pattern.",
  videoContentId: "339",
  availableFrom: "2026-09-06",
  availableThrough: "2026-09-12",
  status: "draft",
  learnPoints: ["Measure the foot"],
  tryCopy: "Cast on.",
  sueTipCopy: "Check the cuff.",
};

function tipRow(overrides: Partial<TipOfTheWeekRow> = {}): TipOfTheWeekRow {
  return {
    id: "tip-row-1",
    tip_id: "taming-the-curl-2026-08",
    title: "Tame the Dreaded Stockinette Curl",
    intro: "Stockinette naturally curls at the edges.",
    intro_glossary_slug: "",
    video_content_id: "339",
    available_from: "2026-08-08",
    available_through: "2026-08-14",
    status: "draft",
    availability_notice: "Free to watch this week",
    availability_footer_template:
      "This Learning Library video is free for everyone through {date}. After that, it returns to the member Learning Library.",
    try_copy: "<p>Knit a swatch.</p>",
    sue_tip_copy: "<p>Don’t judge on the machine.</p>",
    cta_text: "",
    cta_url: "",
    learn_points_json: '["Why stockinette curls"]',
    related_links_json: "[]",
    eyebrow: "TIP OF THE WEEK",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function insertRowFromParams(params: unknown[]): TipOfTheWeekRow {
  return tipRow({
    id: "created-1",
    tip_id: String(params[0]),
    title: String(params[1]),
    intro: String(params[2]),
    intro_glossary_slug: String(params[3]),
    video_content_id: String(params[4]),
    available_from: String(params[5]),
    available_through: String(params[6]),
    status: String(params[7]),
    availability_notice: String(params[8]),
    availability_footer_template: String(params[9]),
    try_copy: String(params[10]),
    sue_tip_copy: String(params[11]),
    cta_text: String(params[12] ?? ""),
    cta_url: String(params[13] ?? ""),
    learn_points_json: String(params[14]),
    related_links_json: String(params[15]),
    eyebrow: String(params[16]),
  });
}

function updateRowFromParams(params: unknown[]): TipOfTheWeekRow {
  return tipRow({
    id: String(params[0]),
    tip_id: String(params[1]),
    title: String(params[2]),
    intro: String(params[3]),
    intro_glossary_slug: String(params[4]),
    video_content_id: String(params[5]),
    available_from: String(params[6]),
    available_through: String(params[7]),
    status: String(params[8]),
    availability_notice: String(params[9]),
    availability_footer_template: String(params[10]),
    try_copy: String(params[11]),
    sue_tip_copy: String(params[12]),
    cta_text: String(params[13] ?? ""),
    cta_url: String(params[14] ?? ""),
    learn_points_json: String(params[15]),
    related_links_json: String(params[16]),
    eyebrow: String(params[17]),
  });
}

function memoryDb(initial: TipOfTheWeekRow[] = []) {
  let rows = [...initial];
  const queryFn = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/INSERT INTO watson_tip_of_the_week/i.test(sql)) {
      const row = insertRowFromParams(params);
      rows = [...rows, row];
      return [row];
    }
    if (/UPDATE watson_tip_of_the_week SET/i.test(sql)) {
      const next = updateRowFromParams(params);
      rows = rows.map((row) => (row.id === next.id ? next : row));
      return rows.filter((row) => row.id === next.id);
    }
    if (/WHERE id = \$1/i.test(sql)) {
      return rows.filter((row) => row.id === params[0]);
    }
    return [...rows];
  });
  return { queryFn, rows: () => rows };
}

describe("Tip of the Week CTA persistence", () => {
  it("selects cta_text and cta_url and maps them onto ctaText / ctaUrl", () => {
    expect(TIP_OF_THE_WEEK_ALL_SQL).toContain("cta_text");
    expect(TIP_OF_THE_WEEK_ALL_SQL).toContain("cta_url");

    const mapped = buildTipOfTheWeekRecord(
      tipRow({
        cta_text: CTA_TEXT,
        cta_url: CTA_URL,
      }),
    );
    expect(mapped?.ctaText).toBe(CTA_TEXT);
    expect(mapped?.ctaUrl).toBe(CTA_URL);

    const blank = buildTipOfTheWeekRecord(tipRow());
    expect(blank?.ctaText).toBe("");
    expect(blank?.ctaUrl).toBe("");
  });

  it("saves CTA Text and CTA URL and loads both back", async () => {
    const db = memoryDb();
    const created = await createTipOfTheWeek(
      {
        ...createInput,
        ctaText: CTA_TEXT,
        ctaUrl: CTA_URL,
      },
      db.queryFn,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const insertCall = db.queryFn.mock.calls.find(([sql]) =>
      /INSERT INTO watson_tip_of_the_week/i.test(String(sql)),
    );
    expect(insertCall?.[1]?.[12]).toBe(CTA_TEXT);
    expect(insertCall?.[1]?.[13]).toBe(CTA_URL);
    expect(created.value.ctaText).toBe(CTA_TEXT);
    expect(created.value.ctaUrl).toBe(CTA_URL);

    const loaded = await getTipOfTheWeekById(created.value.id, db.queryFn);
    expect(loaded?.ctaText).toBe(CTA_TEXT);
    expect(loaded?.ctaUrl).toBe(CTA_URL);
  });

  it("keeps CTA fields when an existing tip is edited and saved without them in the patch", async () => {
    const db = memoryDb([
      tipRow({
        cta_text: CTA_TEXT,
        cta_url: CTA_URL,
      }),
    ]);

    const updated = await updateTipOfTheWeek(
      "tip-row-1",
      { title: "Edited title" },
      db.queryFn,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    const updateCall = db.queryFn.mock.calls.find(([sql]) =>
      /UPDATE watson_tip_of_the_week SET/i.test(String(sql)),
    );
    expect(String(updateCall?.[0])).toContain("cta_text = $14");
    expect(String(updateCall?.[0])).toContain("cta_url = $15");
    expect(updateCall?.[1]?.[13]).toBe(CTA_TEXT);
    expect(updateCall?.[1]?.[14]).toBe(CTA_URL);
    expect(updated.value.title).toBe("Edited title");
    expect(updated.value.ctaText).toBe(CTA_TEXT);
    expect(updated.value.ctaUrl).toBe(CTA_URL);

    const loaded = await getTipOfTheWeekById("tip-row-1", db.queryFn);
    expect(loaded?.ctaText).toBe(CTA_TEXT);
    expect(loaded?.ctaUrl).toBe(CTA_URL);
  });

  it("keeps CTA fields when an existing tip is saved with the same full form payload", async () => {
    const db = memoryDb([
      tipRow({
        cta_text: CTA_TEXT,
        cta_url: CTA_URL,
      }),
    ]);

    const updated = await updateTipOfTheWeek(
      "tip-row-1",
      {
        title: "Tame the Dreaded Stockinette Curl",
        intro: "Stockinette naturally curls at the edges.",
        videoContentId: "339",
        availableFrom: "2026-08-08",
        availableThrough: "2026-08-14",
        status: "draft",
        tryCopy: "Knit a swatch.",
        sueTipCopy: "Don’t judge on the machine.",
        ctaText: CTA_TEXT,
        ctaUrl: CTA_URL,
        learnPoints: ["Why stockinette curls"],
      },
      db.queryFn,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.ctaText).toBe(CTA_TEXT);
    expect(updated.value.ctaUrl).toBe(CTA_URL);
  });

  it("still saves blank CTA fields as empty", async () => {
    const db = memoryDb();
    const created = await createTipOfTheWeek(createInput, db.queryFn);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.ctaText).toBe("");
    expect(created.value.ctaUrl).toBe("");

    const insertCall = db.queryFn.mock.calls.find(([sql]) =>
      /INSERT INTO watson_tip_of_the_week/i.test(String(sql)),
    );
    expect(insertCall?.[1]?.[12]).toBe("");
    expect(insertCall?.[1]?.[13]).toBe("");

    const blanked = await updateTipOfTheWeek(
      created.value.id,
      {
        ...createInput,
        title: created.value.title,
        ctaText: "",
        ctaUrl: "",
      },
      db.queryFn,
    );
    expect(blanked.ok).toBe(true);
    if (!blanked.ok) return;
    expect(blanked.value.ctaText).toBe("");
    expect(blanked.value.ctaUrl).toBe("");
  });
});
