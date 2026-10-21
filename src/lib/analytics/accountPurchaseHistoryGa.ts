/**
 * Account Purchase History events for the GA4 tag already in BaseLayout.
 *
 * Production custom domains only, matching Help Hub and shop analytics.
 * Local review, the dev server, and *.netlify.app do not send these events.
 *
 * The view event records whether the section loaded orders, was empty, or
 * failed. The tracking event records that a tracking link was used. Neither
 * event includes an email, order number, tracking number, or tracking URL.
 *
 * Looker Studio can break results down by outcome only after this parameter
 * is registered as an event-scoped custom dimension:
 *   purchase_history_result
 */
import { detectSiteEnvironment } from "../env/siteEnvironment";

export const ACCOUNT_PURCHASE_HISTORY_VIEW_EVENT = "account_purchase_history_view";
export const ACCOUNT_PURCHASE_TRACKING_CLICK_EVENT = "account_purchase_tracking_click";
export const ACCOUNT_PURCHASE_HISTORY_RESULT_PARAM = "purchase_history_result";

export const ACCOUNT_PURCHASE_HISTORY_GA_EVENTS = [
  ACCOUNT_PURCHASE_HISTORY_VIEW_EVENT,
  ACCOUNT_PURCHASE_TRACKING_CLICK_EVENT,
] as const;

export type AccountPurchaseHistoryGaEventName =
  (typeof ACCOUNT_PURCHASE_HISTORY_GA_EVENTS)[number];

export const ACCOUNT_PURCHASE_HISTORY_RESULTS = ["orders", "empty", "error"] as const;

export type AccountPurchaseHistoryResult = (typeof ACCOUNT_PURCHASE_HISTORY_RESULTS)[number];

const DEDUPE_MS = 400;

type GtagEvent = (
  command: "event",
  name: string,
  params: Record<string, string>,
) => void;

export type AccountPurchaseHistoryGaContext = {
  now?: number;
  gtag?: GtagEvent;
  hostname?: string | null;
  isViteDev?: boolean;
  publicSiteEnv?: string | null;
  measurementIdConfigured?: boolean;
};

const recentSends = new Map<string, number>();

export function resetAccountPurchaseHistoryGaForTests(): void {
  recentSends.clear();
}

export function shouldReportAccountPurchaseHistoryToProductionGa(input: {
  hostname?: string | null;
  isViteDev?: boolean;
  publicSiteEnv?: string | null;
}): boolean {
  return (
    detectSiteEnvironment(input.hostname, {
      isViteDev: input.isViteDev,
      publicSiteEnv: input.publicSiteEnv,
    }) === "production"
  );
}

function browserContext(): AccountPurchaseHistoryGaContext {
  const gtag =
    typeof window !== "undefined"
      ? (window as Window & { gtag?: GtagEvent }).gtag
      : undefined;
  return {
    now: Date.now(),
    gtag: typeof gtag === "function" ? gtag : undefined,
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
    isViteDev: import.meta.env.DEV === true,
    publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
    measurementIdConfigured: Boolean(import.meta.env.PUBLIC_GA4_ID),
  };
}

function sendAccountPurchaseEvent(
  name: AccountPurchaseHistoryGaEventName,
  params: Record<string, string>,
  context?: AccountPurchaseHistoryGaContext,
): boolean {
  const ctx = context ?? browserContext();
  if (
    !shouldReportAccountPurchaseHistoryToProductionGa({
      hostname: ctx.hostname,
      isViteDev: ctx.isViteDev,
      publicSiteEnv: ctx.publicSiteEnv,
    })
  ) {
    return false;
  }
  if (!ctx.measurementIdConfigured || typeof ctx.gtag !== "function") return false;

  const now = ctx.now ?? Date.now();
  const key = `${name}\0${params[ACCOUNT_PURCHASE_HISTORY_RESULT_PARAM] ?? ""}`;
  const previous = recentSends.get(key);
  if (previous != null && now >= previous && now - previous < DEDUPE_MS) return false;

  try {
    ctx.gtag("event", name, {
      ...params,
      transport_type: "beacon",
    });
  } catch {
    return false;
  }

  recentSends.set(key, now);
  return true;
}

export function reportAccountPurchaseHistoryView(
  result: AccountPurchaseHistoryResult,
  context?: AccountPurchaseHistoryGaContext,
): boolean {
  if (!ACCOUNT_PURCHASE_HISTORY_RESULTS.includes(result)) return false;
  return sendAccountPurchaseEvent(
    ACCOUNT_PURCHASE_HISTORY_VIEW_EVENT,
    { [ACCOUNT_PURCHASE_HISTORY_RESULT_PARAM]: result },
    context,
  );
}

export function reportAccountPurchaseTrackingClick(
  context?: AccountPurchaseHistoryGaContext,
): boolean {
  return sendAccountPurchaseEvent(ACCOUNT_PURCHASE_TRACKING_CLICK_EVENT, {}, context);
}
