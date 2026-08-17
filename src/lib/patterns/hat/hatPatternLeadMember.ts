/**
 * Read a known Memberstack email for silent Hat lead tagging.
 * Uses getAppAndMember when available (Hat workspace convention) so we do not
 * classify membership from getCurrentMember. Email presence is enough to skip
 * the visible form — plan is irrelevant.
 */

import {
  isMemberstackLoggedInPayload,
  memberEmailFromMemberstackPayload,
  memberFirstNameFromMemberstackPayload,
} from "../memberstackMember";

export type KnownHatLeadMember = {
  email: string;
  firstName?: string;
  loggedIn: boolean;
};

export async function readKnownHatLeadMember(options: {
  getMember?: () => Promise<unknown>;
} = {}): Promise<KnownHatLeadMember | null> {
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
    const email = memberEmailFromMemberstackPayload(payload);
    const loggedIn = isMemberstackLoggedInPayload(payload);
    if (!email && !loggedIn) return null;
    if (!email) return { email: "", loggedIn: true };
    const firstName = memberFirstNameFromMemberstackPayload(payload);
    return firstName ? { email, firstName, loggedIn: true } : { email, loggedIn: true };
  } catch {
    return null;
  }
}
