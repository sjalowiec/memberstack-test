/**
 * My Patterns dashboard summary on /account — boot script.
 * "View all patterns" uses the global library drawer trigger attribute.
 * `?view=my-patterns` also opens that drawer after the list boots.
 */
import { bootAccountMyPatternsList } from "../lib/patterns/accountMyPatternsList";
import { openPatternWorkspaceLibraryDrawerFromDocument } from "../lib/patterns/patternWorkspaceLibraryDrawer";

function shouldOpenMyPatternsDrawer(loc: Location = window.location): boolean {
  const params = new URLSearchParams(loc.search);
  return params.get("view") === "my-patterns";
}

function boot(): void {
  bootAccountMyPatternsList();

  if (!shouldOpenMyPatternsDrawer()) return;

  // Wait a tick so the global drawer init (Layout) and Memberstack gating have settled.
  window.setTimeout(() => {
    openPatternWorkspaceLibraryDrawerFromDocument();
  }, 0);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot());
  } else {
    boot();
  }
}
