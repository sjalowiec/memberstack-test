/**
 * Safety net for membership-gated pages whose access script never starts.
 *
 * Server HTML starts in "Checking membership…". The module script (pattern gate or
 * landing CTA) marks its root ready as its first step. When a module chunk fails to
 * download (flaky connection, content blocker) or the browser cannot run it, nothing
 * else on the page can show an error or Retry, because those live in the same module.
 *
 * {@link accessScriptStallWatchSource} is a classic inline script with no module
 * dependencies. If a root is still not ready after {@link ACCESS_SCRIPT_STALL_MS}, it
 * swaps the checking text for a "didn't finish loading" notice with a plain Reload link.
 * It never grants access: gated content stays hidden.
 */

export const ACCESS_SCRIPT_STALL_MS = 20_000;

/** Element whose access script is watched. */
export const ACCESS_STALL_ROOT_ATTR = "data-access-stall-root";
/** Set on the root by the module script when it starts. */
export const ACCESS_SCRIPT_READY_ATTR = "data-access-script-ready";
/** Hidden notice revealed when the script never started. */
export const ACCESS_STALL_NOTICE_ATTR = "data-access-stall-notice";
/** "Checking membership…" text hidden while the stall notice shows. */
export const ACCESS_STALL_CHECKING_ATTR = "data-access-stall-checking";

/** Called first by the module script. Hides a notice that appeared before a late load. */
export function markAccessScriptReady(root: HTMLElement): void {
  root.setAttribute(ACCESS_SCRIPT_READY_ATTR, "");
  root.querySelectorAll<HTMLElement>(`[${ACCESS_STALL_NOTICE_ATTR}]`).forEach((el) => {
    el.hidden = true;
  });
}

/**
 * Inline script body (ES5, no imports) that reveals the stall notice for every root
 * the module script has not marked ready. Safe to include more than once per page.
 */
export function accessScriptStallWatchSource(stallMs: number = ACCESS_SCRIPT_STALL_MS): string {
  const ms = Math.max(0, Math.floor(stallMs));
  return [
    "(function(){",
    "if(window.__kbmAccessStallWatch)return;window.__kbmAccessStallWatch=1;",
    "setTimeout(function(){",
    `var roots=document.querySelectorAll("[${ACCESS_STALL_ROOT_ATTR}]");`,
    "for(var i=0;i<roots.length;i++){var r=roots[i];",
    `if(r.hasAttribute("${ACCESS_SCRIPT_READY_ATTR}"))continue;`,
    `var n=r.querySelectorAll("[${ACCESS_STALL_NOTICE_ATTR}]");for(var j=0;j<n.length;j++)n[j].hidden=false;`,
    `var c=r.querySelectorAll("[${ACCESS_STALL_CHECKING_ATTR}]");for(var k=0;k<c.length;k++)c[k].hidden=true;`,
    "}",
    `},${ms});`,
    "})();",
  ].join("");
}
