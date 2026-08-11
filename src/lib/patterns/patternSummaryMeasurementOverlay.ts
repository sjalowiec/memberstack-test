/**
 * Position HTML measurement overlay chips on pattern_summary.svg target anchors.
 * Targets are green/orange circles in the SVG (left visible intentionally).
 *
 * Mode is based on the diagram/stage width (ResizeObserver), not viewport width:
 * - Wide stage: center each chip on its SVG target.
 * - Narrow stage: clear inline coords so shared CSS stacks editable chips in a
 *   labeled Measurements panel under the diagram.
 *
 * Threshold selected from crowded-target overlap sweeps (Sleeveless neck cluster +
 * Drop Shoulder cuff/wrist) for inches and centimeters, plus a readability margin.
 */

export const PATTERN_SUMMARY_MEASUREMENT_TARGETS = {
  neckOpening: "target_neck_opening",
  neckDepth: "target_neck_depth",
  chest: "target_chest",
  bust: "target_bust",
  garmentLength: "target_garment_length",
  hip: "target_hip",
  armholeDepth: "target_armhole_depth",
  hem: "target_hem",
  // Legacy drop-shoulder-summary.svg sleeve targets (superseded by drop_shoulder_summary.svg).
  upperArm: "target_upper_arm",
  cuffCircumference: "target_cuff_circumference",
  armLength: "target_arm_length",
} as const;

/** Drop Shoulder summary blueprint (`drop_shoulder_summary.svg`) — orange target_* anchors only. */
export const DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS = {
  neckOpening: "target_neck_width",
  neckDepth: "target_neck_depth",
  bust: "target_bust_circ",
  garmentLength: "target_body_length",
  hip: "target_hem_width",
  hem: "target_hem_depth",
  armholeDepth: "target_armhole_depth",
  upperArm: "target_upper_arm",
  armLength: "target_arm_length",
  cuffCircumference: "target_wrist",
  cuffDepth: "target_cuff_depth",
} as const;

/** SVG typo alias for garment-length target (`target_garmemt_length`). */
const GARMENT_LENGTH_TARGET_TYPO_ID = "target_garmemt_length";

export type SvgViewBoxSize = { width: number; height: number };

/** Parse an SVG viewBox attribute into width/height (user units). */
export function parseSvgViewBoxSize(svg: Pick<SVGElement, "getAttribute">): SvgViewBoxSize | null {
  const viewBox = svg.getAttribute("viewBox")?.trim();
  if (!viewBox) return null;
  const parts = viewBox.split(/[\s,]+/).map((part) => parseFloat(part));
  if (parts.length !== 4) return null;
  const width = parts[2];
  const height = parts[3];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

export function svgViewBoxAspectRatioCss(size: SvgViewBoxSize): string {
  return `${size.width} / ${size.height}`;
}

/** Sync diagram container aspect ratio with the loaded blueprint SVG viewBox. */
export function applyMeasurementBlueprintViewBoxAspect(
  svg: SVGSVGElement,
  container?: HTMLElement | null,
): SvgViewBoxSize | null {
  const size = parseSvgViewBoxSize(svg);
  if (!size) return null;
  const ratio = svgViewBoxAspectRatioCss(size);
  if (svg.style.aspectRatio !== ratio) {
    svg.style.aspectRatio = ratio;
  }
  const host =
    container ??
    svg.closest(".express-mbp-stage__inner") ??
    svg.closest(".cb-measure-diagram-wrap");
  if (host instanceof HTMLElement) {
    const prev = host.style.getPropertyValue("--pattern-summary-aspect-ratio");
    if (prev !== ratio) {
      host.style.setProperty("--pattern-summary-aspect-ratio", ratio);
    }
  }
  return size;
}

/**
 * Minimum diagram/stage width (px) for absolute on-diagram chips.
 * Below this, the under-diagram Measurements panel is used.
 *
 * Chosen from overlap sweeps of the densest targets (Sleeveless neck cluster;
 * Drop Shoulder cuff length vs cuff circ) with enlarged edit-workspace chips and
 * longer centimeter values. Conservative model cleared at ~570px; 640px adds
 * margin for label icons, focus rings, and font metrics.
 */
export const DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX = 640;

/**
 * Legacy viewport media query — not the primary overlay decision.
 * Kept for phone-workspace / hat docs that still mention the historical 700px MQ.
 */
export const DESKTOP_MEASUREMENT_OVERLAY_MQ = "(min-width: 700px)";

/**
 * Edit Pattern workspace: two-column layout when the drawer body container is at
 * least this wide (container query). Below this, Quick edits stack above the diagram.
 */
export const EDIT_WORKSPACE_TWO_COLUMN_MIN_PX = 1100;

/** Whether the stage is wide enough for absolute overlay chips (not viewport-based). */
export function shouldUseDesktopMeasurementOverlay(stageWidthPx: number): boolean {
  return Number.isFinite(stageWidthPx) && stageWidthPx >= DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX;
}

export type PositionMeasurementBoxOptions = {
  offsetX?: number;
  offsetY?: number;
  /** CSS transform applied after left/top; default centers the group on the anchor. */
  transform?: string;
};

export type MeasurementOverlayAnchor = {
  box: HTMLElement;
  targetId: string;
} & PositionMeasurementBoxOptions;

export function resolvePatternSummaryTarget(
  svg: SVGElement,
  targetId: string,
): SVGGraphicsElement | null {
  let el = svg.querySelector(`#${CSS.escape(targetId)}`);
  if (!el && targetId === PATTERN_SUMMARY_MEASUREMENT_TARGETS.garmentLength) {
    el = svg.querySelector(`#${GARMENT_LENGTH_TARGET_TYPO_ID}`);
  }
  if (el instanceof SVGGraphicsElement) return el;
  if (el instanceof Element && typeof (el as SVGGraphicsElement).getBBox === "function") {
    return el as SVGGraphicsElement;
  }
  return null;
}

/**
 * Place `boxElement` so its transform origin sits on the center of the SVG target.
 * Coordinates are relative to `overlayElement` (the absolute overlay layer).
 */
export function positionMeasurementBox(
  boxElement: HTMLElement,
  svg: SVGElement,
  overlayElement: HTMLElement,
  targetId: string,
  options?: PositionMeasurementBoxOptions,
): boolean {
  const target = resolvePatternSummaryTarget(svg, targetId);
  if (!target) return false;

  const targetRect = target.getBoundingClientRect();
  const overlayRect = overlayElement.getBoundingClientRect();
  if (overlayRect.width <= 0 || overlayRect.height <= 0) return false;

  const x =
    targetRect.left + targetRect.width / 2 - overlayRect.left + (options?.offsetX ?? 0);
  const y =
    targetRect.top + targetRect.height / 2 - overlayRect.top + (options?.offsetY ?? 0);

  boxElement.style.left = `${x}px`;
  boxElement.style.top = `${y}px`;
  boxElement.style.transform = options?.transform ?? "translate(-50%, -50%)";
  return true;
}

export function clearMeasurementBoxPosition(boxElement: HTMLElement): void {
  boxElement.style.left = "";
  boxElement.style.top = "";
  boxElement.style.transform = "";
}

export function applyMeasurementTargetToBox(
  box: HTMLElement,
  targetId: string,
  options?: Pick<PositionMeasurementBoxOptions, "transform">,
): void {
  box.dataset.measurementTarget = targetId;
  if (options?.transform) {
    box.dataset.measurementTransform = options.transform;
  } else {
    delete box.dataset.measurementTransform;
  }
}

export function collectOverlayAnchors(overlay: HTMLElement): MeasurementOverlayAnchor[] {
  const anchors: MeasurementOverlayAnchor[] = [];
  overlay.querySelectorAll("[data-measurement-target]").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const targetId = node.dataset.measurementTarget?.trim();
    if (!targetId) return;
    anchors.push({
      box: node,
      targetId,
      transform: node.dataset.measurementTransform || undefined,
    });
  });
  return anchors;
}

function resolveOverlayStageElement(stageInner: HTMLElement): HTMLElement | null {
  const parent = stageInner.parentElement;
  if (parent instanceof HTMLElement && parent.classList.contains("express-mbp-stage")) {
    return parent;
  }
  return null;
}

function resolveOverlayScrollElement(stage: HTMLElement | null): HTMLElement | null {
  const parent = stage?.parentElement;
  if (parent instanceof HTMLElement && parent.classList.contains("express-mbp-scroll")) {
    return parent;
  }
  return null;
}

/**
 * Keep overlay chips attached to SVG targets when the diagram stage is wide enough.
 * On a narrow stage (including a wide viewport with a height-capped / column-limited
 * diagram), clear inline left/top/transform so shared CSS can stack chips in the
 * Measurements panel under the diagram.
 *
 * Starts in mobile/stacked mode to avoid a flash of overlapping absolute chips
 * before the first stage-width measurement.
 */
export function bindPatternSummaryOverlayPositioning(
  stageInner: HTMLElement,
  svg: SVGElement,
  overlay: HTMLElement,
  anchors: MeasurementOverlayAnchor[],
): () => void {
  const stage = resolveOverlayStageElement(stageInner);
  const scroll = resolveOverlayScrollElement(stage);
  let repositionFrame: number | null = null;
  let lastStageWidth = -1;
  let lastStageHeight = -1;
  let lastDesktop: boolean | null = null;

  const applyModeClass = (desktop: boolean): void => {
    const mode = desktop ? "desktop" : "mobile";
    stageInner.dataset.measurementOverlayMode = mode;
    overlay.dataset.measurementOverlayMode = mode;
    if (stage) stage.dataset.measurementOverlayMode = mode;
    if (scroll) scroll.dataset.measurementOverlayMode = mode;
  };

  const runReposition = (): void => {
    const width = stageInner.clientWidth;
    const height = stageInner.clientHeight;
    // Not laid out yet (hidden drawer, etc.): stay stacked — never assume desktop.
    const desktop = width > 0 && shouldUseDesktopMeasurementOverlay(width);
    applyModeClass(desktop);

    if (!desktop) {
      for (const anchor of anchors) clearMeasurementBoxPosition(anchor.box);
      lastStageWidth = width;
      lastStageHeight = height;
      lastDesktop = false;
      return;
    }

    for (const anchor of anchors) {
      const placed = positionMeasurementBox(anchor.box, svg, overlay, anchor.targetId, anchor);
      if (!placed && import.meta.env.DEV) {
        console.warn(`[pattern-summary-overlay] Missing SVG target: #${anchor.targetId}`);
      }
    }
    lastStageWidth = width;
    lastStageHeight = height;
    lastDesktop = true;
  };

  const scheduleReposition = (force = false): void => {
    if (repositionFrame !== null) return;
    repositionFrame = window.requestAnimationFrame(() => {
      repositionFrame = null;
      const width = stageInner.clientWidth;
      const height = stageInner.clientHeight;
      const desktop = width > 0 && shouldUseDesktopMeasurementOverlay(width);
      if (
        !force &&
        width === lastStageWidth &&
        height === lastStageHeight &&
        lastDesktop === desktop &&
        lastStageWidth >= 0
      ) {
        return;
      }
      runReposition();
    });
  };

  // Stacked until the first real measurement — prevents overlapping chip flash.
  applyModeClass(false);
  for (const anchor of anchors) clearMeasurementBoxPosition(anchor.box);

  // Sync pass when already laid out (visible host); otherwise RO / rAF will follow.
  if (stageInner.clientWidth > 0) {
    runReposition();
  }

  // Wait for aspect-ratio / font layout to settle (avoid scrollbar width oscillation).
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => scheduleReposition(true));
  });

  const onWindowResize = (): void => scheduleReposition();
  const onOrientationChange = (): void => scheduleReposition(true);

  window.addEventListener("resize", onWindowResize, { passive: true });
  window.addEventListener("orientationchange", onOrientationChange);

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => scheduleReposition());
    resizeObserver.observe(stageInner);
    if (stage) resizeObserver.observe(stage);
  }

  return () => {
    if (repositionFrame !== null) {
      window.cancelAnimationFrame(repositionFrame);
      repositionFrame = null;
    }
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("orientationchange", onOrientationChange);
    resizeObserver?.disconnect();
    delete stageInner.dataset.measurementOverlayMode;
    delete overlay.dataset.measurementOverlayMode;
    if (stage) delete stage.dataset.measurementOverlayMode;
    if (scroll) delete scroll.dataset.measurementOverlayMode;
    for (const anchor of anchors) clearMeasurementBoxPosition(anchor.box);
  };
}
