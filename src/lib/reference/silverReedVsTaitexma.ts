import { readFileSync } from "node:fs";
import path from "node:path";
import {
  formatPitch,
  getAllMachines,
  machineTitle,
  type Machine,
} from "../machines/referenceCatalog";
import { availabilityLabel } from "../machines/machineAdminFields";
import { serializeJsonLd } from "../helpHubFaqSchema";

export const PAGE_PATH = "/reference/machines/silver-reed-vs-taitexma";
export const SITE_URL = "https://knitbymachine.com";
export const CANONICAL_URL = `${SITE_URL}${PAGE_PATH}`;

export const PAGE_H1 = "Silver Reed vs. Taitexma Knitting Machines";
export const SEO_TITLE =
  "Silver Reed vs Taitexma Knitting Machines: Models and Differences";
export const META_DESCRIPTION =
  "Compare Silver Reed and Taitexma knitting machines, including available gauges, punchcard and electronic options, needle selection, accessories, and ordering considerations.";

export const INTRO_SUMMARY =
  "Silver Reed and Taitexma both offer new knitting machines, but their model ranges and patterning systems differ. Silver Reed is the choice for knitters who want a currently produced electronic standard-gauge machine, while Taitexma offers punchcard and manual machines in a wider range of gauges, including bulky. The best choice depends on the yarns you use, the type of patterning you prefer, accessory availability, and current delivery times.";

export const AVAILABILITY_NOTE =
  "Model availability can change. Follow the links on this page for current machines offered by Knit It Now.";

export const ORDERING_NEUTRAL =
  "Availability and delivery times vary. Check the current machine listing or contact Knit It Now.";

const COMPARE_BRANDS = ["Silver Reed", "Taitexma"] as const;
export type CompareBrand = (typeof COMPARE_BRANDS)[number];

export interface ComparisonRow {
  feature: string;
  silverReed: string;
  taitexma: string;
}

export interface ModelCard {
  name: string;
  slug: string;
  gauge: string;
  pitch: string | null;
  patterning: string;
  bed: string | null;
  summary: string;
  shopHref: string;
  referenceHref: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

type RawAccessory = { model?: string | null; title?: string | null; category?: string | null };

interface RawMachineRow {
  brand?: string | null;
  model?: string | null;
  accessories?: RawAccessory[] | null;
}

let ribberBySlugCache: Map<string, boolean> | null = null;

function loadRibberBySlug(): Map<string, boolean> {
  if (ribberBySlugCache) return ribberBySlugCache;
  const machinesPath = path.join(process.cwd(), "data", "machines.json");
  const raw = JSON.parse(
    readFileSync(machinesPath, "utf8").replace(/\bNaN\b/g, "null")
  ) as RawMachineRow[];

  const map = new Map<string, boolean>();
  for (const row of raw) {
    const brand = String(row.brand ?? "").trim();
    const model = String(row.model ?? "").trim();
    if (!brand || !model) continue;
    const slug = `${brand}-${model}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const accessories = Array.isArray(row.accessories) ? row.accessories : [];
    const hasRibber = accessories.some((item) => {
      const category = String(item?.category ?? "").toLowerCase();
      const title = String(item?.title ?? "").toLowerCase();
      return category.includes("ribber") || title.includes("ribber");
    });
    map.set(slug, hasRibber);
  }
  ribberBySlugCache = map;
  return map;
}

export function getShopMachinesByBrand(brand: CompareBrand): Machine[] {
  return getAllMachines()
    .filter((m) => m.brand === brand && m.sale?.forSale === true)
    .sort((a, b) =>
      a.model.localeCompare(b.model, "en", { numeric: true, sensitivity: "base" })
    );
}

function plainFirstParagraph(html: string | null | undefined): string | null {
  if (!html) return null;
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!match) return null;
  return match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function defaultSummary(machine: Machine): string {
  const title = machineTitle(machine);
  const style = machine.machineStyle?.toLowerCase() ?? "";
  const pitch = formatPitch(machine);
  const gaugePart = pitch ? `${machine.gauge} (${pitch})` : machine.gauge;

  if (style === "electronic") {
    return `${title} is a ${gaugePart.toLowerCase()} electronic knitting machine that uses an external pattern source for automatic stitch patterning.`;
  }
  if (style === "punchcard") {
    return `${title} is a ${gaugePart.toLowerCase()} punchcard knitting machine for automatic stitch patterns without a computer.`;
  }
  if (style === "manual") {
    const bedNote =
      machine.bed?.toLowerCase() === "plastic"
        ? " with a plastic needle bed"
        : "";
    return `${title} is a ${gaugePart.toLowerCase()} manual knitting machine${bedNote}, well suited to plain knitting and hand-selected patterning.`;
  }
  return `${title} is a ${gaugePart.toLowerCase()} knitting machine listed in the Knit It Now shop.`;
}

export function buildModelCard(machine: Machine): ModelCard {
  const saleHtml = machine.sale?.longDescriptionHtml ?? machine.sale?.shortDescriptionHtml;
  const summary = plainFirstParagraph(saleHtml) ?? defaultSummary(machine);

  return {
    name: machineTitle(machine),
    slug: machine.slug,
    gauge: machine.gauge,
    pitch: formatPitch(machine),
    patterning: machine.machineStyle ?? "-",
    bed: machine.bed,
    summary,
    shopHref: `/shop/machines/${machine.slug}`,
    referenceHref: `/reference/machines/${machine.slug}`,
  };
}

function modelListByGauge(machines: Machine[], gauge: string): string {
  const models = machines
    .filter((m) => m.gauge === gauge)
    .map((m) => m.model)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  return models.length > 0 ? models.join(", ") : "None currently listed for sale";
}

function hasPatterningStyle(machines: Machine[], style: string): boolean {
  return machines.some(
    (m) => (m.machineStyle ?? "").toLowerCase() === style.toLowerCase()
  );
}

function hasPlasticBed(machines: Machine[]): boolean {
  return machines.some((m) => (m.bed ?? "").toLowerCase() === "plastic");
}

function laceSummary(machines: Machine[]): string {
  const parts: string[] = [];
  for (const machine of machines) {
    const laceTechniques = machine.techniques.filter((t) => /lace/i.test(t));
    if (laceTechniques.length === 0) continue;
    parts.push(`${machine.model}: ${laceTechniques.join(", ")}`);
  }
  return parts.length > 0
    ? parts.join("; ")
    : "See individual machine listings for supported techniques";
}

function ribberSummary(machines: Machine[]): string {
  const ribberBySlug = loadRibberBySlug();
  const withRibber = machines
    .filter((m) => ribberBySlug.get(m.slug))
    .map((m) => m.model);
  if (withRibber.length === 0) {
    return "Check individual machine listings for compatible ribbers";
  }
  return `Optional ribbers listed for ${withRibber.join(", ")}`;
}

function orderingSummary(machines: Machine[]): string {
  if (machines.length === 0) return ORDERING_NEUTRAL;
  const labels = machines.map((m) => {
    if (!m.sale) return null;
    return `${m.model}: ${availabilityLabel(m.sale)}`;
  }).filter((value): value is string => !!value);
  return labels.length > 0
    ? `${labels.join("; ")}. ${ORDERING_NEUTRAL}`
    : ORDERING_NEUTRAL;
}

export function buildComparisonRows(
  silverReed: Machine[],
  taitexma: Machine[]
): ComparisonRow[] {
  return [
    {
      feature: "Available new",
      silverReed:
        silverReed.length > 0
          ? `Yes, ${silverReed.length} model${silverReed.length === 1 ? "" : "s"} listed for sale`
          : "Check current shop listings",
      taitexma:
        taitexma.length > 0
          ? `Yes, ${taitexma.length} model${taitexma.length === 1 ? "" : "s"} listed for sale`
          : "Check current shop listings",
    },
    {
      feature: "Standard-gauge models",
      silverReed: modelListByGauge(silverReed, "Standard Gauge"),
      taitexma: modelListByGauge(taitexma, "Standard Gauge"),
    },
    {
      feature: "Mid-gauge models",
      silverReed: modelListByGauge(silverReed, "Mid-Gauge"),
      taitexma: modelListByGauge(taitexma, "Mid-Gauge"),
    },
    {
      feature: "Bulky models",
      silverReed: modelListByGauge(silverReed, "Bulky/Chunky"),
      taitexma: modelListByGauge(taitexma, "Bulky/Chunky"),
    },
    {
      feature: "Electronic option",
      silverReed: hasPatterningStyle(silverReed, "Electronic")
        ? modelListByGauge(
            silverReed.filter((m) => m.machineStyle === "Electronic"),
            "Standard Gauge"
          )
        : "No electronic model currently listed for sale",
      taitexma: hasPatterningStyle(taitexma, "Electronic")
        ? taitexma
            .filter((m) => m.machineStyle === "Electronic")
            .map((m) => m.model)
            .join(", ")
        : "No electronic model currently listed for sale",
    },
    {
      feature: "Punchcard option",
      silverReed: hasPatterningStyle(silverReed, "Punchcard")
        ? silverReed
            .filter((m) => m.machineStyle === "Punchcard")
            .map((m) => m.model)
            .join(", ")
        : "None currently listed for sale",
      taitexma: hasPatterningStyle(taitexma, "Punchcard")
        ? taitexma
            .filter((m) => m.machineStyle === "Punchcard")
            .map((m) => m.model)
            .join(", ")
        : "None currently listed for sale",
    },
    {
      feature: "Plastic-bed option",
      silverReed: hasPlasticBed(silverReed)
        ? silverReed
            .filter((m) => (m.bed ?? "").toLowerCase() === "plastic")
            .map((m) => m.model)
            .join(", ")
        : "No plastic-bed model currently listed for sale",
      taitexma: hasPlasticBed(taitexma)
        ? taitexma
            .filter((m) => (m.bed ?? "").toLowerCase() === "plastic")
            .map((m) => m.model)
            .join(", ")
        : "Metal bed on current listings",
    },
    {
      feature: "Needle-selection method",
      silverReed:
        "Patterning needles selected as the carriage knits the row (not visibly preselected before the pass)",
      taitexma:
        "Punchcard machines preselect needles for the next row, similar to many vintage Brother machines",
    },
    {
      feature: "Ribber availability",
      silverReed: ribberSummary(silverReed),
      taitexma: ribberSummary(taitexma),
    },
    {
      feature: "Lace capability",
      silverReed: laceSummary(silverReed),
      taitexma: laceSummary(taitexma),
    },
    {
      feature: "Typical ordering considerations",
      silverReed: orderingSummary(silverReed),
      taitexma: orderingSummary(taitexma),
    },
  ];
}

export function buildFaqItems(silverReed: Machine[], taitexma: Machine[]): FaqItem[] {
  const silverElectronic = silverReed.filter((m) => m.machineStyle === "Electronic");
  const taitexmaElectronic = taitexma.filter((m) => m.machineStyle === "Electronic");
  const silverBulky = silverReed.filter((m) => m.gauge === "Bulky/Chunky");
  const taitexmaBulky = taitexma.filter((m) => m.gauge === "Bulky/Chunky");

  return [
    {
      question: "Are Silver Reed and Taitexma knitting machines still made?",
      answer:
        silverReed.length > 0 || taitexma.length > 0
          ? `Both brands still appear on current Knit It Now shop listings. Silver Reed has ${silverReed.length} model${silverReed.length === 1 ? "" : "s"} and Taitexma has ${taitexma.length} model${taitexma.length === 1 ? "" : "s"} listed for sale today. ${AVAILABILITY_NOTE}`
          : `${ORDERING_NEUTRAL} ${AVAILABILITY_NOTE}`,
    },
    {
      question: "Does Taitexma make an electronic knitting machine?",
      answer:
        taitexmaElectronic.length > 0
          ? `Taitexma lists electronic models for sale (${taitexmaElectronic.map((m) => m.model).join(", ")}). Check each listing for current availability.`
          : "No Taitexma electronic knitting machine is currently listed for sale on Knit It Now. Current Taitexma shop listings are punchcard and manual models.",
    },
    {
      question: "Which brand offers a bulky knitting machine?",
      answer: `Among current shop listings, Silver Reed offers ${silverBulky.length > 0 ? silverBulky.map((m) => m.model).join(", ") : "no bulky model"}, and Taitexma offers ${taitexmaBulky.length > 0 ? taitexmaBulky.map((m) => m.model).join(", ") : "no bulky model"}. Compare gauge, patterning, and accessories on each machine page before deciding.`,
    },
    {
      question: "Which machines work with DesignaKnit?",
      answer:
        silverElectronic.length > 0
          ? `The ${silverElectronic.map((m) => machineTitle(m)).join(" and ")} support DesignaKnit electronic patterning with a SilverLink 5 cable and curl cord. The Silver Reed LK150 can use DesignaKnit Interactive Knitting with a Screen Link cable, but pattern download to the machine is not supported on manual machines. Taitexma punchcard and manual models do not download patterns from DesignaKnit.`
          : "Check individual machine listings. DesignaKnit electronic patterning on Silver Reed generally requires an electronic model plus compatible cables.",
    },
    {
      question:
        "What is the difference between Silver Reed selection and Taitexma preselection?",
      answer:
        "On Silver Reed machines, patterning needles are selected as the carriage knits the row, so you do not see the upcoming pattern selection in advance. Taitexma punchcard machines preselect the needles required for the following pattern row after one row is completed. Both systems can produce patterned knitting successfully; the difference is mainly in how the carriage pass feels during pattern work.",
    },
    {
      question: "Is Silver Reed or Taitexma better for a beginner?",
      answer:
        "Neither brand is universally better for every beginner. A plastic-bed manual machine such as the Silver Reed LK150 can be approachable for plain knitting, while a punchcard model adds automatic patterning with more setup to learn. Compare machine gauge, patterning type, included accessories, and current availability rather than choosing by brand alone.",
    },
    {
      question: "Can I add a ribber to these machines?",
      answer: `Several current listings include optional ribbers in the machine database accessories (${ribberSummary(silverReed)}; ${ribberSummary(taitexma)}). Ribber compatibility depends on the specific main-bed model.`,
    },
    {
      question: "Where can I check current machine availability?",
      answer:
        "Visit the Knit It Now knitting machines shop page for current listings, availability badges, and links to individual model pages. Availability and delivery times vary by model.",
    },
  ];
}

export function buildPageJsonLd(faqItems: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": CANONICAL_URL,
        url: CANONICAL_URL,
        name: SEO_TITLE,
        description: META_DESCRIPTION,
        inLanguage: "en",
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "Knit it Now",
          url: SITE_URL,
        },
        about: [
          { "@type": "Thing", name: "Silver Reed knitting machine" },
          { "@type": "Thing", name: "Taitexma knitting machine" },
          { "@type": "Thing", name: "Machine knitting gauge" },
        ],
        publisher: {
          "@type": "Organization",
          name: "Knit it Now",
          url: SITE_URL,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${CANONICAL_URL}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Reference",
            item: `${SITE_URL}/reference`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Machines",
            item: `${SITE_URL}/reference/machines`,
          },
          {
            "@type": "ListItem",
            position: 4,
            name: PAGE_H1,
            item: CANONICAL_URL,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${CANONICAL_URL}#faq`,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

export function serializePageJsonLd(faqItems: FaqItem[]): string {
  return serializeJsonLd(buildPageJsonLd(faqItems));
}

export function getComparisonPageData() {
  const silverReed = getShopMachinesByBrand("Silver Reed");
  const taitexma = getShopMachinesByBrand("Taitexma");
  const faqItems = buildFaqItems(silverReed, taitexma);

  return {
    silverReed,
    taitexma,
    silverReedCards: silverReed.map(buildModelCard),
    taitexmaCards: taitexma.map(buildModelCard),
    comparisonRows: buildComparisonRows(silverReed, taitexma),
    faqItems,
    jsonLd: serializePageJsonLd(faqItems),
  };
}
