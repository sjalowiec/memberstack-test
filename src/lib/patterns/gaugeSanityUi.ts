/**
 * Soft unusual-gauge warning UI for Express builders (Sleeveless, Drop Shoulder, Hat).
 * Markup is injected into `#gauge-sanity-warning` when present.
 */

import {
  formatGaugeSanityWarningBody,
  GAUGE_SANITY_CONTINUE_LABEL,
  GAUGE_SANITY_WARNING_HEADING,
  type GaugeSanityResult,
} from "./gaugeSanity";

export const GAUGE_SANITY_WARNING_ID = "gauge-sanity-warning";
export const GAUGE_SANITY_CONTINUE_ID = "gauge-sanity-continue";

/** Bold the 4-inch / 10 cm instruction without using innerHTML. */
function appendGaugeSanityWarningBody(doc: Document, body: HTMLElement, text: string): void {
  const match = text.match(/^(Enter your gauge over )(4 inches|10 cm)(\. )([\s\S]+)$/);
  if (!match) {
    body.textContent = text;
    return;
  }
  body.append(match[1]);
  const strong = doc.createElement("strong");
  strong.textContent = match[2];
  body.append(strong, match[3], match[4]);
}

export function resolveGaugeSanityWarningHost(doc: Document): HTMLElement | null {
  const existing = doc.getElementById(GAUGE_SANITY_WARNING_ID);
  if (existing) return existing as HTMLElement;
  return null;
}

export function hideGaugeSanityWarning(doc: Document): void {
  const host = resolveGaugeSanityWarningHost(doc);
  if (!host) return;
  if (typeof host.replaceChildren === "function") host.replaceChildren();
  else host.textContent = "";
  host.hidden = true;
  if (typeof host.setAttribute === "function") host.setAttribute("hidden", "");
}

export function renderGaugeSanityWarning(
  doc: Document,
  result: GaugeSanityResult,
  options: { onContinue: () => void },
): void {
  const host = resolveGaugeSanityWarningHost(doc);
  if (!host || typeof doc.createElement !== "function") return;

  host.replaceChildren();

  const title = doc.createElement("h2");
  title.className = "gauge-sanity-warning__title";
  title.textContent = GAUGE_SANITY_WARNING_HEADING;

  const body = doc.createElement("p");
  body.className = "gauge-sanity-warning__body";
  appendGaugeSanityWarningBody(doc, body, formatGaugeSanityWarningBody(result));

  const continueBtn = doc.createElement("button");
  continueBtn.type = "button";
  continueBtn.id = GAUGE_SANITY_CONTINUE_ID;
  continueBtn.className = "gauge-sanity-warning__continue";
  continueBtn.textContent = GAUGE_SANITY_CONTINUE_LABEL;
  continueBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    options.onContinue();
  });

  host.append(title, body, continueBtn);
  host.hidden = false;
  host.removeAttribute("hidden");
  if (typeof host.scrollIntoView === "function") {
    host.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}
