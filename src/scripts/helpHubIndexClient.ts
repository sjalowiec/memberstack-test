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

function onAnswerToggle(root: ParentNode, entry: HTMLDetailsElement): void {
  if (!entry.open) {
    stopHelpHubInlineMedia(entry);
    return;
  }
  closeOtherAnswers(root, entry);
  activateHelpHubDeferredMedia(entry);
}

export function initHelpHubIndex(root: ParentNode): void {
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
}
