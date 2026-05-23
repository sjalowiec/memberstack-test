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
} as const;

/** SVG typo alias for garment-length target (`target_garmemt_length`). */
const GARMENT_LENGTH_TARGET_TYPO_ID = "target_garmemt_length";

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

  const reposition = (): void => {
    if (!mq.matches) {
      for (const anchor of anchors) clearMeasurementBoxPosition(anchor.box);
      return;
    }
    for (const anchor of anchors) {
      positionMeasurementBox(anchor.box, svg, overlay, anchor.targetId, anchor);
    }
  };

  reposition();

  const ro = new ResizeObserver(() => reposition());
  ro.observe(stageInner);
  if (svg.parentElement instanceof HTMLElement) {
    ro.observe(svg.parentElement);
  }

  mq.addEventListener("change", reposition);
  window.addEventListener("orientationchange", reposition);

  return () => {
    ro.disconnect();
    mq.removeEventListener("change", reposition);
    window.removeEventListener("orientationchange", reposition);
    for (const anchor of anchors) clearMeasurementBoxPosition(anchor.box);
  };
}
