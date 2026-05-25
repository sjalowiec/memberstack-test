import type { CustomPatternProjectSource } from "./customPatternProjectTypes";

export const OPEN_PATTERN_HREF = "/patterns/sleeveless/pattern/";

export const EXPRESS_CONTINUE_EDITING_HREF = "/patterns/sleeveless/review/";

export const CUSTOM_BUILD_CONTINUE_EDITING_HREF = "/patterns/sleeveless/custom-build/design";

/** Where to send the knitter after loading a saved project to continue editing. */
export function getContinueEditingHref(source: CustomPatternProjectSource): string {
  return source === "express" ? EXPRESS_CONTINUE_EDITING_HREF : CUSTOM_BUILD_CONTINUE_EDITING_HREF;
}
