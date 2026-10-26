/**
 * Shared Pattern Builder landing-page content model.
 * Presentation components stay pattern-agnostic; each builder supplies copy.
 */

export type PatternBuilderLandingImage = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type PatternBuilderLandingSeo = {
  title: string;
  description: string;
  canonicalUrl: string;
};

export type PatternBuilderLandingCopySection = {
  heading: string;
  body: readonly string[];
};

export type PatternBuilderLandingChoice = {
  title: string;
  description: string;
};

export type PatternBuilderLandingChoicesSection = {
  heading: string;
  intro?: string;
  items: readonly PatternBuilderLandingChoice[];
};

export type PatternBuilderLandingKnitAble = {
  eyebrow: string;
  heading: string;
  description: string;
  href: string;
  buttonLabel: string;
  image: PatternBuilderLandingImage;
  logo: PatternBuilderLandingImage & {
    href: string;
    /** Accessible name for the logo link when it should differ from alt. */
    label?: string;
  };
};

export type PatternBuilderLandingCta = {
  memberLabel: string;
  memberHref: string;
  prospectLabel: string;
  prospectHref: string;
  signInLabel: string;
  membershipHeading: string;
  membershipBody: string;
  /** Optional extra membership copy, rendered after the description and before the CTA. */
  membershipNote?: string;
  checkingLabel: string;
};

/** Catalog-card badge values. Landing pages import the existing catalog constants. */
export type PatternBuilderLandingCatalogBadge = {
  count: number;
  rest: string;
};

export type PatternBuilderLandingInlineLink = {
  href: string;
  label: string;
};

/** One paragraph that may include a single inline link. */
export type PatternBuilderLandingLinkedParagraph = {
  lead: string;
  link?: PatternBuilderLandingInlineLink;
  tail?: string;
};

/**
 * Optional note between the hero introduction and the builder button.
 * Only builders that supply it render the block.
 */
export type PatternBuilderLandingMakeItYourOwn = {
  heading: string;
  paragraphs: readonly PatternBuilderLandingLinkedParagraph[];
};

export type PatternBuilderLandingContent = {
  patternName: string;
  headline: string;
  intro: string;
  image: PatternBuilderLandingImage;
  seo: PatternBuilderLandingSeo;
  catalogBadge?: PatternBuilderLandingCatalogBadge;
  why?: PatternBuilderLandingCopySection;
  choices?: PatternBuilderLandingChoicesSection;
  howItWorks?: PatternBuilderLandingCopySection;
  creates?: PatternBuilderLandingCopySection;
  anyYarn?: PatternBuilderLandingCopySection;
  makeItYourOwn?: PatternBuilderLandingMakeItYourOwn;
  knitAble?: PatternBuilderLandingKnitAble;
  cta: PatternBuilderLandingCta;
};

export function hasPatternBuilderLandingCatalogBadge(
  badge: PatternBuilderLandingCatalogBadge | undefined,
): badge is PatternBuilderLandingCatalogBadge {
  return Boolean(badge && Number.isFinite(badge.count) && badge.rest.trim());
}

export function hasPatternBuilderLandingCopy(
  section: PatternBuilderLandingCopySection | undefined,
): section is PatternBuilderLandingCopySection {
  return Boolean(section?.heading?.trim() && section.body.some((paragraph) => paragraph.trim()));
}

export function hasPatternBuilderLandingMakeItYourOwn(
  section: PatternBuilderLandingMakeItYourOwn | undefined,
): section is PatternBuilderLandingMakeItYourOwn {
  return Boolean(
    section?.heading?.trim() &&
      section.paragraphs.some(
        (paragraph) =>
          paragraph.lead.trim() || paragraph.tail?.trim() || paragraph.link?.label.trim(),
      ),
  );
}

export function hasPatternBuilderLandingChoices(
  section: PatternBuilderLandingChoicesSection | undefined,
): section is PatternBuilderLandingChoicesSection {
  return Boolean(section?.heading?.trim() && section.items.length > 0);
}

export function hasPatternBuilderLandingMembership(
  cta: PatternBuilderLandingCta | undefined,
): cta is PatternBuilderLandingCta {
  return Boolean(cta?.membershipHeading?.trim() && cta.membershipBody.trim());
}

export function hasPatternBuilderLandingKnitAble(
  section: PatternBuilderLandingKnitAble | undefined,
): section is PatternBuilderLandingKnitAble {
  return Boolean(
    section?.heading?.trim() &&
      section.description.trim() &&
      section.href.trim() &&
      section.buttonLabel.trim() &&
      section.image.src.trim() &&
      section.logo.src.trim() &&
      section.logo.href.trim(),
  );
}
