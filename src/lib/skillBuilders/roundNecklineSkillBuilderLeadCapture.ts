/**
 * Server-only lead capture for the free Round Neckline Skill Builder.
 * Reuses the shared tagged-lead handler. The browser never talks to AC.
 *
 * Contact upsert + tag apply follow the same sequence as
 * `netlify/functions/memberstack-created.ts` (the proven working path).
 */

import {
  handleTaggedLeadCaptureRequest,
  resolveLeadActiveCampaignConfig,
  toPublicLeadResponse,
  TAGGED_LEAD_AC_DEFAULT_HOST,
  type TaggedLeadHandlerResult,
  type TaggedLeadRequestBody,
} from "../leads/taggedLeadCapture";
import type { ActiveCampaignClient } from "../activecampaign/client";
import type { IpRateLimitStore } from "../security/ipRateLimit";
import {
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG,
} from "./roundNecklineSkillBuilderLeadShared";

export {
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG,
} from "./roundNecklineSkillBuilderLeadShared";

/** Current Knit It Now Admin API host, from the existing email-list-signup integration. */
export const ROUND_NECKLINE_SKILL_BUILDER_AC_DEFAULT_HOST =
  TAGGED_LEAD_AC_DEFAULT_HOST;

export type RoundNecklineLeadRequestBody = TaggedLeadRequestBody;

export type RoundNecklineLeadOutcome = TaggedLeadHandlerResult extends { outcome: infer O }
  ? O
  : never;

export type RoundNecklineLeadHandlerResult = TaggedLeadHandlerResult;

type HandlerOptions = {
  env?: NodeJS.ProcessEnv;
  createClient?: (
    config: { baseUrl: string; apiKey: string },
  ) => ActiveCampaignClient;
  rateLimitStore?: IpRateLimitStore;
  clientIp?: string;
  now?: number;
};

export function resolveRoundNecklineLeadActiveCampaignConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { readAstroEnv?: boolean } = {},
) {
  return resolveLeadActiveCampaignConfig(env, options);
}

/**
 * Upsert the contact and apply the Round Neckline Skill Builder lead tag.
 * Invalid email / honeypot / rate-limit still reject or decoy as before.
 * ActiveCampaign integration failures are logged and do not block practice.
 */
export async function handleRoundNecklineSkillBuilderLeadRequest(
  body: RoundNecklineLeadRequestBody,
  options: HandlerOptions = {},
): Promise<RoundNecklineLeadHandlerResult> {
  return handleTaggedLeadCaptureRequest(body, {
    tag: ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG,
    messages: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES,
    logPrefix: "skill-builder-round-neckline-lead",
    env: options.env,
    createClient: options.createClient,
    rateLimitStore: options.rateLimitStore,
    clientIp: options.clientIp,
    now: options.now,
  });
}

/** Shape returned to the browser (no outcome / AC status fields). */
export function toPublicRoundNecklineLeadResponse(
  result: RoundNecklineLeadHandlerResult,
): { ok: true; message: string } | { ok: false; error: string } {
  return toPublicLeadResponse(result);
}
