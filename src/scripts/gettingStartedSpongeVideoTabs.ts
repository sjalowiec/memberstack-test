/**
 * One sponge-bar video at a time.
 * The LK150 tab starts selected only after Step 1 commits that model.
 */

import {
  PAUSE_VIMEO_PLAYER_ORIGIN,
  applySpongeTabChange,
  pauseVimeoPlayerMessage,
  spongeTabFromKey,
  spongeVideoTabForModel,
  type SpongeVideoTab,
} from "../lib/gettingStarted/spongeVideoTabs";

function asSpongeTab(value: string | undefined): SpongeVideoTab {
  return value === "lk150" ? "lk150" : "metal";
}

function pausePanel(panel: ParentNode | null | undefined): void {
  panel?.querySelectorAll("iframe").forEach((node) => {
    if (!(node instanceof HTMLIFrameElement)) return;
    node.contentWindow?.postMessage(pauseVimeoPlayerMessage(), PAUSE_VIMEO_PLAYER_ORIGIN);
  });
}

export function initGettingStartedSpongeVideoTabs(root: ParentNode): void {
  const scope = root.querySelector<HTMLElement>("[data-gsg-sponge-tabs]");
  if (!scope || scope.dataset.gsgSpongeTabsBound === "true") return;
  scope.dataset.gsgSpongeTabsBound = "true";

  const tablist = scope.querySelector<HTMLElement>('[role="tablist"]');
  const tabs = [...scope.querySelectorAll<HTMLButtonElement>("[data-gsg-sponge-tab]")];
  const panels = [...scope.querySelectorAll<HTMLElement>("[data-gsg-sponge-panel]")];
  if (!tablist || tabs.length === 0 || panels.length === 0) return;

  function currentTab(): SpongeVideoTab {
    const selected = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
    return asSpongeTab(selected?.dataset.gsgSpongeTab);
  }

  function render(next: SpongeVideoTab, focus: boolean): void {
    const change = applySpongeTabChange(currentTab(), next);
    if (change.pauseTab) {
      pausePanel(panels.find((panel) => panel.dataset.gsgSpongePanel === change.pauseTab));
    }
    for (const tab of tabs) {
      const on = tab.dataset.gsgSpongeTab === change.tab;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    }
    for (const panel of panels) {
      const on = panel.dataset.gsgSpongePanel === change.tab;
      panel.hidden = !on;
      if (on) panel.removeAttribute("inert");
      else panel.setAttribute("inert", "");
    }
  }

  tablist.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tab = target.closest<HTMLButtonElement>("[data-gsg-sponge-tab]");
    if (!tab || !scope.contains(tab)) return;
    render(asSpongeTab(tab.dataset.gsgSpongeTab), false);
  });

  tablist.addEventListener("keydown", (event) => {
    const active = event.target;
    if (!(active instanceof HTMLButtonElement) || !tabs.includes(active)) return;
    const next = spongeTabFromKey(currentTab(), event.key);
    if (!next) return;
    event.preventDefault();
    render(next, true);
  });

  const model = root.querySelector<HTMLElement>('[data-gsg-combo="model"]');
  const syncFromIdentity = () => {
    const modelId = model?.getAttribute("data-selected-id") ?? "";
    const modelLabel = model?.querySelector<HTMLInputElement>("[data-gsg-input]")?.value ?? "";
    render(spongeVideoTabForModel(modelId, modelLabel), false);
  };

  if (model) {
    const observer = new MutationObserver(syncFromIdentity);
    observer.observe(model, { attributes: true, attributeFilter: ["data-selected-id"] });
  }
  syncFromIdentity();
}
