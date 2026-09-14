/**
 * Hydrate the account My Courses dashboard from Memberstack planConnections.
 *
 * Prefer getAppAndMember (includes planConnections reliably); fall back to
 * getCurrentMember. The panel stays hidden unless the member owns at least
 * one individual course.
 *
 * Boot does not require the panel to be in the DOM yet: Memberstack may insert
 * the members-only dashboard after authentication. Auth listeners are bound
 * first; a MutationObserver watches for the panel, then disconnects.
 */
import { escapeHtml } from "../lib/favorites/favoriteStarUi";
import {
  ownedCoursesForAccount,
  shouldShowAccountMyCourses,
  type AccountOwnedCourseCard,
} from "../lib/kinCourse/accountMyCourses";
import {
  createAccountMyCoursesController,
  findAccountMyCoursesRoot,
} from "../lib/kinCourse/accountMyCoursesInit";

function readCatalogCards(): AccountOwnedCourseCard[] {
  const el = document.getElementById("account-my-courses-catalog");
  if (!el?.textContent) return [];

  try {
    const parsed = JSON.parse(el.textContent) as unknown;
    if (!Array.isArray(parsed)) return [];
    const cards: AccountOwnedCourseCard[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const slug = typeof record.slug === "string" ? record.slug.trim() : "";
      const title = typeof record.title === "string" ? record.title.trim() : "";
      const href = typeof record.href === "string" ? record.href.trim() : "";
      if (!slug || !title || !href) continue;
      cards.push({
        slug,
        title,
        href,
      });
    }
    return cards;
  } catch {
    return [];
  }
}

async function waitForMemberstackPayload(
  attempts = 35,
  delayMs = 200,
): Promise<unknown | null> {
  for (let i = 0; i < attempts; i++) {
    const ms = window.$memberstackDom;
    const api = ms?.getAppAndMember ?? ms?.getCurrentMember;
    if (typeof api === "function") {
      if (ms?.onReady) await ms.onReady;
      try {
        return await api.call(ms);
      } catch (error) {
        console.warn("[account my courses] Memberstack member check failed", error);
        return null;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

function renderList(root: HTMLElement, courses: AccountOwnedCourseCard[]): void {
  const list = root.querySelector<HTMLElement>("[data-kbm-my-courses-list]");
  if (!list) return;

  list.replaceChildren();

  for (const course of courses) {
    const li = document.createElement("li");
    li.className = "account-my-courses__item";
    li.dataset.kbmMyCourseSlug = course.slug;

    li.innerHTML =
      `<p class="account-my-courses__title">${escapeHtml(course.title)}</p>` +
      `<a class="account-my-courses__view" href="${escapeHtml(course.href)}">View Course</a>`;
    list.appendChild(li);
  }
}

export function applyAccountMyCoursesView(
  root: HTMLElement,
  memberOrPayload: unknown,
  catalogCards: AccountOwnedCourseCard[] = readCatalogCards(),
): AccountOwnedCourseCard[] {
  const courses = ownedCoursesForAccount(memberOrPayload, catalogCards);
  const visible = shouldShowAccountMyCourses(courses);

  if (!visible) {
    root.hidden = true;
    const list = root.querySelector<HTMLElement>("[data-kbm-my-courses-list]");
    list?.replaceChildren();
    return courses;
  }

  renderList(root, courses);
  root.hidden = false;
  return courses;
}

const controller = createAccountMyCoursesController({
  getRoot: () => findAccountMyCoursesRoot(document),
  applyView: (root, payload) => {
    applyAccountMyCoursesView(root, payload);
  },
  readPayload: () => waitForMemberstackPayload(),
  addWindowListener: (type, listener) => {
    window.addEventListener(type, listener);
  },
  getMemberstack: () => window.$memberstackDom,
  startObserver: (onMutate) => {
    const observer = new MutationObserver(onMutate);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return observer;
  },
});

export function bootAccountMyCourses(): void {
  controller.boot();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootAccountMyCourses());
  } else {
    bootAccountMyCourses();
  }
}
