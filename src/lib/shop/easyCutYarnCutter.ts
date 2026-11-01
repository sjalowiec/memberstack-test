/**
 * Review visibility for the Easy-Cut Yarn Cutter.
 * Unpublished drafts 404 on production custom domains.
 * Localhost, Astro dev, and Netlify preview hosts stay available for review.
 */
import {
  EASY_CUT_YARN_CUTTER,
  type EasyCutYarnCutterContent,
} from "../../data/shop/easyCutYarnCutter";
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const EASY_CUT_YARN_CUTTER_PATH = EASY_CUT_YARN_CUTTER.path;

export function isEasyCutYarnCutterRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === EASY_CUT_YARN_CUTTER_PATH;
}

export function isEasyCutYarnCutterProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
  product: Pick<EasyCutYarnCutterContent, "published"> = EASY_CUT_YARN_CUTTER,
): boolean {
  if (product.published) return false;
  return detectSiteEnvironment(hostname, options) === "production";
}

/** Exact Stripe Payment Link. No query string is added. */
export function easyCutYarnCutterCheckoutHref(
  product: Pick<EasyCutYarnCutterContent, "stripePaymentLink"> = EASY_CUT_YARN_CUTTER,
): string {
  return product.stripePaymentLink;
}
