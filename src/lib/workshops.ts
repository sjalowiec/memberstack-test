import fs from 'node:fs';
import path from 'node:path';

const WORKSHOPS_DIR = path.join(process.cwd(), 'src/content/workshops');
const GUIDED_WORKSHOPS_DIR = path.join(process.cwd(), 'src/content/guided-workshops');

export interface WorkshopDay {
  day: number;
  title: string;
  goal: string;
  released: boolean;
  isBonus?: boolean;
}

// Curriculum block types
export interface RichTextBlock {
  type: 'richText';
  content: string;
}

export interface ImageBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
}

export interface VideoBlock {
  type: 'video';
  provider: 'youtube' | 'vimeo' | 'loom' | 'direct';
  url: string;
  caption?: string;
}

export interface DownloadBlock {
  type: 'download';
  label: string;
  url: string;
}

export interface ChecklistItem {
  text: string;
  isOptional?: boolean;
}

export interface ChecklistBlock {
  type: 'checklist';
  title?: string;
  items: ChecklistItem[];
}

export interface CalloutBlock {
  type: 'callout';
  style: 'note' | 'tip' | 'important';
  title?: string;
  content: string;
}

export type CurriculumBlock = RichTextBlock | ImageBlock | VideoBlock | DownloadBlock | ChecklistBlock | CalloutBlock;

export interface CurriculumDay {
  day: number;
  title: string;
  shortDescription: string;
  estimatedTime?: string;
  release: {
    mode: 'relative' | 'absolute';
    dayOffset?: number;
    date?: string;
  };
  blocks: CurriculumBlock[];
}

export interface Curriculum {
  version: number;
  days: CurriculumDay[];
}

export interface Workshop {
  version: number;
  slug: string;
  client: {
    firstName: string;
  };
  workshop: {
    title: string;
    subtitle: string;
    startDay: number;
    status: string;
  };
  outline: {
    id: string;
    days: WorkshopDay[];
  };
  hub: {
    welcomeTitle: string;
    welcomeBody: string;
    todayLabel: string;
    showVideoReplyPlaceholder: boolean;
  };
  hyvor: {
    enabled: boolean;
    websiteId: string;
    pageId: string;
  };
  curriculum?: Curriculum;
}

// New guided workshop format (from admin)
export interface GuidedWorkshopFile {
  workshopId: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  tags: string[];
  isDraft: boolean;
  status?: 'pending' | 'approved' | 'active' | 'completed' | 'declined';
  publishedDate: string;
  durationDays: number;
  level: string;
  imageUrl: string;
  imageAlt: string;
  // Optional customizable welcome fields
  welcomeTitle?: string;  // Supports {name} placeholder
  welcomeBody?: string;
  clientName?: string;    // Fallback name if Outseta not available
  curriculum: {
    version: number;
    days: Array<{
      day: number;
      title: string;
      shortDescription: string;
      estimatedTime?: string;
      isBonus?: boolean;
      release: {
        mode: 'relative' | 'absolute';
        dayOffset?: number;
        date?: string;
      };
      blocks: CurriculumBlock[];
    }>;
  };
}

// Adapt new guided workshop format to expected Workshop interface
function adaptGuidedWorkshop(gw: GuidedWorkshopFile): Workshop {
  // Use explicit clientName, or extract from title "for [Name]", or default to "there"
  let clientName = gw.clientName;
  if (!clientName) {
    const nameMatch = gw.title.match(/for\s+(\w+)/i);
    clientName = nameMatch ? nameMatch[1] : 'there';
  }
  
  // Support {name} placeholder in welcomeTitle
  const welcomeTitleTemplate = gw.welcomeTitle || 'Welcome, {name}';
  const renderedWelcomeTitle = welcomeTitleTemplate.replace('{name}', clientName);
  
  return {
    version: 1,
    slug: gw.workshopId, // Use workshopId for URL routing (privacy)
    client: {
      firstName: clientName
    },
    workshop: {
      title: gw.title,
      subtitle: gw.shortDescription,
      startDay: 1,
      status: 'active'
    },
    outline: {
      id: gw.workshopId,
      days: gw.curriculum.days.map(d => ({
        day: d.day,
        title: d.title,
        goal: d.shortDescription,
        released: true, // All days released by default for new format
        isBonus: d.isBonus || d.day === 99
      }))
    },
    hub: {
      welcomeTitle: renderedWelcomeTitle,
      welcomeBody: gw.welcomeBody || gw.description,
      todayLabel: 'Your workshop is ready',
      showVideoReplyPlaceholder: true // Enable video reply placeholder by default
    },
    hyvor: {
      enabled: true,
      websiteId: '14706', // Default Hyvor website ID
      pageId: `guided-workshop-${gw.workshopId}-hub`
    },
    curriculum: {
      version: gw.curriculum.version,
      days: gw.curriculum.days.map(d => ({
        day: d.day,
        title: d.title,
        shortDescription: d.shortDescription,
        estimatedTime: d.estimatedTime,
        release: d.release,
        blocks: d.blocks
      }))
    }
  };
}

// Get slugs from old workshops directory (with hub/outline/client structure)
function getOldWorkshopSlugs(): string[] {
  try {
    const files = fs.readdirSync(WORKSHOPS_DIR);
    return files
      .filter(file => file.endsWith('.json') && !file.startsWith('_'))
      .filter(file => {
        try {
          const filePath = path.join(WORKSHOPS_DIR, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          return content.hub && content.outline && content.client;
        } catch {
          return false;
        }
      })
      .map(file => file.replace('.json', ''));
  } catch {
    return [];
  }
}

// Get workshopIds from new guided-workshops directory (files named by workshopId, e.g., gw-abc123.json)
function getGuidedWorkshopSlugs(): string[] {
  try {
    if (!fs.existsSync(GUIDED_WORKSHOPS_DIR)) {
      return [];
    }
    const files = fs.readdirSync(GUIDED_WORKSHOPS_DIR);
    return files
      .filter(file => file.endsWith('.json') && !file.startsWith('_'))
      .filter(file => {
        try {
          const filePath = path.join(GUIDED_WORKSHOPS_DIR, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          // New format has curriculum and workshopId, no hub/outline/client
          // Filter by status='active' (Status is the single workflow indicator)
          return content.curriculum && content.workshopId && !content.hub && content.status === 'active';
        } catch {
          return false;
        }
      })
      .map(file => file.replace('.json', ''));
  } catch {
    return [];
  }
}

export function getWorkshopSlugs(): string[] {
  const oldSlugs = getOldWorkshopSlugs();
  const guidedSlugs = getGuidedWorkshopSlugs();
  // Combine and dedupe (old format takes precedence)
  const allSlugs = [...oldSlugs];
  for (const slug of guidedSlugs) {
    if (!allSlugs.includes(slug)) {
      allSlugs.push(slug);
    }
  }
  return allSlugs;
}

export function getWorkshopBySlug(slug: string): Workshop | null {
  // First try old workshops directory
  try {
    const filePath = path.join(WORKSHOPS_DIR, `${slug}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const workshop = JSON.parse(content) as Workshop;
      
      // Validate it's the old structure with hub/outline/client
      if (workshop.hub && workshop.outline && workshop.client) {
        return workshop;
      }
    }
  } catch {
    // Continue to try guided workshops
  }
  
  // Then try new guided-workshops directory (files named by workshopId)
  try {
    const filePath = path.join(GUIDED_WORKSHOPS_DIR, `${slug}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const gw = JSON.parse(content) as GuidedWorkshopFile;
      
      // Validate it's the new guided workshop structure and has active status
      if (gw.curriculum && gw.workshopId && gw.status === 'active') {
        return adaptGuidedWorkshop(gw);
      }
    }
  } catch {
    // Fall through
  }
  
  return null;
}

export function getAllWorkshops(): Workshop[] {
  const slugs = getWorkshopSlugs();
  return slugs
    .map(slug => getWorkshopBySlug(slug))
    .filter((w): w is Workshop => w !== null);
}
