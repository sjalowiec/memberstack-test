import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  mapThankYouStatusRow,
  setThankYouStatus,
  thankYouCompletionSql,
  thankYouVideoLinkSql,
  thankYouStatusUpdateSql,
} from "./memberThankYouStore";
import type { WatsonQueryFn } from "./memberSearch";

describe("member thank-you status storage", () => {
  it("creates a dedicated table keyed by Stripe charge id", () => {
    const sql = readFileSync(
      "supabase/migrations/20261030181500_watson_member_thank_yous.sql",
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.watson_member_thank_yous");
    expect(sql).toContain("stripe_charge_id TEXT PRIMARY KEY");
    expect(sql).toContain("video_sent_at TIMESTAMPTZ");
    expect(sql).toContain("card_sent_at TIMESTAMPTZ");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON TABLE public.watson_member_thank_yous");
    expect(sql).not.toContain("CREATE POLICY");
    expect(sql).not.toContain("birthday-cards");
    expect(sql).not.toContain("birthday_cards");
  });

  it("updates only the checkbox that changed", () => {
    const setClause = (sql: string) => (sql.split(/do update/i)[1] ?? "").split(/returning/i)[0] ?? "";

    const videoSql = thankYouStatusUpdateSql("video");
    const videoInsert = videoSql.split(/on conflict/i)[0] ?? "";
    const videoSet = setClause(videoSql);
    expect(videoInsert).toContain("video_sent_at");
    expect(videoInsert).not.toContain("card_sent_at");
    expect(videoSet).toContain("video_sent_at = EXCLUDED.video_sent_at");
    expect(videoSet).not.toContain("card_sent_at");

    const cardSql = thankYouStatusUpdateSql("card");
    const cardInsert = cardSql.split(/on conflict/i)[0] ?? "";
    const cardSet = setClause(cardSql);
    expect(cardInsert).toContain("card_sent_at");
    expect(cardInsert).not.toContain("video_sent_at");
    expect(cardSet).toContain("card_sent_at = EXCLUDED.card_sent_at");
    expect(cardSet).not.toContain("video_sent_at");
  });

  it("clears one date without clearing the other", async () => {
    let cardSentAt: string | null = "2026-10-30T17:00:00.000Z";
    const queryFn: WatsonQueryFn = async (sql, params) => {
      expect(sql).toContain("video_sent_at");
      expect(params?.[1]).toBeNull();
      return [
        {
          stripe_charge_id: params?.[0],
          video_sent_at: null,
          card_sent_at: cardSentAt,
          updated_at: "2026-10-30T18:00:00.000Z",
        },
      ];
    };
    const saved = await setThankYouStatus(
      { stripeChargeId: "ch_annual123", field: "video", sent: false },
      queryFn,
    );
    expect(saved.videoSentAt).toBeNull();
    expect(saved.cardSentAt).toBe(cardSentAt);
  });

  it("keeps a future renewal on its own charge id", () => {
    const first = mapThankYouStatusRow({
      stripe_charge_id: "ch_thisyear",
      video_sent_at: "2026-10-30T18:00:00.000Z",
      card_sent_at: "2026-10-30T18:00:00.000Z",
      updated_at: "2026-10-30T18:00:00.000Z",
    });
    const renewal = mapThankYouStatusRow({
      stripe_charge_id: "ch_nextyear",
      video_sent_at: null,
      card_sent_at: null,
      updated_at: "2027-10-30T18:00:00.000Z",
    });
    expect(first?.stripeChargeId).not.toBe(renewal?.stripeChargeId);
    expect(renewal?.videoSentAt).toBeNull();
    expect(renewal?.cardSentAt).toBeNull();
    expect(renewal?.videoReplyId).toBeNull();
    expect(renewal?.completedAt).toBeNull();
  });

  it("adds video and completion columns without changing existing sent rows", () => {
    const sql = readFileSync(
      "supabase/migrations/20261101143000_watson_member_thank_you_videos.sql",
      "utf8",
    );
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS video_reply_id");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS completed_at");
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toContain("video_sent_at =");
    expect(sql).not.toContain("card_sent_at =");
  });

  it("stores a video link without changing sent or completion columns", () => {
    const setClause = (thankYouVideoLinkSql().split(/do update/i)[1] ?? "").split(/returning/i)[0] ?? "";
    expect(setClause).toContain("video_reply_id = COALESCE");
    expect(setClause).not.toContain("video_sent_at");
    expect(setClause).not.toContain("card_sent_at");
    expect(setClause).not.toContain("completed_at");
  });

  it("stores completion without changing sent dates or the video link", () => {
    const setClause = (thankYouCompletionSql().split(/do update/i)[1] ?? "").split(/returning/i)[0] ?? "";
    expect(setClause).toContain("completed_at = EXCLUDED.completed_at");
    expect(setClause).not.toContain("video_sent_at");
    expect(setClause).not.toContain("card_sent_at");
    expect(setClause).not.toContain("video_reply_id");
  });
});
