/**
 * Tip of the Week feedback events for the GA4 tag already in BaseLayout.
 *
 * Production custom domains only, matching Help Hub and shop analytics.
 * Local review, the dev server, and *.netlify.app do not send these events.
 *
 * The choice event records which button was used. The topic event records
 * that a suggestion was submitted. Neither event includes the suggestion
 * text, a visitor id, or a member id.
 *
 * Looker Studio can break results down by tip only after these parameters
 * are registered as event-scoped custom dimensions:
 *   tip_id
 *   tip_feedback_choice
 */

import { detectSiteEnvironment } from "../env/siteEnvironment";

export const TIP_FEEDBACK_CHOICE_EVENT = "tip_feedback_choice";
export const TIP_TOPIC_SUGGESTION_EVENT = "tip_topic_suggestion";
export const TIP_GA_TIP_ID_PARAM = "tip_id";
export const TIP_GA_CHOICE_PARAM = "tip_feedback_choice";

export const TIP_OF_THE_WEEK_GA_EVENTS = [
  TIP_FEEDBACK_CHOICE_EVENT,
  TIP_TOPIC_SUGGESTION_EVENT,
] as const;

export type TipOfTheWeekGaEventName = (typeof TIP_OF_THE_WEEK_GA_EVENTS)[number];

/** Button ids the public page still offers. Historical ids are not new events. */
export const TIP_GA_FEEDBACK_CHOICES = ["helped", "not_for_me"] as const;

export type TipGaFeedbackChoice = (typeof TIP_GA_FEEDBACK_CHOICES)[number];

const DEDUPE_MS = 400;
const TIP_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/i;

type GtagEvent = (
  command: "event",
  name: string,
  params: Record<string, string>,
) => void;

export type TipOfTheWeekGaContext = {
  now?: number;
  gtag?: GtagEvent;
  hostname?: string | null;
  isViteDev?: boolean;
  publicSiteEnv?: string | null;
  measurementIdConfigured?: boolean;
};

const recentSends = new Map<string, number>();

export function resetTipOfTheWeekGaForTests(): void {
  recentSends.clear();
}

export function shouldReportTipOfTheWeekToProductionGa(input: {
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

function browserContext(): TipOfTheWeekGaContext {
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

function cleanTipId(value: string): string | null {
  const tipId = value.trim();
  if (!TIP_ID.test(tipId)) return null;
  if (/@|mem_/i.test(tipId)) return null;
  return tipId;
}

function sendTipEvent(
  name: TipOfTheWeekGaEventName,
  tipId: string,
  params: Record<string, string>,
  context?: TipOfTheWeekGaContext,
): boolean {
  const ctx = context ?? browserContext();
  if (
    !shouldReportTipOfTheWeekToProductionGa({
      hostname: ctx.hostname,
      isViteDev: ctx.isViteDev,
      publicSiteEnv: ctx.publicSiteEnv,
    })
  ) {
    return false;
  }
  if (!ctx.measurementIdConfigured || typeof ctx.gtag !== "function") return false;
  const cleanId = cleanTipId(tipId);
  if (!cleanId) return false;

  const now = ctx.now ?? Date.now();
  const choice = params[TIP_GA_CHOICE_PARAM] || "";
  const key = `${name}\0${cleanId}\0${choice}`;
  const previous = recentSends.get(key);
  if (previous != null && now >= previous && now - previous < DEDUPE_MS) return false;

  try {
    ctx.gtag("event", name, {
      ...params,
      [TIP_GA_TIP_ID_PARAM]: cleanId,
      transport_type: "beacon",
    });
  } catch {
    return false;
  }

  recentSends.set(key, now);
  return true;
}

export function reportTipFeedbackChoice(
  tipId: string,
  choice: TipGaFeedbackChoice,
  context?: TipOfTheWeekGaContext,
): boolean {
  if (!TIP_GA_FEEDBACK_CHOICES.includes(choice)) return false;
  return sendTipEvent(
    TIP_FEEDBACK_CHOICE_EVENT,
    tipId,
    { [TIP_GA_CHOICE_PARAM]: choice },
    context,
  );
}

/** Records that a topic was submitted. The suggestion text stays out of GA. */
export function reportTipTopicSuggestion(
  tipId: string,
  context?: TipOfTheWeekGaContext,
): boolean {
  return sendTipEvent(TIP_TOPIC_SUGGESTION_EVENT, tipId, {}, context);
}
