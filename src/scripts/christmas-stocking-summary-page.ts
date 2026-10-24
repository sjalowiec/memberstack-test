/**
 * Christmas Stocking Summary page client (`/patterns/christmas-stocking/summary/`).
 * Reuses the dedicated Edit workspace and Update Pattern behavior.
 */
import { logGeneratedPatternOnce } from "../lib/patterns/patternGenerationActivity";
import "./christmas-stocking-edit-page";

if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("generated") === "1") {
  void logGeneratedPatternOnce({
    patternSystem: "christmas-stocking",
    sourcePage: "/patterns/christmas-stocking/summary/",
  });
}
