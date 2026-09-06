import { hasDisplayValue } from "./memberDetail";
import {
  formatLegacyIntegerFlag,
  formatLegacyTimestampDisplay,
  formatLegacyTimestampSort,
} from "./memberMembership";
import { type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export const FALLBACK_SAVED_PATTERN_NAME = "Legacy saved pattern";
export const WATSON_LEGACY_GARMENTS_TABLE = "watson_legacy_garments";

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
  garment_title?: string | null;
  garment_description?: string | null;
}

export interface MemberSavedPatternDisplay {
  detailId: string;
  patternName: string;
  garmentDescription: string | null;
  garmentDescriptionPreview: string | null;
  savedAs: string | null;
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
    d.detailid,
    d.member_fk,
    d.garmentid_fk,
    d.builddate,
    d.libraryid_fk,
    d.buildnotes,
    d.buildid,
    d.size,
    d.patterntype,
    d.gaugesizing,
    d.challengeid_fk,
    d.challengepatternname,
    d.customfit,
    d.customname,
    d.sizingsizeid,
    d.issuewithpattern,
    d.issuewithpatternmarker,
    d.neckshape,
    d.garmentstyle,
    d.datatoggles,
    d.patternidlist,
    d.fixed,
    g.garment_title,
    g.garment_description
  FROM ${MEMBER_SAVED_PATTERNS_TABLE} d
  LEFT JOIN ${WATSON_LEGACY_GARMENTS_TABLE} g
    ON g.garment_id = d.garmentid_fk
  WHERE d.member_fk = $1
  ORDER BY d.builddate DESC NULLS LAST, d.detailid DESC
`;

export const MEMBER_SAVED_PATTERN_COUNT_SQL = `
  SELECT COUNT(*)::text AS pattern_count
  FROM ${MEMBER_SAVED_PATTERNS_TABLE}
  WHERE member_fk = $1
`;

export const MEMBER_SAVED_PATTERN_SORTABLE_COLUMNS = [
  "patternName",
  "savedAs",
  "savedDate",
  "size",
  "buildNotes",
] as const;

function trimLegacyText(value: string | null | undefined): string | null {
  if (!hasDisplayValue(value)) {
    return null;
  }
  return String(value).trim();
}

export function buildSavedPatternName(
  row: Pick<
    LegacyMemberPatternDetailsRow,
    "customname" | "challengepatternname" | "garment_title"
  >,
): string {
  const garmentTitle = trimLegacyText(row.garment_title);
  if (garmentTitle) {
    return garmentTitle;
  }
  const customName = trimLegacyText(row.customname);
  if (customName) {
    return customName;
  }
  const challengePatternName = trimLegacyText(row.challengepatternname);
  if (challengePatternName) {
    return challengePatternName;
  }
  return FALLBACK_SAVED_PATTERN_NAME;
}

export function buildSavedAsName(
  row: Pick<LegacyMemberPatternDetailsRow, "customname">,
): string | null {
  return trimLegacyText(row.customname);
}

export const GARMENT_DESCRIPTION_PREVIEW_LIMIT = 60;

export function buildGarmentDescription(
  row: Pick<LegacyMemberPatternDetailsRow, "garment_title" | "garment_description">,
): string | null {
  if (!trimLegacyText(row.garment_title)) {
    return null;
  }
  return trimLegacyText(row.garment_description);
}

/** Compact Saved Patterns preview. Does not change stored garment_description. */
export function formatGarmentDescriptionPreview(description: string | null | undefined): string | null {
  const compact = trimLegacyText(description)?.replace(/\s+/g, " ") ?? null;
  if (!compact) {
    return null;
  }
  if (compact.length <= GARMENT_DESCRIPTION_PREVIEW_LIMIT) {
    return compact;
  }

  const slice = compact.slice(0, GARMENT_DESCRIPTION_PREVIEW_LIMIT);
  const lastSpace = slice.lastIndexOf(" ");
  const clipped = (lastSpace >= 40 ? slice.slice(0, lastSpace) : slice).replace(/[.,;:]+$/, "");
  return `${clipped}...`;
}

export function buildSavedPatternDisplay(row: LegacyMemberPatternDetailsRow): MemberSavedPatternDisplay {
  const garmentDescription = buildGarmentDescription(row);
  return {
    detailId: String(row.detailid),
    patternName: buildSavedPatternName(row),
    garmentDescription,
    garmentDescriptionPreview: formatGarmentDescriptionPreview(garmentDescription),
    savedAs: buildSavedAsName(row),
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
  showSavedAs: boolean;
  showSavedDate: boolean;
  showSize: boolean;
  showBuildNotes: boolean;
} {
  const hasValue = (getter: (record: MemberSavedPatternDisplay) => string | null) =>
    records.some((record) => getter(record) != null);

  return {
    showPatternName: records.length > 0,
    showSavedAs: hasValue((record) => record.savedAs),
    showSavedDate: hasValue((record) => record.savedDate),
    showSize: hasValue((record) => record.size),
    showBuildNotes: hasValue((record) => record.buildNotes),
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
