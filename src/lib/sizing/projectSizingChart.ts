import { ALL_SIZING_CHART_DATA_URLS, ALL_SIZING_CHART_METADATA } from "./sizingChartCatalog";

/** Charts offered from the Rectangle/Square tool. */
export const PROJECT_CHART_TYPES = ["scarves", "blankets", "pillows"] as const;
export type ProjectChartType = (typeof PROJECT_CHART_TYPES)[number];

export const SCARF_INTRO =
  "Use these sizes as a starting point. Choose the width and length to suit the person, the fabric, and the way the scarf will be worn.";
export const SCARF_MEASUREMENT_NOTE =
  "All sizes are width × length. Measurements refer to the finished scarf body, excluding fringe. Centimeters are rounded.";
export const SCARF_NOTES = [
  "Have a scarf you enjoy wearing? Measure it and use those dimensions for your own design.",
  "The chart describes finished wearing dimensions. If a scarf is folded or seamed into a double layer, allow for that construction when drafting the fabric width.",
] as const;

const PILLOW_HEADERS: Record<string, string> = {
  hatLength: "Depth",
};

type ChartRow = Record<string, unknown>;

const chartCache = new Map<ProjectChartType, ChartRow[]>();

export function isProjectChartType(type: string): type is ProjectChartType {
  return (PROJECT_CHART_TYPES as readonly string[]).includes(type);
}

export function toCm(inches: number): number {
  return Math.round(inches * 2.54);
}

export function formatSizingMeasurement(value: unknown, isMetric: boolean): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  const displayValue = isMetric ? toCm(value) : value;
  return isMetric ? `${displayValue} cm` : `${displayValue}″`;
}

function columnLabel(type: ProjectChartType, key: string): string {
  if (type === "pillows" && PILLOW_HEADERS[key]) return PILLOW_HEADERS[key];
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function rowLabel(row: ChartRow): string {
  const label = row.extended_label || row.label || row.size;
  return String(label ?? "");
}

function measurementKeys(rows: ChartRow[]): string[] {
  const keys: string[] = [];
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (
        key !== "size" &&
        key !== "label" &&
        key !== "extended_label" &&
        key !== "" &&
        key !== "__1" &&
        !keys.includes(key)
      ) {
        keys.push(key);
      }
    });
  });
  return keys;
}

export function projectChartTableHtml(
  type: ProjectChartType,
  rows: ChartRow[],
  isMetric: boolean,
): string {
  if (type === "scarves") {
    let html = "<table><thead><tr><th>Scarf</th><th>Width × length</th></tr></thead><tbody>";
    rows.forEach((row) => {
      html += "<tr>";
      html += `<td>${rowLabel(row)}</td>`;
      html += `<td class="sizing-pair">${formatSizingMeasurement(row.width, isMetric)} × ${formatSizingMeasurement(row.length, isMetric)}</td>`;
      html += "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  const keys = measurementKeys(rows);
  let html = "<table><thead><tr><th>Size</th>";
  keys.forEach((key) => {
    html += `<th>${columnLabel(type, key)}</th>`;
  });
  html += "</tr></thead><tbody>";
  rows.forEach((row) => {
    html += `<tr><td>${rowLabel(row)}</td>`;
    keys.forEach((key) => {
      const value = row[key];
      if (value === "" || value === null || value === undefined) {
        html += "<td>—</td>";
      } else if (typeof value === "number") {
        html += `<td>${formatSizingMeasurement(value, isMetric)}</td>`;
      } else {
        html += `<td>${String(value)}</td>`;
      }
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  return html;
}

/** Intro and measurement note. Does not include navigation links. */
export function projectChartGuidanceHtml(type: ProjectChartType): string {
  if (type !== "scarves") return "";
  return `<p class="chart-intro">${SCARF_INTRO}</p><p class="chart-measurement-note"><strong>${SCARF_MEASUREMENT_NOTE}</strong></p>`;
}

/** Notes under the table. Does not include the pattern-tool link. */
export function projectChartNotesHtml(type: ProjectChartType): string {
  if (type !== "scarves") return "";
  return SCARF_NOTES.map((note) => `<p>${note}</p>`).join("");
}

export function projectChartTitle(type: ProjectChartType): string {
  return ALL_SIZING_CHART_METADATA[type]?.label ?? "";
}

/** Title, guidance, table, and notes for one category. No site navigation. */
export function renderProjectChartView(
  type: ProjectChartType,
  rows: ChartRow[],
  isMetric: boolean,
): string {
  const notes = projectChartNotesHtml(type);
  return `
    <h2 id="sizing-chart-modal-title">${projectChartTitle(type)}</h2>
    ${projectChartGuidanceHtml(type)}
    <div class="sizing-grid">${projectChartTableHtml(type, rows, isMetric)}</div>
    ${notes ? `<div class="chart-notes">${notes}</div>` : ""}
  `;
}

export async function loadProjectChart(type: ProjectChartType): Promise<ChartRow[]> {
  const cached = chartCache.get(type);
  if (cached) return cached;
  const url = ALL_SIZING_CHART_DATA_URLS[type];
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  const rows = (await response.json()) as ChartRow[];
  chartCache.set(type, rows);
  return rows;
}

export function installProjectSizingCharts(): void {
  const target = window as Window & {
    KinProjectSizing?: {
      isProjectChart: typeof isProjectChartType;
      tableHtml: typeof projectChartTableHtml;
      guidanceHtml: typeof projectChartGuidanceHtml;
      notesHtml: typeof projectChartNotesHtml;
    };
  };
  target.KinProjectSizing = {
    isProjectChart: isProjectChartType,
    tableHtml: projectChartTableHtml,
    guidanceHtml: projectChartGuidanceHtml,
    notesHtml: projectChartNotesHtml,
  };
}
