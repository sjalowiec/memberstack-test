/**
 * Whether the video page can show this transcript right now.
 * Open playback reads the public document. Member playback reads the member
 * document, and only after the same membership check as the player.
 */
import type { PublicVideoRow } from "../lessonVideo";
import {
  paragraphsForVimeoId,
  type CatalogTranscriptArtifact,
} from "../transcripts/catalogTranscriptData";
import { catalogTranscriptVimeoId } from "../transcripts/generateCatalogTranscripts";
import { catalogVideoIsPublic } from "../videoPublic";
import { catalogVideoPlaybackAccess } from "./catalogVideoPlaybackAccess";

export function transcriptIsLive(
  video: Record<string, unknown>,
  documents: { public: CatalogTranscriptArtifact; member: CatalogTranscriptArtifact },
): boolean {
  if (!catalogVideoIsPublic(video)) return false;
  const access = catalogVideoPlaybackAccess({
    access_level: video.access_level,
    featuredTipPlayback: video.featuredTipPlayback === true,
  });
  const artifact = access === "open" ? documents.public : documents.member;
  const vimeoId = catalogTranscriptVimeoId(video as PublicVideoRow);
  return paragraphsForVimeoId(artifact, vimeoId).length > 0;
}
