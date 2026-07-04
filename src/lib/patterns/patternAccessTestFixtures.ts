/**
 * Test fixtures for {@link SleevelessUserAccess} after per-system entitlement migration.
 */
import type { PatternSystemId } from "./patternSystemId";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

export function testAccess(
  partial: Partial<SleevelessUserAccess> & {
    loggedIn: boolean;
    hasSystemAccess: boolean;
    /** Shorthand - sets claim on sleeveless unless patternSystem is given. */
    freeClaimed?: boolean;
    freeClaimedPatternId?: string;
    claimedSystem?: PatternSystemId;
  },
): SleevelessUserAccess {
  const {
    freeClaimed,
    freeClaimedPatternId,
    claimedSystem = "sleeveless",
    freeClaimsBySystem,
    ...rest
  } = partial;

  let claims = freeClaimsBySystem ?? {};
  if (freeClaimed === true) {
    claims = {
      ...claims,
      [claimedSystem]: {
        claimed: true,
        ...(freeClaimedPatternId ? { patternId: freeClaimedPatternId } : {}),
      },
    };
  } else if (freeClaimed === false && !freeClaimsBySystem) {
    claims = {};
  }

  return {
    freeClaimsBySystem: claims,
    ...rest,
  } as SleevelessUserAccess;
}
