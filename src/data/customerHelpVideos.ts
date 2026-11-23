/**
 * Public customer help videos.
 *
 * Each entry becomes one page at /video-help/{slug}/.
 * The page plays only videos listed here. A Vimeo id in the URL is ignored.
 *
 * To add a video, copy an entry and fill in slug, title, intro, and vimeoId.
 * Add privacyHash only when the Vimeo video is Unlisted.
 */
export type CustomerHelpVideo = {
  slug: string;
  title: string;
  intro: string;
  vimeoId: string;
  privacyHash?: string;
};

export const customerHelpVideos: readonly CustomerHelpVideo[] = [
  {
    slug: "save-designaknit-file",
    title: "How to save a file in DesignaKnit",
    intro: "Click the play button below to watch. You can pause and replay any step.",
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
