/**
 * Read-only thank-you history for one customer account.
 * Uses the membership thank-you rows already built from Stripe charges,
 * watson_member_thank_yous, and video replies. Nothing is copied or inferred.
 */

import { customerEmailLookupKeys } from "./customerIdentifier";
import {
  loadMemberThankYouPage,
  type MemberThankYouDeps,
  type MemberThankYouPage,
  type MemberThankYouRow,
} from "./memberThankYouLoad";
import { MEMBER_THANK_YOU_START_YMD } from "./memberThankYouRules";

export const THANK_YOU_HISTORY_NO_SEND = "No send recorded";
export const THANK_YOU_HISTORY_SEND_UNKNOWN = "Sent status could not be loaded";
export const THANK_YOU_HISTORY_NOT_COMPLETE = "Not complete";
export const THANK_YOU_HISTORY_NO_VIDEO = "No video link saved";
export const THANK_YOU_HISTORY_VIDEO_UNKNOWN = "Video link could not be loaded";

export type ThankYouHistorySendState = "recorded" | "none" | "unknown";

export type CustomerThankYouHistoryItem = {
  stripeChargeId: string;
  reason: string;
  paymentDateLabel: string;
  videoSentText: string;
  videoSentState: ThankYouHistorySendState;
  cardSentText: string;
  cardSentState: ThankYouHistorySendState;
  videoPublicUrl: string | null;
  videoLinkText: string;
  videoLinkDisabled: boolean;
  completionText: string;
  completed: boolean;
};

export type CustomerThankYouHistory = {
  items: CustomerThankYouHistoryItem[];
  warning: string | null;
  error: string | null;
};

type HistoryPageLoader = (deps: MemberThankYouDeps) => Promise<MemberThankYouPage>;

function recordedSend(
  sentAt: string | null,
  label: string | null,
  statusesKnown: boolean,
): { text: string; state: ThankYouHistorySendState } {
  if (!statusesKnown) {
    return { text: THANK_YOU_HISTORY_SEND_UNKNOWN, state: "unknown" };
  }
  if (!sentAt) {
    return { text: THANK_YOU_HISTORY_NO_SEND, state: "none" };
  }
  return { text: label?.trim() || "Sent", state: "recorded" };
}

export function presentCustomerThankYouHistoryItem(
  row: MemberThankYouRow,
  options: { statusesKnown: boolean; videoLinksKnown: boolean },
): CustomerThankYouHistoryItem {
  const video = recordedSend(row.videoSentAt, row.videoSentLabel, options.statusesKnown);
  const card = recordedSend(row.cardSentAt, row.cardSentLabel, options.statusesKnown);
  const videoPublicUrl = options.videoLinksKnown ? row.videoPublicUrl : null;
  return {
    stripeChargeId: row.stripeChargeId,
    reason: row.kindLabel,
    paymentDateLabel: row.paymentDateLabel,
    videoSentText: video.text,
    videoSentState: video.state,
    cardSentText: card.text,
    cardSentState: card.state,
    videoPublicUrl,
    videoLinkText: !options.videoLinksKnown
      ? THANK_YOU_HISTORY_VIDEO_UNKNOWN
      : videoPublicUrl
        ? videoPublicUrl
        : THANK_YOU_HISTORY_NO_VIDEO,
    videoLinkDisabled: Boolean(options.videoLinksKnown && row.videoLinkDisabled && videoPublicUrl),
    completionText: row.completedAt ? row.completedLabel?.trim() || "Completed" : THANK_YOU_HISTORY_NOT_COMPLETE,
    completed: Boolean(row.completedAt),
  };
}

function emailKeys(values: Array<string | null | undefined>): Set<string> {
  return new Set(values.flatMap((value) => customerEmailLookupKeys(value)));
}

export function thankYouRowMatchesCustomer(
  row: Pick<MemberThankYouRow, "email" | "profileHref">,
  input: {
    emails: Array<string | null | undefined>;
    profilePaths: Array<string | null | undefined>;
  },
): boolean {
  const keys = emailKeys(input.emails);
  if (customerEmailLookupKeys(row.email).some((key) => keys.has(key))) return true;
  const paths = new Set(
    input.profilePaths
      .map((path) => path?.trim() || "")
      .filter(Boolean),
  );
  return Boolean(row.profileHref && paths.has(row.profileHref));
}

export async function loadCustomerThankYouHistory(
  input: {
    emails: Array<string | null | undefined>;
    profilePaths?: Array<string | null | undefined>;
    origin?: string;
    loadPage?: HistoryPageLoader;
  },
): Promise<CustomerThankYouHistory> {
  const loadPage = input.loadPage ?? loadMemberThankYouPage;
  const page = await loadPage({
    filter: "all",
    from: MEMBER_THANK_YOU_START_YMD,
    origin: input.origin,
  });
  if (page.error) {
    return { items: [], warning: null, error: page.error };
  }
  const profilePaths = input.profilePaths ?? [];
  const items = page.rows
    .filter((row) => thankYouRowMatchesCustomer(row, { emails: input.emails, profilePaths }))
    .map((row) =>
      presentCustomerThankYouHistoryItem(row, {
        statusesKnown: page.statusesAvailable,
        videoLinksKnown: page.videoColumnsAvailable,
      }),
    );
  return {
    items,
    warning: page.warnings.length > 0 ? page.warnings.join(" ") : null,
    error: null,
  };
}
