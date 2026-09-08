import { vimeoNumericIdFromPublicVideo, type PublicVideoRow } from "../lessonVideo";
import { catalogVideoIsPublic, findPublicCatalogVideoByContentId } from "../videoPublic";
import { catalogVideoPlaybackAccess } from "./catalogVideoPlaybackAccess";
import { buildCatalogVimeoEmbedSrc } from "./catalogVideoEmbedSrc";

export type CatalogVideoEmbedResult =
  | { ok: true; access: "open" | "member"; iframeSrc: string; title: string }
  | { ok: false; error: "not_found" | "no_player" };

export function resolveCatalogVideoEmbed(
  catalog: PublicVideoRow[],
  contentId: string,
  options: { enableVimeoPlayerApi?: boolean } = {},
): CatalogVideoEmbedResult {
  const row = findPublicCatalogVideoByContentId(catalog, contentId);
  if (!row || !catalogVideoIsPublic(row)) return { ok: false, error: "not_found" };
  const vimeoId = vimeoNumericIdFromPublicVideo(row);
  if (!vimeoId) return { ok: false, error: "no_player" };
  const iframePlayerId = `kbm-gated-vimeo-${contentId}`;
  const privacyHash =
    typeof row.vimeo_hash === "string" ? row.vimeo_hash.trim() : "";
  const iframeSrc = buildCatalogVimeoEmbedSrc({
    vimeoId,
    privacyHash,
    enableVimeoPlayerApi: options.enableVimeoPlayerApi,
    iframePlayerId,
  });
  if (!iframeSrc) return { ok: false, error: "no_player" };
  const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : "Video";
  return {
    ok: true,
    access: catalogVideoPlaybackAccess(row),
    iframeSrc,
    title,
  };
}
