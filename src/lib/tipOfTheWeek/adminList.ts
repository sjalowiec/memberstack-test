/**
 * Watson Tip of the Week admin list, archive search, and video usage.
 *
 * Public featuring rules stay in `schedule.ts`. Labels such as Past and
 * Archived are for this list only and do not change the stored status.
 *
 * Watson stores one date range per tip. It does not keep a playback log.
 * Rescheduling a tip replaces that range, so each repeat has to be its own
 * tip record if the earlier run should remain visible.
 */
import type { TipOfTheWeekRecord, TipOfTheWeekStatus } from "./types";
import {
  isIsoDateOnly,
  statusLabel,
  tipIsPubliclyFeatured,
  tipScheduleBucket,
} from "./schedule";

export const TIP_VIDEO_USAGE_DATE_NOTE =
  "Past scheduled runs are counted from each tip's dates. Watson does not keep a separate playback log.";

export const TIP_VIDEO_USAGE_LIMITATION =
  "Rescheduling a tip replaces its date range. Save each repeat as its own tip to keep the earlier run.";

export type TipAdminReactionRow = {
  label: string;
  count: number;
};

export type TipAdminListItem = {
  tip: TipOfTheWeekRecord;
  videoTitle: string | null;
  reactionRows: TipAdminReactionRow[];
  topicCount: number;
};

export type TipAdminSectionKey = "current" | "upcoming" | "drafts" | "past";

export type TipAdminSection = {
  key: TipAdminSectionKey;
  id: string;
  title: string;
  items: TipAdminListItem[];
};

export type VideoUsageRun = {
  id: string;
  title: string;
  availableFrom: string;
  availableThrough: string;
  rangeLabel: string;
};

export type VideoUsageSummary = {
  /** Live runs plus elapsed scheduled windows. Drafts are never included. */
  publicCount: number;
  latestStart: string | null;
  latestStartLabel: string | null;
  live: VideoUsageRun[];
  past: VideoUsageRun[];
  upcoming: VideoUsageRun[];
};

type ScheduleTip = Pick<
  TipOfTheWeekRecord,
  "id" | "title" | "status" | "videoContentId" | "availableFrom" | "availableThrough"
>;

const SECTION_META: Record<TipAdminSectionKey, { id: string; title: string }> = {
  current: { id: "totw-group-current", title: "Current (public)" },
  upcoming: { id: "totw-group-upcoming", title: "Upcoming" },
  drafts: { id: "totw-group-drafts", title: "Drafts" },
  past: { id: "totw-group-past", title: "Past & archived" },
};

export function canonicalVideoContentId(value: string): string {
  const trimmed = String(value || "").trim();
  if (!/^\d+$/.test(trimmed)) return trimmed.toLowerCase();
  return trimmed.replace(/^0+/, "") || "0";
}

export function sameVideoContentId(a: string, b: string): boolean {
  if (!String(a || "").trim() || !String(b || "").trim()) return false;
  return canonicalVideoContentId(a) === canonicalVideoContentId(b);
}

/** List badge only. Stored status is unchanged. */
export function tipAdminDisplayStatus(
  tip: Pick<TipOfTheWeekRecord, "status" | "availableFrom" | "availableThrough">,
  todayLa: string,
): string {
  const bucket = tipScheduleBucket(tip, todayLa);
  if (bucket === "expired") return "Past";
  if (bucket === "archived" || tip.status === "archived") return "Archived";
  return statusLabel(tip.status);
}

export function tipAdminSectionKey(
  tip: Pick<TipOfTheWeekRecord, "status" | "availableFrom" | "availableThrough">,
  todayLa: string,
): TipAdminSectionKey {
  const bucket = tipScheduleBucket(tip, todayLa);
  if (bucket === "current") return "current";
  if (bucket === "scheduled") return "upcoming";
  if (bucket === "draft") return "drafts";
  return "past";
}

function compareTitle(a: TipAdminListItem, b: TipAdminListItem): number {
  return a.tip.title.localeCompare(b.tip.title, "en", { sensitivity: "base" });
}

function compareDate(
  a: TipAdminListItem,
  b: TipAdminListItem,
  key: "availableFrom" | "availableThrough",
  direction: "asc" | "desc",
): number {
  const av = a.tip[key] || "";
  const bv = b.tip[key] || "";
  if (av !== bv) {
    if (!av) return 1;
    if (!bv) return -1;
    const cmp = av < bv ? -1 : 1;
    return direction === "asc" ? cmp : -cmp;
  }
  return compareTitle(a, b);
}

export function groupTipAdminItems(
  items: TipAdminListItem[],
  todayLa: string,
): TipAdminSection[] {
  const buckets: Record<TipAdminSectionKey, TipAdminListItem[]> = {
    current: [],
    upcoming: [],
    drafts: [],
    past: [],
  };
  for (const item of items) {
    buckets[tipAdminSectionKey(item.tip, todayLa)].push(item);
  }
  buckets.current.sort((a, b) => compareDate(a, b, "availableFrom", "desc"));
  buckets.upcoming.sort((a, b) => compareDate(a, b, "availableFrom", "asc"));
  buckets.drafts.sort((a, b) => {
    const updated = String(b.tip.updatedAt || "").localeCompare(String(a.tip.updatedAt || ""));
    if (updated !== 0) return updated;
    return compareTitle(a, b);
  });
  buckets.past.sort((a, b) => compareDate(a, b, "availableThrough", "desc"));

  return (Object.keys(SECTION_META) as TipAdminSectionKey[]).map((key) => ({
    key,
    id: SECTION_META[key].id,
    title: SECTION_META[key].title,
    items: buckets[key],
  }));
}

export type ArchiveSearchFields = {
  title: string;
  videoTitle: string;
  videoId: string;
};

export function archiveSearchFields(item: TipAdminListItem): ArchiveSearchFields {
  return {
    title: item.tip.title.toLowerCase(),
    videoTitle: (item.videoTitle || "").toLowerCase(),
    videoId: item.tip.videoContentId.toLowerCase(),
  };
}

/** Match the tip title, the catalog video title, or the KIN video id. */
export function archiveFieldsMatch(fields: ArchiveSearchFields, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [fields.title, fields.videoTitle, fields.videoId].some((field) =>
    field.toLowerCase().includes(q),
  );
}

export function tipMatchesArchiveQuery(item: TipAdminListItem, query: string): boolean {
  return archiveFieldsMatch(archiveSearchFields(item), query);
}

function formatTipAdminDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || "").trim());
  if (!match) return String(isoDate || "").trim();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return String(isoDate).trim();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatTipAdminDateRange(from: string, through: string): string {
  const start = formatTipAdminDate(from);
  const end = formatTipAdminDate(through);
  if (start && end) return `${start} \u2013 ${end}`;
  if (start || end) return start || end;
  return "Dates not set";
}

function toUsageRun(tip: ScheduleTip): VideoUsageRun {
  return {
    id: tip.id,
    title: tip.title,
    availableFrom: tip.availableFrom,
    availableThrough: tip.availableThrough,
    rangeLabel: formatTipAdminDateRange(tip.availableFrom, tip.availableThrough),
  };
}

function compareStartDesc(a: VideoUsageRun, b: VideoUsageRun): number {
  if (a.availableFrom !== b.availableFrom) {
    return a.availableFrom > b.availableFrom ? -1 : 1;
  }
  return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
}

function compareStartAsc(a: VideoUsageRun, b: VideoUsageRun): number {
  if (a.availableFrom !== b.availableFrom) {
    return a.availableFrom < b.availableFrom ? -1 : 1;
  }
  return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
}

/**
 * Usage for one KIN video id.
 * Drafts are ignored even when they have dates.
 * A currently public tip counts as a run and is marked live.
 * Future scheduled/active tips are returned separately and are not counted.
 * Elapsed scheduled, active, and archived windows are past scheduled runs.
 */
export function buildVideoUsageSummary(
  tips: ScheduleTip[],
  videoContentId: string,
  todayLa: string,
): VideoUsageSummary {
  const live: VideoUsageRun[] = [];
  const past: VideoUsageRun[] = [];
  const upcoming: VideoUsageRun[] = [];

  if (!String(videoContentId || "").trim()) {
    return {
      publicCount: 0,
      latestStart: null,
      latestStartLabel: null,
      live,
      past,
      upcoming,
    };
  }

  for (const tip of tips) {
    if (!sameVideoContentId(tip.videoContentId, videoContentId)) continue;
    if (tip.status === "draft") continue;
    if (tipIsPubliclyFeatured(tip, todayLa)) {
      live.push(toUsageRun(tip));
      continue;
    }
    const bucket = tipScheduleBucket(tip, todayLa);
    if (bucket === "scheduled") {
      upcoming.push(toUsageRun(tip));
      continue;
    }
    if (bucket === "expired") {
      past.push(toUsageRun(tip));
      continue;
    }
    if (
      tip.status === "archived" &&
      isIsoDateOnly(tip.availableFrom) &&
      isIsoDateOnly(tip.availableThrough) &&
      tip.availableThrough < todayLa
    ) {
      past.push(toUsageRun(tip));
    }
  }

  live.sort(compareStartDesc);
  past.sort(compareStartDesc);
  upcoming.sort(compareStartAsc);

  const publicRuns = [...live, ...past].sort(compareStartDesc);
  const latest = publicRuns[0] ?? null;

  return {
    publicCount: publicRuns.length,
    latestStart: latest?.availableFrom || null,
    latestStartLabel: latest ? formatTipAdminDate(latest.availableFrom) : null,
    live,
    past,
    upcoming,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function usageCountLine(summary: VideoUsageSummary): string {
  if (summary.publicCount === 0) return "No past runs found";
  const noun = summary.publicCount === 1 ? "public run" : "public runs";
  const parts = [`${summary.publicCount} ${noun}`];
  if (summary.latestStartLabel) parts.push(`latest started ${summary.latestStartLabel}`);
  if (summary.live.length > 0) parts.push("Live now");
  return parts.join(" · ");
}

function renderUsageRun(run: VideoUsageRun, live: boolean): string {
  const badge = live ? `<span class="watson-totw__badge">Live now</span> ` : "";
  return `<li>${badge}<span class="watson-totw__usage-title">${escapeHtml(run.title)}</span> <span class="watson-totw__usage-dates">${escapeHtml(run.rangeLabel)}</span></li>`;
}

export function renderVideoUsageHtml(summary: VideoUsageSummary): string {
  const pastInner = summary.past.length
    ? `<p class="watson-totw__usage-label">Past scheduled runs</p><ul class="watson-totw__usage-list">${summary.past
        .map((run) => renderUsageRun(run, false))
        .join("")}</ul>`
    : `<p class="watson-totw__usage-empty">No past runs found</p>`;
  const liveHtml = summary.live.length
    ? `<ul class="watson-totw__usage-list" data-video-usage-live>${summary.live
        .map((run) => renderUsageRun(run, true))
        .join("")}</ul>`
    : "";
  const upcomingHtml = summary.upcoming.length
    ? `<div data-video-usage-upcoming><h3 class="watson-totw__usage-label">Future scheduled runs</h3><ul class="watson-totw__usage-list">${summary.upcoming
        .map((run) => renderUsageRun(run, false))
        .join("")}</ul></div>`
    : "";

  return `<div class="watson-totw__usage-card">
      <p class="watson-totw__usage-summary" data-video-usage-summary>${escapeHtml(usageCountLine(summary))}</p>
      ${liveHtml}
      <details class="watson-totw__usage-past" data-video-usage-past>
        <summary>View past runs</summary>
        ${pastInner}
      </details>
      ${upcomingHtml}
      <p class="watson-totw__hint">${escapeHtml(TIP_VIDEO_USAGE_DATE_NOTE)}</p>
      <p class="watson-totw__hint">${escapeHtml(TIP_VIDEO_USAGE_LIMITATION)}</p>
    </div>`;
}

function renderReactions(item: TipAdminListItem): string {
  const rows = item.reactionRows
    .map(
      (row) =>
        `<span>${escapeHtml(row.label)} <strong>${Number(row.count) || 0}</strong></span>`,
    )
    .join("");
  const topics =
    item.topicCount > 0
      ? `<span>Topics <strong>${item.topicCount}</strong></span>`
      : "";
  if (!rows && !topics) return "";
  return `<p class="watson-totw__reactions-inline" aria-label="Reaction counts">${rows}${topics}</p>`;
}

function renderRow(item: TipAdminListItem, todayLa: string, past: boolean, hidden: boolean): string {
  const tip = item.tip;
  const fields = archiveSearchFields(item);
  const videoLabel = item.videoTitle?.trim() ? item.videoTitle.trim() : "Video unresolved";
  const hiddenAttr = hidden ? " hidden" : "";
  const pastAttr = past ? " data-totw-past-row" : "";
  return `<li class="watson-totw__row" data-totw-row${pastAttr}${hiddenAttr} data-search-title="${escapeHtml(fields.title)}" data-search-video-title="${escapeHtml(fields.videoTitle)}" data-search-video-id="${escapeHtml(fields.videoId)}">
      <div class="watson-totw__row-main">
        <div class="watson-totw__row-primary">
          <h3 class="watson-totw__row-title">${escapeHtml(tip.title)}</h3>
          <span class="watson-totw__row-dates">${escapeHtml(formatTipAdminDateRange(tip.availableFrom, tip.availableThrough))}</span>
          <span class="watson-totw__badge">${escapeHtml(tipAdminDisplayStatus(tip, todayLa))}</span>
        </div>
        ${renderReactions(item)}
        <p class="watson-totw__meta watson-totw__row-secondary">${escapeHtml(videoLabel)} · video ${escapeHtml(tip.videoContentId)} · tip ${escapeHtml(tip.tipId)}</p>
      </div>
      <div class="watson-totw__row-actions">
        <button type="button" class="watson-totw__btn watson-totw__btn--small" data-totw-edit="${escapeHtml(tip.id)}">Edit</button>
        <a class="watson-totw__btn watson-totw__btn--small watson-totw__btn--link" href="/tip-of-the-week?preview=${escapeHtml(tip.id)}" target="_blank" rel="noopener">Preview</a>
      </div>
    </li>`;
}

function renderSection(
  section: TipAdminSection,
  todayLa: string,
  archiveQuery: string,
): string {
  const isPast = section.key === "past";
  const query = isPast ? archiveQuery : "";
  const rows = section.items.map((item) =>
    renderRow(item, todayLa, isPast, isPast && !tipMatchesArchiveQuery(item, query)),
  );
  const matched = isPast
    ? section.items.filter((item) => tipMatchesArchiveQuery(item, query)).length
    : section.items.length;
  const search = isPast
    ? `<div class="watson-totw__archive-search">
        <label>
          Search past and archived
          <input type="search" class="watson__search-input" data-totw-archive-search value="${escapeHtml(query)}" placeholder="Tip title, video title, or video ID" autocomplete="off" />
        </label>
      </div>`
    : "";
  let empty = "";
  if (section.items.length === 0) {
    empty = `<p class="watson-totw__empty" data-totw-empty>None</p>`;
  } else if (isPast && query.trim() && matched === 0) {
    empty = `<p class="watson-totw__empty" data-totw-past-nomatch>No matching tips</p>`;
  }
  const list =
    section.items.length > 0
      ? `<ul class="watson-totw__rows">${rows.join("")}</ul>`
      : "";
  return `<section class="watson__panel watson-totw__group" data-totw-group="${section.key}" aria-labelledby="${section.id}">
      <h2 id="${section.id}" class="watson__panel-title">${escapeHtml(section.title)}</h2>
      ${search}
      ${empty}
      ${list}
    </section>`;
}

export function renderTipAdminBoardHtml(input: {
  todayLa: string;
  items: TipAdminListItem[];
  archiveQuery?: string;
}): string {
  const sections = groupTipAdminItems(input.items, input.todayLa);
  const query = input.archiveQuery || "";
  return sections.map((section) => renderSection(section, input.todayLa, query)).join("");
}

export function serializeTipAdminJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function isTipAdminStatus(value: unknown): value is TipOfTheWeekStatus {
  return (
    value === "draft" || value === "scheduled" || value === "active" || value === "archived"
  );
}
