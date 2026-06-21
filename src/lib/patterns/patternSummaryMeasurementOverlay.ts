/**
 * Position HTML measurement overlay chips on pattern_summary.svg target anchors.
 * Targets are green circles in the SVG (left visible intentionally).
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

export const DESKTOP_MEASUREMENT_OVERLAY_MQ = "(min-width: 700px)";

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

/** Keep overlay chips attached to SVG targets on desktop; clear inline coords on mobile stack layout. */
export function bindPatternSummaryOverlayPositioning(
  stageInner: HTMLElement,
  svg: SVGElement,
  overlay: HTMLElement,
  anchors: MeasurementOverlayAnchor[],
): () => void {
  const mq = window.matchMedia(DESKTOP_MEASUREMENT_OVERLAY_MQ);
  let repositionFrame: number | null = null;
  let lastStageWidth = -1;
  let lastStageHeight = -1;

  const runReposition = (): void => {
    if (!mq.matches) {
      for (const anchor of anchors) clearMeasurementBoxPosition(anchor.box);
      lastStageWidth = -1;
      lastStageHeight = -1;
      return;
    }
    for (const anchor of anchors) {
      const placed = positionMeasurementBox(anchor.box, svg, overlay, anchor.targetId, anchor);
      if (!placed && import.meta.env.DEV) {
        console.warn(
          `[pattern-summary-overlay] Missing SVG target: #${anchor.targetId}`,
        );
      }
    }
  };

  const scheduleReposition = (force = false): void => {
    if (repositionFrame !== null) return;
    repositionFrame = window.requestAnimationFrame(() => {
      repositionFrame = null;
      const width = stageInner.clientWidth;
      const height = stageInner.clientHeight;
      if (
        !force &&
        width === lastStageWidth &&
        height === lastStageHeight &&
        lastStageWidth >= 0
      ) {
        return;
      }
      lastStageWidth = width;
      lastStageHeight = height;
      runReposition();
    });
  };

  // Wait for aspect-ratio / font layout to settle (avoid scrollbar width oscillation).
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => scheduleReposition(true));
  });

  const onWindowResize = (): void => scheduleReposition();
  const onMqChange = (): void => scheduleReposition(true);
  const onOrientationChange = (): void => scheduleReposition(true);

  window.addEventListener("resize", onWindowResize, { passive: true });
  mq.addEventListener("change", onMqChange);
  window.addEventListener("orientationchange", onOrientationChange);

  return () => {
    if (repositionFrame !== null) {
      window.cancelAnimationFrame(repositionFrame);
      repositionFrame = null;
    }
    window.removeEventListener("resize", onWindowResize);
    mq.removeEventListener("change", onMqChange);
    window.removeEventListener("orientationchange", onOrientationChange);
    for (const anchor of anchors) clearMeasurementBoxPosition(anchor.box);
  };
}
