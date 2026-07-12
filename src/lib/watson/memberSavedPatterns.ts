import { hasDisplayValue } from "./memberDetail";
import {
  formatLegacyIntegerFlag,
  formatLegacyTimestampDisplay,
  formatLegacyTimestampSort,
} from "./memberMembership";
import { type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export interface LegacyMemberPatternDetailsRow {
  detailid: string | number;
  member_fk: string;
  garmentid_fk: string | null;
  builddate: Date | string | null;
  libraryid_fk: string | null;
  buildnotes: string | null;
  buildid: string | null;
  size: string | null;
  patterntype: string | null;
  gaugesizing: string | null;
  challengeid_fk: string | null;
  challengepatternname: string | null;
  customfit: number | null;
  customname: string | null;
  sizingsizeid: string | null;
  issuewithpattern: number | null;
  issuewithpatternmarker: number | null;
  neckshape: string | null;
  garmentstyle: string | null;
  datatoggles: string | null;
  patternidlist: string | null;
  fixed: number | null;
}

export interface MemberSavedPatternDisplay {
  detailId: string;
  patternName: string | null;
  savedDate: string | null;
  savedDateSort: string;
  patternType: string | null;
  garmentStyle: string | null;
  gaugeSizing: string | null;
  size: string | null;
  neckShape: string | null;
  libraryId: string | null;
  garmentId: string | null;
  buildId: string | null;
  challengeId: string | null;
  customName: string | null;
  challengePatternName: string | null;
  buildNotes: string | null;
  sizingSizeId: string | null;
  customFitFlag: string | null;
  issueWithPatternFlag: string | null;
  issueWithPatternMarkerFlag: string | null;
  patternIdList: string | null;
  fixedFlag: string | null;
  dataToggles: string | null;
}

export const MEMBER_SAVED_PATTERNS_TABLE = "legacy_member_pattern_details";

export const MEMBER_SAVED_PATTERNS_SQL = `
  SELECT
    detailid,
    member_fk,
    garmentid_fk,
    builddate,
    libraryid_fk,
    buildnotes,
    buildid,
    size,
    patterntype,
    gaugesizing,
    challengeid_fk,
    challengepatternname,
    customfit,
    customname,
    sizingsizeid,
    issuewithpattern,
    issuewithpatternmarker,
    neckshape,
    garmentstyle,
    datatoggles,
    patternidlist,
    fixed
  FROM ${MEMBER_SAVED_PATTERNS_TABLE}
  WHERE member_fk = $1
  ORDER BY builddate DESC NULLS LAST, detailid DESC
`;

export const MEMBER_SAVED_PATTERN_COUNT_SQL = `
  SELECT COUNT(*)::text AS pattern_count
  FROM ${MEMBER_SAVED_PATTERNS_TABLE}
  WHERE member_fk = $1
`;

export const MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS = [
  "detailId",
  "patternName",
  "savedDate",
  "patternType",
  "garmentStyle",
  "gaugeSizing",
  "size",
  "neckShape",
  "libraryId",
  "garmentId",
  "buildId",
  "challengeId",
  "customName",
  "challengePatternName",
  "buildNotes",
  "sizingSizeId",
  "customFitFlag",
  "issueWithPatternFlag",
  "issueWithPatternMarkerFlag",
  "patternIdList",
  "fixedFlag",
  "dataToggles",
] as const;

function trimLegacyText(value: string | null | undefined): string | null {
  if (!hasDisplayValue(value)) {
    return null;
  }
  return String(value).trim();
}

export function buildSavedPatternName(
  row: Pick<LegacyMemberPatternDetailsRow, "customname" | "challengepatternname">,
): string | null {
  const customName = trimLegacyText(row.customname);
  if (customName) {
    return customName;
  }
  return trimLegacyText(row.challengepatternname);
}

export function buildSavedPatternDisplay(row: LegacyMemberPatternDetailsRow): MemberSavedPatternDisplay {
  return {
    detailId: String(row.detailid),
    patternName: buildSavedPatternName(row),
    savedDate: formatLegacyTimestampDisplay(row.builddate),
    savedDateSort: formatLegacyTimestampSort(row.builddate),
    patternType: trimLegacyText(row.patterntype),
    garmentStyle: trimLegacyText(row.garmentstyle),
    gaugeSizing: trimLegacyText(row.gaugesizing),
    size: trimLegacyText(row.size),
    neckShape: trimLegacyText(row.neckshape),
    libraryId: trimLegacyText(row.libraryid_fk),
    garmentId: trimLegacyText(row.garmentid_fk),
    buildId: trimLegacyText(row.buildid),
    challengeId: trimLegacyText(row.challengeid_fk),
    customName: trimLegacyText(row.customname),
    challengePatternName: trimLegacyText(row.challengepatternname),
    buildNotes: trimLegacyText(row.buildnotes),
    sizingSizeId: trimLegacyText(row.sizingsizeid),
    customFitFlag: formatLegacyIntegerFlag(row.customfit),
    issueWithPatternFlag: formatLegacyIntegerFlag(row.issuewithpattern),
    issueWithPatternMarkerFlag: formatLegacyIntegerFlag(row.issuewithpatternmarker),
    patternIdList: trimLegacyText(row.patternidlist),
    fixedFlag: formatLegacyIntegerFlag(row.fixed),
    dataToggles: trimLegacyText(row.datatoggles),
  };
}

export function getVisibleSavedPatternColumns(records: MemberSavedPatternDisplay[]): {
  showPatternName: boolean;
  showSavedDate: boolean;
  showPatternType: boolean;
  showGarmentStyle: boolean;
  showGaugeSizing: boolean;
  showSize: boolean;
  showNeckShape: boolean;
  showLibraryId: boolean;
  showGarmentId: boolean;
  showBuildId: boolean;
  showChallengeId: boolean;
  showCustomName: boolean;
  showChallengePatternName: boolean;
  showBuildNotes: boolean;
  showSizingSizeId: boolean;
  showCustomFitFlag: boolean;
  showIssueWithPatternFlag: boolean;
  showIssueWithPatternMarkerFlag: boolean;
  showPatternIdList: boolean;
  showFixedFlag: boolean;
  showDataToggles: boolean;
} {
  const hasValue = (getter: (record: MemberSavedPatternDisplay) => string | null) =>
    records.some((record) => getter(record) != null);

  const showCustomName = hasValue((record) => record.customName);
  const showChallengePatternName = hasValue((record) => record.challengePatternName);
  const showPatternName =
    hasValue((record) => record.patternName) &&
    !(showCustomName && showChallengePatternName);

  return {
    showPatternName,
    showSavedDate: hasValue((record) => record.savedDate),
    showPatternType: hasValue((record) => record.patternType),
    showGarmentStyle: hasValue((record) => record.garmentStyle),
    showGaugeSizing: hasValue((record) => record.gaugeSizing),
    showSize: hasValue((record) => record.size),
    showNeckShape: hasValue((record) => record.neckShape),
    showLibraryId: hasValue((record) => record.libraryId),
    showGarmentId: hasValue((record) => record.garmentId),
    showBuildId: hasValue((record) => record.buildId),
    showChallengeId: hasValue((record) => record.challengeId),
    showCustomName,
    showChallengePatternName,
    showBuildNotes: hasValue((record) => record.buildNotes),
    showSizingSizeId: hasValue((record) => record.sizingSizeId),
    showCustomFitFlag: hasValue((record) => record.customFitFlag),
    showIssueWithPatternFlag: hasValue((record) => record.issueWithPatternFlag),
    showIssueWithPatternMarkerFlag: hasValue((record) => record.issueWithPatternMarkerFlag),
    showPatternIdList: hasValue((record) => record.patternIdList),
    showFixedFlag: hasValue((record) => record.fixedFlag),
    showDataToggles: hasValue((record) => record.dataToggles),
  };
}

export async function getMemberSavedPatternCount(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const normalized = memberid.trim();
  if (!normalized) {
    return 0;
  }

  const rows = await queryFn<{ pattern_count: string }>(MEMBER_SAVED_PATTERN_COUNT_SQL, [
    normalized,
  ]);
  const count = Number.parseInt(rows[0]?.pattern_count ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getMemberSavedPatterns(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberSavedPatternDisplay[]> {
  const normalized = memberid.trim();
  if (!normalized) {
    return [];
  }

  const rows = await queryFn<LegacyMemberPatternDetailsRow>(MEMBER_SAVED_PATTERNS_SQL, [
    normalized,
  ]);
  return rows.map(buildSavedPatternDisplay);
}
