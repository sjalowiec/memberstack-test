import {
  announcementToShow,
  type WhatsNewAnnouncement,
} from "../lib/whatsNew/announcement";
import {
  hasSeenAnnouncement,
  mergeAnnouncementSeenIntoMemberJson,
  readAnnouncementSeenMap,
  readSeenMapFromMemberJson,
  rememberAnnouncementSeen,
  WHATS_NEW_ANNOUNCEMENT_SEEN_KEY,
} from "../lib/whatsNew/announcementSeen";
import { sanitizeCardDescriptionHtml } from "../lib/whatsNew/sanitizeBillboardHtml";
import { resolveActivitySender } from "../lib/searchActivityClient";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ACTIVITY_ENDPOINT = "/api/whats-new/announcement-activity";
const ANNOUNCEMENT_ENDPOINT = "/api/whats-new/announcement";

type OpenInput = {
  id: string;
  title: string;
  introductionHtml: string;
  href: string;
};

let openPreviewImpl: ((input: OpenInput) => void) | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readStorage(storage: Storage | undefined): Record<string, string> {
  if (!storage) return {};
  try {
    return readAnnouncementSeenMap(storage.getItem(WHATS_NEW_ANNOUNCEMENT_SEEN_KEY));
  } catch {
    return {};
  }
}

function readBrowserSeen(): Record<string, string> {
  const session = readStorage(window.sessionStorage);
  const local = readStorage(window.localStorage);
  return { ...session, ...local };
}

function writeBrowserSeen(id: string, seenAt: string): boolean {
  const next = rememberAnnouncementSeen(readBrowserSeen(), id, seenAt);
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(WHATS_NEW_ANNOUNCEMENT_SEEN_KEY, raw);
    return true;
  } catch {
    try {
      window.sessionStorage.setItem(WHATS_NEW_ANNOUNCEMENT_SEEN_KEY, raw);
      return true;
    } catch {
      return false;
    }
  }
}

async function waitForSignedIn(): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < 3000) {
    const loggedIn = window.__KBM_AUTH?.loggedIn;
    if (loggedIn === true) return true;
    if (loggedIn === false) return false;
    await delay(100);
  }
  const ms = window.$memberstackDom;
  if (!ms) return false;
  try {
    if (ms.onReady) await ms.onReady;
    const member = await ms.getCurrentMember?.();
    const payload = member as { data?: { id?: string }; id?: string } | null | undefined;
    const id = payload?.data?.id || payload?.id;
    return typeof id === "string" && id.startsWith("mem_");
  } catch {
    return false;
  }
}

async function loadSeen(signedIn: boolean): Promise<Record<string, string>> {
  if (!signedIn) return readBrowserSeen();
  const ms = window.$memberstackDom;
  if (!ms?.getMemberJSON) return {};
  try {
    return readSeenMapFromMemberJson(await ms.getMemberJSON());
  } catch {
    return {};
  }
}

async function rememberSeen(id: string, signedIn: boolean, seenAt: string): Promise<void> {
  if (!signedIn) {
    writeBrowserSeen(id, seenAt);
    return;
  }
  const ms = window.$memberstackDom;
  if (!ms?.getMemberJSON || !ms.updateMemberJSON) return;
  try {
    const current = await ms.getMemberJSON();
    const merged = mergeAnnouncementSeenIntoMemberJson(current, id, seenAt);
    await ms.updateMemberJSON({ json: merged });
  } catch {
    // A failed account write leaves the announcement unseen, so a later visit can try again.
  }
}

function asAnnouncement(value: unknown): WhatsNewAnnouncement | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id.trim()) return null;
  if (typeof row.title !== "string" || !row.title.trim()) return null;
  if (typeof row.introductionHtml !== "string") return null;
  if (typeof row.href !== "string" || !row.href.startsWith("/") || row.href.startsWith("//")) {
    return null;
  }
  if (row.audience !== "everyone" && row.audience !== "members") return null;
  return {
    id: row.id.trim(),
    title: row.title.trim(),
    introductionHtml: row.introductionHtml,
    href: row.href,
    audience: row.audience,
  };
}

async function fetchAnnouncement(): Promise<WhatsNewAnnouncement | null> {
  try {
    const response = await fetch(ANNOUNCEMENT_ENDPOINT, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      ok?: boolean;
      announcement?: unknown;
    };
    if (!data?.ok) return null;
    return asAnnouncement(data.announcement);
  } catch {
    return null;
  }
}

const trackedActivity = new Set<string>();

function track(eventType: "displayed" | "read_more", cardId: string): Promise<void> {
  const key = `${eventType}:${cardId}`;
  if (trackedActivity.has(key)) return Promise.resolve();
  trackedActivity.add(key);
  return (async () => {
    try {
      const sender = await resolveActivitySender();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sender.token) headers.Authorization = `Bearer ${sender.token}`;
      await fetch(ACTIVITY_ENDPOINT, {
        method: "POST",
        headers,
        keepalive: true,
        body: JSON.stringify({
          cardId,
          eventType,
          identity: sender.identity,
          sourcePage: window.location.pathname,
        }),
      });
    } catch {
      // Activity tracking must never block the page.
    }
  })();
}

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest("[hidden]")) return false;
    return true;
  });
}

function wireAnnouncement(host: HTMLElement): void {
  const dialog = host.querySelector<HTMLElement>("[data-wn-announcement-dialog]");
  const title = host.querySelector<HTMLElement>("[data-wn-announcement-title]");
  const intro = host.querySelector<HTMLElement>("[data-wn-announcement-intro]");
  const link = host.querySelector<HTMLAnchorElement>("[data-wn-announcement-read]");
  const previewNote = host.querySelector<HTMLElement>("[data-wn-announcement-preview]");
  const closeButtons = host.querySelectorAll<HTMLButtonElement>("[data-wn-announcement-close]");
  if (!dialog || !title || !intro || !link) return;

  let restoreFocus: HTMLElement | null = null;
  let previousOverflow = "";
  let signedInForLive = false;

  const close = () => {
    if (host.hidden) return;
    host.hidden = true;
    host.setAttribute("aria-hidden", "true");
    document.body.style.overflow = previousOverflow;
    const back = restoreFocus;
    restoreFocus = null;
    if (back && back.isConnected) back.focus();
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (host.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusableElements(dialog);
    if (items.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const open = (input: OpenInput, mode: "live" | "preview") => {
    const safeIntro = sanitizeCardDescriptionHtml(input.introductionHtml || "");
    title.textContent = input.title.trim();
    intro.innerHTML = safeIntro;
    link.href = input.href.startsWith("/") && !input.href.startsWith("//") ? input.href : "/whats-new";
    link.dataset.cardId = input.id;
    if (previewNote) previewNote.hidden = mode !== "preview";
    host.dataset.preview = mode === "preview" ? "true" : "false";
    host.hidden = false;
    host.setAttribute("aria-hidden", "false");
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      dialog.focus();
    } catch {
      // Focus can fail in unusual documents. The dialog is still shown.
    }

    if (mode === "preview" || host.hidden || !host.isConnected) return;
    void rememberSeen(input.id, signedInForLive, new Date().toISOString());
    track("displayed", input.id);
  };

  document.addEventListener("keydown", onKeydown);
  for (const button of closeButtons) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      close();
    });
  }
  host.querySelector("[data-wn-announcement-backdrop]")?.addEventListener("click", () => {
    close();
  });
  link.addEventListener("click", (event) => {
    if (host.dataset.preview === "true") return;
    const cardId = link.dataset.cardId;
    if (!cardId) return;
    // The next page replaces this one immediately, which drops the tracking
    // request before it is sent. Save the click, then open the announcement.
    event.preventDefault();
    const href = link.href;
    void track("read_more", cardId).finally(() => {
      if (href) window.location.assign(href);
    });
  });

  openPreviewImpl = (input) => {
    if (!input.title.trim()) return;
    open(input, "preview");
  };

  if (host.getAttribute("data-wn-announcement-auto") !== "true") return;

  void (async () => {
    const [signedIn, announcement] = await Promise.all([waitForSignedIn(), fetchAnnouncement()]);
    if (!announcement || host.dataset.preview === "true" || !host.hidden) return;
    signedInForLive = signedIn;
    const seen = await loadSeen(signedIn);
    const current = announcementToShow(announcement, signedIn, (id) =>
      hasSeenAnnouncement(seen, id),
    );
    if (!current) return;
    open(current, "live");
  })();
}

export function initWhatsNewAnnouncement(root: ParentNode = document): void {
  const host = root.querySelector<HTMLElement>("[data-wn-announcement]");
  if (!host || host.dataset.wnAnnouncementReady === "true") return;
  host.dataset.wnAnnouncementReady = "true";
  wireAnnouncement(host);
}

/** Admin preview. Does not mark the announcement seen and does not record activity. */
export function openWhatsNewAnnouncementPreview(input: OpenInput, root: ParentNode = document): void {
  initWhatsNewAnnouncement(root);
  openPreviewImpl?.(input);
}
