/**
 * Foundations data fetching utilities
 * Fetches published foundations from the admin API
 */

export interface FoundationNextStep {
  label: string;
  href: string;
  note?: string;
}

export interface FoundationImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface FoundationVideo {
  title: string;
  vimeoId: string;
  access: "free" | "member";
  description?: string;
  posterSrc?: string;
  runtime?: string;
}

export interface FoundationContentSection {
  heading: string;
  body?: string;
  bullets?: string[];
  callout?: { title?: string; text: string };
}

export interface Foundation {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  status: string;
  machineTags: string[];
  intro: string | null;
  heroImageSrc: string | null;
  heroImageAlt: string | null;
  whatYoullBeAbleToDo: string[];
  youNeed: string[];
  commonSnags: string[];
  sections: FoundationContentSection[];
  videos: FoundationVideo[];
  images: FoundationImage[];
  nextSteps: FoundationNextStep[];
  createdAt: string;
  updatedAt: string;
}

export interface FoundationSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  heroImageSrc: string | null;
  updatedAt: string;
}

// API base URL - uses environment variable or falls back to hardcoded default
// Set CONTENT_API_BASE_URL to point to the admin API endpoint
// @ts-ignore - import.meta.env is provided by Astro
const API_BASE = (import.meta as any).env?.CONTENT_API_BASE_URL || process.env.CONTENT_API_BASE_URL || 'https://knit-content-manager-sue23.replit.app';

/**
 * Get all published foundations
 */
export async function getPublishedFoundations(): Promise<FoundationSummary[]> {
  try {
    const response = await fetch(`${API_BASE}/api/public/foundations`);
    if (!response.ok) {
      console.error('Failed to fetch foundations:', response.status);
      return [];
    }
    const data = await response.json();
    return data.map((f: Foundation) => ({
      id: f.id,
      slug: f.slug,
      title: f.title,
      subtitle: f.subtitle,
      summary: f.summary,
      heroImageSrc: f.heroImageSrc,
      updatedAt: f.updatedAt,
    }));
  } catch (error) {
    console.error('Error fetching foundations:', error);
    return [];
  }
}

/**
 * Get a single foundation by slug
 */
export async function getFoundationBySlug(slug: string): Promise<Foundation | null> {
  try {
    const response = await fetch(`${API_BASE}/api/public/foundations/${slug}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error('Failed to fetch foundation:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching foundation:', error);
    return null;
  }
}
