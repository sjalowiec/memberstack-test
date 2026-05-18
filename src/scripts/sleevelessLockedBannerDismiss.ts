/** Persists collapsed state for the sleeveless locked / not-yet-unlocked access banner. */
export const SLEEVELESS_LOCKED_BANNER_COLLAPSED_KEY = "kbm-sleeveless-locked-banner-collapsed";

const BOUND_ATTR = "data-sleeveless-locked-banner-bound";

// Dev: clear localStorage key `kbm-sleeveless-locked-banner-collapsed` to restore the large banner.

export function isSleevelessLockedBannerCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(SLEEVELESS_LOCKED_BANNER_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function clearSleevelessLockedBannerCollapsed(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SLEEVELESS_LOCKED_BANNER_COLLAPSED_KEY);
  } catch {
    /* ignore quota / privacy mode */
  }
}

function setSleevelessLockedBannerCollapsed(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SLEEVELESS_LOCKED_BANNER_COLLAPSED_KEY, "true");
  } catch {
    /* ignore quota / privacy mode */
  }
}

/** Full banner and collapsed strip are never visible at the same time. */
function applyLockedBannerView(
  banner: HTMLElement,
  expandLink: HTMLElement,
  collapsed: boolean,
): void {
  banner.hidden = collapsed;
  expandLink.hidden = !collapsed;
}

export function collapseSleevelessLockedBanner(banner: HTMLElement, expandLink: HTMLElement): void {
  setSleevelessLockedBannerCollapsed();
  applyLockedBannerView(banner, expandLink, true);
}

export function expandSleevelessLockedBanner(banner: HTMLElement, expandLink: HTMLElement): void {
  clearSleevelessLockedBannerCollapsed();
  applyLockedBannerView(banner, expandLink, false);
}

/** Wire dismiss / expand controls and restore collapsed state from localStorage. */
export function initSleevelessLockedBannerDismiss(root: ParentNode = document): void {
  const banner = root.querySelector<HTMLElement>("[data-sleeveless-review-access-locked]");
  const expandLink = root.querySelector<HTMLElement>("[data-sleeveless-locked-banner-expand]");
  if (!banner || !expandLink) return;

  const dismissBtn = banner.querySelector<HTMLButtonElement>("[data-sleeveless-locked-banner-dismiss]");

  if (expandLink.getAttribute(BOUND_ATTR) !== "true") {
    expandLink.setAttribute(BOUND_ATTR, "true");
    expandLink.addEventListener("click", () => {
      expandSleevelessLockedBanner(banner, expandLink);
    });
  }

  if (dismissBtn && dismissBtn.getAttribute(BOUND_ATTR) !== "true") {
    dismissBtn.setAttribute(BOUND_ATTR, "true");
    dismissBtn.addEventListener("click", () => {
      collapseSleevelessLockedBanner(banner, expandLink);
    });
  }

  applyLockedBannerView(banner, expandLink, isSleevelessLockedBannerCollapsed());
}
