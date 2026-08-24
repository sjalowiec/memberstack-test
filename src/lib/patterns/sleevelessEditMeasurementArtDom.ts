/**
 * DOM contract for Sleeveless Edit Pattern measurement art refresh.
 *
 * The generated garment SVG may be replaced when the silhouette changes.
 * The measurement overlay (chips + values) must stay in place and keep its nodes.
 *
 *   .express-mbp-stage__inner
 *     .express-mbp-art-host
 *       svg.express-mbp-art
 *     .express-mbp-overlay
 *       .express-mbp-box  (chips — do not rebuild)
 */

export const SLEEVELESS_EDIT_MEASUREMENT_ART_HOST_CLASS = "express-mbp-art-host";
export const SLEEVELESS_EDIT_NECKLINE_ART_WIRED_FLAG = "slEditNecklineArtWired";

/**
 * `change` and capture `blur` both fire when leaving a text input.
 * Keep persist + art refresh to one commit per field value in the same turn.
 */
export function createSameTurnCommitGate(): (key: string, value: string) => boolean {
  let lastKey = "";
  let lastValue = "";
  let resetScheduled = false;
  return (key: string, value: string): boolean => {
    if (key === lastKey && value === lastValue) return false;
    lastKey = key;
    lastValue = value;
    if (!resetScheduled) {
      resetScheduled = true;
      queueMicrotask(() => {
        lastKey = "";
        lastValue = "";
        resetScheduled = false;
      });
    }
    return true;
  };
}

export function collectedMeasurementValuesArePersistable(
  collected: Record<string, string | undefined>,
): boolean {
  return Object.values(collected).some((value) => typeof value === "string" && value.trim() !== "");
}

/** Move a parser-created SVG into the page document (same contract as the static blueprint). */
export function adoptGeneratedMeasurementSvg(
  svg: SVGSVGElement,
  doc: Document,
): SVGSVGElement {
  const imported = doc.importNode(svg, true);
  if (!(imported instanceof SVGSVGElement)) {
    throw new Error("adoptGeneratedMeasurementSvg: importNode did not return an SVG element");
  }
  imported.classList.add("express-mbp-art");
  return imported;
}

export function parseAndAdoptGeneratedMeasurementSvg(
  svgText: string,
  doc: Document,
): SVGSVGElement | null {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = parsed.documentElement;
  if (!(root instanceof SVGSVGElement)) return null;
  return adoptGeneratedMeasurementSvg(root, doc);
}

/**
 * Replace only the generated SVG inside `.express-mbp-art-host`.
 * Returns null when the host/overlay contract is missing — never touches overlay children.
 */
export function replaceSleevelessMeasurementArtOnly(
  stageInner: ParentNode,
  nextArt: Element,
): { overlay: Element; art: Element } | null {
  const host = stageInner.querySelector(`.${SLEEVELESS_EDIT_MEASUREMENT_ART_HOST_CLASS}`);
  const overlay = stageInner.querySelector(".express-mbp-overlay");
  if (!host || !overlay) return null;
  const previous = host.querySelector("svg.express-mbp-art");
  if (previous) previous.replaceWith(nextArt);
  else host.append(nextArt);
  return { overlay, art: nextArt };
}

export type SleevelessMeasurementArtRefreshBind = (art: Element, overlay: Element) => void;

/**
 * Live silhouette refresh: swap the generated SVG, keep the same overlay nodes,
 * then rebind positioning against the new `target_*` anchors.
 */
export function refreshSleevelessEditMeasurementArtLayer(options: {
  stageInner: ParentNode;
  nextArt: Element;
  cleanupPreviousBind?: () => void;
  bindOverlay: SleevelessMeasurementArtRefreshBind;
}): { overlay: Element; art: Element } | null {
  const swapped = replaceSleevelessMeasurementArtOnly(options.stageInner, options.nextArt);
  if (!swapped) return null;
  options.cleanupPreviousBind?.();
  options.bindOverlay(swapped.art, swapped.overlay);
  return swapped;
}

type NecklineArtRefreshRadio = {
  dataset: Record<string, string | undefined>;
  addEventListener: (type: string, listener: () => void) => void;
};

/** Wire neckline radios once so repeated inits do not stack change listeners. */
export function wireSleevelessNecklineArtRefreshOnce(
  radios: Iterable<NecklineArtRefreshRadio>,
  onChange: () => void,
): number {
  let added = 0;
  for (const el of radios) {
    if (el.dataset[SLEEVELESS_EDIT_NECKLINE_ART_WIRED_FLAG] === "1") continue;
    el.dataset[SLEEVELESS_EDIT_NECKLINE_ART_WIRED_FLAG] = "1";
    el.addEventListener("change", onChange);
    added += 1;
  }
  return added;
}
