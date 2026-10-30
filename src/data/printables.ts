import data from "./printables.json";

/** One printable sold on /shop/downloads. Edited from Store Items admin. */
export type Printable = {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  salesFocus: string;
  stripeLink: string;
  file: string;
  price: number;
  memberFree: boolean;
  image: string;
  productImage: { type: "image"; value: string };
  media: { type: "vimeo" | "image"; value: string };
  detailsPage: string;
  includes: string[];
};

export const printables = data as Printable[];
