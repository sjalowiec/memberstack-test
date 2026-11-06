import { describe, expect, it } from "vitest";
import { formatTipAvailabilityDate } from "./map";
import {
  TIP_VIDEO_USAGE_LIMITATION,
  archiveFieldsMatch,
  archiveSearchFields,
  buildVideoUsageSummary,
  groupTipAdminItems,
  orderedTipAdminItems,
  renderTipAdminBoardHtml,
  renderVideoUsageHtml,
  tipAdminDisplayStatus,
  tipAdminStatusSortValue,
  tipMatchesArchiveQuery,
  type TipAdminListItem,
} from "./adminList";
import type { TipOfTheWeekRecord, TipOfTheWeekStatus } from "./types";

const TODAY = "2026-08-10";

function tip(
  partial: Partial<TipOfTheWeekRecord> &
    Pick<TipOfTheWeekRecord, "id" | "title" | "status">,
): TipOfTheWeekRecord {
  return {
    tipId: partial.tipId ?? partial.id,
    intro: "",
    introGlossarySlug: "",
    videoContentId: partial.videoContentId ?? "339",
    availableFrom: partial.availableFrom ?? "",
    availableThrough: partial.availableThrough ?? "",
    availabilityNotice: "",
    availabilityFooterTemplate: "",
    tryCopy: "",
    sueTipCopy: "",
    ctaText: "",
    ctaUrl: "",
    learnPoints: [],
    relatedLinks: [],
    eyebrow: "",
    createdAt: partial.createdAt ?? "2026-08-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

function item(
  partial: Partial<TipOfTheWeekRecord> &
    Pick<TipOfTheWeekRecord, "id" | "title" | "status">,
  videoTitle: string | null = "Short rows",
): TipAdminListItem {
  return {
    tip: tip(partial),
    videoTitle,
    reactionRows: [
      { label: "Helpful", count: 2 },
      { label: "Not for me", count: 1 },
    ],
    topicCount: 0,
  };
}

function section(items: TipAdminListItem[], key: "current" | "upcoming" | "drafts" | "past") {
  return groupTipAdminItems(items, TODAY).find((group) => group.key === key);
}

describe("Watson tip admin list", () => {
  it("keeps a dated draft in Drafts and labels expired and archived tips for display only", () => {
    const draft = item({
      id: "draft-1",
      title: "Dated draft",
      status: "draft",
      availableFrom: "2026-08-01",
      availableThrough: "2026-08-20",
      videoContentId: "100",
    });
    const expired = item({
      id: "expired-1",
      title: "Expired scheduled",
      status: "scheduled",
      availableFrom: "2026-07-01",
      availableThrough: "2026-07-07",
    });
    const archived = item({
      id: "archived-1",
      title: "Explicit archive",
      status: "archived",
      availableFrom: "2026-06-01",
      availableThrough: "2026-06-07",
    });
    const upcoming = item({
      id: "soon-1",
      title: "Soon",
      status: "scheduled",
      availableFrom: "2026-08-20",
      availableThrough: "2026-08-26",
    });

    expect(section([draft], "drafts")?.items.map((row) => row.tip.id)).toEqual(["draft-1"]);
    expect(section([draft], "upcoming")?.items).toEqual([]);
    expect(section([expired, archived], "past")?.items.map((row) => row.tip.status)).toEqual([
      "scheduled",
      "archived",
    ]);
    expect(tipAdminDisplayStatus(expired.tip, TODAY)).toBe("Past");
    expect(tipAdminDisplayStatus(archived.tip, TODAY)).toBe("Archived");
    expect(tipAdminDisplayStatus(upcoming.tip, TODAY)).toBe("Scheduled");
    expect(
      tipAdminDisplayStatus(
        item({
          id: "live-1",
          title: "Live tip",
          status: "scheduled",
          availableFrom: "2026-08-08",
          availableThrough: "2026-08-14",
        }).tip,
        TODAY,
      ),
    ).toBe("Live");
    expect(expired.tip.status).toBe("scheduled");
  });

  it("sorts Upcoming by start date and Past & archived by end date", () => {
    const items = [
      item({
        id: "late",
        title: "Late start",
        status: "scheduled",
        availableFrom: "2026-09-01",
        availableThrough: "2026-09-07",
      }),
      item({
        id: "early",
        title: "Early start",
        status: "active",
        availableFrom: "2026-08-20",
        availableThrough: "2026-08-26",
      }),
      item({
        id: "older",
        title: "Older ending",
        status: "scheduled",
        availableFrom: "2026-05-01",
        availableThrough: "2026-05-07",
      }),
      item({
        id: "newer",
        title: "Newer ending",
        status: "archived",
        availableFrom: "2026-06-01",
        availableThrough: "2026-07-15",
      }),
    ];
    expect(section(items, "upcoming")?.items.map((row) => row.tip.id)).toEqual([
      "early",
      "late",
    ]);
    expect(section(items, "past")?.items.map((row) => row.tip.id)).toEqual(["newer", "older"]);
  });

  it("searches past tips by title, video title, or KIN video id", () => {
    const row = item(
      {
        id: "row-1",
        tipId: "heel-slug-not-the-video",
        title: "Turning a heel",
        status: "archived" as TipOfTheWeekStatus,
        videoContentId: "456",
        availableFrom: "2026-01-01",
        availableThrough: "2026-01-07",
      },
      "Short-row heels",
    );
    expect(tipMatchesArchiveQuery(row, "heel")).toBe(true);
    expect(tipMatchesArchiveQuery(row, "short-row")).toBe(true);
    expect(tipMatchesArchiveQuery(row, "456")).toBe(true);
    expect(tipMatchesArchiveQuery(row, "heel-slug")).toBe(false);
    expect(archiveFieldsMatch(archiveSearchFields(row), "  456 ")).toBe(true);

    const live = item({
      id: "live-1",
      title: "Live heel week",
      status: "scheduled",
      availableFrom: "2026-08-08",
      availableThrough: "2026-08-14",
      videoContentId: "339",
    });
    const scheduled = item({
      id: "soon-1",
      title: "Queued sooner",
      status: "scheduled",
      availableFrom: "2026-08-20",
      availableThrough: "2026-08-26",
    });
    const draft = item({
      id: "draft-1",
      title: "Dated draft",
      status: "draft",
      availableFrom: "2026-08-01",
      availableThrough: "2026-08-07",
    });
    const html = renderTipAdminBoardHtml({
      todayLa: TODAY,
      items: [row, draft, scheduled, live],
      archiveQuery: "999",
    });
    expect(orderedTipAdminItems([row, draft, scheduled, live], TODAY).map((entry) => entry.tip.id)).toEqual([
      "live-1",
      "soon-1",
      "draft-1",
      "row-1",
    ]);
    expect(html).toContain("data-totw-archive-search");
    expect(html).toMatch(/<label>\s*Search\s*<input/);
    expect(html).toContain('data-sortable-table');
    expect(html).toContain('data-sort-key="title"');
    expect(html).toContain('data-sort-key="status"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain("data-sort-default");
    expect(tipAdminStatusSortValue("Live")).toBe("1");
    expect(tipAdminStatusSortValue("Scheduled")).toBe("2");
    expect(tipAdminStatusSortValue("Draft")).toBe("3");
    expect(tipAdminStatusSortValue("Past")).toBe("4");
    expect(tipAdminStatusSortValue("Archived")).toBe("5");
    expect(html).toContain('data-sort-value="1"');
    expect(html).toContain('data-sort-value="5"');
    expect(html).toContain(">Title<");
    expect(html).toContain(">Status<");
    expect(html).toContain(">Edit<");
    expect(html).toContain(">Preview<");
    expect(html).toContain("No matching tips");
    expect(html).toContain("hidden");
    expect(html).toContain('href="/tip-of-the-week?preview=row-1"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("Helpful <strong>2</strong>");
    expect(html).not.toContain("video 456");
    expect(html).not.toContain("Past & archived");
    expect(html).toContain(">Archived<");
    expect(html).toContain(">Live<");
    expect(html.indexOf("live-1")).toBeLessThan(html.indexOf("soon-1"));
    expect(html.indexOf("soon-1")).toBeLessThan(html.indexOf("draft-1"));
    expect(html.indexOf("draft-1")).toBeLessThan(html.indexOf("row-1"));
  });
});

describe("video usage summary", () => {
  const repeatPast = tip({
    id: "past-a",
    title: "First heel week",
    status: "scheduled",
    videoContentId: "339",
    availableFrom: "2026-06-01",
    availableThrough: "2026-06-07",
  });
  const repeatLater = tip({
    id: "past-b",
    title: "Second heel week",
    status: "active",
    videoContentId: "0339",
    availableFrom: "2026-07-06",
    availableThrough: "2026-07-12",
  });
  const live = tip({
    id: "live-1",
    title: "Live heel week",
    status: "scheduled",
    videoContentId: "339",
    availableFrom: "2026-08-08",
    availableThrough: "2026-08-14",
  });
  const queued = tip({
    id: "queue-1",
    title: "Queued heel week",
    status: "scheduled",
    videoContentId: "339",
    availableFrom: "2026-09-01",
    availableThrough: "2026-09-07",
  });
  const datedDraft = tip({
    id: "draft-1",
    title: "Draft with dates",
    status: "draft",
    videoContentId: "339",
    availableFrom: "2026-08-01",
    availableThrough: "2026-08-20",
  });

  it("counts a repeat video, includes the live run, and lists future runs separately", () => {
    const summary = buildVideoUsageSummary(
      [queued, datedDraft, repeatPast, live, repeatLater],
      "339",
      TODAY,
    );
    expect(summary.publicCount).toBe(3);
    expect(summary.latestStart).toBe("2026-08-08");
    expect(summary.latestStartLabel).toBe(formatTipAvailabilityDate("2026-08-08"));
    expect(summary.live.map((run) => run.title)).toEqual(["Live heel week"]);
    expect(summary.past.map((run) => run.id)).toEqual(["past-b", "past-a"]);
    expect(summary.upcoming.map((run) => run.title)).toEqual(["Queued heel week"]);
    expect(summary.past.concat(summary.live, summary.upcoming).map((run) => run.title)).not.toContain(
      "Draft with dates",
    );

    const html = renderVideoUsageHtml(summary);
    expect(html).toContain("3 public runs");
    expect(html).toContain("Live now");
    expect(html).toContain("View past runs");
    expect(html).toContain("Past scheduled runs");
    expect(html).toContain("First heel week");
    expect(html).toContain("Second heel week");
    expect(html).toContain(formatTipAvailabilityDate("2026-06-01"));
    expect(html).toContain("Future scheduled runs");
    expect(html).toContain("Queued heel week");
    expect(html).not.toContain("Draft with dates");
    expect(html).toContain(TIP_VIDEO_USAGE_LIMITATION);
    expect(html).not.toContain("<details open");
  });

  it("says there are no past runs when the video has no history", () => {
    const summary = buildVideoUsageSummary([datedDraft], "880", TODAY);
    expect(summary.publicCount).toBe(0);
    expect(summary.past).toEqual([]);
    expect(summary.upcoming).toEqual([]);
    const html = renderVideoUsageHtml(summary);
    expect(html).toContain("No past runs found");
    expect(html).toContain("View past runs");
    expect(html).not.toContain("Future scheduled runs");
  });

  it("ignores a dated draft even when it is the only tip for that video", () => {
    const summary = buildVideoUsageSummary([datedDraft], "339", TODAY);
    expect(summary.publicCount).toBe(0);
    expect(summary.live).toEqual([]);
    expect(summary.past).toEqual([]);
    expect(renderVideoUsageHtml(summary)).toContain("No past runs found");
    expect(renderVideoUsageHtml(summary)).not.toContain("Draft with dates");
  });

  it("keeps each saved tip as its own run and includes the tip being edited", () => {
    const oneRange = buildVideoUsageSummary([repeatPast], "339", TODAY);
    expect(oneRange.publicCount).toBe(1);
    expect(oneRange.past).toHaveLength(1);

    const twoRecords = buildVideoUsageSummary([repeatPast, repeatLater], "339", TODAY);
    expect(twoRecords.past.map((run) => run.id)).toEqual(["past-b", "past-a"]);
  });

  it("counts an elapsed archived window as a past scheduled run and leaves a future archive out of the queue", () => {
    const elapsedArchive = tip({
      id: "arch-past",
      title: "Archived after it ran",
      status: "archived",
      videoContentId: "339",
      availableFrom: "2026-05-01",
      availableThrough: "2026-05-07",
    });
    const futureArchive = tip({
      id: "arch-future",
      title: "Archived before it started",
      status: "archived",
      videoContentId: "339",
      availableFrom: "2026-10-01",
      availableThrough: "2026-10-07",
    });
    const summary = buildVideoUsageSummary([elapsedArchive, futureArchive], "339", TODAY);
    expect(summary.past.map((run) => run.id)).toEqual(["arch-past"]);
    expect(summary.upcoming).toEqual([]);
    expect(summary.publicCount).toBe(1);
  });
});
