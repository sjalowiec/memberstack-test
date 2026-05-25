/** Temporary performance logging for saved-patterns diagnosis. Remove after investigation. */
const PREFIX = "[kbm-perf:saved-patterns]";

let accountListRenderCount = 0;
let panelListRefreshCount = 0;

export function nextAccountListRender(): number {
  accountListRenderCount += 1;
  return accountListRenderCount;
}

export function nextPanelListRefresh(): number {
  panelListRefreshCount += 1;
  return panelListRefreshCount;
}

export function perfStart(): number {
  return performance.now();
}

export function perfEnd(step: string, start: number, extra?: Record<string, unknown>): void {
  const ms = performance.now() - start;
  if (extra && Object.keys(extra).length > 0) {
    console.log(`${PREFIX} ${step}: ${ms.toFixed(1)}ms`, extra);
  } else {
    console.log(`${PREFIX} ${step}: ${ms.toFixed(1)}ms`);
  }
}

export function perfMark(step: string, extra?: Record<string, unknown>): void {
  if (extra && Object.keys(extra).length > 0) {
    console.log(`${PREFIX} ${step}`, extra);
  } else {
    console.log(`${PREFIX} ${step}`);
  }
}

export function memberstackReadinessSnapshot(): Record<string, unknown> {
  const ms = typeof window !== "undefined" ? window.$memberstackDom : undefined;
  return {
    msDomPresent: Boolean(ms),
    msGetCurrentMember: Boolean(ms?.getCurrentMember),
    msOnReady: Boolean(ms?.onReady),
    documentReadyState: typeof document !== "undefined" ? document.readyState : "unknown",
  };
}
