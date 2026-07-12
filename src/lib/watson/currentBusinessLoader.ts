import {
  computeMembershipSummary,
  fetchAllMembers,
  type MembershipSummary,
  type MemberstackListMembersClient,
} from "../membership/membershipSummary";

export type CurrentBusinessLoadResult =
  | { ok: true; summary: MembershipSummary }
  | { ok: false; error: string };

type MemberstackAdminClient = MemberstackListMembersClient | null;

type MemberstackSecretEnv = {
  MEMBERSTACK_SECRET_KEY?: string;
};

/** Resolves the Memberstack admin secret from Astro SSR env (server-only). */
export function resolveCurrentBusinessMemberstackSecretKey(
  env: MemberstackSecretEnv = import.meta.env,
): string | null {
  const key = (env.MEMBERSTACK_SECRET_KEY || "").trim();
  return key || null;
}

async function getMemberstackAdminClientForCurrentBusiness(
  secretKey: string | null,
): Promise<MemberstackAdminClient> {
  const { getMemberstackAdminClient } = await import(
    "../../../netlify/functions/lib/memberstack-admin.js"
  );
  return getMemberstackAdminClient({ secretKey });
}

export async function loadCurrentBusinessMembershipSummary(options?: {
  getClient?: () => Promise<MemberstackAdminClient>;
  secretKey?: string | null;
}): Promise<CurrentBusinessLoadResult> {
  const getClient =
    options?.getClient ??
    (() =>
      getMemberstackAdminClientForCurrentBusiness(
        options && "secretKey" in options
          ? (options.secretKey ?? null)
          : resolveCurrentBusinessMemberstackSecretKey(),
      ));
  const client = await getClient();
  if (!client) {
    return { ok: false, error: "Memberstack admin API is not configured." };
  }

  try {
    const { members, truncated } = await fetchAllMembers(client);
    const summary = computeMembershipSummary(members, { truncated });
    return { ok: true, summary };
  } catch {
    return { ok: false, error: "Failed to load live membership summary from Memberstack." };
  }
}
