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

export type KnitAbleInspirationPageContent = {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  hero: KnitAbleInspirationImage & {
    /** Defaults to the original pattern link. */
    href?: string;
    rel?: string;
  };
  tagline: string;
  /** One paragraph, or several paragraphs rendered with the page's normal paragraph spacing. */
  intro: string | readonly string[];
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
