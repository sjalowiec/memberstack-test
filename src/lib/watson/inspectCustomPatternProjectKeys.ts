/**
 * Typed re-exports of pure blob-key helpers for Watson Saved Pattern Inspector.
 * Implementation lives in the adjacent `.mjs` so the local CLI can share it.
 */

export {
  findMatchingProjectKeys,
  isUuid,
  keyEndsWithProjectJson,
  matchOutcome,
  parseMemberstackUserIdFromKey,
} from "./inspectCustomPatternProjectKeys.mjs";

export type MatchOutcome = "one" | "none" | "many";
