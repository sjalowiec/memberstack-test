/**
 * Server-only lead capture for the free Hat Pattern.
 * Reuses the shared tagged-lead handler. The browser never talks to AC.
 */

import {
  handleTaggedLeadCaptureRequest,
  resolveLeadActiveCampaignConfig,
  toPublicLeadResponse,
  TAGGED_LEAD_AC_DEFAULT_HOST,
  type TaggedLeadHandlerResult,
  type TaggedLeadRequestBody,
} from "../../leads/taggedLeadCapture";
import type { IpRateLimitStore } from "../../security/ipRateLimit";
import type { ActiveCampaignClient } from "../../activecampaign/client";
import {
  HAT_PATTERN_LEAD_MESSAGES,
  HAT_PATTERN_LEAD_TAG,
} from "./hatPatternLeadShared";

export {
  HAT_PATTERN_LEAD_MESSAGES,
  HAT_PATTERN_LEAD_TAG,
} from "./hatPatternLeadShared";

export const HAT_PATTERN_LEAD_AC_DEFAULT_HOST = TAGGED_LEAD_AC_DEFAULT_HOST;

export type HatPatternLeadRequestBody = TaggedLeadRequestBody;
export type HatPatternLeadHandlerResult = TaggedLeadHandlerResult;

type HandlerOptions = {
  env?: NodeJS.ProcessEnv;
  createClient?: (
    config: { baseUrl: string; apiKey: string },
  ) => ActiveCampaignClient;
  rateLimitStore?: IpRateLimitStore;
  clientIp?: string;
  now?: number;
};

export function resolveHatPatternLeadActiveCampaignConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { readAstroEnv?: boolean } = {},
) {
  return resolveLeadActiveCampaignConfig(env, options);
}

export async function handleHatPatternLeadRequest(
  body: HatPatternLeadRequestBody,
  options: HandlerOptions = {},
): Promise<HatPatternLeadHandlerResult> {
  return handleTaggedLeadCaptureRequest(body, {
    tag: HAT_PATTERN_LEAD_TAG,
    messages: HAT_PATTERN_LEAD_MESSAGES,
    logPrefix: "hat-pattern-lead",
    env: options.env,
    createClient: options.createClient,
    rateLimitStore: options.rateLimitStore,
    clientIp: options.clientIp,
    now: options.now,
  });
}

export function toPublicHatPatternLeadResponse(
  result: HatPatternLeadHandlerResult,
): { ok: true; message: string } | { ok: false; error: string } {
  return toPublicLeadResponse(result);
}
