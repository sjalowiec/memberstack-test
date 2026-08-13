/**
 * Optional video slots for the public round-neckline Skill Builders.
 *
 * Add a numeric Vimeo ID (and optional title) when a video is ready.
 * Leave `vimeoId` empty so the page does not render an embed.
 */
export type SkillBuilderVideoSlot = {
  vimeoId: string;
  title?: string;
};

export type RoundNecklineSkillBuilderVideoKey =
  | "round-neckline-basics"
  | "round-neckline-basics/shallow-back"
  | "round-neckline-basics/deep-front"
  | "round-necklines-shaped-shoulders"
  | "round-necklines-shaped-shoulders/shallow-back"
  | "round-necklines-shaped-shoulders/deep-front";

export const ROUND_NECKLINE_SKILL_BUILDER_VIDEOS: Record<
  RoundNecklineSkillBuilderVideoKey,
  SkillBuilderVideoSlot | null
> = {
  "round-neckline-basics": null,
  "round-neckline-basics/shallow-back": null,
  "round-neckline-basics/deep-front": null,
  "round-necklines-shaped-shoulders": null,
  "round-necklines-shaped-shoulders/shallow-back": null,
  "round-necklines-shaped-shoulders/deep-front": null,
};

export function skillBuilderVideoSlot(
  key: RoundNecklineSkillBuilderVideoKey,
): SkillBuilderVideoSlot | null {
  const slot = ROUND_NECKLINE_SKILL_BUILDER_VIDEOS[key];
  if (!slot) return null;
  const vimeoId = slot.vimeoId.trim();
  if (!vimeoId) return null;
  return { ...slot, vimeoId };
}
