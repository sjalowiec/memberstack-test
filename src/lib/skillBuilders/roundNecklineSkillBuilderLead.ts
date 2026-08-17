import {
  roundNecklineSkillBuilderRequiresLeadCapture,
  type RoundNecklineSkillBuilderId,
} from "./roundNecklineSkillBuilders";

export type RoundNecklineLeadCaptureDecision =
  | { action: "create-practice" }
  | { action: "submit-known-email"; email: string; firstName?: string }
  | { action: "show-capture" };

/**
 * Decide whether the free Skill Builder should ask for email, silently tag a
 * known member, or continue straight to the generated practice.
 * Member-only builders are unchanged — they never use this capture step.
 */
export function decideRoundNecklineLeadCapture(args: {
  builderId: RoundNecklineSkillBuilderId;
  alreadyCaptured: boolean;
  memberEmail?: string | null;
  memberFirstName?: string | null;
}): RoundNecklineLeadCaptureDecision {
  if (!roundNecklineSkillBuilderRequiresLeadCapture(args.builderId)) {
    return { action: "create-practice" };
  }
  if (args.alreadyCaptured) {
    return { action: "create-practice" };
  }

  const email = typeof args.memberEmail === "string" ? args.memberEmail.trim() : "";
  if (email) {
    const firstName =
      typeof args.memberFirstName === "string" ? args.memberFirstName.trim() : "";
    return firstName
      ? { action: "submit-known-email", email, firstName }
      : { action: "submit-known-email", email };
  }

  return { action: "show-capture" };
}
