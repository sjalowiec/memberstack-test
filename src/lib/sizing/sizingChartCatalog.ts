/**
 * Shared sizing chart catalog — sweater JSON URLs and reference-page metadata.
 * Used by pattern builders, the sweater sizing reference page, and (via define:vars) the general
 * sizing charts page so chart data cannot drift between surfaces.
 */

export const SWEATER_CHART_AUDIENCES = ["misses", "plus", "men", "kids", "baby"] as const;
export type SweaterChartAudience = (typeof SWEATER_CHART_AUDIENCES)[number];

/** Builder / client fetch keys ? JSON paths (same files as the reference sizing charts page). */
export const SWEATER_CHART_DATA_URLS_BY_AUDIENCE: Record<SweaterChartAudience, string> = {
  misses: "/data/sizing_sweaters_misses.json",
  plus: "/data/sizing_sweaters_plus.json",
  men: "/data/sizing_sweaters_men.json",
  kids: "/data/sizing_sweaters_kids.json",
  baby: "/data/sizing_sweaters_baby.json",
};

/** Reference page chart type ids (sweaters_* keys used by the general sizing charts UI). */
export const SWEATER_CHART_TYPE_IDS = [
  "sweaters_misses",
  "sweaters_plus",
  "sweaters_men",
  "sweaters_kids",
  "sweaters_baby",
] as const;
export type SweaterChartTypeId = (typeof SWEATER_CHART_TYPE_IDS)[number];

export const SWEATER_CHART_DATA_URLS_BY_TYPE: Record<SweaterChartTypeId, string> = {
  sweaters_misses: SWEATER_CHART_DATA_URLS_BY_AUDIENCE.misses,
  sweaters_plus: SWEATER_CHART_DATA_URLS_BY_AUDIENCE.plus,
  sweaters_men: SWEATER_CHART_DATA_URLS_BY_AUDIENCE.men,
  sweaters_kids: SWEATER_CHART_DATA_URLS_BY_AUDIENCE.kids,
  sweaters_baby: SWEATER_CHART_DATA_URLS_BY_AUDIENCE.baby,
};

export const SWEATER_CHART_METADATA: Record<
  SweaterChartTypeId,
  { label: string; icon: string; hash: string; audienceLabel: string }
> = {
  sweaters_misses: {
    label: "Sweaters - Women",
    audienceLabel: "Women",
    icon: "/images/sweater.svg",
    hash: "sweaters-misses-chart",
  },
  sweaters_plus: {
    label: "Sweaters - Plus",
    audienceLabel: "Plus",
    icon: "/images/sweater.svg",
    hash: "sweaters-plus-chart",
  },
  sweaters_men: {
    label: "Sweaters - Men",
    audienceLabel: "Men",
    icon: "/images/sweater.svg",
    hash: "sweaters-men-chart",
  },
  sweaters_kids: {
    label: "Sweaters - Kids",
    audienceLabel: "Kids",
    icon: "/images/sweater.svg",
    hash: "sweaters-kids-chart",
  },
  sweaters_baby: {
    label: "Sweaters - Baby",
    audienceLabel: "Baby",
    icon: "/images/sweater.svg",
    hash: "sweaters-baby-chart",
  },
};

/** Columns hidden from sweater reference tables (matches the general sizing charts page). */
export const SWEATER_EXCLUDED_COLUMNS: Record<SweaterChartTypeId, string[]> = {
  sweaters_men: [
    "head_circumference",
    "head circumference",
    "foot_circumference",
    "foot circumference",
    "foot_length",
    "sleeve_cap",
    "raglan_depth",
    "raglan_sleeve_top",
    "waist",
    "hip",
    "sleeve_length",
  ],
  sweaters_misses: [
    "head_circumference",
    "head circumference",
    "foot_circumference",
    "foot circumference",
    "foot_length",
    "sleeve_cap",
    "raglan_depth",
    "raglan_sleeve_top",
    "waist",
    "hip",
    "sleeve_length",
  ],
  sweaters_plus: [
    "head_circumference",
    "head circumference",
    "foot_circumference",
    "foot circumference",
    "foot_length",
    "sleeve_cap",
    "raglan_depth",
    "raglan_sleeve_top",
    "waist",
    "hip",
    "sleeve_length",
  ],
  sweaters_kids: [
    "head_circumference",
    "head circumference",
    "foot_circumference",
    "foot circumference",
    "foot_length",
    "sleeve_cap",
    "raglan_depth",
    "raglan_sleeve_top",
    "waist",
    "hip",
    "sleeve_length",
  ],
  sweaters_baby: [
    "head_circumference",
    "head circumference",
    "foot_circumference",
    "foot circumference",
    "foot_length",
    "sleeve_cap",
    "raglan_depth",
    "raglan_sleeve_top",
    "waist",
    "hip",
    "sleeve_length",
  ],
};

/** Full catalog for the general sizing charts page (sweater + non-sweater types). */
export const ALL_SIZING_CHART_DATA_URLS: Record<string, string> = {
  ...SWEATER_CHART_DATA_URLS_BY_TYPE,
  hats: "/data/sizing_hats.json",
  mittens: "/data/sizing_mittens.json",
  socks: "/data/sizing_socks.json",
  blankets: "/data/sizing_blankets.json",
  pillows: "/data/sizing_pillows.json",
  xmas_stockings: "/data/sizing_xmas_stockings.json",
};

export const ALL_SIZING_CHART_METADATA: Record<string, { label: string; icon: string; hash: string }> = {
  ...Object.fromEntries(
    Object.entries(SWEATER_CHART_METADATA).map(([key, meta]) => [
      key,
      { label: meta.label, icon: meta.icon, hash: meta.hash },
    ]),
  ),
  hats: { label: "Hats Sizing Chart", icon: "/images/hat.svg", hash: "hats-chart" },
  mittens: { label: "Mittens Sizing Chart", icon: "/images/mitten.svg", hash: "mittens-chart" },
  socks: { label: "Socks Sizing Chart", icon: "/images/sock.svg", hash: "socks-chart" },
  blankets: { label: "Blankets Sizing Chart", icon: "/images/blanket.svg", hash: "blankets-chart" },
  pillows: { label: "Pillows Sizing Chart", icon: "/images/pillow.svg", hash: "pillows-chart" },
  xmas_stockings: {
    label: "Christmas Stockings Sizing Chart",
    icon: "/images/stocking.svg",
    hash: "xmas-stockings-chart",
  },
};

export const BODY_MEASUREMENT_CHART_TYPES = new Set([
  "sweaters_men",
  "sweaters_misses",
  "sweaters_plus",
  "sweaters_kids",
  "sweaters_baby",
  "socks",
  "mittens",
]);

export const SIZING_CHART_CUSTOM_HEADERS: Record<string, Record<string, string>> = {
  mittens: {
    cuff_circumference: "Cuff<br>Circ.",
    cuff_length: "Cuff<br>Length",
    hand_circumference: "Hand<br>Circ.",
    hand_length: "Hand<br>Length",
    thumb_length: "Thumb<br>Length",
    thumb_opening: "Thumb<br>Opening",
  },
  hats: {
    circumference: "Head<br>Circ.",
    hatLength: "Hat<br>Length",
    suggestedCrownDepth: "Suggested<br>Crown Depth",
  },
  pillows: {
    hatLength: "Depth",
  },
};

export const DEFAULT_SWEATER_CHART_TYPE: SweaterChartTypeId = "sweaters_misses";
