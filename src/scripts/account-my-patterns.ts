/**
 * My Patterns list on /account — boot script.
 */
import { bootAccountMyPatternsList } from "../lib/patterns/accountMyPatternsList";

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootAccountMyPatternsList());
  } else {
    bootAccountMyPatternsList();
  }
}
