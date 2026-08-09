/**
 * Hydrate the account My Downloads dashboard from the authenticated entitlements API.
 */
import { escapeHtml } from "../lib/favorites/favoriteStarUi";
import {
  listMyEbookDownloads,
  MyEbookDownloadsAuthError,
  type MyEbookDownloadItem,
} from "../lib/legacy/myEbookDownloadsClient";

function setStatus(root: HTMLElement, text: string): void {
  const status = root.querySelector<HTMLElement>("[data-kbm-my-downloads-status]");
  if (status) status.textContent = text;
}

function setEmptyVisible(root: HTMLElement, visible: boolean): void {
  const empty = root.querySelector<HTMLElement>("[data-kbm-my-downloads-empty]");
  if (empty) empty.hidden = !visible;
}

function renderList(root: HTMLElement, ebooks: MyEbookDownloadItem[]): void {
  const list = root.querySelector<HTMLElement>("[data-kbm-my-downloads-list]");
  if (!list) return;

  list.replaceChildren();

  if (ebooks.length === 0) {
    list.hidden = true;
    setEmptyVisible(root, true);
    setStatus(root, "");
    return;
  }

  setEmptyVisible(root, false);
  list.hidden = false;

  for (const ebook of ebooks) {
    const li = document.createElement("li");
    li.className = "account-downloads__item";
    li.innerHTML =
      `<p class="account-downloads__title">${escapeHtml(ebook.title)}</p>` +
      `<a class="kbm-btn kbm-btn-accent account-downloads__download" href="${escapeHtml(ebook.downloadUrl)}" download>Download</a>`;
    list.appendChild(li);
  }

  setStatus(root, "");
}

async function hydrate(root: HTMLElement): Promise<void> {
  setEmptyVisible(root, false);
  const list = root.querySelector<HTMLElement>("[data-kbm-my-downloads-list]");
  if (list) {
    list.hidden = true;
    list.replaceChildren();
  }
  setStatus(root, "Loading your downloads…");

  try {
    const ebooks = await listMyEbookDownloads();
    renderList(root, ebooks);
  } catch (err) {
    if (err instanceof MyEbookDownloadsAuthError) {
      setStatus(root, "Sign in to see your ebook downloads.");
      setEmptyVisible(root, false);
      return;
    }
    setStatus(root, "We couldn’t load your downloads right now. Please try again.");
    setEmptyVisible(root, false);
  }
}

export function bootAccountMyDownloads(): void {
  const root = document.querySelector<HTMLElement>("[data-kbm-my-downloads]");
  if (!root) return;

  void hydrate(root);

  window.addEventListener("auth:updated", () => {
    void hydrate(root);
  });

  const ms = window.$memberstackDom;
  if (ms?.on) {
    ms.on("member.login", () => {
      void hydrate(root);
    });
    ms.on("member.logout", () => {
      void hydrate(root);
    });
  }
}

bootAccountMyDownloads();
