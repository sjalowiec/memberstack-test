import { rankSearchText } from "./searchSynonyms.ts";

export function highlightMatch(text, query) {
  if (!query) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  return text.replace(regex, '<strong class="video-search__highlight">$1</strong>');
}

export function searchVideos(videos, query) {
    if (!query || !String(query).trim()) return [];

    const results = [];

    videos.forEach((video) => {
      video.chunks.forEach((chunk) => {
        const rank = rankSearchText(chunk.text || "", query);
        if (rank > 0) {
          results.push({
            rank,
            videoId: video.vimeoId,
            title: video.title,
            start: chunk.start,
            timestamp: chunk.timestamp,
            text: chunk.text,
          });
        }
      });
    });

    results.sort((a, b) => b.rank - a.rank);
    return results.map(({ rank, ...hit }) => hit);
  }