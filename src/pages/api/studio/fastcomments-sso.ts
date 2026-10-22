import type { APIRoute } from "astro";

import {
  getMemberstackAdminClient,
  resolveMemberstackAdminSecret,
} from "../../../../netlify/functions/lib/memberstack-admin.js";
import { handleStudioFastcommentsSso } from "../../../lib/studio/fastcommentsSsoRequest";

export const prerender = false;

function apiSecret(): string | null {
  const fromProcess = process.env.FASTCOMMENTS_API_SECRET?.trim() ?? "";
  if (fromProcess) return fromProcess;
  const fromMeta = import.meta.env.FASTCOMMENTS_API_SECRET?.trim() ?? "";
  return fromMeta || null;
}

/** Secure SSO payload for the Sue's Studio comment proof. Secret stays on the server. */
export const GET: APIRoute = async ({ request, url }) => {
  const resolved = resolveMemberstackAdminSecret();
  const client =
    resolved.mode === "sandbox" && resolved.secretKey
      ? getMemberstackAdminClient({ secretKey: resolved.secretKey })
      : null;

  return handleStudioFastcommentsSso({
    request,
    hostname: url.hostname,
    siteEnv: {
      isViteDev: import.meta.env.DEV,
      publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
    },
    apiSecret: apiSecret(),
    memberstack: client
      ? {
          mode: "sandbox",
          verifyMemberToken: (token) => client.verifyMemberToken(token),
          getMember: (id) => client.getMember(id),
        }
      : null,
  });
};
