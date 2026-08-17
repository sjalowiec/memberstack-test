import {
  buildLeadSubmitPayload,
  submitLeadRequest,
  type LeadSubmitPayload,
  type LeadSubmitResult,
} from "../../leads/leadCaptureClient";
import {
  HAT_PATTERN_LEAD_ENDPOINT,
  HAT_PATTERN_LEAD_MESSAGES,
} from "./hatPatternLeadShared";

export type HatPatternLeadSubmitPayload = LeadSubmitPayload;
export type HatPatternLeadSubmitResult = LeadSubmitResult;

export function buildHatPatternLeadPayload(args: {
  email: string;
  firstName?: string;
  botField?: string;
}): HatPatternLeadSubmitPayload | { error: string } {
  return buildLeadSubmitPayload(args, HAT_PATTERN_LEAD_MESSAGES);
}

export async function submitHatPatternLeadRequest(
  payload: HatPatternLeadSubmitPayload,
  options: {
    fetchImpl?: typeof fetch;
    endpoint?: string;
  } = {},
): Promise<HatPatternLeadSubmitResult> {
  return submitLeadRequest(payload, {
    endpoint: options.endpoint ?? HAT_PATTERN_LEAD_ENDPOINT,
    messages: HAT_PATTERN_LEAD_MESSAGES,
    fetchImpl: options.fetchImpl,
  });
}
