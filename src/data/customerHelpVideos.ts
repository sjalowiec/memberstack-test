/**
 * Customer help videos that ship with the site.
 *
 * Each entry is a public page at /video-help/{slug}/. A Vimeo id in the URL
 * is ignored. Add the next video in Admin → Support Videos. That save is
 * stored for the live site and does not require a new deploy.
 * Add privacyHash only when the Vimeo video is Unlisted.
 */
export type CustomerHelpVideo = {
  slug: string;
  title: string;
  intro: string;
  vimeoId: string;
  privacyHash?: string;
};

export const CUSTOMER_HELP_VIDEO_INTRO =
  "Click the play button below to watch. You can pause and replay any step.";

export const customerHelpVideos: readonly CustomerHelpVideo[] = [
  {
    slug: "save-designaknit-file",
    title: "How to save a file in DesignaKnit",
    intro: CUSTOMER_HELP_VIDEO_INTRO,
    vimeoId: "1249450856",
  },
];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIMEO_ID = /^\d{6,20}$/;
const PRIVACY_HASH = /^[A-Za-z0-9]+$/;

export function findCustomerHelpVideo(slug: string): CustomerHelpVideo | undefined {
  const key = slug.trim().toLowerCase();
  if (!SLUG.test(key)) return undefined;
  const video = customerHelpVideos.find((entry) => entry.slug === key);
  if (!video) return undefined;
  if (!VIMEO_ID.test(video.vimeoId.trim())) return undefined;
  const privacyHash = video.privacyHash?.trim() ?? "";
  if (privacyHash && !PRIVACY_HASH.test(privacyHash)) return undefined;
  return video;
}
