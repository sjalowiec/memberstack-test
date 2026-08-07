/**
 * Finished-pattern Bust Dart modal client (Sleeveless / Drop Shoulder workspaces).
 * Controls live in the Front BODY slot; this module wires the modal + Add/Update/Remove.
 */
import {
  applyBustDartConfigToWorkingDraft,
  buildBustDartPatternContext,
  bustDartCupOptions,
  bustDartDisplayDimensionsFromConfig,
  bustDartPresetDisplayDimensions,
  emptyBustDartSavedConfig,
  parseCupSizeInput,
  persistBustDartCustomization,
  previewBustDartForPattern,
  removeBustDartFromWorkingDraft,
  type BustDartPatternContext,
} from "../lib/patterns/bustDartPatternCustomization";
import { bustDartSavedConfigIsActive } from "../lib/patterns/legoBlocks/bustDart";
import {
  dartDimensionUnitLabel,
  isCustomDartDimensions,
  inchesFromDisplayDartLength,
  parsePositiveDartMeasurement,
  type DartCupSize,
  type DartFormulaUnit,
} from "../lib/tools/dartFormulaMath";

declare global {
  interface Window {
    kbmRefreshSleevelessPattern?: () => void | Promise<void>;
    /** Clears the pattern-tab render signature so the next refresh cannot no-op. */
    kbmInvalidateSleevelessPatternRender?: () => void;
  }
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

function syncDimLabels(modal: HTMLElement, unit: DartFormulaUnit): void {
  const suffix = dartDimensionUnitLabel(unit);
  const widthLabel = modal.querySelector("#bust-dart-pattern-width-label");
  const depthLabel = modal.querySelector("#bust-dart-pattern-depth-label");
  if (widthLabel) widthLabel.textContent = `Dart width (${suffix})`;
  if (depthLabel) depthLabel.textContent = `Dart depth (${suffix})`;
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

function widthInput(modal: HTMLElement): HTMLInputElement | null {
  return modal.querySelector<HTMLInputElement>("#bust-dart-pattern-width");
}

function depthInput(modal: HTMLElement): HTMLInputElement | null {
  return modal.querySelector<HTMLInputElement>("#bust-dart-pattern-depth");
}

function setDimInputs(modal: HTMLElement, width: number | null, depth: number | null): void {
  const w = widthInput(modal);
  const d = depthInput(modal);
  if (w) {
    w.value = width == null ? "" : String(width);
    w.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (d) {
    d.value = depth == null ? "" : String(depth);
    d.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function readDimInputs(modal: HTMLElement): {
  dartWidth: number | null;
  dartDepth: number | null;
} {
  const wRaw = widthInput(modal)?.value;
  const dRaw = depthInput(modal)?.value;
  return {
    dartWidth: parsePositiveDartMeasurement(wRaw),
    dartDepth: parsePositiveDartMeasurement(dRaw),
  };
}

function updateCustomizedBadge(
  modal: HTMLElement,
  cup: DartCupSize | null,
  unit: DartFormulaUnit,
): void {
  const badge = modal.querySelector<HTMLElement>("[data-bust-dart-modal-customized]");
  if (!badge) return;
  const { dartWidth, dartDepth } = readDimInputs(modal);
  if (!cup || dartWidth == null || dartDepth == null) {
    badge.hidden = true;
    return;
  }
  const wIn = inchesFromDisplayDartLength(dartWidth, unit);
  const dIn = inchesFromDisplayDartLength(dartDepth, unit);
  badge.hidden = !isCustomDartDimensions(cup, wIn, dIn);
}

function renderPreview(modal: HTMLElement, ctx: BustDartPatternContext, cup: DartCupSize | null): void {
  const box = modal.querySelector<HTMLElement>("[data-bust-dart-modal-preview]");
  const list = modal.querySelector<HTMLElement>("[data-bust-dart-modal-preview-list]");
  if (!box || !list) return;
  const { dartWidth, dartDepth } = readDimInputs(modal);
  updateCustomizedBadge(modal, cup, ctx.unit);

  if (!cup || dartWidth == null || dartDepth == null) {
    box.hidden = true;
    list.innerHTML = "";
    return;
  }
  const result = previewBustDartForPattern(ctx, { cupSize: cup, dartWidth, dartDepth });
  if (!result.active) {
    box.hidden = true;
    list.innerHTML = "";
    setError(modal, result.errors[0] || "Could not calculate this dart for the current pattern.");
    return;
  }
  setError(modal, null);
  const cupLabel = result.config.cupSize
    ? result.shaping?.customized
      ? `Cup ${result.config.cupSize} · Customized`
      : `Cup ${result.config.cupSize}`
    : result.shaping?.customized
      ? "Customized"
      : "Dart";
  const unitLabel = dartDimensionUnitLabel(ctx.unit);
  const lines = [
    cupLabel,
    `Width ${dartWidth} ${unitLabel} · Depth ${dartDepth} ${unitLabel}`,
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
  // Bust-dart commits must not be skipped by the pattern-tab signature short-circuit
  // (or dropped when another refresh is already in flight).
  if (typeof window.kbmInvalidateSleevelessPatternRender === "function") {
    window.kbmInvalidateSleevelessPatternRender();
  }
  if (typeof window.kbmRefreshSleevelessPattern === "function") {
    await window.kbmRefreshSleevelessPattern();
  }
}

/** @deprecated Action bar mounting removed — Front BODY slot owns the control. Kept as no-op for callers. */
export function syncBustDartPatternActionVisibility(): void {
  // Intentionally empty: Optional Bust Dart is rendered inside Front instructions.
}

export function initBustDartPatternCustomization(): void {
  const modal = document.querySelector<HTMLDialogElement>("[data-bust-dart-pattern-modal]");
  if (!modal) return;
  // Idempotent: Vite HMR / re-boot must not stack duplicate listeners on the same dialog.
  if (modal.dataset.bustDartModalBound === "1") return;
  modal.dataset.bustDartModalBound = "1";

  let context: BustDartPatternContext | null = null;
  /** When true, cup change reloads preset width/depth. Cleared after restore-from-saved. */
  let reloadPresetOnCupChange = true;
  /** Control that opened the modal — restored on close (Cancel / × / Escape). */
  let lastFocus: HTMLElement | null = null;
  /** Prevents double commit when delegated click + form submit both fire. */
  let commitInFlight = false;

  const form = modal.querySelector<HTMLFormElement>("[data-bust-dart-modal-form]");
  const cupSelect = () => modal.querySelector<HTMLSelectElement>("#bust-dart-pattern-cup");
  const removeBtn = modal.querySelector<HTMLButtonElement>("[data-bust-dart-modal-remove]");
  const addBtn = () => modal.querySelector<HTMLButtonElement>("[data-bust-dart-modal-add]");
  const cancelBtn = modal.querySelector<HTMLButtonElement>("[data-bust-dart-modal-cancel]");
  const closeBtn = modal.querySelector<HTMLButtonElement>("[data-bust-dart-modal-close]");
  const title = modal.querySelector<HTMLElement>("#bust-dart-modal-title");

  function openModal(opener?: Element | null): void {
    try {
      context = buildBustDartPatternContext();
    } catch (err) {
      console.error("[kbm] Bust dart context failed:", err);
      context = null;
      return;
    }
    if (!context || !context.eligible) return;
    fillSummary(modal, context);
    syncCupLabels(modal, context.unit);
    syncDimLabels(modal, context.unit);
    const sel = cupSelect();
    const existing = context.config;
    const hasActive = bustDartSavedConfigIsActive(existing);
    if (sel) {
      sel.value = hasActive && existing.cupSize ? existing.cupSize : "";
    }
    if (hasActive) {
      reloadPresetOnCupChange = false;
      const restored = bustDartDisplayDimensionsFromConfig(existing, context.unit);
      setDimInputs(modal, restored.dartWidth, restored.dartDepth);
      // After restore, further cup changes should reload presets.
      reloadPresetOnCupChange = true;
    } else {
      reloadPresetOnCupChange = true;
      const cup = parseCupSizeInput(sel?.value);
      if (cup) {
        const preset = bustDartPresetDisplayDimensions(cup, context.unit);
        setDimInputs(modal, preset.dartWidth, preset.dartDepth);
      } else {
        setDimInputs(modal, null, null);
      }
    }
    if (removeBtn) {
      removeBtn.hidden = !hasActive;
    }
    if (title) {
      title.textContent = hasActive ? "Change Bust Dart" : "Optional Bust Dart";
    }
    const primary = addBtn();
    if (primary) {
      primary.textContent = hasActive ? "Update Pattern" : "Add to Pattern";
    }
    setError(modal, null);
    renderPreview(modal, context, parseCupSizeInput(sel?.value));
    lastFocus =
      opener instanceof HTMLElement
        ? opener
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function closeModal(): void {
    // Close without form submission — never run constraint or custom validation.
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }

  async function removeDartAndRefresh(fromModal: boolean): Promise<void> {
    try {
      removeBustDartFromWorkingDraft();
      const persisted = await persistBustDartCustomization(emptyBustDartSavedConfig());
      await refreshPatternView();
      if (!persisted.ok && fromModal) {
        setError(modal, persisted.error);
        return;
      }
      if (fromModal) closeModal();
    } catch (err) {
      console.error("[kbm] Remove bust dart failed:", err);
      if (fromModal) {
        setError(modal, "Could not remove the bust dart. Please try again.");
      }
      await refreshPatternView();
    }
  }

  // Cancel / × close without validation or saving (type=button — never submit).
  cancelBtn?.addEventListener("click", (ev) => {
    ev.preventDefault();
    closeModal();
  });
  closeBtn?.addEventListener("click", (ev) => {
    ev.preventDefault();
    closeModal();
  });

  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const openBtn = t.closest("[data-bust-dart-pattern-open]");
    if (openBtn) {
      ev.preventDefault();
      openModal(openBtn);
      return;
    }
    const removeTrigger = t.closest("[data-bust-dart-pattern-remove]");
    if (removeTrigger) {
      ev.preventDefault();
      void removeDartAndRefresh(false);
      return;
    }
    // Delegated Add/Update — same reliability pattern as open/remove. preventDefault stops
    // the subsequent form submit so commit runs once (Enter still uses the submit listener).
    const addTrigger = t.closest("[data-bust-dart-modal-add]");
    if (addTrigger && modal.contains(addTrigger)) {
      ev.preventDefault();
      void commitBustDartFromModal();
    }
  });

  cupSelect()?.addEventListener("change", () => {
    if (!context) return;
    const cup = parseCupSizeInput(cupSelect()?.value);
    if (cup && reloadPresetOnCupChange) {
      const preset = bustDartPresetDisplayDimensions(cup, context.unit);
      setDimInputs(modal, preset.dartWidth, preset.dartDepth);
    }
    renderPreview(modal, context, cup);
  });

  const onDimEdit = () => {
    if (!context) return;
    renderPreview(modal, context, parseCupSizeInput(cupSelect()?.value));
  };
  widthInput(modal)?.addEventListener("input", onDimEdit);
  depthInput(modal)?.addEventListener("input", onDimEdit);

  /**
   * Add / Update Pattern. Invoked from delegated Add click and form submit (Enter).
   * Never used by Cancel / × / Escape.
   */
  async function commitBustDartFromModal(): Promise<void> {
    if (commitInFlight) return;
    if (!context) return;
    const cup = parseCupSizeInput(cupSelect()?.value);
    if (!cup) {
      setError(modal, "Select a cup size.");
      cupSelect()?.focus();
      return;
    }
    const { dartWidth, dartDepth } = readDimInputs(modal);
    if (dartWidth == null || dartDepth == null) {
      setError(modal, "Enter dart width and depth greater than 0.");
      (dartWidth == null ? widthInput(modal) : depthInput(modal))?.focus();
      return;
    }
    const preview = previewBustDartForPattern(context, { cupSize: cup, dartWidth, dartDepth });
    if (!preview.active || !preview.shaping) {
      setError(modal, preview.errors[0] || "Could not add this dart.");
      return;
    }
    const primary = addBtn();
    commitInFlight = true;
    if (primary) primary.disabled = true;
    setError(modal, null);
    try {
      const stored = applyBustDartConfigToWorkingDraft({
        cupSize: cup,
        dartWidthInches: preview.shaping.dartWidthInches,
        dartDepthInches: preview.shaping.dartDepthInches,
      });
      // Show active knitting instructions immediately from the local draft — do not wait on
      // cloud save (saved-project persist can block or fail while the dart is already local).
      await refreshPatternView();
      const persisted = await persistBustDartCustomization(stored);
      if (!persisted.ok) {
        setError(modal, persisted.error);
        return;
      }
      closeModal();
    } catch (err) {
      console.error("[kbm] Add bust dart failed:", err);
      setError(modal, "Could not add the bust dart. Please try again.");
      await refreshPatternView();
    } finally {
      commitInFlight = false;
      const btn = addBtn();
      if (btn) btn.disabled = false;
    }
  }

  // Enter in a field submits the form; preventDefault then commit (Add click is delegated above).
  form?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    void commitBustDartFromModal();
  });

  removeBtn?.addEventListener("click", async () => {
    removeBtn.disabled = true;
    setError(modal, null);
    try {
      await removeDartAndRefresh(true);
    } finally {
      removeBtn.disabled = false;
    }
  });

  modal.addEventListener("close", () => {
    setError(modal, null);
    const restore = lastFocus;
    lastFocus = null;
    if (restore && typeof restore.focus === "function" && restore.isConnected) {
      restore.focus();
    }
  });
}
