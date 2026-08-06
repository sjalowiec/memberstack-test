/**
 * Finished-pattern Bust Dart action + modal client (Sleeveless / Drop Shoulder workspaces).
 */
import {
  applyBustDartCupToWorkingDraft,
  buildBustDartPatternContext,
  bustDartCupOptions,
  isPatternEligibleForBustDartAction,
  parseCupSizeInput,
  persistBustDartCustomization,
  previewBustDartForPattern,
  removeBustDartFromWorkingDraft,
  type BustDartPatternContext,
} from "../lib/patterns/bustDartPatternCustomization";
import { readBustDartConfigFromPatternData } from "../lib/patterns/legoBlocks/bustDart";
import { getPatternData } from "../lib/patterns/patternStorage";
import type { DartCupSize, DartFormulaUnit } from "../lib/tools/dartFormulaMath";

declare global {
  interface Window {
    kbmRefreshSleevelessPattern?: () => void | Promise<void>;
  }
}

function $(sel: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(sel);
}

function syncCupLabels(modal: HTMLElement, unit: DartFormulaUnit): void {
  const sel = modal.querySelector<HTMLSelectElement>("#bust-dart-pattern-cup");
  if (!sel) return;
  const opts = bustDartCupOptions(unit);
  for (let i = 0; i < sel.options.length; i++) {
    const opt = sel.options[i];
    const hit = opts.find((o) => o.value === opt.value);
    if (hit) opt.textContent = hit.label;
  }
}

function fillSummary(modal: HTMLElement, ctx: BustDartPatternContext): void {
  const set = (attr: string, text: string) => {
    const el = modal.querySelector(`[${attr}]`);
    if (el) el.textContent = text || "—";
  };
  set("data-bust-dart-summary-construction", ctx.summary.constructionLabel);
  set("data-bust-dart-summary-garment", ctx.summary.garmentLabel);
  set("data-bust-dart-summary-gauge", ctx.summary.gaugeLabel);
  set("data-bust-dart-summary-front-sts", ctx.summary.frontStitchesLabel);
  set("data-bust-dart-summary-placement", ctx.summary.placementLabel);
}

function setError(modal: HTMLElement, message: string | null): void {
  const el = modal.querySelector<HTMLElement>("[data-bust-dart-modal-error]");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function renderPreview(modal: HTMLElement, ctx: BustDartPatternContext, cup: DartCupSize | null): void {
  const box = modal.querySelector<HTMLElement>("[data-bust-dart-modal-preview]");
  const list = modal.querySelector<HTMLElement>("[data-bust-dart-modal-preview-list]");
  if (!box || !list) return;
  if (!cup) {
    box.hidden = true;
    list.innerHTML = "";
    return;
  }
  const result = previewBustDartForPattern(ctx, cup);
  if (!result.active) {
    box.hidden = true;
    list.innerHTML = "";
    setError(modal, result.errors[0] || "Could not calculate this dart for the current pattern.");
    return;
  }
  setError(modal, null);
  const lines = [
    `Cup ${result.config.cupSize}`,
    `Starts at RC ${result.dartStartGarmentRc} (1″ below armhole)`,
    `${result.shaping?.totalHeldStitches ?? "—"} stitches held across ${result.shaping?.shapingPasses ?? "—"} shaping passes`,
    ...result.holdStepLines.filter((l) => l.startsWith("Place ")),
  ];
  list.innerHTML = lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("");
  box.hidden = false;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function refreshPatternView(): Promise<void> {
  if (typeof window.kbmRefreshSleevelessPattern === "function") {
    await window.kbmRefreshSleevelessPattern();
  }
}

function updateActionButtonLabel(btn: HTMLButtonElement): void {
  const imported = readBustDartConfigFromPatternData(getPatternData());
  if (imported.enabled && imported.cupSize) {
    btn.textContent = `Bust Dart (Cup ${imported.cupSize})`;
    btn.setAttribute("aria-label", `Change or remove bust dart, currently cup ${imported.cupSize}`);
  } else {
    btn.textContent = "Optional Bust Dart";
    btn.setAttribute("aria-label", "Add optional bust dart");
  }
}

function mountActionButton(host: HTMLElement): HTMLButtonElement {
  let btn = host.querySelector<HTMLButtonElement>("[data-bust-dart-pattern-open]");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sleeveless-pattern-edit-action no-print";
    btn.setAttribute("data-bust-dart-pattern-open", "");
    btn.setAttribute("data-testid", "button-optional-bust-dart");
    btn.setAttribute("aria-haspopup", "dialog");
    // Insert before Print when present
    const printBtn = host.querySelector("#print-btn");
    if (printBtn) host.insertBefore(btn, printBtn);
    else host.appendChild(btn);
  }
  updateActionButtonLabel(btn);
  return btn;
}

export function syncBustDartPatternActionVisibility(): void {
  const host = document.querySelector<HTMLElement>("[data-sleeveless-pattern-actions]");
  if (!host) return;
  const eligible = isPatternEligibleForBustDartAction();
  let btn = host.querySelector<HTMLButtonElement>("[data-bust-dart-pattern-open]");
  if (!eligible) {
    if (btn) btn.hidden = true;
    return;
  }
  btn = mountActionButton(host);
  btn.hidden = false;
  updateActionButtonLabel(btn);
}

export function initBustDartPatternCustomization(): void {
  const modal = document.querySelector<HTMLDialogElement>("[data-bust-dart-pattern-modal]");
  if (!modal) return;

  let context: BustDartPatternContext | null = null;

  const cupSelect = () => modal.querySelector<HTMLSelectElement>("#bust-dart-pattern-cup");
  const removeBtn = modal.querySelector<HTMLButtonElement>("[data-bust-dart-modal-remove]");
  const addBtn = modal.querySelector<HTMLButtonElement>("[data-bust-dart-modal-add]");
  const title = modal.querySelector<HTMLElement>("#bust-dart-modal-title");

  function openModal(): void {
    context = buildBustDartPatternContext();
    if (!context.eligible) return;
    fillSummary(modal, context);
    syncCupLabels(modal, context.unit);
    const sel = cupSelect();
    const existing = context.config;
    if (sel) {
      sel.value = existing.enabled && existing.cupSize ? existing.cupSize : "";
    }
    if (removeBtn) {
      removeBtn.hidden = !(existing.enabled && existing.cupSize);
    }
    if (title) {
      title.textContent =
        existing.enabled && existing.cupSize ? "Change Bust Dart" : "Optional Bust Dart";
    }
    if (addBtn) {
      addBtn.textContent =
        existing.enabled && existing.cupSize ? "Update Pattern" : "Add to Pattern";
    }
    setError(modal, null);
    renderPreview(modal, context, parseCupSizeInput(sel?.value));
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function closeModal(): void {
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }

  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const openBtn = t.closest("[data-bust-dart-pattern-open]");
    if (openBtn) {
      ev.preventDefault();
      openModal();
    }
  });

  cupSelect()?.addEventListener("change", () => {
    if (!context) return;
    renderPreview(modal, context, parseCupSizeInput(cupSelect()?.value));
  });

  addBtn?.addEventListener("click", async () => {
    if (!context) return;
    const cup = parseCupSizeInput(cupSelect()?.value);
    if (!cup) {
      setError(modal, "Select a cup size.");
      return;
    }
    const preview = previewBustDartForPattern(context, cup);
    if (!preview.active) {
      setError(modal, preview.errors[0] || "Could not add this dart.");
      return;
    }
    addBtn.disabled = true;
    setError(modal, null);
    try {
      applyBustDartCupToWorkingDraft(cup);
      const persisted = await persistBustDartCustomization({ enabled: true, cupSize: cup });
      if (!persisted.ok) {
        // Draft already has the dart; still refresh so the user sees instructions.
        await refreshPatternView();
        syncBustDartPatternActionVisibility();
        setError(modal, persisted.error);
        return;
      }
      await refreshPatternView();
      syncBustDartPatternActionVisibility();
      closeModal();
    } finally {
      addBtn.disabled = false;
    }
  });

  removeBtn?.addEventListener("click", async () => {
    removeBtn.disabled = true;
    setError(modal, null);
    try {
      removeBustDartFromWorkingDraft();
      const persisted = await persistBustDartCustomization({ enabled: false, cupSize: null });
      await refreshPatternView();
      syncBustDartPatternActionVisibility();
      if (!persisted.ok) {
        setError(modal, persisted.error);
        return;
      }
      closeModal();
    } finally {
      removeBtn.disabled = false;
    }
  });

  modal.addEventListener("close", () => {
    setError(modal, null);
  });

  syncBustDartPatternActionVisibility();
}
