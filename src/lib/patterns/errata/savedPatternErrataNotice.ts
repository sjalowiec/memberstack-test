import { readActiveCustomPatternProjectId } from "../customPatternProjectActiveId";
import { getCurrentPattern } from "../patternStorage";
import { noticesForSavedPattern, savedPatternNoticeText, type SavedPatternErrataNotice } from "./errataVisibility";
import type { PatternErrataRecord } from "./types";

const MOUNT_ATTR = "data-pattern-errata-notice";

function noticeElement(notice: SavedPatternErrataNotice): HTMLElement {
  const article = document.createElement("article");
  article.className = "pattern-errata-notice";
  article.setAttribute("role", "note");

  const heading = document.createElement("h2");
  heading.className = "pattern-errata-notice__title";
  heading.textContent = `Pattern correction: ${notice.title}`;

  const body = document.createElement("p");
  body.className = "pattern-errata-notice__body";
  body.textContent = savedPatternNoticeText(notice);

  const link = document.createElement("a");
  link.className = "pattern-errata-notice__link";
  link.href = notice.href;
  link.textContent = "Read the full correction";

  article.append(heading, body, link);
  return article;
}

export function renderSavedPatternErrataNotices(
  mount: HTMLElement,
  notices: readonly SavedPatternErrataNotice[],
): void {
  mount.replaceChildren();
  if (notices.length === 0) {
    mount.hidden = true;
    return;
  }
  mount.hidden = false;
  for (const notice of notices) {
    mount.append(noticeElement(notice));
  }
}

function ensureMount(): HTMLElement | null {
  const existing = document.querySelector<HTMLElement>(`[${MOUNT_ATTR}]`);
  if (existing) return existing;
  const anchor =
    document.querySelector("#pattern-content") ??
    document.querySelector("[data-saved-pattern-header]");
  if (!anchor?.parentElement) return null;
  const mount = document.createElement("div");
  mount.className = "pattern-errata-notices";
  mount.setAttribute(MOUNT_ATTR, "");
  mount.hidden = true;
  anchor.parentElement.insertBefore(mount, anchor);
  return mount;
}

function recordFromPublic(value: unknown): PatternErrataRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<PatternErrataRecord>;
  if (row.status !== "published") return null;
  if (typeof row.id !== "string" || typeof row.slug !== "string" || typeof row.title !== "string") {
    return null;
  }
  if (typeof row.whatChanged !== "string" || typeof row.knitterAction !== "string") return null;
  if (!row.matchRules || row.matchRules.kind !== "finished-length-defaults") return null;
  return {
    id: row.id,
    slug: row.slug,
    status: "published",
    title: row.title,
    whatChanged: row.whatChanged,
    knitterAction: row.knitterAction,
    publishedOn: typeof row.publishedOn === "string" ? row.publishedOn : null,
    affectedBuilders: Array.isArray(row.affectedBuilders) ? row.affectedBuilders : [],
    affectedSizes: row.affectedSizes && typeof row.affectedSizes === "object" ? row.affectedSizes : {},
    matchRules: row.matchRules,
    createdAt: "",
    updatedAt: "",
    updatedBy: null,
  };
}

/**
 * Show published corrections on an opened saved pattern.
 * Reads the working copy already loaded for this page. Does not save or edit measurements.
 */
export async function mountSavedPatternErrataNotices(
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (typeof document === "undefined") return;
  const mount = ensureMount();
  if (!mount) return;

  const savedProjectId = readActiveCustomPatternProjectId();
  if (!savedProjectId?.trim()) {
    renderSavedPatternErrataNotices(mount, []);
    return;
  }

  let payload: unknown;
  try {
    const response = await fetchImpl("/api/pattern-errata");
    if (!response.ok) {
      renderSavedPatternErrataNotices(mount, []);
      return;
    }
    payload = await response.json();
  } catch {
    renderSavedPatternErrataNotices(mount, []);
    return;
  }

  const rawList =
    payload && typeof payload === "object" && Array.isArray((payload as { errata?: unknown }).errata)
      ? (payload as { errata: unknown[] }).errata
      : [];
  const published = rawList.flatMap((entry) => {
    const record = recordFromPublic(entry);
    return record ? [record] : [];
  });
  const project = {
    ...getCurrentPattern(),
    pattern: getCurrentPattern(),
    createdAt: getCurrentPattern().createdAt,
  };
  renderSavedPatternErrataNotices(mount, noticesForSavedPattern(published, project, savedProjectId));
}
