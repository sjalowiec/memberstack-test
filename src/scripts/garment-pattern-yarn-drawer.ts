/**
 * Finished sweater pattern — How Much Yarn? drawer open/close (express-yarn-drawer ids).
 * Shared by sleeveless and drop-shoulder pattern workspaces.
 */

export function initGarmentPatternYarnDrawer(opts?: {
  /** Re-dispatch dimensions when opening (YarnRequirement may mount after first push). */
  onOpen?: () => void;
}): void {
  const drawerRoot = document.getElementById("express-yarn-drawer");
  const openBtn = document.getElementById("express-yarn-drawer-open");
  const closeBtn = document.getElementById("express-yarn-drawer-close");
  const backdrop = document.getElementById("express-yarn-drawer-backdrop");
  let lastFocus: HTMLElement | null = null;

  function openDrawer(): void {
    if (!drawerRoot) return;
    opts?.onOpen?.();
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerRoot.classList.add("is-open");
    drawerRoot.setAttribute("aria-hidden", "false");
    document.body.classList.add("hat-yarn-drawer-open");
    openBtn?.setAttribute("aria-expanded", "true");
  }

  function closeDrawer(): void {
    if (!drawerRoot?.classList.contains("is-open")) return;
    drawerRoot.classList.remove("is-open");
    drawerRoot.setAttribute("aria-hidden", "true");
    document.body.classList.remove("hat-yarn-drawer-open");
    openBtn?.setAttribute("aria-expanded", "false");
    const restore = lastFocus;
    if (restore instanceof HTMLElement) {
      restore.focus();
    } else if (openBtn instanceof HTMLElement) {
      openBtn.focus();
    }
    lastFocus = null;
  }

  if (openBtn && openBtn.dataset.garmentYarnDrawerBound !== "true") {
    openBtn.dataset.garmentYarnDrawerBound = "true";
    openBtn.addEventListener("click", () => openDrawer());
  }
  if (closeBtn && closeBtn.dataset.garmentYarnDrawerBound !== "true") {
    closeBtn.dataset.garmentYarnDrawerBound = "true";
    closeBtn.addEventListener("click", () => closeDrawer());
  }
  if (backdrop && backdrop.dataset.garmentYarnDrawerBound !== "true") {
    backdrop.dataset.garmentYarnDrawerBound = "true";
    backdrop.addEventListener("click", () => closeDrawer());
  }
  if (drawerRoot && drawerRoot.dataset.garmentYarnEscBound !== "true") {
    drawerRoot.dataset.garmentYarnEscBound = "true";
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (drawerRoot.classList.contains("is-open")) {
        closeDrawer();
        e.preventDefault();
      }
    });
  }
}

export function setGarmentPatternYarnActionVisible(visible: boolean): void {
  const yarnBtn = document.getElementById("express-yarn-drawer-open");
  if (!(yarnBtn instanceof HTMLElement)) return;
  if (visible) {
    yarnBtn.hidden = false;
    yarnBtn.style.display = "";
    yarnBtn.removeAttribute("aria-disabled");
  } else {
    yarnBtn.hidden = true;
    yarnBtn.style.display = "none";
    yarnBtn.setAttribute("aria-expanded", "false");
  }
}
