/**
 * Server-side read of the pattern-activity-log blob store.
 * Watson's session cookie is the only client credential. A DEV member token is
 * never sent to production. Cross-site reads use a server-only blobs token.
 */
import { getStore } from "@netlify/blobs";

import {
  isKinDevNetlifySite,
  KIN_DEV_SITE_ID,
  listActivityEvents,
  PATTERN_ACTIVITY_BLOB_STORE,
} from "../../../netlify/functions/lib/pattern-activity-store.js";

/** Public Netlify site id for https://knititnow.com (site name `knititnow`). */
export const PRODUCTION_PATTERN_ACTIVITY_SITE_ID = "7a6a8dde-c0a0-4a21-960d-dff3f0ba358b";

export type PatternActivityReadEnvironment = "production" | "dev";

export type PatternActivityReadResult =
  | { ok: true; events: unknown[]; total: number }
  | { ok: false; status: number; error: string };

function blobsToken(env: NodeJS.ProcessEnv): string {
  return (
    env.PATTERN_ACTIVITY_BLOBS_TOKEN?.trim() ||
    env.NETLIFY_AUTH_TOKEN?.trim() ||
    ""
  );
}

function storeFor(
  environment: PatternActivityReadEnvironment,
  env: NodeJS.ProcessEnv,
): { store: ReturnType<typeof getStore> } | { error: string } {
  const onDev = isKinDevNetlifySite(env);
  const sameSite = (environment === "dev") === onDev;
  if (sameSite) {
    return {
      store: getStore({
        name: PATTERN_ACTIVITY_BLOB_STORE,
        consistency: "strong",
      }),
    };
  }
  const token = blobsToken(env);
  if (!token) {
    return {
      error:
        "This server cannot read the other site's pattern activity. A server-side blobs token is required, and the browser session is not sent across sites.",
    };
  }
  const siteID = environment === "dev" ? KIN_DEV_SITE_ID : PRODUCTION_PATTERN_ACTIVITY_SITE_ID;
  return {
    store: getStore({
      name: PATTERN_ACTIVITY_BLOB_STORE,
      siteID,
      token,
      consistency: "strong",
    }),
  };
}

export async function readPatternActivityEvents(options: {
  environment: PatternActivityReadEnvironment;
  from?: string;
  to?: string;
  offset?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<PatternActivityReadResult> {
  const env = options.env ?? process.env;
  const resolved = storeFor(options.environment, env);
  if ("error" in resolved) {
    return { ok: false, status: 503, error: resolved.error };
  }
  const limit = 2000;
  const offset = Number(options.offset);
  const listed = await listActivityEvents(resolved.store, {
    from: options.from || undefined,
    to: options.to || undefined,
    limit,
    offset: Number.isFinite(offset) ? offset : 0,
  });
  return { ok: true, events: listed.events, total: listed.total };
}
