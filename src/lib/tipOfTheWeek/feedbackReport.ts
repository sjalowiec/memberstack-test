/**
 * Watson comparison of stored Tip of the Week feedback.
 * Reads the existing reaction blobs. Does not record new analytics.
 */
import { TIP_REACTION_HISTORY, type TipReactionId } from "../tipOfTheWeekReactions";
import { listAllTipOfTheWeek } from "./store";
import {
  loadTipReactionTotals,
  type TipReactionTotals,
} from "./reactionsAggregate";
import type { TipOfTheWeekRecord, TipOfTheWeekStatus } from "./types";

export const TIP_FEEDBACK_REPORT_PATH = "/watson/tip-of-the-week/feedback";
export const TIP_EDITOR_PATH = "/watson/tip-of-the-week";

export const NO_RESPONSES_LABEL = "No responses";
export const UNABLE_TO_LOAD_FEEDBACK_LABEL = "Unable to load feedback.";
export const UNABLE_TO_LOAD_TIPS_LABEL = "Unable to load the tip list.";

export const FEEDBACK_REPORT_TOTAL_EXPLANATION =
  "Total responses counts every saved button choice for that tip: Helpful, Not for me, and older choices that are no longer on the public page (“I’m going to try it” and “Show me more like this”). Changing a choice updates that visitor’s existing response, so it is not counted twice. Topic suggestions are stored separately and are not included in the total.";

export const FEEDBACK_REPORT_VIEWS_LIMITATION =
  "Views and response rate are omitted. Knit It Now does not store a reliable per-tip view count, and this report does not query or create an analytics system. Feedback events sent from the public page are not view counts.";

export type TipFeedbackSource = Pick<
  TipOfTheWeekRecord,
  "id" | "tipId" | "title" | "availableFrom" | "availableThrough" | "status"
>;

export type TipFeedbackLoad =
  | { status: "loaded"; totals: TipReactionTotals }
  | { status: "error" };

export type FeedbackReportState = "responses" | "empty" | "error";

export type FeedbackReportHistoricalCount = {
  id: TipReactionId;
  label: string;
  count: number;
};

export type FeedbackReportRow = {
  id: string;
  tipId: string;
  title: string;
  status: TipOfTheWeekStatus;
  availableFrom: string;
  availableThrough: string;
  state: FeedbackReportState;
  helpful: number | null;
  notForMe: number | null;
  total: number | null;
  historical: FeedbackReportHistoricalCount[];
  topicCount: number | null;
  topicSuggestions: string[];
  editorHref: string;
};

export type TipFeedbackReport = {
  error: string | null;
  rows: FeedbackReportRow[];
};

type FeedbackReportDeps = {
  listTips: () => Promise<TipFeedbackSource[]>;
  loadTotals: (tipId: string) => Promise<TipReactionTotals>;
};

const STATUS_LABELS: Record<TipOfTheWeekStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  archived: "Archived",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function tipEditorHref(id: string): string {
  const params = new URLSearchParams({ edit: id });
  return `${TIP_EDITOR_PATH}?${params.toString()}`;
}

export function formatTipSchedule(from: string, through: string): string {
  const start = formatCalendarDate(from);
  const end = formatCalendarDate(through);
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function tipStatusLabel(status: TipOfTheWeekStatus): string {
  return STATUS_LABELS[status] || status;
}

function historicalCounts(totals: TipReactionTotals): FeedbackReportHistoricalCount[] {
  return TIP_REACTION_HISTORY.flatMap((reaction) => {
    const count = totals.byReaction[reaction.id] ?? 0;
    if (count <= 0) return [];
    return [{ id: reaction.id, label: reaction.label, count }];
  });
}

export function historicalResponseNote(historical: FeedbackReportHistoricalCount[]): string {
  if (historical.length === 0) return "";
  const parts = historical.map((item) => `${item.count} “${item.label}”`);
  return `Includes ${joinAnd(parts)}.`;
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] || "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function buildFeedbackReportRow(
  tip: TipFeedbackSource,
  load: TipFeedbackLoad,
): FeedbackReportRow {
  const editorHref = tipEditorHref(tip.id);
  if (load.status === "error") {
    return {
      id: tip.id,
      tipId: tip.tipId,
      title: tip.title.trim() || tip.tipId,
      status: tip.status,
      availableFrom: tip.availableFrom,
      availableThrough: tip.availableThrough,
      state: "error",
      helpful: null,
      notForMe: null,
      total: null,
      historical: [],
      topicCount: null,
      topicSuggestions: [],
      editorHref,
    };
  }

  const { totals } = load;
  const total = totals.total;
  return {
    id: tip.id,
    tipId: tip.tipId,
    title: tip.title.trim() || tip.tipId,
    status: tip.status,
    availableFrom: tip.availableFrom,
    availableThrough: tip.availableThrough,
    state: total > 0 ? "responses" : "empty",
    helpful: totals.byReaction.helped ?? 0,
    notForMe: totals.byReaction.not_for_me ?? 0,
    total,
    historical: historicalCounts(totals),
    topicCount: totals.topicCount,
    topicSuggestions: totals.topicSuggestions,
    editorHref,
  };
}

function totalSortValue(row: FeedbackReportRow): number {
  return row.total ?? Number.NEGATIVE_INFINITY;
}

/** Default order: total responses descending, then title. Errors sort after zeros. */
export function sortFeedbackReportRows(rows: FeedbackReportRow[]): FeedbackReportRow[] {
  return [...rows].sort((left, right) => {
    const byTotal = totalSortValue(right) - totalSortValue(left);
    if (byTotal !== 0) return byTotal;
    return left.title.localeCompare(right.title, undefined, { sensitivity: "base", numeric: true });
  });
}

function countSortValue(value: number | null): string {
  return value == null ? "-1" : String(value);
}

function countText(value: number | null): string {
  return value == null ? "—" : String(value);
}

function topicCell(row: FeedbackReportRow): string {
  if (row.state === "error" || row.topicCount == null) {
    return `<td data-sort-value="-1">—</td>`;
  }
  if (row.topicCount === 0 || row.topicSuggestions.length === 0) {
    return `<td data-sort-value="0">0</td>`;
  }
  const items = row.topicSuggestions
    .map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`)
    .join("");
  return `<td data-sort-value="${row.topicCount}"><details><summary>${row.topicCount}</summary><ul>${items}</ul></details></td>`;
}

function totalCell(row: FeedbackReportRow): string {
  if (row.state === "error") {
    return `<td data-sort-value="-1" data-feedback-state="error"><span class="totw-feedback-report__state">${escapeHtml(UNABLE_TO_LOAD_FEEDBACK_LABEL)}</span></td>`;
  }
  const note = historicalResponseNote(row.historical);
  const noteHtml = note
    ? `<span class="totw-feedback-report__historical">${escapeHtml(note)}</span>`
    : "";
  const emptyHtml =
    row.state === "empty"
      ? `<span class="totw-feedback-report__state">${escapeHtml(NO_RESPONSES_LABEL)}</span>`
      : "";
  return `<td data-sort-value="${countSortValue(row.total)}" data-feedback-state="${row.state}"><strong>${countText(row.total)}</strong>${emptyHtml}${noteHtml}</td>`;
}

export function renderTipFeedbackReportTable(rows: FeedbackReportRow[]): string {
  const body =
    rows.length === 0
      ? `<tr data-sort-ignore><td colspan="7">No tips to compare yet.</td></tr>`
      : rows
          .map((row) => {
            const schedule = formatTipSchedule(row.availableFrom, row.availableThrough);
            return `<tr data-feedback-report-row="${escapeHtml(row.tipId)}">
<td data-sort-value="${escapeHtml(row.title)}"><span class="totw-feedback-report__title">${escapeHtml(row.title)}</span><span class="totw-feedback-report__meta">${escapeHtml(tipStatusLabel(row.status))}</span></td>
<td data-sort-value="${escapeHtml(row.availableFrom)}">${escapeHtml(schedule)}</td>
<td data-sort-value="${countSortValue(row.helpful)}">${countText(row.helpful)}</td>
<td data-sort-value="${countSortValue(row.notForMe)}">${countText(row.notForMe)}</td>
${totalCell(row)}
${topicCell(row)}
<td><a href="${escapeHtml(row.editorHref)}">Edit</a></td>
</tr>`;
          })
          .join("");

  return `<table class="watson-table totw-feedback-report__table" data-sortable-table data-feedback-report>
<thead>
<tr>
<th scope="col" data-sort-key="title">Tip title</th>
<th scope="col" data-sort-key="dates" data-sort-type="date">Scheduled dates</th>
<th scope="col" data-sort-key="helpful">Helpful</th>
<th scope="col" data-sort-key="not-for-me">Not for me</th>
<th scope="col" data-sort-key="total" data-sort-default="true" data-sort-default-direction="desc">Total responses</th>
<th scope="col" data-sort-key="topics">Topic suggestions</th>
<th scope="col">Edit</th>
</tr>
</thead>
<tbody>${body}</tbody>
</table>`;
}

export async function loadTipFeedbackReport(
  deps: FeedbackReportDeps = {
    listTips: listAllTipOfTheWeek,
    loadTotals: loadTipReactionTotals,
  },
): Promise<TipFeedbackReport> {
  let tips: TipFeedbackSource[];
  try {
    tips = await deps.listTips();
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "";
    return {
      error: message ? `${UNABLE_TO_LOAD_TIPS_LABEL} ${message}` : UNABLE_TO_LOAD_TIPS_LABEL,
      rows: [],
    };
  }

  const rows: FeedbackReportRow[] = [];
  for (const tip of tips) {
    try {
      const totals = await deps.loadTotals(tip.tipId);
      rows.push(buildFeedbackReportRow(tip, { status: "loaded", totals }));
    } catch {
      rows.push(buildFeedbackReportRow(tip, { status: "error" }));
    }
  }

  return { error: null, rows: sortFeedbackReportRows(rows) };
}
