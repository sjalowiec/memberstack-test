/**
 * Socks Summary page client (`/patterns/socks/summary/`).
 * Reuses the dedicated Edit workspace and Update Pattern behavior.
 */
import { logGeneratedPatternOnce } from "../lib/patterns/patternGenerationActivity";
import "./socks-edit-page";

if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("generated") === "1") {
  void logGeneratedPatternOnce({
    patternSystem: "socks",
    sourcePage: "/patterns/socks/summary/",
  });
}
