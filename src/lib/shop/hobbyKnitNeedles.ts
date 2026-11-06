/**
 * Review visibility for Hobby Knit Replacement Needles.
 * Unpublished drafts 404 on production custom domains.
 * Localhost, Astro dev, and Netlify preview hosts stay available for review.
 */
import {
  HOBBY_KNIT_NEEDLES,
  type HobbyKnitNeedlesContent,
} from "../../data/shop/hobbyKnitNeedles";
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const HOBBY_KNIT_NEEDLES_PATH = HOBBY_KNIT_NEEDLES.path;

export function isHobbyKnitNeedlesRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === HOBBY_KNIT_NEEDLES_PATH;
}

export function isHobbyKnitNeedlesProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
  product: Pick<HobbyKnitNeedlesContent, "published"> = HOBBY_KNIT_NEEDLES,
): boolean {
  if (product.published) return false;
  return detectSiteEnvironment(hostname, options) === "production";
}

/** Exact Stripe Payment Link. No query string is added. */
export function hobbyKnitNeedlesCheckoutHref(
  product: Pick<HobbyKnitNeedlesContent, "stripePaymentLink"> = HOBBY_KNIT_NEEDLES,
): string {
  return product.stripePaymentLink;
}
