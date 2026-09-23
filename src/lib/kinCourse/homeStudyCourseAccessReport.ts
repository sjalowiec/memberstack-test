/**
 * Course-by-course Home Study access report.
 *
 * Player titles come from ported course JSON (`legacyChallengeId`). They are
 * not Home Study catalog titles. Purchase playback is listed only for the
 * explicit map in homeStudyCourseMap. Nothing in this report offers a download.
 */
import {
  HOME_STUDY_COURSE_ID_CONFLICTS,
  isUnresolvedHomeStudyCourseId,
  verifiedHomeStudyPlaybackCourse,
} from "../../config/homeStudyCourseMap";
import { listAdminCourseSummaries, type AdminCourseSummary } from "../legacy_kin/courseContentAdmin";

export type HomeStudyLibraryCourseCounts = {
  courseId: number;
  subscriberFreeRows: number;
  candidateRows: number;
  verifiedRows: number;
};

export type HomeStudyCourseAccessReportRow = {
  homeStudyCourseId: number | null;
  sitePlayerId: number | null;
  sitePlayerTitle: string | null;
  mapping: "verified_site_product" | "unresolved_title_conflict" | "unmapped_player" | "no_player";
  playback: "available" | "not_available";
  subscriberFreeRows: number | null;
  candidateRows: number | null;
  verifiedPurchaseRows: number | null;
  needed: string;
};

const NO_DOWNLOAD =
  "Do not label this course accessible and do not promise a download.";

function countsFor(
  courseId: number | null,
  counts: readonly HomeStudyLibraryCourseCounts[],
): Pick<
  HomeStudyCourseAccessReportRow,
  "subscriberFreeRows" | "candidateRows" | "verifiedPurchaseRows"
> {
  if (courseId == null) {
    return { subscriberFreeRows: null, candidateRows: null, verifiedPurchaseRows: null };
  }
  const match = counts.find((row) => row.courseId === courseId);
  if (!match) {
    return { subscriberFreeRows: null, candidateRows: null, verifiedPurchaseRows: null };
  }
  return {
    subscriberFreeRows: match.subscriberFreeRows,
    candidateRows: match.candidateRows,
    verifiedPurchaseRows: match.verifiedRows,
  };
}

function rowForPlayer(
  course: AdminCourseSummary,
  counts: readonly HomeStudyLibraryCourseCounts[],
): HomeStudyCourseAccessReportRow {
  const conflict = isUnresolvedHomeStudyCourseId(course.id);
  const mapped = verifiedHomeStudyPlaybackCourse(course.id);
  const playbackReady = Boolean(mapped) && course.isPublic && !conflict;
  let mapping: HomeStudyCourseAccessReportRow["mapping"] = "unmapped_player";
  let needed = `Player content exists under legacyChallengeId ${course.id}. That id is not confirmed as a Home Study course id. Needed: compare the Home Study course title for this id with the player title before adding it to the verified map. ${NO_DOWNLOAD}`;
  if (conflict) {
    mapping = "unresolved_title_conflict";
    needed = `Title conflict for id ${course.id}. ${NO_DOWNLOAD}`;
  } else if (mapped) {
    mapping = "verified_site_product";
    needed = playbackReady
      ? "Verified purchases of this Home Study course id can open the existing course page. Credit evidence must still be imported on DEV before any customer is granted that purchase."
      : `Mapped, but the player is not public. ${NO_DOWNLOAD}`;
  }
  return {
    homeStudyCourseId: mapped || conflict ? course.id : null,
    sitePlayerId: course.id,
    sitePlayerTitle: course.title,
    mapping,
    playback: playbackReady ? "available" : "not_available",
    ...countsFor(mapped || conflict ? course.id : null, counts),
    needed,
  };
}

export type HomeStudyCourseAccessReport = {
  /** Ported player files. Titles are challenge/player titles, not Home Study titles. */
  players: HomeStudyCourseAccessReportRow[];
  /** Library ids with no confirmed Home Study → player map. Counts are not joined to player titles. */
  unmappedLibraryCourses: HomeStudyCourseAccessReportRow[];
};

export function buildHomeStudyCourseAccessReport(input: {
  players: readonly AdminCourseSummary[];
  counts?: readonly HomeStudyLibraryCourseCounts[];
}): HomeStudyCourseAccessReport {
  const counts = input.counts ?? [];
  const players = input.players.map((course) => rowForPlayer(course, counts));
  const playerIds = new Set(input.players.map((course) => course.id));

  for (const conflict of HOME_STUDY_COURSE_ID_CONFLICTS) {
    if (playerIds.has(conflict.homeStudyCourseId)) continue;
    players.push({
      homeStudyCourseId: conflict.homeStudyCourseId,
      sitePlayerId: null,
      sitePlayerTitle: null,
      mapping: "unresolved_title_conflict",
      playback: "not_available",
      ...countsFor(conflict.homeStudyCourseId, counts),
      needed: `Home Study id ${conflict.homeStudyCourseId} was reported as "${conflict.libraryTitleFromAudit}". The challenges export titles id ${conflict.homeStudyCourseId} as "${conflict.challengesIndexTitle}" and id ${conflict.challengesIndexIdForLibraryTitle} as the cocoon title. No ported page is tied to this id. ${NO_DOWNLOAD}`,
    });
  }

  const unmappedLibraryCourses: HomeStudyCourseAccessReportRow[] = [];
  for (const count of counts) {
    if (verifiedHomeStudyPlaybackCourse(count.courseId)) continue;
    if (isUnresolvedHomeStudyCourseId(count.courseId)) continue;
    unmappedLibraryCourses.push({
      homeStudyCourseId: count.courseId,
      sitePlayerId: playerIds.has(count.courseId) ? count.courseId : null,
      sitePlayerTitle: null,
      mapping: "no_player",
      playback: "not_available",
      subscriberFreeRows: count.subscriberFreeRows,
      candidateRows: count.candidateRows,
      verifiedPurchaseRows: count.verifiedRows,
      needed: playerIds.has(count.courseId)
        ? `Library course id ${count.courseId} uses the same number as a player file. The titles have not been compared, so playback stays off. ${NO_DOWNLOAD}`
        : `Library course id ${count.courseId} has no mapped player. ${NO_DOWNLOAD}`,
    });
  }

  const byId = (a: HomeStudyCourseAccessReportRow, b: HomeStudyCourseAccessReportRow) => {
    const aId = a.sitePlayerId ?? a.homeStudyCourseId ?? 0;
    const bId = b.sitePlayerId ?? b.homeStudyCourseId ?? 0;
    return aId - bId;
  };
  players.sort(byId);
  unmappedLibraryCourses.sort(byId);
  return { players, unmappedLibraryCourses };
}

export function loadHomeStudySitePlayerInventory(): AdminCourseSummary[] {
  return listAdminCourseSummaries();
}
