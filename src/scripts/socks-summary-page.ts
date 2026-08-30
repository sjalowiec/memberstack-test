/**
 * Socks Summary page — loads kbm_socks_draft and displays committed Socks geometry.
 * Does not generate a finished Pattern page.
 */
import {
  createSockSizingAdapter,
  type SockSizingAdapter,
} from "../lib/patterns/sock/sockSizing";
import { readSockDraft } from "../lib/patterns/sock/sockDraft";
import {
  buildSockSummaryFromDraft,
  type SockSummaryView,
} from "../lib/patterns/sock/sockPatternFromDraft";
import { reconcilePatternDraftOwner } from "../lib/patterns/patternDraftOwnerGuard";

function loadSizingAdapterFromPage(): SockSizingAdapter {
  const node = document.getElementById("socks-sizing-chart");
  if (!node?.textContent?.trim()) return createSockSizingAdapter([]);
  try {
    return createSockSizingAdapter(JSON.parse(node.textContent) as unknown);
  } catch {
    return createSockSizingAdapter([]);
  }
}

function setVisible(el: Element | null, visible: boolean): void {
  if (!(el instanceof HTMLElement)) return;
  el.hidden = !visible;
}

function showEmptyState(message: string): void {
  const empty = document.querySelector("[data-socks-summary-empty]");
  const workspace = document.querySelector("[data-socks-summary-workspace]");
  const msg = document.querySelector("[data-socks-summary-empty-message]");
  if (msg) msg.textContent = message;
  setVisible(empty, true);
  setVisible(workspace, false);
}

function showWorkspace(): void {
  const empty = document.querySelector("[data-socks-summary-empty]");
  const workspace = document.querySelector("[data-socks-summary-workspace]");
  setVisible(empty, false);
  setVisible(workspace, true);
}

function fill(field: keyof SockSummaryView, text: string): void {
  const el = document.querySelector(`[data-socks-summary="${field}"]`);
  if (el) el.textContent = text;
}

function fillNumber(field: keyof SockSummaryView, value: number): void {
  fill(field, String(value));
}

function renderSockSummaryView(view: SockSummaryView): void {
  fill("patternName", view.patternName);
  fill("sizeLabel", view.sizeLabel);
  fill("constructionLabel", view.constructionLabel);
  fill("unitsLabel", view.unitsLabel);
  fill("footCircumference", view.footCircumference);
  fill("footLength", view.footLength);
  fill("legCircumference", view.legCircumference);
  fill("legLength", view.legLength);
  fill("stitchGauge", view.stitchGauge);
  fill("rowGauge", view.rowGauge);
  fill("gaugeBasisLabel", view.gaugeBasisLabel);
  fill("gaugeLabel", view.gaugeLabel);
  fillNumber("totalSockStitches", view.totalSockStitches);
  fillNumber("legStitches", view.legStitches);
  fillNumber("workingStitches", view.workingStitches);
  fillNumber("heldStitches", view.heldStitches);
  fillNumber("remainingStitches", view.remainingStitches);
  fillNumber("shortRowShapingRows", view.shortRowShapingRows);
  fillNumber("returnToWorkRows", view.returnToWorkRows);
  fill("heelDepth", view.heelDepth);
  fill("toeDepth", view.toeDepth);
  fill("straightFootLength", view.straightFootLength);
  fillNumber("straightFootRows", view.straightFootRows);
  fill("ankleStraightLength", view.ankleStraightLength);
  fillNumber("ankleStraightRows", view.ankleStraightRows);
  fillNumber("legRows", view.legRows);
  fill("legShapingStatus", view.legShapingStatus);
  fillNumber("ankleStitches", view.ankleStitches);
  fillNumber("topLegStitches", view.topLegStitches);
  fill("pairedEventLabel", view.pairedEventLabel);
  fillNumber("pairedShapingEvents", view.pairedShapingEvents);
  fillNumber("legShapingRowsAvailable", view.legShapingRowsAvailable);
  fill("magicFormulaSchedule", view.magicFormulaSchedule);
  fill("knitOrderSummary", view.knitOrderSummary);
  const legDetails = document.querySelector("[data-socks-summary-leg-details]");
  if (legDetails instanceof HTMLElement) {
    legDetails.hidden = !view.legShapingNeeded;
  }
  fillNumber("requiredNeedles", view.requiredNeedles);
  fillNumber("availableNeedles", view.availableNeedles);
}

async function initSocksSummaryPage(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-socks-summary-page]");
  if (!root || root.dataset.socksSummaryBound === "true") return;
  root.dataset.socksSummaryBound = "true";

  await reconcilePatternDraftOwner();

  const adapter = loadSizingAdapterFromPage();
  const result = buildSockSummaryFromDraft(readSockDraft(), adapter);
  if (!result.ok) {
    showEmptyState(result.message);
    return;
  }

  renderSockSummaryView(result.view);
  showWorkspace();
}

function boot(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void initSocksSummaryPage(), { once: true });
  } else {
    void initSocksSummaryPage();
  }
}

boot();
