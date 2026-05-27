/**
 * Flush visible Custom Build diagram overrides and sync wizard state into canonical
 * pattern storage before {@link generateSleevelessBackPattern} runs.
 */
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { ensureSavedCustomPatternSessionHydratedOnPatternPage } from "./hydrateSavedCustomPatternProject";
import { getCurrentPattern, getPatternData } from "./patternStorage";
import { resolveGeneratorPatternMode, sectionPattern } from "./sleevelessPatternBuilderMerge";
import {
  flushCustomBuildMeasurementOverridesToCanonical,
  resolveCustomBuildMeasureFlushRoot,
} from "./sleevelessCustomMeasurementStorage";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";
export type PrepareCustomBuildPatternGenerationOptions = {
  /** Diagram host; defaults to `document` in the browser. */
  root?: ParentNode | null;
  /** Passed through to {@link syncCustomBuildToPatternStorage}. */
  awaitCharts?: boolean;
  /** When false, skip saved-project Express rehydrate (tests). */
  rehydrateSavedProject?: boolean;
  /**
   * When false, skip {@link syncCustomBuildToPatternStorage} (My Pattern page — storage is synced
   * before navigation from Customize; re-syncing on every render caused refresh loops).
   */
  syncToPatternStorage?: boolean;
};

/** Dedicated workspace My Pattern route (`/patterns/sleeveless/pattern/`), not in-page builder tabs. */
export function isDedicatedSleevelessPatternWorkspacePage(doc: Document = document): boolean {
  return doc.querySelector(".sleeveless-pattern-page.sleeveless-workspace-subpage") instanceof HTMLElement;
}

function shouldPrepareCustomBuildPatternGeneration(): boolean {
  if (isEditingSavedCustomPatternProject()) return true;
  const canonicalStyle = sectionPattern(getCurrentPattern().style);
  const pbStyle = sectionPattern(getPatternData().style);
  if (resolveGeneratorPatternMode(canonicalStyle, pbStyle) === "custom-build") {
    return true;
  }
  // Diagram overrides are written on Custom Build / Customize; run flush+sync even if patternMode
  // was briefly stale (e.g. express-shaped wizard storage before first sync).
  const canonOverrides = sectionPattern(sectionPattern(getCurrentPattern().fit).cbMeasurementOverrides);
  return Object.keys(canonOverrides).length > 0;
}

/**
 * Merges pending diagram input (including hem depth without blur), then syncs builder → pattern storage.
 */
export function prepareCustomBuildPatternGeneration(
  options: PrepareCustomBuildPatternGenerationOptions = {},
): void {
  if (!shouldPrepareCustomBuildPatternGeneration()) {
    return;
  }

  const root = resolveCustomBuildMeasureFlushRoot(
    options.root !== undefined
      ? options.root
      : typeof document !== "undefined"
        ? document
        : undefined,
  );

  if (options.rehydrateSavedProject !== false && isEditingSavedCustomPatternProject()) {
    ensureSavedCustomPatternSessionHydratedOnPatternPage();
  }

  if (options.syncToPatternStorage !== false) {
    syncCustomBuildToPatternStorage({ awaitCharts: options.awaitCharts ?? false });
  }

  // After sync so diagram overrides (e.g. hip on straight torso) are not reconciled away.
  flushCustomBuildMeasurementOverridesToCanonical({ root: root ?? undefined });
}
