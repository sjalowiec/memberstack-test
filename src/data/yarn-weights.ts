export interface YarnWeightRow {
  rangeId: "lace" | "super-fine" | "fine" | "light" | "medium" | "bulky" | "super-bulky";
  symbol: string;
  category: string;
  types: string[];
  ypp: string;
  gauge: string;
  machine: string;
  pitch: string;
  note: string;
  uk: string;
  aus: string;
  needles: string;
}

export const yarnWeights: YarnWeightRow[] = [
  {
    rangeId: "lace",
    symbol: "0.png",
    category: "Lace",
    types: ["Lace", "Fingering", "2-ply", "10-count crochet thread"],
    ypp: "4000 - 10,000 ypp",
    gauge: "33-40 sts",
    machine: "Standard",
    pitch: "4.5mm",
    note: "(stranded)",
    uk: "1 ply",
    aus: "2 ply",
    needles: "1.5 - 2.2mm",
  },
  {
    rangeId: "super-fine",
    symbol: "1.png",
    category: "Super fine",
    types: ["Sock", "Fingering", "Baby", "3-ply"],
    ypp: "3000-4000 ypp",
    gauge: "27-32 sts",
    machine: "Standard",
    pitch: "4.5mm",
    note: "(stranded)",
    uk: "2 ply",
    aus: "3 ply",
    needles: "1.25 - 3.5mm",
  },
  {
    rangeId: "fine",
    symbol: "2.png",
    category: "Fine",
    types: ["Sport", "Baby", "4-ply"],
    ypp: "2000-3000 ypp",
    gauge: "23-26 sts",
    machine: "Standard",
    pitch: "4.5mm",
    note: "/ Double Bed",
    uk: "4 ply",
    aus: "5 ply",
    needles: "3.5 - 4.5mm",
  },
  {
    rangeId: "light",
    symbol: "3.png",
    category: "Light",
    types: ["DK", "Light worsted"],
    ypp: "1000-2000 ypp",
    gauge: "21-24 sts",
    machine: "Mid-Gauge",
    pitch: "6.0 | 6.5 | 7mm / Standard 4.5mm",
    note: "",
    uk: "DK",
    aus: "8 ply",
    needles: "4.5 - 5.5mm",
  },
  {
    rangeId: "medium",
    symbol: "4.png",
    category: "Medium",
    types: ["Worsted", "Afghan", "Aran"],
    ypp: "800-1000 ypp",
    gauge: "16-20 sts",
    machine: "Mid-Gauge",
    pitch: "6.0 | 6.5 | 7mm / Bulky 9mm",
    note: "",
    uk: "Aran",
    aus: "10 ply",
    needles: "5.5 - 6.5mm",
  },
  {
    rangeId: "bulky",
    symbol: "5.png",
    category: "Bulky",
    types: ["Chunky", "Craft", "Rug"],
    ypp: "500-800 ypp",
    gauge: "12-15 sts",
    machine: "Bulky",
    pitch: "9mm",
    note: "",
    uk: "Chunky",
    aus: "12 ply",
    needles: "6.5 - 9mm",
  },
  {
    rangeId: "super-bulky",
    symbol: "6.png",
    category: "Super Bulky",
    types: ["Super bulky", "Roving"],
    ypp: "100-500 ypp",
    gauge: "6-11 sts",
    machine: "May not be appropriate",
    pitch: "",
    note: "",
    uk: "Super Chunky",
    aus: "14 ply",
    needles: "9mm +",
  },
];
