/**
 * Exposes {@link triggerPatternPrint} for legacy inline page scripts (hat, diy-blanket).
 */
import { triggerPatternPrint, type PatternPrintTriggerOptions } from "./patternPrintPersonalization.ts";

declare global {
  interface Window {
    kbmTriggerPatternPrint?: (
      triggerEl: HTMLElement | null,
      opts?: PatternPrintTriggerOptions,
    ) => void;
  }
}

window.kbmTriggerPatternPrint = triggerPatternPrint;
