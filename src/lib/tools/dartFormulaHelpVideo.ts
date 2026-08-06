/**
 * Shared bust-dart help video (Dart Formula Tool + finished-pattern Optional Bust Dart).
 * Learning Library content_id lookup for KinCatalogVideoModal — no hardcoded Vimeo URLs.
 */
import {
  sleevelessHelpVideoFromCatalog,
  type SleevelessHelpVideoMeta,
} from "../patterns/sleevelessCatalogHelpVideo";
import type { PublicVideoRow } from "../lessonVideo";

/** Learning Library catalog content_id for “Adding Bust Darts” / Bust Darts for Better Fit. */
export const BUST_DART_HELP_VIDEO_CONTENT_ID = 643;

/** @deprecated Prefer {@link BUST_DART_HELP_VIDEO_CONTENT_ID}. */
export const DART_FORMULA_HELP_VIDEO_CONTENT_ID = BUST_DART_HELP_VIDEO_CONTENT_ID;

export const BUST_DART_HELP_WATCH_LABEL = "Watch: Bust Darts for Better Fit";

/** @deprecated Prefer {@link BUST_DART_HELP_WATCH_LABEL}. */
export const DART_FORMULA_HELP_BUTTON_LABEL = BUST_DART_HELP_WATCH_LABEL;

/** Dart Formula Tool callout heading. */
export const DART_FORMULA_HELP_HEADING = "New to Bust Darts?";

/** Dart Formula Tool callout body. */
export const DART_FORMULA_HELP_DESCRIPTION =
  "Learn why bust darts improve sweater fit, how to determine their placement, width, and depth, and how the short-row shaping is worked.";

/** Compact note inside the inactive Front BODY Optional Bust Dart prompt. */
export const BUST_DART_INACTIVE_HELP_NOTE =
  "Not sure whether you need a bust dart? Learn how bust darts improve sweater fit and how to determine the right placement, width, and depth.";

/** Compact heading inside the Add/Update Bust Dart modal. */
export const BUST_DART_MODAL_HELP_HEADING = "New to bust darts?";

/** Compact body inside the Add/Update Bust Dart modal. */
export const BUST_DART_MODAL_HELP_DESCRIPTION =
  "Learn how bust darts improve sweater fit and how to determine the right placement, width, and depth.";

export function resolveBustDartHelpVideo(
  catalog?: PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(BUST_DART_HELP_VIDEO_CONTENT_ID, catalog);
}

/** Alias used by the Dart Formula Tool page. */
export const resolveDartFormulaHelpVideo = resolveBustDartHelpVideo;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type BustDartHelpWatchButtonOptions = {
  /** Extra CSS classes (in addition to kbm-kin-catalog-video). */
  className?: string;
  /** data-testid for the Watch control. */
  testId: string;
};

/**
 * KinCatalogVideoModal trigger. Returns "" when the catalog row cannot be resolved
 * so callers never show a dead Watch button.
 */
export function renderBustDartHelpWatchButtonHtml(
  video: SleevelessHelpVideoMeta | null,
  options: BustDartHelpWatchButtonOptions,
): string {
  if (!video) return "";
  const chaptersAttr =
    video.jumpLinks.length > 0
      ? ` data-video-chapters="${escapeHtml(
          JSON.stringify(
            video.jumpLinks.map((j) => ({ label: j.label, time: j.seconds })),
          ),
        )}"`
      : "";
  const extraClass = options.className ? ` ${options.className}` : "";
  return `<button
      type="button"
      class="kbm-kin-catalog-video${extraClass}"
      data-vimeo-id="${escapeHtml(video.id)}"
      data-video-title="${escapeHtml(video.title)}"
      data-testid="${escapeHtml(options.testId)}"
      data-bust-dart-help-content-id="${BUST_DART_HELP_VIDEO_CONTENT_ID}"
      data-dart-formula-help-content-id="${BUST_DART_HELP_VIDEO_CONTENT_ID}"${chaptersAttr}
    >${escapeHtml(BUST_DART_HELP_WATCH_LABEL)}</button>`;
}

/**
 * Compact help callout HTML for the Dart Formula Tool.
 * When catalog resolution fails, heading + description still render; the Watch button is omitted.
 */
export function renderDartFormulaHelpSectionHtml(
  video: SleevelessHelpVideoMeta | null = resolveBustDartHelpVideo(),
): string {
  const button = renderBustDartHelpWatchButtonHtml(video, {
    className: "dart-formula-help__watch wizard-button",
    testId: "button-dart-formula-help-video",
  });

  return `<section class="kbm-intro-callout dart-formula-help" aria-labelledby="dart-formula-help-heading" data-dart-formula-help data-content-id="${BUST_DART_HELP_VIDEO_CONTENT_ID}">
  <strong id="dart-formula-help-heading">${escapeHtml(DART_FORMULA_HELP_HEADING)}</strong>
  <p class="dart-formula-help__desc">${escapeHtml(DART_FORMULA_HELP_DESCRIPTION)}</p>
  ${button}
</section>`;
}

/**
 * Help note + Watch control for the inactive Front BODY Optional Bust Dart tip.
 * Returns "" when the video cannot be resolved (no dead button).
 */
export function renderBustDartInactivePromptHelpHtml(
  video: SleevelessHelpVideoMeta | null = resolveBustDartHelpVideo(),
): string {
  const button = renderBustDartHelpWatchButtonHtml(video, {
    className: "bust-dart-front-slot__watch sleeveless-pattern-edit-action",
    testId: "button-bust-dart-front-help-video",
  });
  if (!button) return "";
  return `<div class="bust-dart-front-slot__help no-print" data-bust-dart-front-help data-content-id="${BUST_DART_HELP_VIDEO_CONTENT_ID}">
  <p class="bust-dart-front-slot__help-note">${escapeHtml(BUST_DART_INACTIVE_HELP_NOTE)}</p>
  ${button}
</div>`;
}

/**
 * Compact help for the Add/Update Bust Dart modal.
 * Returns "" when the video cannot be resolved.
 */
export function renderBustDartModalHelpHtml(
  video: SleevelessHelpVideoMeta | null = resolveBustDartHelpVideo(),
): string {
  const button = renderBustDartHelpWatchButtonHtml(video, {
    className: "bust-dart-pattern-modal__watch btn btn-outline-secondary",
    testId: "button-bust-dart-modal-help-video",
  });
  if (!button) return "";
  return `<aside class="bust-dart-pattern-modal__help" data-bust-dart-modal-help data-content-id="${BUST_DART_HELP_VIDEO_CONTENT_ID}" aria-labelledby="bust-dart-modal-help-heading">
  <strong id="bust-dart-modal-help-heading" class="bust-dart-pattern-modal__help-title">${escapeHtml(BUST_DART_MODAL_HELP_HEADING)}</strong>
  <p class="bust-dart-pattern-modal__help-desc">${escapeHtml(BUST_DART_MODAL_HELP_DESCRIPTION)}</p>
  ${button}
</aside>`;
}
