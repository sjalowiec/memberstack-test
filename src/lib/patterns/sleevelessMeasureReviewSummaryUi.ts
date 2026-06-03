/**
 * Compact inline project summary for sleeveless measurement review pages (Express, Custom, unified review).
 * Presentation only — callers supply label/value segments from existing data sources.
 */

export type MeasureReviewSummarySegment = {
  label: string;
  value: string;
};

const DEFAULT_UNITS_HOST_SELECTOR = "[data-express-measurements-units-host]";

function appendSeparator(line: HTMLElement): void {
  const sep = document.createElement("span");
  sep.className = "sleeveless-measure-summary-line__sep";
  sep.setAttribute("aria-hidden", "true");
  sep.textContent = "•";
  line.appendChild(sep);
}

function appendSegment(line: HTMLElement, segment: MeasureReviewSummarySegment): void {
  const wrap = document.createElement("span");
  wrap.className = "sleeveless-measure-summary-line__segment";

  const label = document.createElement("span");
  label.className = "sleeveless-measure-summary-line__label";
  label.textContent = `${segment.label}:`;

  const value = document.createElement("span");
  value.className = "sleeveless-measure-summary-line__value";
  value.textContent = segment.value;

  // Space between label and value so it reads "Recipient: Women", not "Recipient:Women".
  wrap.append(label, document.createTextNode(" "), value);
  line.appendChild(wrap);
}

/**
 * Renders a single wrapping summary line into `host`, preserving an optional unit-toggle host child.
 */
export function renderMeasureReviewSummaryLine(
  host: HTMLElement,
  segments: MeasureReviewSummarySegment[],
  options?: {
    unitsHostSelector?: string;
    preserveUnitsHost?: boolean;
  },
): void {
  const unitsSelector = options?.unitsHostSelector ?? DEFAULT_UNITS_HOST_SELECTOR;
  const unitsHostEl =
    options?.preserveUnitsHost === false
      ? null
      : host.querySelector<HTMLElement>(unitsSelector);

  const lineSlot = host.querySelector<HTMLElement>("[data-sleeveless-review-summary-line-slot]");
  const lineHost = lineSlot ?? host;

  if (lineSlot) {
    lineSlot.replaceChildren();
  } else {
    host.replaceChildren();
  }

  const filtered = segments.filter((s) => s.label.trim() && s.value.trim());
  if (filtered.length === 0) {
    if (unitsHostEl && !lineSlot) host.appendChild(unitsHostEl);
    return;
  }

  const line = document.createElement(lineSlot ? "span" : "p");
  line.className = "sleeveless-measure-summary-line";
  if (lineSlot) {
    line.classList.add("sleeveless-measure-summary-line--inline");
  }

  filtered.forEach((segment, index) => {
    if (index > 0) appendSeparator(line);
    appendSegment(line, segment);
  });

  lineHost.appendChild(line);
  if (unitsHostEl && !lineSlot) host.appendChild(unitsHostEl);
}

/** Clears rendered summary text while keeping the unit-toggle host (Express / unified review). */
export function clearMeasureReviewSummaryLine(
  host: HTMLElement,
  options?: { unitsHostSelector?: string },
): void {
  const unitsSelector = options?.unitsHostSelector ?? DEFAULT_UNITS_HOST_SELECTOR;
  const unitsHostEl = host.querySelector<HTMLElement>(unitsSelector);
  const lineSlot = host.querySelector<HTMLElement>("[data-sleeveless-review-summary-line-slot]");
  if (lineSlot) {
    lineSlot.replaceChildren();
  } else {
    host.replaceChildren();
    if (unitsHostEl) host.appendChild(unitsHostEl);
  }
}
