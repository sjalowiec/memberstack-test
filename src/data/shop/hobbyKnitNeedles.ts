/**
 * Hobby Knit Replacement Needles.
 *
 * `published` controls the live shop. While false, the sales page and shop
 * card stay available on localhost and preview hosts and return 404 on
 * production.
 */

export const HOBBY_KNIT_NEEDLES_STRIPE_URL =
  "https://buy.stripe.com/5kQcN4eSqauD2v44u60oM0W";

export type HobbyKnitNeedlesContent = {
  slug: string;
  path: string;
  name: string;
  pageTitle: string;
  metaDescription: string;
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  priceLabel: string;
  cardPriceLabel: string;
  cardNote: string;
  checkoutNote: string;
  stripePaymentLink: string;
  published: boolean;
};

export const HOBBY_KNIT_NEEDLES: HobbyKnitNeedlesContent = {
  slug: "hobby-knit-replacement-needles",
  path: "/shop/accessories/hobby-knit-replacement-needles",
  name: "Hobby Knit Replacement Needles",
  pageTitle: "Hobby Knit Replacement Needles | Knit It Now",
  metaDescription:
    "Unused vintage replacement needles for the Hobby Knit cord knitter, from remaining original inventory. Set of 3 for $29.95 with free U.S. shipping.",
  imageSrc: "/images/shop/hobby-knit-needles.jpg",
  imageAlt: "Three Hobby Knit replacement needles beside a ruler for scale.",
  imageWidth: 747,
  imageHeight: 624,
  priceLabel: "$29.95 per set of 3",
  cardPriceLabel: "$29.95",
  cardNote: "Set of 3. Free U.S. shipping.",
  checkoutNote: "Free U.S. shipping. Applicable tax added at checkout.",
  stripePaymentLink: HOBBY_KNIT_NEEDLES_STRIPE_URL,
  published: true,
};
