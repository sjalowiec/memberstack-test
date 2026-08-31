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
  BICKFORD_SEAM_GLOSSARY_ID,
  BICKFORD_SEAM_GLOSSARY_TERM,
  KITCHENER_STITCH_GLOSSARY_ID,
  KITCHENER_STITCH_GLOSSARY_TERM,
  SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_ID,
  SCRAP_AND_RAVEL_CAST_ON_GLOSSARY_TERM,
  SOCK_ANKLE_VIDEO_PRIVACY_HASH,
  SOCK_ANKLE_VIDEO_TIP_ID,
  SOCK_ANKLE_VIDEO_TITLE,
  SOCK_ANKLE_VIDEO_VIMEO_ID,
  SOCK_CUFF_CAST_ON_VIDEO_TIP_ID,
  SOCK_CUFF_CAST_ON_VIDEO_TITLE,
  SOCK_CUFF_CAST_ON_VIDEO_VIMEO_ID,
  SOCK_HEEL_VIDEO_PRIVACY_HASH,
  SOCK_HEEL_VIDEO_TIP_ID,
  SOCK_HEEL_VIDEO_TITLE,
  SOCK_HEEL_VIDEO_VIMEO_ID,
  SOCK_TOE_FINISHING_VIDEO_PRIVACY_HASH,
  SOCK_TOE_FINISHING_VIDEO_TIP_ID,
  SOCK_TOE_FINISHING_VIDEO_TITLE,
  SOCK_TOE_FINISHING_VIDEO_VIMEO_ID,
  SOCK_TOE_VIDEO_PRIVACY_HASH,
  SOCK_TOE_VIDEO_TIP_ID,
  SOCK_TOE_VIDEO_TITLE,
  SOCK_TOE_VIDEO_VIMEO_ID,
  SOCK_WHY_STOP_ROW_COUNTER_BODY,
  SOCK_WHY_STOP_ROW_COUNTER_TIP_ID,
  SOCK_WHY_STOP_ROW_COUNTER_TITLE,
  SOCK_SECOND_SOCK_INTRO,
  SOCK_REHANG_TOE_INSTRUCTION,
  formatSockInstructionOutline,
  renderBasicSockInstructionsHtml,
  wrapSockPatternSection,
} from "./sockInstructionRender";
