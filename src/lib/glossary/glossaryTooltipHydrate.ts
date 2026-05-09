/**
 * Client-side hydration for `.glossary-tooltip-placeholder` spans (dynamic HTML strings).
 * Mirrors markup + behavior from GlossaryTooltip.astro.
 */
import glossaryData from "../../data/glossary.json";

type GlossaryRow = {
  glossaryId: number;
  english: string;
  example?: string;
  helpinfo?: string;
  image?: string;
  image_alt?: string;
};

const glossary: GlossaryRow[] = Array.isArray(glossaryData) ? (glossaryData as GlossaryRow[]) : [];

function sanitizeGlossaryPopupHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<video\b[\s\S]*?<\/video>/gi, "")
    .replace(/<audio\b[\s\S]*?<\/audio>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*\/?>/gi, "");
}

function escapeHtmlAttr(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeGlossaryImageSrc(path: string): string {
  const p = (path ?? "").trim();
  if (!p) return "";
  if (p.startsWith("http") || p.startsWith("/")) return p;
  return `/images/glossary/${p.replace(/^\.?\//, "")}`;
}

function buildGlossaryContentHtml(entry: GlossaryRow): string {
  const parts: string[] = [];
  const ex = (entry.example ?? "").trim();
  if (ex) {
    if (/[<>]/.test(ex)) {
      parts.push(sanitizeGlossaryPopupHtml(ex));
    } else {
      parts.push(`<p class="glossary-popup-lead">${escapeHtmlText(ex)}</p>`);
    }
  }
  const imgSrc = normalizeGlossaryImageSrc(entry.image ?? "");
  const altRaw = (entry.image_alt ?? "").trim() || stripHtml(entry.english ?? "");
  if (imgSrc) {
    parts.push(
      `<figure class="glossary-popup-figure"><img src="${escapeHtmlAttr(imgSrc)}" alt="${escapeHtmlAttr(altRaw)}" loading="lazy" /></figure>`
    );
  }
  const help = (entry.helpinfo ?? "").trim();
  if (help) {
    parts.push(`<div class="glossary-popup-help">${sanitizeGlossaryPopupHtml(help)}</div>`);
  }
  return parts.join("");
}

const stripHtml = (s: string) => (s ?? "").replace(/<[^>]*>/g, "").trim();

export function getGlossaryTooltipPayload(glossaryId: number): {
  cleanHtml: string;
  titlePlain: string;
} | null {
  const entry = glossary.find((e) => e.glossaryId === glossaryId);
  if (!entry) return null;
  return {
    cleanHtml: buildGlossaryContentHtml(entry),
    titlePlain: stripHtml(entry.english ?? ""),
  };
}

function ensureGlossaryApi(w: Window & { __kbmGlossaryApi?: unknown; __kbmGlossaryGlobalsBound?: boolean }) {
  if (!w.__kbmGlossaryApi) {
    w.__kbmGlossaryApi = {
      closeAll: function () {
        document.querySelectorAll(".glossary-tooltip-wrap").forEach(function (wrap) {
          const wrapId = wrap.id || "";
          const p = wrapId ? document.getElementById(wrapId + "-popup") : null;
          const b = wrap.querySelector(".glossary-tooltip-trigger");
          if (p instanceof HTMLElement) p.setAttribute("hidden", "");
          if (b instanceof HTMLElement) b.setAttribute("aria-expanded", "false");
          wrap.classList.remove("glossary-tooltip-wrap--open");
        });
      },
      ensureGlobalListeners: function () {
        if (w.__kbmGlossaryGlobalsBound) return;
        w.__kbmGlossaryGlobalsBound = true;
        document.addEventListener(
          "pointerdown",
          function (e) {
            const t = e.target;
            if (!(t instanceof Element)) return;
            if (t.closest(".glossary-tooltip-wrap")) return;
            if (t.closest("[data-glossary-popup]")) return;
            if (t.closest(".glossary-mobile-scrim")) return;
            (w.__kbmGlossaryApi as { closeAll: () => void }).closeAll();
          },
          true
        );
        document.addEventListener("keydown", function (e) {
          if (e.key !== "Escape") return;
          if (!document.querySelector(".glossary-tooltip-wrap--open")) return;
          e.preventDefault();
          (w.__kbmGlossaryApi as { closeAll: () => void }).closeAll();
        });
      },
    };
  }
  (w.__kbmGlossaryApi as { ensureGlobalListeners: () => void }).ensureGlobalListeners();
}

function bindGlossaryTooltipInstance(
  w: Window & { __kbmGlossaryApi?: { closeAll: () => void; ensureGlobalListeners: () => void } },
  root: HTMLElement,
  popup: HTMLElement,
  opts: { autoOnce: boolean; lsKey: string }
) {
  const btn = root.querySelector(".glossary-tooltip-trigger");
  if (!btn || !popup || !(btn instanceof HTMLButtonElement) || !(popup instanceof HTMLElement)) return;

  const lsKey = opts.lsKey || "";
  const autoOnce = opts.autoOnce;
  const api = w.__kbmGlossaryApi!;

  function isOpen() {
    return !popup.hasAttribute("hidden");
  }

  function isMobileLayout() {
    return w.matchMedia && w.matchMedia("(max-width: 640px)").matches;
  }

  function syncPopupPosition() {
    if (!isOpen() || !root.isConnected) return;
    if (isMobileLayout()) {
      popup.style.top = "50%";
      popup.style.left = "50%";
      popup.style.right = "auto";
      popup.style.bottom = "auto";
      popup.style.transform = "translate(-50%, -50%)";
      return;
    }
    const r = root.getBoundingClientRect();
    const gap = 8;
    const vw = w.innerWidth || document.documentElement.clientWidth;
    const estW = Math.min(420, vw * 0.85);
    let top = r.bottom + gap;
    let left = r.left;
    if (left + estW > vw - 8) left = Math.max(8, vw - estW - 8);
    if (left < 8) left = 8;
    popup.style.top = top + "px";
    popup.style.left = left + "px";
    popup.style.right = "auto";
    popup.style.bottom = "auto";
    popup.style.transform = "none";
  }

  function onViewportChange() {
    if (isOpen()) syncPopupPosition();
  }

  w.addEventListener("scroll", onViewportChange, true);
  w.addEventListener("resize", onViewportChange);

  function markSeen() {
    if (!autoOnce || !lsKey) return;
    try {
      localStorage.setItem(lsKey, "1");
    } catch {
      /* ignore */
    }
  }

  function isSeen() {
    if (!lsKey) return true;
    try {
      return localStorage.getItem(lsKey) === "1";
    } catch {
      return true;
    }
  }

  function setExpanded(open: boolean) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    root.classList.toggle("glossary-tooltip-wrap--open", open);
  }

  function openPopup() {
    api.closeAll();
    popup.removeAttribute("hidden");
    setExpanded(true);
    syncPopupPosition();
    markSeen();
    requestAnimationFrame(function () {
      syncPopupPosition();
      const closeBtn = popup.querySelector("[data-glossary-close]");
      if (closeBtn instanceof HTMLElement) closeBtn.focus();
    });
  }

  function closePopup() {
    popup.setAttribute("hidden", "");
    setExpanded(false);
    btn.focus();
  }

  function togglePopup() {
    if (isOpen()) closePopup();
    else openPopup();
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    togglePopup();
  });

  const closeBtn = popup.querySelector("[data-glossary-close]");
  closeBtn?.addEventListener("click", function (e) {
    e.stopPropagation();
    e.preventDefault();
    closePopup();
  });

  const scrim = root.querySelector("[data-glossary-mobile-scrim]");
  scrim?.addEventListener("click", function () {
    closePopup();
  });

  if (autoOnce && lsKey && !isSeen()) {
    requestAnimationFrame(function () {
      if (!root.isConnected || isOpen()) return;
      if (isSeen()) return;
      openPopup();
    });
  }
}

function replacePlaceholderWithTooltip(placeholder: HTMLElement) {
  const w = window as Window & { __kbmGlossaryApi?: unknown; __kbmGlossaryGlobalsBound?: boolean };
  ensureGlossaryApi(w);

  const idRaw = placeholder.getAttribute("data-glossary-id");
  const glossaryId = idRaw != null ? Number(idRaw) : NaN;
  const fallbackTerm = placeholder.getAttribute("data-term") ?? "";
  const visibleLabel = (placeholder.textContent ?? fallbackTerm).trim() || fallbackTerm;

  const entry = Number.isFinite(glossaryId) ? glossary.find((e) => e.glossaryId === glossaryId) : undefined;

  if (!entry) {
    const fb = document.createElement("span");
    fb.className = "glossary-tooltip-fallback glossary-tooltip";
    fb.textContent = visibleLabel;
    placeholder.replaceWith(fb);
    return;
  }

  const payload = getGlossaryTooltipPayload(entry.glossaryId)!;

  const rootId = `gt-${crypto.randomUUID()}`;
  const titleId = `gt-title-${crypto.randomUUID()}`;
  const popupId = rootId + "-popup";

  const wrap = document.createElement("span");
  wrap.className = "glossary-tooltip glossary-tooltip-wrap";
  wrap.id = rootId;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "glossary-tooltip-trigger";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", popupId);

  const label = document.createElement("span");
  label.className = "glossary-tooltip-label";
  label.append(document.createTextNode(visibleLabel));
  const sup = document.createElement("sup");
  sup.className = "glossary-tooltip-icon";
  sup.setAttribute("aria-hidden", "true");
  sup.textContent = "?";
  label.append(sup);
  btn.append(label);

  const scrim = document.createElement("span");
  scrim.className = "glossary-mobile-scrim";
  scrim.setAttribute("data-glossary-mobile-scrim", "");
  scrim.setAttribute("aria-hidden", "true");

  wrap.append(btn, scrim);

  let popup = document.getElementById(popupId) as HTMLElement | null;
  if (!popup) {
    popup = document.createElement("div");
    popup.className = "glossary-popup glossary-tooltip-popup";
    popup.id = popupId;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "false");
    popup.setAttribute("aria-labelledby", titleId);
    popup.setAttribute("hidden", "");
    popup.setAttribute("data-glossary-popup", "");

    const srH = document.createElement("h2");
    srH.className = "glossary-popup-sr-title";
    srH.id = titleId;
    srH.textContent = payload.titlePlain;

    const closeB = document.createElement("button");
    closeB.type = "button";
    closeB.className = "glossary-close";
    closeB.setAttribute("data-glossary-close", "");
    closeB.setAttribute("aria-label", "Close");
    closeB.textContent = "\u00d7";

    const contentEl = document.createElement("div");
    contentEl.className = "glossary-content";
    contentEl.innerHTML = payload.cleanHtml;

    popup.append(srH, closeB, contentEl);
    document.body.appendChild(popup);
  }

  placeholder.replaceWith(wrap);

  bindGlossaryTooltipInstance(w, wrap, popup, { autoOnce: false, lsKey: "" });
}

/** Finds `.glossary-tooltip-placeholder` under `root` and swaps in real glossary tooltip UI. */
export function hydrateGlossaryTooltipPlaceholders(root: ParentNode | null | undefined) {
  if (!root) return;
  root.querySelectorAll(".glossary-tooltip-placeholder").forEach((el) => {
    if (el instanceof HTMLElement) replacePlaceholderWithTooltip(el);
  });
}
