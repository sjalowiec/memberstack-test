import { getExpressEditingProjectLabel } from "./sleevelessExpressResume";

/**
 * Client-side header sync for the Express “Build/Create” page (`/patterns/sleeveless/builder`).
 * The page template has a hardcoded `<h1>`, so we overwrite it when a saved project is active.
 */
export function resolveSleevelessBuilderHeaderTitle(): string {
  return getExpressEditingProjectLabel();
}

export function syncSleevelessBuilderHeaderTitle(): void {
  if (typeof document === "undefined") return;
  const h1 = document.querySelector<HTMLElement>(".sleeveless-express-page .pattern-title");
  if (!h1) return;
  h1.textContent = resolveSleevelessBuilderHeaderTitle();
}

