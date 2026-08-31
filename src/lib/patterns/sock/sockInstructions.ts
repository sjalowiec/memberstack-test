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
  SOCK_TOE_UP_OPENING_SECTION_TITLE,
  buildBasicSockInstructionPair,
  buildBasicSockInstructions,
  type BuildBasicSockInstructionsOptions,
} from "./sockInstructionBuild";

export { buildSockShortRowInstructionSection } from "./sockShortRowInstructions";

export {
  SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID,
  SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM,
  SOCK_ANKLE_VIDEO_TIP_ID,
  SOCK_ANKLE_VIDEO_TITLE,
  SOCK_ANKLE_VIDEO_VIMEO_ID,
  SOCK_CUFF_CAST_ON_VIDEO_TIP_ID,
  SOCK_CUFF_CAST_ON_VIDEO_TITLE,
  SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID,
  formatSockInstructionOutline,
  renderBasicSockInstructionsHtml,
  wrapSockPatternSection,
} from "./sockInstructionRender";
