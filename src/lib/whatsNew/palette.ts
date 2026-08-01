import type { WhatsNewBoardColumn, WhatsNewCategory } from "./types";

/**
 * Sue's pinwheel brand palette for What’s New accents only.
 * Do not use these to replace site-wide --kbm-* brand tokens.
 */
export const WHATS_NEW_PINWHEEL = {
  deepRed: "#8a1e1d",
  brightRed: "#be352f",
  orange: "#d36835",
  amber: "#de9643",
  softGold: "#e7c677",
  lightGreen: "#acc37e",
  midGreen: "#769e5e",
  green: "#588450",
  teal: "#325b5d",
  blue: "#2b4859",
  indigo: "#33355a",
  plum: "#5c254b",
} as const;

export type WhatsNewPinwheelColor =
  (typeof WHATS_NEW_PINWHEEL)[keyof typeof WHATS_NEW_PINWHEEL];

/** Mix a hex color toward white for soft badge / featured backgrounds. */
export function softTint(hex: string, amount = 0.14): string {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#f7f8f7";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const mix = (channel: number) =>
    Math.round(channel * amount + 255 * (1 - amount));
  const toHex = (channel: number) => mix(channel).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export type WhatsNewCategoryAccent = {
  accent: string;
  soft: string;
  label: string;
};

/** Category accent assignments — used on public cards and Watson board cards. */
export const WHATS_NEW_CATEGORY_ACCENTS: Record<
  WhatsNewCategory,
  WhatsNewCategoryAccent
> = {
  tool: {
    accent: WHATS_NEW_PINWHEEL.blue,
    soft: softTint(WHATS_NEW_PINWHEEL.blue),
    label: WHATS_NEW_PINWHEEL.blue,
  },
  pattern: {
    accent: WHATS_NEW_PINWHEEL.plum,
    soft: softTint(WHATS_NEW_PINWHEEL.plum),
    label: WHATS_NEW_PINWHEEL.plum,
  },
  resource: {
    accent: WHATS_NEW_PINWHEEL.indigo,
    soft: softTint(WHATS_NEW_PINWHEEL.indigo),
    label: WHATS_NEW_PINWHEEL.indigo,
  },
  learning: {
    accent: WHATS_NEW_PINWHEEL.orange,
    soft: softTint(WHATS_NEW_PINWHEEL.orange),
    label: WHATS_NEW_PINWHEEL.orange,
  },
  improvement: {
    accent: WHATS_NEW_PINWHEEL.green,
    soft: softTint(WHATS_NEW_PINWHEEL.green),
    label: WHATS_NEW_PINWHEEL.green,
  },
};

export const WHATS_NEW_COLUMN_ACCENTS: Record<WhatsNewBoardColumn, string> = {
  just_added: WHATS_NEW_PINWHEEL.brightRed,
  worth_exploring: WHATS_NEW_PINWHEEL.teal,
  in_the_pipeline: WHATS_NEW_PINWHEEL.amber,
};

export const WHATS_NEW_BADGE_COLORS = {
  newBackground: WHATS_NEW_PINWHEEL.deepRed,
  newText: "#ffffff",
  featuredBackground: WHATS_NEW_PINWHEEL.plum,
  featuredText: "#ffffff",
} as const;

/** Subtle decorative surfaces from the lighter pinwheel colors. */
export const WHATS_NEW_SURFACE_COLORS = {
  boardBorder: softTint(WHATS_NEW_PINWHEEL.midGreen, 0.35),
  columnBackground: softTint(WHATS_NEW_PINWHEEL.lightGreen, 0.1),
  videoBackgroundStart: softTint(WHATS_NEW_PINWHEEL.softGold, 0.22),
  videoBackgroundMid: "#f8f7f2",
  videoBackgroundEnd: softTint(WHATS_NEW_PINWHEEL.lightGreen, 0.16),
  videoBorder: softTint(WHATS_NEW_PINWHEEL.midGreen, 0.4),
} as const;

export function whatsNewCategoryCardStyle(category: WhatsNewCategory): string {
  const accent = WHATS_NEW_CATEGORY_ACCENTS[category];
  return [
    `--wn-accent: ${accent.accent}`,
    `--wn-soft: ${accent.soft}`,
    `--wn-label: ${accent.label}`,
  ].join("; ");
}

/** CSS custom properties for board chrome, badges, and surfaces. */
export function whatsNewThemeStyle(): string {
  return [
    `--wn-col-just-added: ${WHATS_NEW_COLUMN_ACCENTS.just_added}`,
    `--wn-col-worth-exploring: ${WHATS_NEW_COLUMN_ACCENTS.worth_exploring}`,
    `--wn-col-in-the-pipeline: ${WHATS_NEW_COLUMN_ACCENTS.in_the_pipeline}`,
    `--wn-badge-new-bg: ${WHATS_NEW_BADGE_COLORS.newBackground}`,
    `--wn-badge-new-text: ${WHATS_NEW_BADGE_COLORS.newText}`,
    `--wn-badge-featured-bg: ${WHATS_NEW_BADGE_COLORS.featuredBackground}`,
    `--wn-badge-featured-text: ${WHATS_NEW_BADGE_COLORS.featuredText}`,
    `--wn-board-border: ${WHATS_NEW_SURFACE_COLORS.boardBorder}`,
    `--wn-column-bg: ${WHATS_NEW_SURFACE_COLORS.columnBackground}`,
    `--wn-video-bg-start: ${WHATS_NEW_SURFACE_COLORS.videoBackgroundStart}`,
    `--wn-video-bg-mid: ${WHATS_NEW_SURFACE_COLORS.videoBackgroundMid}`,
    `--wn-video-bg-end: ${WHATS_NEW_SURFACE_COLORS.videoBackgroundEnd}`,
    `--wn-video-border: ${WHATS_NEW_SURFACE_COLORS.videoBorder}`,
  ].join("; ");
}
