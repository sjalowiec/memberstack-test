/**
 * Basic Socks instruction generation entry.
 * Pipeline: approved calc → structured sections → HTML renderer.
 */

export {
  SOCK_SHORT_ROW_WRAP_WARNING,
  SOCK_TOE_FINISHING_DEFAULT,
  sockHoldOrientation,
  sockInstructionSectionIds,
  type SockHoldOrientation,
  type SockInstructionDocument,
  type SockInstructionSection,
  type SockInstructionSectionId,
  type SockInstructionStep,
  type SockNeedleHalf,
  type SockOfPair,
  type SockSectionRc,
  type SockShortRowPart,
  type SockToeFinishingVariation,
} from "./sockInstructionModel";

export {
  buildBasicSockInstructionPair,
  buildBasicSockInstructions,
  type BuildBasicSockInstructionsOptions,
} from "./sockInstructionBuild";

export { buildSockShortRowInstructionSection } from "./sockShortRowInstructions";

export {
  formatSockInstructionOutline,
  renderBasicSockInstructionsHtml,
  wrapSockPatternSection,
} from "./sockInstructionRender";
