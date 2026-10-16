/** Show the Bootstrap tab pane targeted by a stored lesson tab link. */

export function legacyTabTargetId(href: string): string {
  const hash = href.trim();
  if (!hash.startsWith("#") || hash.length < 2) return "";
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

export function activateLegacyLessonTab(link: HTMLAnchorElement): boolean {
  const id = legacyTabTargetId(link.getAttribute("href") || "");
  if (!id || typeof link.closest !== "function") return false;
  const scope = link.closest(".legacy-html") ?? link.closest(".legacy-content");
  if (!scope || typeof scope.querySelector !== "function") return false;

  if (!/^[\w:-]+$/.test(id)) return false;
  const pane = scope.querySelector<HTMLElement>(`#${id}`);
  if (!pane || !pane.classList.contains("tab-pane")) return false;

  const tabContent = pane.closest(".tab-content");
  const panes = tabContent
    ? tabContent.querySelectorAll<HTMLElement>(".tab-pane")
    : [pane];
  panes.forEach((item) => item.classList.toggle("active", item === pane));

  const list = link.closest(".nav");
  list?.querySelectorAll("li").forEach((item) => {
    item.classList.toggle("active", item.contains(link));
  });
  return true;
}

export function bindLegacyLessonTabs(root: ParentNode): void {
  const doc = root instanceof Document ? root : root.ownerDocument;
  if (!doc) return;
  if (doc.documentElement.dataset.kinLegacyTabsBound === "true") return;
  doc.documentElement.dataset.kinLegacyTabsBound = "true";
  doc.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>(
      '.legacy-content a[data-toggle="tab"], .legacy-content .nav-tabs a[href^="#"]',
    );
    if (!link) return;
    if (!activateLegacyLessonTab(link)) return;
    event.preventDefault();
  });
}
