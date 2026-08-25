import {
  getViewerAccessState,
  logMemberAccessDebug,
  type ViewerAccessState,
} from "../lib/memberAccess";
import { openMemberstackLoginModal } from "../lib/memberstackLogin";
import { memberDownloadCtaSpec } from "../lib/printables/memberDownloadCta";
import { hidePrintableBuyNow } from "../lib/printables/printableProductBuyNow";

async function waitForMemberstackReady({ attempts = 30, delayMs = 200 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const ms = window.$memberstackDom;
      const api = ms?.getAppAndMember ?? ms?.getCurrentMember;
      if (typeof api === "function") return await api.call(ms);
    } catch {
      /* keep polling until Memberstack is ready */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export async function resolvePrintableDownloadViewerState(
  gate: string,
): Promise<ViewerAccessState> {
  const res = await waitForMemberstackReady();
  logMemberAccessDebug(gate, res);
  return getViewerAccessState(res);
}

export function renderPrintableDownloadCta(
  mount: HTMLElement,
  state: ViewerAccessState | null,
  downloadHref: string,
  downloadLabel: string,
): void {
  mount.replaceChildren();
  const spec = memberDownloadCtaSpec(state, downloadHref, downloadLabel);

  if (spec.lockedStatus) {
    const status = document.createElement("p");
    status.className = "printable-download-card__locked-status";
    status.textContent = spec.lockedStatus;
    mount.appendChild(status);
  }

  if (spec.lockedSupport) {
    const support = document.createElement("p");
    support.className = "printable-download-card__locked-support";
    support.textContent = spec.lockedSupport;
    mount.appendChild(support);
  }

  for (const button of spec.buttons) {
    const link = document.createElement("a");
    link.className =
      button.variant === "primary"
        ? "kbm-btn kbm-btn-accent printable-download-card__cta"
        : "kbm-btn kbm-btn-outline printable-download-card__cta printable-download-card__cta--secondary";
    link.href = button.href;
    link.textContent = button.text;

    if (button.action === "download") {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    if (button.action === "login") {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openMemberstackLoginModal();
      });
    }

    mount.appendChild(link);
  }
}

function syncCard(card: HTMLElement, state: ViewerAccessState | null): void {
  const downloadHref = card.dataset.downloadHref?.trim() ?? "";
  const downloadLabel = card.dataset.downloadLabel?.trim() ?? "Download (PDF)";
  const mount = card.querySelector<HTMLElement>("[data-printable-download-cta]");
  if (!mount) return;
  renderPrintableDownloadCta(mount, state, downloadHref, downloadLabel);
}

export function syncPrintableDownloadCards(state: ViewerAccessState): void {
  document.querySelectorAll<HTMLElement>("[data-printable-download]").forEach((card) => {
    syncCard(card, state);
  });
}

export function clearPrintableDownloadCards(): void {
  document.querySelectorAll<HTMLElement>("[data-printable-download]").forEach((card) => {
    syncCard(card, null);
  });
}

function previewOverride(): ViewerAccessState | null {
  const root = document.querySelector<HTMLElement>("[data-printable-product-actions]");
  const mode = root?.dataset.previewMode?.trim() ?? "";
  if (mode === "memberAccess" || mode === "loggedOut" || mode === "loggedInNoAccess") {
    return mode;
  }

  const previewMember = new URLSearchParams(window.location.search).get("previewMember");
  if (previewMember === "member") return "memberAccess";
  if (previewMember === "nonmember") return "loggedOut";
  return null;
}

function syncProductBuyNow(state: ViewerAccessState | null): void {
  document.querySelectorAll<HTMLElement>("[data-printable-product-actions]").forEach((root) => {
    const memberFree = root.dataset.memberFree === "true";
    const buy = root.querySelector<HTMLElement>("[data-buy-now]");
    if (!buy) return;
    buy.hidden = hidePrintableBuyNow(memberFree, state);
  });
}

let authListenersBound = false;

function bindPrintableDownloadRefresh(onRefresh: () => void): void {
  if (authListenersBound) return;
  authListenersBound = true;
  window.addEventListener("auth:updated", onRefresh);
  const ms = window.$memberstackDom;
  if (ms?.on) {
    ms.on("member.login", onRefresh);
    ms.on("member.logout", onRefresh);
  }
  void ms?.onReady?.then(() => {
    onRefresh();
  });
}

export function runPrintableDownloadGate(): void {
  clearPrintableDownloadCards();
  syncProductBuyNow(null);

  async function refresh(): Promise<void> {
    const state =
      previewOverride() ??
      (await resolvePrintableDownloadViewerState("downloads/shop/[slug].printableDownload"));
    syncPrintableDownloadCards(state);
    syncProductBuyNow(state);
  }

  void refresh();
  bindPrintableDownloadRefresh(() => {
    clearPrintableDownloadCards();
    void refresh();
  });
}

export function bootPrintableDownloadGates(): void {
  if (document.querySelector("[data-printable-download]")) {
    runPrintableDownloadGate();
  }
}
