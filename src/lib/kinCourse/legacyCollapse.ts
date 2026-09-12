/** Convert recovered Bootstrap collapse markup into native, accessible details. */

export const KIN_LEGACY_COLLAPSE_CLASS = "kin-legacy-collapse";
export const KIN_LEGACY_COLLAPSE_TRIGGER_CLASS = "kin-legacy-collapse-trigger";
export const KIN_LEGACY_COLLAPSE_PANEL_CLASS = "kin-legacy-collapse-panel";

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const WHAT_HAPPENS_RE = /what\s+happens\?/i;

type ElementRange = {
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
  tagName: string;
  attrs: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseOpenTag(
  html: string,
  index: number,
): { tagName: string; attrs: string; end: number; selfClosing: boolean } | null {
  if (html[index] !== "<") return null;
  const match = /^<([a-zA-Z][\w:-]*)\b([^>]*?)(\/)?>/.exec(html.slice(index));
  if (!match) return null;
  const tagName = match[1]!;
  const selfClosing = Boolean(match[3]) || VOID_TAGS.has(tagName.toLowerCase());
  return {
    tagName,
    attrs: match[2] || "",
    end: index + match[0].length,
    selfClosing,
  };
}

function findMatchingClose(html: string, tagName: string, innerStart: number): number {
  const lower = tagName.toLowerCase();
  if (VOID_TAGS.has(lower)) return innerStart;
  let i = innerStart;
  while (i < html.length) {
    const next = html.indexOf("<", i);
    if (next === -1) return -1;
    const rest = html.slice(next);
    if (rest.startsWith("<!--")) {
      const end = html.indexOf("-->", next + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const close = new RegExp(`^</${escapeRegExp(tagName)}\\s*>`, "i").exec(rest);
    if (close) {
      return next;
    }
    const open = parseOpenTag(html, next);
    if (open && open.tagName.toLowerCase() === lower && !open.selfClosing) {
      const nestedClose = findMatchingClose(html, open.tagName, open.end);
      if (nestedClose < 0) return -1;
      const nestedCloseTag = html.slice(nestedClose).match(new RegExp(`^</${escapeRegExp(open.tagName)}\\s*>`, "i"));
      i = nestedClose + (nestedCloseTag?.[0].length ?? 0);
      continue;
    }
    i = next + 1;
  }
  return -1;
}

function elementRange(html: string, openIndex: number): ElementRange | null {
  const open = parseOpenTag(html, openIndex);
  if (!open) return null;
  if (open.selfClosing) {
    return {
      start: openIndex,
      end: open.end,
      innerStart: open.end,
      innerEnd: open.end,
      tagName: open.tagName,
      attrs: open.attrs,
    };
  }
  const innerEnd = findMatchingClose(html, open.tagName, open.end);
  if (innerEnd < 0) return null;
  const closeMatch = html.slice(innerEnd).match(new RegExp(`^</${escapeRegExp(open.tagName)}\\s*>`, "i"));
  if (!closeMatch) return null;
  return {
    start: openIndex,
    end: innerEnd + closeMatch[0].length,
    innerStart: open.end,
    innerEnd,
    tagName: open.tagName,
    attrs: open.attrs,
  };
}

function attrValue(attrs: string, name: string): string {
  return new RegExp(`\\b${escapeRegExp(name)}=["']([^"']*)["']`, "i").exec(attrs)?.[1] || "";
}

function classFromAttrs(attrs: string): string {
  return attrValue(attrs, "class");
}

function collapseTargetId(attrs: string): string | null {
  const target = attrValue(attrs, "data-target");
  const href = attrValue(attrs, "href");
  const raw = target || href;
  if (!raw || raw.charAt(0) !== "#") return null;
  const id = raw.slice(1).trim();
  return id || null;
}

function findTaggedCollapseTriggers(html: string): Array<ElementRange & { inner: string; targetId: string }> {
  const results: Array<ElementRange & { inner: string; targetId: string }> = [];
  const re = /<(a|button)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const range = elementRange(html, match.index);
    if (!range) {
      re.lastIndex = match.index + match[0].length;
      continue;
    }
    re.lastIndex = range.end;
    if (!/\bdata-toggle=["']collapse["']/i.test(range.attrs)) continue;
    const targetId = collapseTargetId(range.attrs);
    if (!targetId) continue;
    results.push({
      ...range,
      inner: html.slice(range.innerStart, range.innerEnd),
      targetId,
    });
  }
  return results;
}

function findElementById(html: string, id: string): ElementRange | null {
  const re = new RegExp(`<(div|section)\\b[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*>`, "gi");
  const match = re.exec(html);
  if (!match) return null;
  return elementRange(html, match.index);
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function wrapLegacyCollapseHtml(
  triggerInner: string,
  panelInner: string,
  options: { id?: string; triggerClass?: string; panelClass?: string } = {},
): string {
  const idAttr = options.id ? ` id="${escapeHtml(options.id)}"` : "";
  const triggerClass = KIN_LEGACY_COLLAPSE_TRIGGER_CLASS;
  const innerClass = String(options.triggerClass || "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
  const panelClass = [KIN_LEGACY_COLLAPSE_PANEL_CLASS, options.panelClass]
    .filter((name) => name && name !== "collapse" && name !== "in" && name !== "show")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const labeledTrigger = innerClass
    ? `<span class="${innerClass}">${triggerInner}</span>`
    : triggerInner;
  return (
    `<details class="${KIN_LEGACY_COLLAPSE_CLASS}"${idAttr}>` +
    `<summary class="${triggerClass}" aria-expanded="false">${labeledTrigger}</summary>` +
    `<div class="${panelClass}">${panelInner}</div>` +
    `</details>`
  );
}

/**
 * Rewrite `data-toggle="collapse"` + matching `#id.collapse` panels into native
 * `<details>` so recovered KIN HTML works without Bootstrap JavaScript.
 */
export function rewriteLegacyBootstrapCollapse(html: string): string {
  const triggers = findTaggedCollapseTriggers(html);
  if (!triggers.length) return html;

  type Replacement = { start: number; end: number; html: string };
  const replacements: Replacement[] = [];
  const consumed = new Set<number>();

  for (const trigger of triggers) {
    const panel = findElementById(html, trigger.targetId);
    if (!panel) continue;
    if (rangesOverlap(trigger, panel)) continue;
    if (consumed.has(trigger.start) || consumed.has(panel.start)) continue;

    const extraPanelClass = classFromAttrs(panel.attrs)
      .split(/\s+/)
      .filter((name) => name && name !== "collapse" && name !== "in" && name !== "show")
      .join(" ");
    const details = wrapLegacyCollapseHtml(trigger.inner, html.slice(panel.innerStart, panel.innerEnd), {
      id: trigger.targetId,
      triggerClass: classFromAttrs(trigger.attrs),
      panelClass: extraPanelClass,
    });

    const first = trigger.start <= panel.start ? trigger : panel;
    const second = trigger.start <= panel.start ? panel : trigger;
    const between = html.slice(first.end, second.start);
    if (/^[\s]*$/.test(between)) {
      replacements.push({ start: first.start, end: second.end, html: details });
    } else {
      replacements.push({ start: trigger.start, end: trigger.end, html: details });
      replacements.push({ start: panel.start, end: panel.end, html: "" });
    }
    consumed.add(trigger.start);
    consumed.add(panel.start);
  }

  if (!replacements.length) return html;
  replacements.sort((a, b) => b.start - a.start);
  let out = html;
  for (const replacement of replacements) {
    out = `${out.slice(0, replacement.start)}${replacement.html}${out.slice(replacement.end)}`;
  }
  return out;
}

export function findEmbeddedCollapseTrigger(
  html: string,
): (ElementRange & { inner: string }) | null {
  const tagged = findTaggedCollapseTriggers(html);
  if (tagged.length) return tagged[tagged.length - 1]!;

  const re = /<(button|a)\b/gi;
  let last: (ElementRange & { inner: string }) | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const range = elementRange(html, match.index);
    if (!range) {
      re.lastIndex = match.index + match[0].length;
      continue;
    }
    re.lastIndex = range.end;
    const inner = html.slice(range.innerStart, range.innerEnd);
    if (WHAT_HAPPENS_RE.test(inner)) last = { ...range, inner };
  }
  return last;
}

export function hasEmbeddedCollapseTrigger(html: string): boolean {
  return findEmbeddedCollapseTrigger(html) != null;
}

export function collapsePanelId(lessonId: number, componentId: number, order: number): string {
  return `kin-collapse-${lessonId}-${componentId || 0}-${order}`;
}

/**
 * Pair an exercise heading's "What happens?" (or Bootstrap) trigger with its
 * answer HTML so the shared collapse rewriter can convert both together.
 */
export function attachCollapsePanel(headingHtml: string, panelHtml: string, panelId: string): string | null {
  const trigger = findEmbeddedCollapseTrigger(headingHtml);
  if (!trigger) return null;
  const cleanedAttrs = trigger.attrs
    .replace(/\s*data-toggle=["'][^"']*["']/gi, "")
    .replace(/\s*data-target=["'][^"']*["']/gi, "")
    .replace(/\s*href=["']#[^"']*["']/gi, "")
    .trim();
  const nextAttrs = `${cleanedAttrs} data-toggle="collapse" data-target="#${escapeHtml(panelId)}"`
    .replace(/\s+/g, " ")
    .trim();
  const tag = trigger.tagName.toLowerCase();
  const nextTrigger = `<${tag} ${nextAttrs}>${trigger.inner}</${tag}>`;
  const heading = `${headingHtml.slice(0, trigger.start)}${nextTrigger}${headingHtml.slice(trigger.end)}`;
  return `${heading}\n<div id="${escapeHtml(panelId)}" class="collapse">${panelHtml}</div>`;
}

export type PresentedExerciseItem = {
  order: number;
  mode: "heading-summary" | "embedded-trigger";
  image?: string;
  headingHtml: string;
  detailsHtml: string;
  html: string;
};

export function presentExerciseAccordionItem(
  item: { order: number; heading?: string; detailsHtml?: string; image?: string },
  presentHtml: (html: string) => string,
  presentSrc: (src: string) => string,
  ids: { lessonId: number; componentId?: number | null },
): PresentedExerciseItem {
  const heading = item.heading || "";
  const details = item.detailsHtml || "";
  const panelId = collapsePanelId(ids.lessonId, ids.componentId ?? 0, item.order);
  const combined = attachCollapsePanel(heading, details, panelId);
  if (combined) {
    return {
      order: item.order,
      mode: "embedded-trigger",
      headingHtml: "",
      detailsHtml: "",
      html: presentHtml(combined),
    };
  }
  return {
    order: item.order,
    mode: "heading-summary",
    image: item.image ? presentSrc(item.image) : undefined,
    headingHtml: presentHtml(heading),
    detailsHtml: presentHtml(details),
    html: "",
  };
}

type CollapseDetails = {
  open: boolean;
  id?: string;
  dataset?: { kinCollapseBound?: string };
  querySelector: (selector: string) => { setAttribute: (name: string, value: string) => void } | null;
  addEventListener?: (type: string, handler: () => void) => void;
};

export function syncLegacyCollapseExpanded(details: CollapseDetails): void {
  const trigger = details.querySelector("summary, .kin-legacy-collapse-trigger");
  trigger?.setAttribute("aria-expanded", details.open ? "true" : "false");
}

export function toggleLegacyCollapse(details: CollapseDetails): boolean {
  details.open = !details.open;
  syncLegacyCollapseExpanded(details);
  return details.open;
}

export function bindLegacyCollapse(root: ParentNode, locationHash = ""): void {
  root.querySelectorAll<HTMLDetailsElement>(`details.${KIN_LEGACY_COLLAPSE_CLASS}`).forEach((details) => {
    if (details.dataset.kinCollapseBound === "true") return;
    details.dataset.kinCollapseBound = "true";
    if (locationHash && details.id && locationHash === `#${details.id}`) {
      details.open = true;
    }
    const sync = () => syncLegacyCollapseExpanded(details);
    sync();
    details.addEventListener("toggle", sync);
    const summary = details.querySelector("summary");
    if (summary && typeof summary.addEventListener === "function") {
      summary.addEventListener("click", () => {
        requestAnimationFrame(sync);
      });
    }
  });
}
