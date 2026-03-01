import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE_FILE = path.join(process.cwd(), 'src/data/vimeoThumbCache.json');
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CacheEntry {
  thumbnail_url: string;
  fetched_at: number;
}

interface CacheData {
  [videoId: string]: CacheEntry;
}

export function extractVimeoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  
  const trimmed = url.trim();
  
  // player.vimeo.com/video/{id}
  const playerMatch = trimmed.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (playerMatch) return playerMatch[1];
  
  // vimeo.com/{id} or vimeo.com/video/{id}
  const standardMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (standardMatch) return standardMatch[1];
  
  return null;
}

export function toVimeoPlayerUrl(url: string): string | null {
  const id = extractVimeoId(url);
  if (!id) return null;
  return `https://player.vimeo.com/video/${id}`;
}

async function readCache(): Promise<CacheData> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeCache(cache: CacheData): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[vimeo] failed to write cache:', err);
  }
}

export async function getVimeoThumbnailUrl(videoUrl: string): Promise<string | null> {
  const id = extractVimeoId(videoUrl);
  if (!id) return null;
  
  // Build sanitized URL from ID only (no query params from original)
  const sanitizedVimeoUrl = `https://vimeo.com/${id}`;
  
  const cache = await readCache();
  const entry = cache[id];
  
  // Check if cache entry exists and is not stale
  if (entry && (Date.now() - entry.fetched_at) < CACHE_TTL_MS) {
    return entry.thumbnail_url;
  }
  
  // Cache miss or stale - fetch from oEmbed using sanitized URL
  // For domain-restricted videos, we need to send the Referer header
  let thumbnailUrl: string | null = null;
  
  // List of referer domains to try (whitelisted domains for Vimeo embeds)
  const refererDomains = [
    'https://knitbymachine.com',
    'https://www.knitbymachine.com',
  ];
  
  for (const referer of refererDomains) {
    if (thumbnailUrl) break;
    
    try {
      const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(sanitizedVimeoUrl)}`;
      const response = await fetch(oembedUrl, {
        headers: {
          'Referer': referer,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        thumbnailUrl = data.thumbnail_url || null;
        
        if (thumbnailUrl) {
          console.log('[vimeo] oembed thumbnail fetched for', id, 'using referer', referer);
        }
      } else {
        console.warn('[vimeo] oEmbed request failed:', response.status, 'for referer', referer);
      }
    } catch (err) {
      console.warn('[vimeo] oEmbed fetch error:', err);
    }
  }
  
  if (!thumbnailUrl) {
    console.error('[vimeo] no thumbnail available for', id);
    return null;
  }
  
  // Update cache
  cache[id] = {
    thumbnail_url: thumbnailUrl,
    fetched_at: Date.now()
  };
  await writeCache(cache);
  
  return thumbnailUrl;
}
