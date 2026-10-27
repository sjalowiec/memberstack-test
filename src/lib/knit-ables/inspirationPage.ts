/**
 * Shared content model for Knit-able inspiration pages.
 * Presentation lives in KnitAbleInspirationPage. Copy stays in each Knit-able's data.
 */
import type { PatternBuilderLandingCta } from "../patterns/patternBuilderLanding";

export type KnitAbleInspirationImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type KnitAbleInspirationSwatch = {
  /** Hex color, such as #e56b93 or #fff. */
  color: string;
  /** Light border so a near-white swatch stays visible. */
  bordered?: boolean;
};

export type KnitAbleInspirationPalette = {
  label?: string;
  caption?: string;
  colors: readonly KnitAbleInspirationSwatch[];
};

/** Plain bullet, or a bold opening phrase plus the rest of the line. */
export type KnitAbleInspirationStep =
  | string
  | {
      lead: string;
      text: string;
    };

export type KnitAbleInspirationClosingLine = {
  text: string;
  /** Bold green line under the builder steps. */
  emphasis?: boolean;
  /** Subheading inside the builder panel. */
  heading?: boolean;
  /** Bold sentence that is not the green brand line. */
  strong?: boolean;
};

/** Fields the Knit-able builder panel shows. A pattern-landing CTA object is assignable. */
export type KnitAbleInspirationCta = Pick<
  PatternBuilderLandingCta,
  | "checkingLabel"
  | "memberLabel"
  | "memberHref"
  | "prospectLabel"
  | "prospectHref"
  | "signInLabel"
>;

export type KnitAbleInspirationLesson = {
  title: string;
  description: string;
  /** Public catalog path, /videos/{contentId}. */
  href: string;
};

export type KnitAbleInspirationLessons = {
  heading: string;
  intro?: string;
  accessLabel: string;
  items: readonly KnitAbleInspirationLesson[];
};

/** Plain words, or a linked phrase inside a perspective paragraph. */
export type KnitAbleInspirationPerspectivePart = string | { label: string; href: string };

/** Scannable machine-knitter notes. Rendered as plain points, not a card. */
export type KnitAbleInspirationPerspectivePoint = {
  lead: string;
  /** A paragraph, or a paragraph made of text and links. */
  paragraphs: readonly (string | readonly KnitAbleInspirationPerspectivePart[])[];
  /** Modest callout for one point, such as a tip. */
  callout?: boolean;
};

export type KnitAbleInspirationPerspective = {
  heading: string;
  intro?: string;
  /** Render the intro as a subtle speech bubble. The points stay outside it. */
  introVoice?: boolean;
  points: readonly KnitAbleInspirationPerspectivePoint[];
};

export type KnitAbleInspirationPageContent = {
  path: string;
  canonicalUrl: string;
  title: string;
  /** Small label above the title. Other Knit-ables keep “Knit-able Inspiration.” */
  eyebrow?: string;
  /** Set false to show the title without the collection logo. */
  showLogo?: boolean;
  description: string;
  hero: KnitAbleInspirationImage & {
    /** Defaults to the original pattern link. */
    href?: string;
    rel?: string;
  };
  tagline: string;
  /** One paragraph, or several paragraphs rendered with the page's normal paragraph spacing. */
  intro: string | readonly string[];
  /**
   * Places the builder under the title, in the column beside the photo.
   * Leave this unset so other Knit-ables keep the builder below the photo.
   */
  placeBuilderBesidePhoto?: boolean;
  palette?: KnitAbleInspirationPalette;
  builder: {
    heading: string;
    introduction: {
      before: string;
      link?: {
        label: string;
        href: string;
      };
      after?: string;
    };
    steps: readonly KnitAbleInspirationStep[];
    closing?: readonly KnitAbleInspirationClosingLine[];
    cta: KnitAbleInspirationCta;
  };
  pattern: {
    heading: string;
    copy: string;
    linkLabel: string;
    href: string;
    rel?: string;
  };
  yarn: {
    heading: string;
    cardHeading: string;
    paragraphs: readonly string[];
    buttonLabel: string;
    href: string;
    image?: KnitAbleInspirationImage;
    featured?: boolean;
    imagePlacement?: "above" | "beside";
    rel?: string;
  };
  lessons?: KnitAbleInspirationLessons;
  /**
   * Machine-knitter perspective. Omit it and the layout skips the section.
   * Shown after the photo and before the builder.
   */
  perspective?: KnitAbleInspirationPerspective;
  affiliateDisclosure?: string;
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function knitAbleInspirationIntroParagraphs(
  intro: string | readonly string[] | undefined,
): string[] {
  const parts = typeof intro === "string" ? [intro] : intro ?? [];
  return parts.map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph.length > 0);
}

export function knitAbleInspirationSwatches(
  palette: KnitAbleInspirationPalette | undefined,
): Array<{ color: string; bordered: boolean }> {
  if (!palette) return [];
  return palette.colors.flatMap((swatch) => {
    const color = swatch.color.trim();
    if (!HEX_COLOR.test(color)) return [];
    return [{ color, bordered: swatch.bordered === true }];
  });
}

export function knitAbleInspirationClosingLines(
  closing: readonly KnitAbleInspirationClosingLine[] | undefined,
): KnitAbleInspirationClosingLine[] {
  if (!closing) return [];
  return closing.filter((line) => line.text.trim().length > 0);
}

function normalizePerspectiveParagraph(
  paragraph: string | readonly KnitAbleInspirationPerspectivePart[],
): string | KnitAbleInspirationPerspectivePart[] | null {
  if (typeof paragraph === "string") {
    const text = paragraph.trim();
    return text.length > 0 ? text : null;
  }
  const parts = paragraph.flatMap((part) => {
    if (typeof part === "string") return part.length > 0 ? [part] : [];
    const label = part.label.trim();
    const href = part.href.trim();
    if (!label || !href) return [];
    return [{ label, href }];
  });
  return parts.length > 0 ? parts : null;
}

export function knitAbleInspirationPerspective(
  perspective: KnitAbleInspirationPerspective | undefined,
): KnitAbleInspirationPerspective | null {
  if (!perspective) return null;
  const heading = perspective.heading.trim();
  if (!heading) return null;
  const points = perspective.points.flatMap((point) => {
    const lead = point.lead.trim();
    const paragraphs = point.paragraphs.flatMap((paragraph) => {
      const normalized = normalizePerspectiveParagraph(paragraph);
      return normalized ? [normalized] : [];
    });
    if (!lead || paragraphs.length === 0) return [];
    return [{ lead, paragraphs, ...(point.callout ? { callout: true } : {}) }];
  });
  if (points.length === 0) return null;
  const intro = perspective.intro?.trim() ?? "";
  return {
    heading,
    ...(intro ? { intro } : {}),
    ...(perspective.introVoice && intro ? { introVoice: true } : {}),
    points,
  };
}

export function knitAbleInspirationLessons(
  lessons: KnitAbleInspirationLessons | undefined,
): KnitAbleInspirationLessons | null {
  if (!lessons || lessons.items.length === 0) return null;
  const heading = lessons.heading.trim();
  if (!heading) return null;
  return lessons;
}

export function knitAbleInspirationDisclosure(text: string | undefined): string {
  return text?.trim() ?? "";
}

/** Catalog id the lesson modal requests, taken from /videos/{contentId}. */
export function knitAbleInspirationLessonContentId(href: string): string {
  const match = href.match(/\/videos\/([^/?#]+)/);
  return match?.[1] ?? "";
}
