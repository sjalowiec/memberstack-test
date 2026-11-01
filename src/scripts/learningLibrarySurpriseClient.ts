/**
 * Learning Library Surprise Me.
 * The catalog stays on the page. Surprise Me opens one video in a dialog,
 * then Show Me Another, without repeating until the eligible pool for this
 * visit has been shown. Nothing is autoplayed.
 */

import {
  anotherSurpriseVideo,
  assembleLearningLibrarySurpriseVideos,
  eligibleSurpriseVideos,
  parseVideoSurpriseSession,
  serializeVideoSurpriseSession,
  sessionForEligiblePool,
  startSurpriseVideo,
  VIDEO_SURPRISE_SESSION_KEY,
  videoSurpriseAccessMode,
  videoSurprisePanel,
  type LearningLibrarySurpriseCard,
  type LearningLibrarySurpriseRef,
  type LearningLibrarySurpriseVideo,
  type VideoSurpriseAccessMode,
  type VideoSurpriseSession,
} from "../lib/videos/learningLibrarySurprise";

const CHECKING_MESSAGE = "Checking which videos you can watch.";
const EMPTY_MESSAGE = "No videos are available to surprise you with right now.";

type SurpriseWindow = Window & {
  __KIN_MEMBER_ACCESS__?: { hasMemberAccess?: boolean } | null;
  __PREVIEW_FORCE_MEMBER__?: boolean | null;
};

function readJson(node: Element | null): unknown {
  if (!node) return null;
  try {
    return JSON.parse(node.textContent || "null") as unknown;
  } catch {
    return null;
  }
}

function readRefs(root: ParentNode): LearningLibrarySurpriseRef[] {
  const parsed = readJson(root.querySelector("#video-surprise-refs"));
  if (!Array.isArray(parsed)) return [];
  const refs: LearningLibrarySurpriseRef[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; access?: unknown };
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    refs.push({ id, access: row.access === "open" ? "open" : "member" });
  }
  return refs;
}

function readCards(root: ParentNode): LearningLibrarySurpriseCard[] {
  const parsed = readJson(root.querySelector("#videos-data"));
  return Array.isArray(parsed) ? (parsed as LearningLibrarySurpriseCard[]) : [];
}

function readAccessMode(): VideoSurpriseAccessMode {
  const view = window as SurpriseWindow;
  const preview = view.__PREVIEW_FORCE_MEMBER__;
  const hasMemberAccess = view.__KIN_MEMBER_ACCESS__?.hasMemberAccess;
  return videoSurpriseAccessMode({
    hasMemberAccess: typeof hasMemberAccess === "boolean" ? hasMemberAccess : null,
    previewForceMember: preview === true ? true : preview === false ? false : null,
  });
}

function readSession(): VideoSurpriseSession | null {
  try {
    return parseVideoSurpriseSession(sessionStorage.getItem(VIDEO_SURPRISE_SESSION_KEY));
  } catch {
    return null;
  }
}

function writeSession(session: VideoSurpriseSession | null): void {
  try {
    if (!session || (session.currentId === "" && session.seenIds.length === 0)) {
      sessionStorage.removeItem(VIDEO_SURPRISE_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(VIDEO_SURPRISE_SESSION_KEY, serializeVideoSurpriseSession(session));
  } catch {
    // The picker still works for this page view when storage is blocked.
  }
}

function restoreScroll(y: number): void {
  window.scrollTo(0, y);
  requestAnimationFrame(() => window.scrollTo(0, y));
}

export function initLearningLibrarySurprise(root: ParentNode = document): void {
  const dialog = root.querySelector("[data-video-surprise]");
  const start = root.querySelector("[data-video-surprise-start]");
  if (!(dialog instanceof HTMLDialogElement) || dialog.dataset.videoSurpriseReady === "true") return;
  if (!(start instanceof HTMLButtonElement)) return;
  const close = dialog.querySelector("[data-video-surprise-close]");
  const card = dialog.querySelector("[data-video-surprise-card]");
  const media = dialog.querySelector("[data-video-surprise-media]");
  const poster = dialog.querySelector("[data-video-surprise-poster]");
  const title = dialog.querySelector("[data-video-surprise-title]");
  const description = dialog.querySelector("[data-video-surprise-description]");
  const watch = dialog.querySelector("[data-video-surprise-watch]");
  const another = dialog.querySelector("[data-video-surprise-another]");
  const note = dialog.querySelector("[data-video-surprise-note]");
  const anotherNote = dialog.querySelector("[data-video-surprise-another-note]");
  const status = dialog.querySelector("[data-video-surprise-status]");
  if (
    !(close instanceof HTMLButtonElement) ||
    !(card instanceof HTMLElement) ||
    !(media instanceof HTMLElement) ||
    !(poster instanceof HTMLImageElement) ||
    !(title instanceof HTMLElement) ||
    !(description instanceof HTMLElement) ||
    !(watch instanceof HTMLAnchorElement) ||
    !(another instanceof HTMLButtonElement) ||
    !(note instanceof HTMLElement)
  ) {
    return;
  }

  const videos = assembleLearningLibrarySurpriseVideos(readRefs(root), readCards(root));
  if (videos.length === 0) {
    start.hidden = true;
    return;
  }

  dialog.dataset.videoSurpriseReady = "true";
  let accessMode = readAccessMode();
  let session = readSession();
  let scrollY = 0;

  function eligibleNow(): LearningLibrarySurpriseVideo[] {
    return eligibleSurpriseVideos(videos, accessMode);
  }

  function render(announce: boolean): void {
    const eligible = eligibleNow();
    session = sessionForEligiblePool(session, eligible.map((video) => video.id));
    const openCount = videos.filter((video) => video.access === "open").length;
    const panel = videoSurprisePanel({
      access: accessMode,
      openCount,
      memberOnlyCount: videos.length - openCount,
    });
    const current = session?.currentId
      ? eligible.find((video) => video.id === session?.currentId)
      : undefined;

    card.hidden = true;
    note.hidden = true;

    if (!current) {
      if (panel === "checking" || panel === "empty" || eligible.length === 0) {
        note.hidden = false;
        note.textContent = panel === "checking" ? CHECKING_MESSAGE : EMPTY_MESSAGE;
        if (announce && status instanceof HTMLElement) status.textContent = note.textContent;
      }
      return;
    }

    card.hidden = false;
    title.textContent = current.title;
    if (current.description) {
      description.hidden = false;
      description.textContent = current.description;
    } else {
      description.hidden = true;
      description.textContent = "";
    }
    if (current.posterUrl) {
      media.hidden = false;
      poster.src = current.posterUrl;
      poster.alt = "";
    } else {
      media.hidden = true;
      poster.removeAttribute("src");
    }
    watch.href = current.href;
    watch.setAttribute("aria-label", `Watch video: ${current.title}`);
    const onlyOne = eligible.length < 2;
    another.disabled = onlyOne;
    if (onlyOne && anotherNote instanceof HTMLElement) {
      another.setAttribute("aria-describedby", "video-surprise-another-note");
      anotherNote.hidden = false;
    } else {
      another.removeAttribute("aria-describedby");
      if (anotherNote instanceof HTMLElement) anotherNote.hidden = true;
    }
    if (announce && status instanceof HTMLElement) {
      status.textContent = current.description
        ? `Video: ${current.title}. ${current.description}`
        : `Video: ${current.title}.`;
    }
  }

  function openDialog(): void {
    scrollY = window.scrollY;
    if (!dialog.open) dialog.showModal();
    restoreScroll(scrollY);
    close.focus({ preventScroll: true });
  }

  function closeDialog(): void {
    if (dialog.open) dialog.close();
  }

  start.addEventListener("click", () => {
    const next = startSurpriseVideo(
      eligibleNow().map((video) => video.id),
      session?.seenIds ?? [],
    );
    if (next) {
      session = next;
      writeSession(session);
    }
    render(true);
    openDialog();
  });

  another.addEventListener("click", () => {
    if (!session?.currentId) return;
    const next = anotherSurpriseVideo(
      eligibleNow().map((video) => video.id),
      session,
    );
    if (!next) return;
    session = next;
    writeSession(session);
    render(true);
  });

  close.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("close", () => {
    restoreScroll(scrollY);
    start.focus({ preventScroll: true });
  });

  function refreshAccess(): void {
    accessMode = readAccessMode();
    render(false);
  }

  window.addEventListener("kin:member-access", refreshAccess);
  window.addEventListener("auth:updated", refreshAccess);
  window.addEventListener("pageshow", () => {
    refreshAccess();
    if (dialog.open) closeDialog();
  });
}
