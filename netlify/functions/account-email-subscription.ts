/**
 * Customer-facing email-list status and explicit resubscribe for the Account page.
 *
 * GET  /.netlify/functions/account-email-subscription
 * POST /.netlify/functions/account-email-subscription
 *
 * Auth: requireMember (Bearer Memberstack JWT). Email is taken only from the
 * verified session — query/body email parameters are ignored.
 *
 * Independent of membership status. Never auto-subscribes on GET.
 */
import { requireMember } from "./lib/member-auth.js";
import { getMemberstackAdminClient } from "./lib/memberstack-admin.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import {
  checkAccountEmailSubscription,
  namesFromMemberstackRecord,
  resubscribeAccountEmailSubscription,
  toPublicAccountEmailSubscriptionResubscribe,
  toPublicAccountEmailSubscriptionStatus,
} from "../../src/lib/account/accountEmailSubscription";

async function lookupMemberNames(
  memberId: string,
): Promise<{ firstName?: string; lastName?: string }> {
  try {
    const client = getMemberstackAdminClient();
    if (!client) return {};
    const record = await client.getMember(memberId);
    return namesFromMemberstackRecord(record);
  } catch {
    return {};
  }
}

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed." }, 405));
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    return withCors(jsonResponse({ ok: false, error: auth.error }, auth.status));
  }

  // Intentionally ignore any client-supplied email (query or body).
  const email = auth.member.email;

  if (req.method === "GET") {
    const result = await checkAccountEmailSubscription(email);
    return withCors(
      jsonResponse(toPublicAccountEmailSubscriptionStatus(result), result.status),
    );
  }

  const names = await lookupMemberNames(auth.member.id);
  const result = await resubscribeAccountEmailSubscription(email, names);
  return withCors(
    jsonResponse(toPublicAccountEmailSubscriptionResubscribe(result), result.status),
  );
};
