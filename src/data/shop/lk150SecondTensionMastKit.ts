/**
 * LK150 Second Tension Mast Kit sales content.
 *
 * Photos use site paths under `/images/shop/` (files in `public/images/shop/`).
 * The page hides a photo when `src` or `alt` is blank.
 *
 * Installation video and printable instructions stay off the page until filled in:
 * - `vimeoId`: numeric Vimeo id only. Optional `vimeoPrivacyHash` is the `h`
 *   value from a private Vimeo URL.
 * - `youtubeUrl`: full https://www.youtube.com or youtu.be URL, when the
 *   video is on YouTube instead of Vimeo.
 * - `installationInstructionsHtml`: public HTML for the printable instructions.
 *   When the printable is a file, put it in `public/` and link it from this HTML.
 *   Leave the field blank until that file exists.
 *
 * `published` shows the page on production and in the shop listing.
 * `checkoutEnabled` turns on Buy Now. The Shopify URL, product id, and variant
 * id below match the live product (handle `lk150-second-tension-mast-kit`, $54.95).
 */

export type TensionMastPhoto = {
  src: string;
  alt: string;
  caption?: string;
  placement?: "product" | "installed";
  width?: number;
  height?: number;
};

export type TensionMastKitContent = {
  slug: string;
  path: string;
  name: string;
  headline: string;
  introduction: string;
  priceLabel: string;
  shippingLabel: string;
  shopifyUrl: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  published: boolean;
  checkoutEnabled: boolean;
  photos: TensionMastPhoto[];
  vimeoId: string;
  vimeoPrivacyHash: string;
  youtubeUrl: string;
  installationInstructionsHtml: string;
};

export const LK150_SECOND_TENSION_MAST_KIT: TensionMastKitContent = {
  slug: "lk150-second-tension-mast-kit",
  path: "/shop/accessories/lk150-second-tension-mast-kit",
  name: "LK150 Second Tension Mast Kit",
  headline: "",
  introduction:
    "Keep a second yarn ready to knit. Add a second tension mast to your Silver Reed LK150 for Fair Isle, intarsia, and other multicolor projects, or keep waste yarn threaded and ready to use.",
  priceLabel: "$54.95",
  shippingLabel: "plus shipping",
  shopifyUrl: "https://vjzu11-86.myshopify.com/products/lk150-second-tension-mast-kit",
  shopifyProductId: "15535058157762",
  shopifyVariantId: "67874971877570",
  published: true,
  checkoutEnabled: true,
  photos: [
    {
      src: "/images/shop/lk150-mast-kit.jpg",
      alt: "The five components included in the LK150 Second Tension Mast Kit.",
      placement: "product",
      width: 600,
      height: 450,
    },
    {
      src: "/images/shop/lk150-second-mast.png",
      alt: "LK150 knitting machine with a second tension mast installed and yarn threaded.",
      caption: "Shown installed on an LK150. Knitting machine and yarn are not included.",
      placement: "installed",
      width: 1087,
      height: 1447,
    },
  ],
  vimeoId: "",
  vimeoPrivacyHash: "",
  youtubeUrl: "",
  installationInstructionsHtml: "",
};

export const TENSION_MAST_BENEFITS = [
  "Keep a second color threaded and ready.",
  "Set up yarn for Fair Isle, intarsia, and other multicolor knitting.",
  "Keep waste yarn ready between projects.",
] as const;

export const TENSION_MAST_INCLUDED = [
  "Auto tension mast",
  "Tension rod",
  "Tension guide/holder",
  "Yarn rod socket",
  "Socket base with mounting screw",
] as const;

export const TENSION_MAST_NOT_INCLUDED =
  "This kit adds a second tension mast to your existing machine. Knitting machine, carriage, yarn, and tools are not included.";

export const TENSION_MAST_INSTALLATION =
  "Installation uses a mounting socket attached underneath the machine.";

export const TENSION_MAST_LK150_ONLY = "For the Silver Reed LK150 only.";

export const TENSION_MAST_US_SALES_ONLY = "U.S. sales only.";

export const TENSION_MAST_SALES_FINAL =
  "All sales are final. If any parts arrive damaged or missing, please contact us so we can make it right.";
