export type PatternTabName = "build" | "pattern" | "share" | "inspiration";

export interface PatternTabsControl {
  activateTab: (name: PatternTabName) => void;
}

function loadPatternComments(): void {
  const el = document.querySelector("[data-pattern-comments]");
  if (!el || !(el instanceof HTMLElement)) return;

  const commentsEl = el;
  const alreadyLoaded = commentsEl.dataset.hyvorLoaded === "true";
  const websiteId = commentsEl.dataset.hyvorWebsiteId;
  const cleanPath = window.location.pathname.replace(/\/$/, "") || "/";

  const w = window as Window &
    typeof globalThis & {
      HYVOR_TALK_WEBSITE?: number;
      HYVOR_TALK_CONFIG?: { url: string; id: string };
      HyvorTalk?: { reload?: () => void };
    };

  w.HYVOR_TALK_WEBSITE = Number(websiteId);
  w.HYVOR_TALK_CONFIG = {
    url: window.location.origin + cleanPath,
    id: cleanPath,
  };

  if (alreadyLoaded) {
    if (w.HyvorTalk && typeof w.HyvorTalk.reload === "function") {
      w.HyvorTalk.reload();
    }
    return;
  }

  const existingScript = document.querySelector("script[data-hyvor-embed]");
  if (existingScript) {
    commentsEl.dataset.hyvorLoaded = "true";
    if (w.HyvorTalk && typeof w.HyvorTalk.reload === "function") {
      w.HyvorTalk.reload();
    }
    return;
  }

  const script = document.createElement("script");
  script.src = "https://talk.hyvor.com/web-api/embed.js";
  script.async = true;
  script.type = "text/javascript";
  script.setAttribute("data-hyvor-embed", "true");

  script.onload = () => {
    commentsEl.dataset.hyvorLoaded = "true";
    if (w.HyvorTalk && typeof w.HyvorTalk.reload === "function") {
      w.HyvorTalk.reload();
    }
  };

  document.body.appendChild(script);
}

/**
 * Wire tab buttons/panels inside a `.pattern-tabs` root. Returns `activateTab` for programmatic switches.
 * Multiple instances: pass the specific `.pattern-tabs` element as `root`.
 */
export function initPatternTabs(root: ParentNode | null | undefined): PatternTabsControl | null {
  const tabsRoot =
    root &&
    (root instanceof Element && root.classList.contains("pattern-tabs")
      ? root
      : root.querySelector(".pattern-tabs"));

  if (!tabsRoot) return null;

  const tabButtons = tabsRoot.querySelectorAll<HTMLButtonElement>(".pattern-tab-nav .tab-btn");
  const tabPanels = tabsRoot.querySelectorAll<HTMLElement>(".pattern-tab-content .tab-panel");

  function activateTab(target: PatternTabName): void {
    const panel = tabsRoot.querySelector<HTMLElement>(`#tab-${target}`);
    if (!panel) return;

    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === target);
    });
    tabPanels.forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${target}`);
    });

    if (target === "share") {
      loadPatternComments();
    }
    if (target === "inspiration") {
      const win = window as Window &
        typeof globalThis & {
          PinUtils?: { build?: (r?: Document | Element | null) => void };
          kbmSchedulePinterestEmbedsRefresh?: (root?: Document | Element | null) => void;
        };
      if (win.PinUtils && typeof win.PinUtils.build === "function") {
        win.PinUtils.build();
      }
      win.kbmSchedulePinterestEmbedsRefresh?.();
    }
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.classList.contains("is-disabled")) return;
      const target = button.dataset.tab as PatternTabName | undefined;
      if (!target) return;
      activateTab(target);
    });
  });

  const shareTabIsActive =
    tabsRoot.querySelector(".pattern-tab-nav .tab-btn[data-tab='share']")?.classList.contains("active") ||
    tabsRoot.querySelector("#tab-share")?.classList.contains("active");

  if (shareTabIsActive) {
    loadPatternComments();
  }

  return { activateTab };
}
