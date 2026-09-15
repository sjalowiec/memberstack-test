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

export type PatternBuilderLandingContent = {
  patternName: string;
  headline: string;
  intro: string;
  image: PatternBuilderLandingImage;
  seo: PatternBuilderLandingSeo;
  why?: PatternBuilderLandingCopySection;
  choices?: PatternBuilderLandingChoicesSection;
  creates?: PatternBuilderLandingCopySection;
  anyYarn?: PatternBuilderLandingCopySection;
  cta: PatternBuilderLandingCta;
};

export function hasPatternBuilderLandingCopy(
  section: PatternBuilderLandingCopySection | undefined,
): section is PatternBuilderLandingCopySection {
  return Boolean(section?.heading?.trim() && section.body.some((paragraph) => paragraph.trim()));
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
