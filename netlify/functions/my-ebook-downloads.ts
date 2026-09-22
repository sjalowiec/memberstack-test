/**
 * Customer My Downloads API — legacy ebook entitlements plus Stripe-paid
 * downloads for the verified Memberstack session email (no membership required).
 *
 * GET /.netlify/functions/my-ebook-downloads
 *
 * Auth: requireMember (Bearer JWT). Email is taken only from the verified
 * session — query/body email, member ID, and Memberstack ID are ignored.
 *
 * Legacy CSV lookup is unioned with paid Watson store transactions
 * (billing email, then trusted unique legacy member ID) when
 * LEGACY_EBOOK_WATSON_LOOKUP=true on production. Production stays CSV-only
 * until that flag is set. Paid-download lookup failures must not hide
 * legacy ebooks; Watson lookup failures must not hide CSV ebooks.
 */
import { requireMember } from "./lib/member-auth.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import {
  listPaidDownloadCustomerEntitlementsForEmail,
  type PaidDownloadCustomerEntitlement,
} from "../../src/lib/downloads/paidDownloadEntitlements";
import { resolveCustomerLegacyEbookEntitlementsForEmail } from "../../src/lib/legacy/legacyEbookOwnership";

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed." }, 405));
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    return withCors(jsonResponse({ ok: false, error: auth.error }, auth.status));
  }

  // Intentionally ignore any client-supplied email, member ID, or Memberstack ID.
  const email = auth.member.email;

  try {
    const ebooks = await resolveCustomerLegacyEbookEntitlementsForEmail(email, {
      allowLiveWatson: true,
    });

    let paid: PaidDownloadCustomerEntitlement[] = [];
    try {
      paid = await listPaidDownloadCustomerEntitlementsForEmail(email);
    } catch (err) {
      console.error("my-ebook-downloads: paid-download lookup failed:", err);
    }

    const downloads = [...ebooks, ...paid];
    return withCors(
      jsonResponse({
        ok: true,
        ebooks: downloads,
        downloads,
        authMode: auth.mode,
      }),
    );
  } catch (err) {
    console.error("my-ebook-downloads failed:", err);
    return withCors(
      jsonResponse({ ok: false, error: "Failed to load downloads." }, 500),
    );
  }
};
