/** Fields the /videos catalog page needs. Omits Vimeo player ids and hashes. */
export type VideoCatalogClientCard = {
  content_id?: string | number;
  slug?: string;
  title?: string;
  description?: string;
  summary?: string;
  posterUrl?: string;
  category?: string;
  subcategory?: string;
  access_level?: string;
  isTipOfWeek?: boolean;
  tipOfWeek?: boolean;
};

export function videoCatalogClientCards<T extends VideoCatalogClientCard>(
  videos: T[],
): VideoCatalogClientCard[] {
  return videos.map((video) => ({
    content_id: video.content_id,
    slug: video.slug,
    title: video.title,
    description: video.description,
    summary: video.summary,
    posterUrl: video.posterUrl,
    category: video.category,
    subcategory: video.subcategory,
    access_level: video.access_level,
    isTipOfWeek: video.isTipOfWeek,
    tipOfWeek: video.tipOfWeek,
  }));
}
