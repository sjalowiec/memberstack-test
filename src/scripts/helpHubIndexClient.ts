/** In-page Help Hub landing search. This does not call Pagefind or site search. */

import { queueSearchCommit } from "../lib/searchActivityClient";

export function helpHubEntryVisibleForQuery(searchText: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return searchText.toLowerCase().includes(q);
}

function isDetails(node: Element): node is HTMLDetailsElement {
  return node instanceof HTMLDetailsElement;
}

export function activateHelpHubDeferredMedia(root: ParentNode): void {
  root.querySelectorAll("[data-help-hub-deferred-media]").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const next = node.dataset.src?.trim() ?? "";
    if (!next || node.getAttribute("src")) return;
    node.setAttribute("src", next);
    const video = node.closest("video");
    if (video instanceof HTMLMediaElement) video.load();
  });
}

function stopHelpHubInlineMedia(root: ParentNode): void {
  root.querySelectorAll("video").forEach((video) => {
    if (video instanceof HTMLMediaElement && !video.paused) video.pause();
  });
  root.querySelectorAll("iframe[data-help-hub-deferred-media]").forEach((frame) => {
    if (!(frame instanceof HTMLIFrameElement)) return;
    if (!frame.getAttribute("src")) return;
    frame.removeAttribute("src");
  });
}

function closeOtherAnswers(root: ParentNode, current: HTMLDetailsElement): void {
  root.querySelectorAll("details[data-help-hub-answer]").forEach((node) => {
    if (!isDetails(node) || node === current) return;
    // The details name group may already have closed the previous answer
    // without a toggle event. Stop its media either way.
    stopHelpHubInlineMedia(node);
    if (node.open) node.open = false;
  });
}

export function applyHelpHubIndexQuery(root: ParentNode, query: string): number {
  const q = query.trim();
  const queryActive = q.length > 0;
  const newSection = root.querySelector("[data-help-hub-new]");
  if (newSection instanceof HTMLElement) newSection.hidden = queryActive;

  let matchCount = 0;
  root.querySelectorAll("[data-help-hub-category]").forEach((section) => {
    if (!(section instanceof HTMLElement)) return;
    let visible = 0;
    section.querySelectorAll("[data-help-hub-entry]").forEach((entry) => {
      if (!(entry instanceof HTMLElement)) return;
      const show = helpHubEntryVisibleForQuery(entry.dataset.helpHubSearch ?? "", q);
      entry.hidden = queryActive ? !show : false;
      if (queryActive && show) visible += 1;
    });
    section.hidden = queryActive && visible === 0;
    if (isDetails(section)) {
      if (queryActive && visible > 0) section.open = true;
      if (!queryActive) section.open = false;
    }
    if (queryActive) matchCount += visible;
  });

  root.querySelectorAll("details[data-help-hub-answer]").forEach((node) => {
    if (!isDetails(node) || !node.open) return;
    const concealed = node.hidden || Boolean(node.closest("[hidden]"));
    if (!queryActive || concealed) node.open = false;
  });

  const empty = root.querySelector("[data-help-hub-search-empty]");
  if (empty instanceof HTMLElement) empty.hidden = !(queryActive && matchCount === 0);

  const status = root.querySelector("[data-help-hub-search-status]");
  if (status) {
    if (!queryActive || matchCount === 0) status.textContent = "";
    else if (matchCount === 1) status.textContent = "1 Help Hub answer";
    else status.textContent = `${matchCount} Help Hub answers`;
  }

  return matchCount;
}

const READING_HISTORY_KEY = "helpHubReading";

type ReadingSession = {
  entry: HTMLDetailsElement;
  summary: HTMLElement;
  parent: Node;
  next: ChildNode | null;
  scrollY: number;
};

let readingSession: ReadingSession | null = null;
let lastOpenedEntry: HTMLDetailsElement | null = null;
let ignoreAnswerToggle = false;

function readingHistoryActive(): boolean {
  try {
    return history.state?.[READING_HISTORY_KEY] === true;
  } catch {
    return false;
  }
}

function articleTitle(entry: HTMLDetailsElement): string {
  const summary = entry.querySelector("summary");
  const text = summary?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return text || "Help Hub";
}

function articlePanel(root: ParentNode): HTMLElement | null {
  const panel = root.querySelector("[data-help-hub-article-panel]");
  return panel instanceof HTMLElement ? panel : null;
}

function articleHeading(root: ParentNode): HTMLElement | null {
  const heading = root.querySelector("[data-help-hub-article-title]");
  return heading instanceof HTMLElement ? heading : null;
}

function scrollWindowTo(top: number): void {
  const y = Math.max(0, top);
  const scroller = document.scrollingElement;
  if (scroller) scroller.scrollTop = y;
  window.scrollTo(0, y);
}

function focusWithoutMoving(el: HTMLElement): void {
  if (typeof el.focus !== "function") return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

/** Show one article apart from the question browser and move to its heading. */
export function openHelpHubArticle(root: ParentNode, entry: HTMLDetailsElement): void {
  if (readingSession?.entry === entry) return;
  const panel = articlePanel(root);
  const heading = articleHeading(root);
  const slot = root.querySelector("[data-help-hub-article-slot]");
  const summary = entry.querySelector("summary");
  if (!panel || !heading || !(slot instanceof HTMLElement) || !(summary instanceof HTMLElement)) return;
  if (!entry.parentNode) return;

  if (readingSession) closeHelpHubArticle(root, { restoreFocus: false });

  const scrollY = window.scrollY;
  const parent = entry.parentNode;
  const next = entry.nextSibling;
  heading.textContent = articleTitle(entry);
  if (!readingHistoryActive()) {
    try {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      history.pushState({ [READING_HISTORY_KEY]: true }, "");
    } catch {
      /* History can reject the extra entry; the in-page Back button still closes. */
    }
  }
  slot.replaceChildren(entry);
  panel.hidden = false;
  if (root instanceof HTMLElement) root.classList.add("is-reading");
  readingSession = { entry, summary, parent, next, scrollY };
  lastOpenedEntry = entry;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      void panel.offsetHeight;
      const margin = Number.parseFloat(getComputedStyle(panel).scrollMarginTop) || 0;
      const top = panel.getBoundingClientRect().top + window.scrollY - margin;
      scrollWindowTo(top);
      focusWithoutMoving(heading);
    });
  });
}

/** Return to the question lists without clearing search, open categories, or scroll. */
export function closeHelpHubArticle(
  root: ParentNode,
  options: { restoreFocus?: boolean } = {},
): void {
  const session = readingSession;
  if (!session) return;
  readingSession = null;
  stopHelpHubInlineMedia(session.entry);
  ignoreAnswerToggle = true;
  session.entry.open = false;
  ignoreAnswerToggle = false;
  if (session.next && session.next.parentNode === session.parent) {
    session.parent.insertBefore(session.entry, session.next);
  } else {
    session.parent.appendChild(session.entry);
  }

  const panel = articlePanel(root);
  const heading = articleHeading(root);
  if (panel) panel.hidden = true;
  if (heading) heading.textContent = "";
  if (root instanceof HTMLElement) root.classList.remove("is-reading");

  const restoreFocus = options.restoreFocus !== false;
  scrollWindowTo(session.scrollY);
  if ("scrollRestoration" in history) history.scrollRestoration = "auto";
  if (restoreFocus) focusWithoutMoving(session.summary);
}

function requestCloseHelpHubArticle(root: ParentNode): void {
  if (!readingSession) return;
  if (readingHistoryActive()) {
    history.back();
    return;
  }
  closeHelpHubArticle(root);
}

function onAnswerToggle(root: ParentNode, entry: HTMLDetailsElement): void {
  if (ignoreAnswerToggle) return;
  if (!entry.open) {
    stopHelpHubInlineMedia(entry);
    if (readingSession?.entry === entry) closeHelpHubArticle(root);
    return;
  }
  closeOtherAnswers(root, entry);
  activateHelpHubDeferredMedia(entry);
  openHelpHubArticle(root, entry);
}

export function initHelpHubIndex(root: ParentNode): void {
  if (root instanceof HTMLElement) {
    if (root.dataset.helpHubIndexBound === "true") return;
    root.dataset.helpHubIndexBound = "true";
  }
  root.querySelectorAll("details[data-help-hub-answer]").forEach((node) => {
    if (!isDetails(node)) return;
    node.addEventListener("toggle", () => onAnswerToggle(root, node));
  });

  root.querySelectorAll("details[data-help-hub-category]").forEach((node) => {
    if (!isDetails(node)) return;
    node.addEventListener("toggle", () => {
      if (node.open) return;
      node.querySelectorAll("details[data-help-hub-answer][open]").forEach((answer) => {
        if (isDetails(answer)) answer.open = false;
      });
    });
  });

  const input = root.querySelector("#help-hub-search-input");
  if (input instanceof HTMLInputElement) {
    const noteHelpHubSearch = (flush: boolean) => {
      const resultCount = applyHelpHubIndexQuery(root, input.value);
      queueSearchCommit({ area: "help-hub", term: input.value, resultCount });
      if (flush && typeof window.__kinFlushSearchCommit === "function") {
        window.__kinFlushSearchCommit();
      }
    };
    input.addEventListener("input", () => {
      noteHelpHubSearch(false);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      noteHelpHubSearch(true);
    });
  }

  const siteSearch = root.querySelector("[data-help-hub-open-site-search]");
  siteSearch?.addEventListener("click", () => {
    const trigger = document.querySelector("[data-open-search-modal]");
    if (trigger instanceof HTMLElement) trigger.click();
  });

  root.querySelectorAll("[data-help-hub-article-back]").forEach((button) => {
    button.addEventListener("click", () => requestCloseHelpHubArticle(root));
  });

  window.addEventListener("popstate", () => {
    if (readingHistoryActive()) {
      if (!readingSession && lastOpenedEntry && !lastOpenedEntry.open) {
        lastOpenedEntry.open = true;
      }
      return;
    }
    if (readingSession) closeHelpHubArticle(root);
  });
}
