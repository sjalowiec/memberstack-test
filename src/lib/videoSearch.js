export function highlightMatch(text, query) {
  if (!query) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  return text.replace(regex, '<strong class="video-search__highlight">$1</strong>');
}

export function searchVideos(videos, query) {
    if (!query) return [];
  
    const q = query.toLowerCase();
  
    let results = [];
  
    videos.forEach(video => {
      video.chunks.forEach(chunk => {
        if (chunk.text.toLowerCase().includes(q)) {
          results.push({
            videoId: video.vimeoId,
            title: video.title,
            start: chunk.start,
            timestamp: chunk.timestamp,
            text: chunk.text
          });
        }
      });
    });
  
    return results;
  }