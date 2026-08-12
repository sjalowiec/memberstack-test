export type PrintableResource = {
  slug: string;
  title: string;
  subtitle: string;
  intro: string[];
  techniqueIntro?: string;
  techniqueExamples?: string[];
  includes: string[];
  downloadLabel: string;
  /** Placeholder until final PDFs are wired in. */
  pdfFile: string;
  image?: string;
  imageAlt?: string;
};

export const printableResources: PrintableResource[] = [
  {
    slug: "machine-technique-reference-cards",
    title: "Machine Technique Reference Cards",
    subtitle:
      "Printable reference cards to record the machine settings you use for your favorite techniques.",
    intro: [
      "Keep track of successful machine settings so you don't have to remember them the next time you knit.",
      "Print as many cards as you like and build your own personal machine knitting reference library.",
    ],
    techniqueIntro: "Perfect for recording settings for techniques such as:",
    techniqueExamples: [
      "Tuck",
      "Slip",
      "Fair Isle",
      "Fisherman Rib",
      "Lace",
      "Plating",
      "Weaving",
      "Punch Lace",
      "and your own custom techniques",
    ],
    includes: [
      "Printable PDF",
      "Fill-in-the-blank machine setting cards",
      "Unlimited printing for your personal use",
    ],
    downloadLabel: "Machine Technique Reference Cards (PDF)",
    pdfFile: "/downloads/shop/machine-technique-reference-cards.pdf",
    image: "/images/shop/downloads/machine-technique-reference-cards.webp",
  },
  {
    slug: "needle-selection-worksheet",
    title: "Needle Selection Worksheet",
    subtitle:
      "Printable graph paper for planning and selecting needles when working hand-manipulated stitch patterns.",
    intro: [
      "Place the worksheet behind your machine's needle bed to make it easier to visualize and manually select needles while knitting.",
      "Especially helpful for LK-150 owners and anyone working hand-manipulated stitch patterns.",
      "Print multiple copies and keep them beside your machine whenever you're experimenting with stitch designs.",
    ],
    includes: [
      "Printable PDF",
      "Needle selection graph",
      "Multiple copies may be printed for personal use",
    ],
    downloadLabel: "Needle Selection Worksheet (PDF)",
    pdfFile: "/downloads/shop/placeholder-needle-selection-worksheet.pdf",
    image: "/images/shop/downloads/cheat_sheet.jpg",
    imageAlt: "Needle Selection Worksheet preview",
  },
];

export function findPrintableResourceBySlug(slug: string): PrintableResource | undefined {
  const normalized = slug.trim().toLowerCase();
  return printableResources.find((resource) => resource.slug === normalized);
}
