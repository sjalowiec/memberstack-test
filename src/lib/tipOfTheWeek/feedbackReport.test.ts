import { describe, expect, it } from "vitest";
import { compareSortValues } from "../watson/sortableTable";
import { isWatsonPublicPath } from "../watson/watsonAuth";
import { isWatsonRoute } from "../watson/watsonAccess";
import {
  FEEDBACK_REPORT_TOTAL_EXPLANATION,
  FEEDBACK_REPORT_VIEWS_LIMITATION,
  NO_RESPONSES_LABEL,
  TIP_FEEDBACK_REPORT_PATH,
  UNABLE_TO_LOAD_FEEDBACK_LABEL,
  UNABLE_TO_LOAD_TIPS_LABEL,
  buildFeedbackReportRow,
  loadTipFeedbackReport,
  renderTipFeedbackReportTable,
  sortFeedbackReportRows,
  type FeedbackReportRow,
  type TipFeedbackSource,
} from "./feedbackReport";
import type { TipReactionTotals } from "./reactionsAggregate";

function tip(overrides: Partial<TipFeedbackSource> = {}): TipFeedbackSource {
  return {
    id: "row-1",
    tipId: "cast-on",
    title: "Cast on",
    availableFrom: "2026-03-02",
    availableThrough: "2026-03-08",
    status: "archived",
    ...overrides,
  };
}

function totals(overrides: Partial<TipReactionTotals> = {}): TipReactionTotals {
  return {
    tipId: "cast-on",
    total: 0,
    byReaction: {
      helped: 0,
      not_for_me: 0,
      will_try: 0,
      more_like_this: 0,
    },
    topicCount: 0,
    topicSuggestions: [],
    ...overrides,
  };
}

function cellSortValues(html: string, columnIndex: number): string[] {
  const rows = [...html.matchAll(/<tr data-feedback-report-row="[^"]*">([\s\S]*?)<\/tr>/g)];
  return rows.map((match) => {
    const cells = [...match[1].matchAll(/<td\b([^>]*)>/g)];
    const attrs = cells[columnIndex]?.[1] || "";
    const value = attrs.match(/data-sort-value="([^"]*)"/);
    return value?.[1] || "";
  });
}

describe("tip feedback comparison report", () => {
  it("stays behind Watson authentication", () => {
    expect(isWatsonRoute(TIP_FEEDBACK_REPORT_PATH)).toBe(true);
    expect(isWatsonPublicPath(TIP_FEEDBACK_REPORT_PATH)).toBe(false);
  });

  it("counts current and older reactions in the total and keeps topic text separate", () => {
    const row = buildFeedbackReportRow(
      tip(),
      {
        status: "loaded",
        totals: totals({
          total: 5,
          byReaction: { helped: 2, not_for_me: 1, will_try: 1, more_like_this: 1 },
          topicCount: 1,
          topicSuggestions: ["Short rows <script>"],
        }),
      },
    );

    expect(row.helpful).toBe(2);
    expect(row.notForMe).toBe(1);
    expect(row.total).toBe(5);
    expect(row.historical.map((item) => item.label)).toEqual([
      "I’m going to try it",
      "Show me more like this",
    ]);
    expect(row.topicSuggestions).toEqual(["Short rows <script>"]);
    expect(FEEDBACK_REPORT_TOTAL_EXPLANATION).toContain("I’m going to try it");
    expect(FEEDBACK_REPORT_TOTAL_EXPLANATION).toContain("Show me more like this");
    expect(FEEDBACK_REPORT_TOTAL_EXPLANATION).toContain("not included in the total");
    expect(JSON.stringify(row)).not.toContain("visitorId");
  });

  it("labels a successful zero separately from a failed feedback load", () => {
    const empty = buildFeedbackReportRow(tip({ tipId: "quiet", title: "Quiet tip" }), {
      status: "loaded",
      totals: totals({ tipId: "quiet" }),
    });
    const failed = buildFeedbackReportRow(tip({ id: "row-2", tipId: "missing", title: "Missing" }), {
      status: "error",
    });

    expect(empty.state).toBe("empty");
    expect(empty.total).toBe(0);
    expect(empty.topicCount).toBe(0);
    expect(failed.state).toBe("error");
    expect(failed.total).toBeNull();
    expect(failed.helpful).toBeNull();
    expect(failed.topicSuggestions).toEqual([]);

    const html = renderTipFeedbackReportTable([empty, failed]);
    expect(html).toContain(NO_RESPONSES_LABEL);
    expect(html).toContain(UNABLE_TO_LOAD_FEEDBACK_LABEL);
    expect(html).not.toContain(`${UNABLE_TO_LOAD_FEEDBACK_LABEL}${NO_RESPONSES_LABEL}`);
    const emptyStart = html.indexOf('data-feedback-state="empty"');
    const emptyCell = html.slice(emptyStart, html.indexOf("</td>", emptyStart));
    expect(emptyCell).toContain(NO_RESPONSES_LABEL);
    expect(emptyCell).not.toContain(UNABLE_TO_LOAD_FEEDBACK_LABEL);
  });

  it("shows suggestion text and a link to the existing tip editor", () => {
    const row = buildFeedbackReportRow(tip({ id: "tip-uuid" }), {
      status: "loaded",
      totals: totals({
        total: 1,
        byReaction: { helped: 1, not_for_me: 0, will_try: 0, more_like_this: 0 },
        topicCount: 2,
        topicSuggestions: ["Button bands", "Ribbing & seams"],
      }),
    });
    const html = renderTipFeedbackReportTable([row]);
    expect(html).toContain("<summary>2</summary>");
    expect(html).toContain("Button bands");
    expect(html).toContain("Ribbing &amp; seams");
    expect(html).not.toContain("Ribbing & seams");
    expect(html).toContain('href="/watson/tip-of-the-week?edit=tip-uuid"');
    expect(html).toContain(">Edit</a>");
    expect(html).toContain("Mar 2, 2026 – Mar 8, 2026");
    expect(html).toContain("Archived");
  });

  it("sorts by total responses descending and places failed loads after zeros", () => {
    const rows = sortFeedbackReportRows([
      buildFeedbackReportRow(tip({ id: "a", tipId: "a", title: "Alpha" }), {
        status: "loaded",
        totals: totals({ total: 1, byReaction: { helped: 1, not_for_me: 0, will_try: 0, more_like_this: 0 } }),
      }),
      buildFeedbackReportRow(tip({ id: "b", tipId: "b", title: "Busy", status: "active" }), {
        status: "loaded",
        totals: totals({
          tipId: "b",
          total: 4,
          byReaction: { helped: 3, not_for_me: 1, will_try: 0, more_like_this: 0 },
        }),
      }),
      buildFeedbackReportRow(tip({ id: "c", tipId: "c", title: "Quiet" }), {
        status: "loaded",
        totals: totals({ tipId: "c" }),
      }),
      buildFeedbackReportRow(tip({ id: "d", tipId: "d", title: "Broken" }), { status: "error" }),
    ]);

    expect(rows.map((row) => row.title)).toEqual(["Busy", "Alpha", "Quiet", "Broken"]);

    const html = renderTipFeedbackReportTable(rows);
    expect(html).toContain('data-sort-key="total" data-sort-default="true" data-sort-default-direction="desc"');
    const totalsColumn = cellSortValues(html, 4);
    const sorted = [...totalsColumn].sort((left, right) => -compareSortValues(left, right, "string"));
    expect(totalsColumn).toEqual(sorted);
    expect(compareSortValues("-1", "0", "string")).toBeLessThan(0);
    expect(FEEDBACK_REPORT_VIEWS_LIMITATION).toContain("Views and response rate are omitted");
    expect(html).not.toContain("Response rate");
  });

  it("keeps loaded tips when one feedback read fails and reports a tip-list failure separately", async () => {
    const loaded = await loadTipFeedbackReport({
      listTips: async () => [
        tip({ id: "ok", tipId: "ok", title: "Ready" }),
        tip({ id: "bad", tipId: "bad", title: "Unread" }),
      ],
      loadTotals: async (tipId) => {
        if (tipId === "bad") throw new Error("blob unavailable");
        return totals({
          tipId,
          total: 2,
          byReaction: { helped: 2, not_for_me: 0, will_try: 0, more_like_this: 0 },
        });
      },
    });

    expect(loaded.error).toBeNull();
    expect(loaded.rows.map((row) => row.state)).toEqual(["responses", "error"]);
    expect(loaded.rows[0]?.total).toBe(2);
    expect(loaded.rows[1]?.total).toBeNull();

    const failedList = await loadTipFeedbackReport({
      listTips: async () => {
        throw new Error("database offline");
      },
      loadTotals: async () => totals(),
    });
    expect(failedList.rows).toEqual([]);
    expect(failedList.error).toContain(UNABLE_TO_LOAD_TIPS_LABEL);
    expect(failedList.error).toContain("database offline");
    expect(failedList.error).not.toContain(UNABLE_TO_LOAD_FEEDBACK_LABEL);
  });

  it("includes a zero-response past tip in the loaded report", async () => {
    const report = await loadTipFeedbackReport({
      listTips: async () => [tip({ status: "archived", title: "Past tip" })],
      loadTotals: async () => totals(),
    });
    expect(report.rows).toHaveLength(1);
    const row: FeedbackReportRow | undefined = report.rows[0];
    expect(row?.state).toBe("empty");
    expect(row?.status).toBe("archived");
    expect(renderTipFeedbackReportTable(report.rows)).toContain("Past tip");
  });
});
