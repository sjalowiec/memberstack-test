/**
 * Easy-Cut Yarn Cutter.
 *
 * `published` controls the live shop. While false, the sales page and shop
 * cards stay available on localhost and preview hosts and return 404 on
 * production.
 */

export const EASY_CUT_YARN_CUTTER_STRIPE_URL =
  "https://buy.stripe.com/4gMbJ0fWu0U3fhQe4G0oM0X";

export type EasyCutYarnCutterContent = {
  slug: string;
  path: string;
  name: string;
  pageTitle: string;
  metaDescription: string;
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  shortDescription: string;
  offerLabel: string;
  stripePaymentLink: string;
  published: boolean;
};

export const EASY_CUT_YARN_CUTTER: EasyCutYarnCutterContent = {
  slug: "easy-cut-yarn-cutter",
  path: "/shop/accessories/easy-cut-yarn-cutter",
  name: "Easy-Cut Yarn Cutter",
  pageTitle: "Easy-Cut Yarn Cutter | Knit It Now",
  metaDescription:
    "Self-adhesive Easy-Cut yarn cutter for knitting machines, sewing machines, sergers, and quilt frames. $9.99 with free U.S. shipping.",
  imageSrc: "/images/shop/easycut.jpg",
  imageAlt: "Easy-Cut yarn cutter",
  imageWidth: 493,
  imageHeight: 324,
  shortDescription:
    "The cutter that won't get lost! Self-adhesive backing keeps it right where you need it.",
  offerLabel: "$9.99. Free U.S. shipping.",
  stripePaymentLink: EASY_CUT_YARN_CUTTER_STRIPE_URL,
  published: true,
};
