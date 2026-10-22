/**
 * Help Hub discovery activity.
 * Records which published entry was opened, surprised, or saved.
 * The stored event is the slug and the action. It does not keep a question,
 * an answer, an email, a member id, or a visitor id.
 */

import { randomUUID } from "node:crypto";

import { cleanHelpHubDiscoverySlug } from "./discoverySlug";
import {
  resolveSearchActivityEnvironment,
  resolveStoredIdentity,
  type SearchActivityEnvironment,
  type SearchActivityIdentity,
} from "../searchActivity";

export { cleanHelpHubDiscoverySlug };

export const HELP_HUB_DISCOVERY_ACTIVITY_TYPES = [
  "surprise_me",
  "discovery_open",
  "favorite_save",
  "favorite_remove",
] as const;

export type HelpHubDiscoveryActivityType = (typeof HELP_HUB_DISCOVERY_ACTIVITY_TYPES)[number];

export type HelpHubDiscoveryActivityEvent = {
  id: string;
  slug: string;
  eventType: HelpHubDiscoveryActivityType;
  identity: SearchActivityIdentity;
  environment: SearchActivityEnvironment;
  sourcePage?: string;
  createdAt: string;
};

export function isHelpHubDiscoveryActivityType(
  value: unknown,
): value is HelpHubDiscoveryActivityType {
  return (
    typeof value === "string" &&
    (HELP_HUB_DISCOVERY_ACTIVITY_TYPES as readonly string[]).includes(value)
  );
}

function cleanSourcePage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return undefined;
  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? "";
  if (!pathOnly.startsWith("/") || pathOnly.includes("\\") || pathOnly.includes("@")) return undefined;
  return pathOnly.slice(0, 180);
}

/**
 * Builds one discovery event from the public action.
 * A verified session may mark the visitor as a member, but the member id is not stored.
 */
export function buildHelpHubDiscoveryActivityEvent(
  raw: unknown,
  options: {
    verifiedMemberId?: string | null;
    now?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): { ok: true; event: HelpHubDiscoveryActivityEvent } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Event body required." };
  }
  const body = raw as Record<string, unknown>;
  const slug = cleanHelpHubDiscoverySlug(body.slug);
  if (!slug) return { ok: false, error: "Help Hub slug is required." };
  if (!isHelpHubDiscoveryActivityType(body.eventType ?? body.event_type)) {
    return { ok: false, error: "Event type is not a Help Hub discovery action." };
  }

  const identity = resolveStoredIdentity({
    verifiedMemberId: options.verifiedMemberId,
    clientIdentity: body.identity,
  });

  const event: HelpHubDiscoveryActivityEvent = {
    id: randomUUID(),
    slug,
    eventType: (body.eventType ?? body.event_type) as HelpHubDiscoveryActivityType,
    identity: identity.identity,
    environment: resolveSearchActivityEnvironment(options.env),
    createdAt: options.now ?? new Date().toISOString(),
  };
  const sourcePage = cleanSourcePage(body.sourcePage ?? body.source_page);
  if (sourcePage) event.sourcePage = sourcePage;
  return { ok: true, event };
}
