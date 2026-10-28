/**
 * Who may see the Getting Started Guide.
 * Signed-in Memberstack members skip the form and are not subscribed or tagged.
 * A recognized browser skips the form for one year after a successful signup.
 * Everyone else sees the introduction and the signup form.
 */

import { isMemberstackLoggedInPayload } from "../patterns/memberstackMember";

export type GettingStartedGuideAccess = "show-guide" | "show-form";

export function decideGettingStartedGuideAccess(args: {
  recognized: boolean;
  memberLoggedIn: boolean;
}): GettingStartedGuideAccess {
  if (args.recognized || args.memberLoggedIn) return "show-guide";
  return "show-form";
}

/**
 * Signed-in Memberstack members skip the form, including members without a paid plan.
 * `null` means the site has not published an access snapshot yet.
 */
export function signedInMemberFromAccessSnapshot(
  snapshot: { viewerAccessState?: string } | null | undefined,
): boolean | null {
  const state = snapshot?.viewerAccessState;
  if (state === "loggedOut") return false;
  if (state === "loggedInNoAccess" || state === "memberAccess") return true;
  return null;
}

/**
 * Unlock only when ActiveCampaign accepted the signup.
 * A failure leaves the form in place.
 */
export function guideSignupUnlock(
  result: { ok: true } | { ok: false; error: string },
): { unlock: true } | { unlock: false; error: string } {
  if (result.ok) return { unlock: true };
  return { unlock: false, error: result.error };
}

export async function readGettingStartedGuideMember(options: {
  getMember?: () => Promise<unknown>;
} = {}): Promise<{ loggedIn: boolean }> {
  const getMember =
    options.getMember ??
    (() => {
      const ms = typeof window !== "undefined" ? window.$memberstackDom : undefined;
      if (ms && typeof ms.getAppAndMember === "function") {
        return ms.getAppAndMember();
      }
      return Promise.resolve(null);
    });

  try {
    const payload = await getMember();
    return { loggedIn: isMemberstackLoggedInPayload(payload) };
  } catch {
    return { loggedIn: false };
  }
}

/**
 * Members and recognized browsers see the guide.
 * This function does not call ActiveCampaign.
 */
export async function resolveGettingStartedGuideAccess(args: {
  recognized: boolean;
  readMember?: typeof readGettingStartedGuideMember;
}): Promise<GettingStartedGuideAccess> {
  if (args.recognized) return "show-guide";
  const member = await (args.readMember ?? readGettingStartedGuideMember)();
  return decideGettingStartedGuideAccess({
    recognized: false,
    memberLoggedIn: member.loggedIn,
  });
}
