/** Wire the lesson-page video modal and inline frame expand buttons under `root`. */
export function initLessonVideoModal(root: ParentNode = document): void {
  const openBtn = root.querySelector<HTMLButtonElement>("#lesson-video-open");
  const inlineOpenBtns = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".lesson-video-frame__open"),
  );
  const dialog = root.querySelector<HTMLDialogElement>("#lesson-video-modal");
  const iframe = root.querySelector<HTMLIFrameElement>("#lesson-video-modal-iframe");
  const closeBtn = dialog?.querySelector<HTMLButtonElement>(".lesson-video-modal__close") ?? null;

  if ((!openBtn && inlineOpenBtns.length === 0) || !dialog || !iframe) return;
  if (dialog.dataset.lessonVideoModalBound === "true") return;
  dialog.dataset.lessonVideoModalBound = "true";

  const baseSrc = dialog.getAttribute("data-player-src") || "";
  let lastFocused: Element | null = null;

  function withAutoplay(url: string): string {
    if (!url) return "";
    return url + (url.includes("?") ? "&" : "?") + "autoplay=1";
  }

  function openModal(src: string, trigger: Element | null): void {
    const resolvedSrc = src || baseSrc;
    if (!resolvedSrc) return;
    lastFocused = trigger || document.activeElement;
    iframe.setAttribute("src", withAutoplay(resolvedSrc));
    dialog.showModal();
    document.body.style.overflow = "hidden";
    closeBtn?.focus();
  }

  function closeModal(): void {
    iframe.removeAttribute("src");
    dialog.close();
    document.body.style.overflow = "";
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  openBtn?.addEventListener("click", () => openModal(baseSrc, openBtn));
  inlineOpenBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      openModal(btn.getAttribute("data-player-src") || "", btn);
    });
  });
  closeBtn?.addEventListener("click", closeModal);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeModal();
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeModal();
  });
}
