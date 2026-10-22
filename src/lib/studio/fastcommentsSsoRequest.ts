/**
 * Signs a FastComments session from a verified Memberstack token.
 * Does not change Memberstack login, cookies, or the shared admin client.
 */
import { bearerTokenFromRequest } from "../../../netlify/functions/lib/member-auth.js";
import {
  STUDIO_FASTCOMMENTS_TENANT_ID,
  STUDIO_FASTCOMMENTS_URL_ID,
  isStudioCommentsPocProductionBlocked,
} from "./fastcommentsPocAccess";
import {
  buildSecureSsoWidgetUser,
  studioCommentIdentityFromMemberRecord,
  type SecureSsoWidgetUser,
} from "./fastcommentsSso";
import type { DetectSiteEnvironmentOptions } from "../env/siteEnvironment";

export type StudioMemberstackVerifier = {
  /** Sandbox is required. A live Admin secret must not verify kin-dev test members. */
  mode: "sandbox" | "live" | "unset";
  verifyMemberToken: (token: string) => Promise<{ id?: string | null } | null>;
  getMember: (id: string) => Promise<unknown>;
};

export type StudioFastcommentsSsoBody = {
  ok: boolean;
  tenantId: string;
  urlId: string;
  authenticated: boolean;
  displayName: string | null;
  sso: SecureSsoWidgetUser | null;
  code: string | null;
};

function json(body: StudioFastcommentsSsoBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function publicBody(
  patch: Partial<StudioFastcommentsSsoBody> & Pick<StudioFastcommentsSsoBody, "ok" | "authenticated">,
): StudioFastcommentsSsoBody {
  return {
    tenantId: STUDIO_FASTCOMMENTS_TENANT_ID,
    urlId: STUDIO_FASTCOMMENTS_URL_ID,
    displayName: null,
    sso: null,
    code: null,
    ...patch,
  };
}

export async function handleStudioFastcommentsSso(options: {
  request: Request;
  hostname: string;
  siteEnv?: DetectSiteEnvironmentOptions;
  apiSecret: string | null;
  memberstack: StudioMemberstackVerifier | null;
  now?: number;
  readBearerToken?: (request: Request) => string | null;
}): Promise<Response> {
  if (isStudioCommentsPocProductionBlocked(options.hostname, options.siteEnv)) {
    return new Response("Not found", { status: 404 });
  }

  const readBearerToken = options.readBearerToken ?? bearerTokenFromRequest;
  const token = readBearerToken(options.request);
  if (!token) {
    return json(publicBody({ ok: true, authenticated: false }));
  }

  if (!options.memberstack || options.memberstack.mode !== "sandbox") {
    return json(
      publicBody({
        ok: false,
        authenticated: false,
        code: "memberstack-sandbox-secret-missing",
      }),
      503,
    );
  }

  let verified: { id?: string | null } | null = null;
  try {
    verified = await options.memberstack.verifyMemberToken(token);
  } catch {
    verified = null;
  }
  const memberId = typeof verified?.id === "string" ? verified.id.trim() : "";
  if (!memberId.startsWith("mem_sb_")) {
    return json(
      publicBody({
        ok: false,
        authenticated: false,
        code: "session-invalid",
      }),
      401,
    );
  }

  let record: unknown = null;
  try {
    record = await options.memberstack.getMember(memberId);
  } catch {
    return json(
      publicBody({
        ok: false,
        authenticated: false,
        code: "member-lookup-failed",
      }),
      503,
    );
  }

  const identity = studioCommentIdentityFromMemberRecord(record);
  if (!identity.email) {
    return json(
      publicBody({
        ok: false,
        authenticated: true,
        code: "member-email-missing",
      }),
      200,
    );
  }
  if (!identity.displayName) {
    return json(
      publicBody({
        ok: false,
        authenticated: true,
        displayName: null,
        code: "member-name-missing",
      }),
      200,
    );
  }

  const apiSecret = options.apiSecret?.trim() ?? "";
  if (!apiSecret) {
    return json(
      publicBody({
        ok: false,
        authenticated: true,
        displayName: identity.displayName,
        code: "fastcomments-secret-missing",
      }),
      503,
    );
  }

  const sso = buildSecureSsoWidgetUser({
    id: memberId,
    email: identity.email,
    displayName: identity.displayName,
    apiSecret,
    timestamp: options.now ?? Date.now(),
  });

  return json(
    publicBody({
      ok: true,
      authenticated: true,
      displayName: identity.displayName,
      sso,
    }),
  );
}
