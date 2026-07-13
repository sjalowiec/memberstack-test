/**
 * Client-side sizing chart table renderer (sweater reference page).
 * Mirrors the sweater table behavior on the general sizing charts page.
 */
import {
  DEFAULT_SWEATER_CHART_TYPE,
  SWEATER_CHART_DATA_URLS_BY_TYPE,
  SWEATER_CHART_METADATA,
  SWEATER_EXCLUDED_COLUMNS,
  type SweaterChartTypeId,
} from "./sizingChartCatalog";

function toCm(inches: number): number {
  return Math.round(inches * 2.54);
}

function formatLabel(key: string): string {
  if (key === "garment_back_length") {
    return "Back neck to hem";
  }
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatAudienceLabel(subCategory: string): string {
  return subCategory === "misses" ? "Women" : formatLabel(subCategory);
}

type ChartRow = Record<string, unknown>;

export function initSweaterSizingChartTable(options: {
  gridId?: string;
  headerId?: string;
  errorId?: string;
  unitToggleId?: string;
  pillsSelector?: string;
  initialType?: SweaterChartTypeId;
}): void {
  const gridId = options.gridId ?? "sizingGrid";
  const headerId = options.headerId ?? "chartHeader";
  const errorId = options.errorId ?? "errorMsg";
  const unitToggleId = options.unitToggleId ?? "unitToggle";
  const pillsSelector = options.pillsSelector ?? ".sweater-audience-pills button";

  let currentType: SweaterChartTypeId = options.initialType ?? DEFAULT_SWEATER_CHART_TYPE;
  let currentData: ChartRow[] = [];
  let isMetric = false;

  function updateChartHeader(): void {
    const chartHeader = document.getElementById(headerId);
    const metadata = SWEATER_CHART_METADATA[currentType];
    if (!chartHeader || !metadata) return;

    const subCategory = currentType.replace("sweaters_", "");
    chartHeader.innerHTML = `
      <h2 id="${metadata.hash}">
        <img src="${metadata.icon}" alt="" />
        Sweaters - 
        <div class="chart-header-dropdown">
          <button type="button" class="chart-header-dropdown-button">
            ${formatAudienceLabel(subCategory)} <span class="chart-header-dropdown-caret">▾</span>
          </button>
          <div class="chart-header-dropdown-content">
            <button type="button" data-type="sweaters_men">Men</button>
            <button type="button" data-type="sweaters_misses">Women</button>
            <button type="button" data-type="sweaters_plus">Plus</button>
            <button type="button" data-type="sweaters_kids">Kids</button>
            <button type="button" data-type="sweaters_baby">Baby</button>
          </div>
        </div>
      </h2>
      <p class="chart-header-body-measurements-note">These charts show <strong>body measurements</strong> for sizing, not finished sweater measurements.</p>
    `;

    const dropdown = chartHeader.querySelector(".chart-header-dropdown");
    const dropdownButton = chartHeader.querySelector<HTMLButtonElement>(
      ".chart-header-dropdown-button",
    );
    if (!dropdown || !dropdownButton) return;

    dropdownButton.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.classList.remove("open");
      }
    });

    chartHeader.querySelectorAll<HTMLButtonElement>(".chart-header-dropdown-content button").forEach(
      (btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const type = btn.dataset.type as SweaterChartTypeId | undefined;
          if (!type) return;
          dropdown.classList.remove("open");
          currentType = type;
          void loadData(currentType);
          updateActiveStates(currentType);
          updateURL(currentType);
        });
      },
    );
  }

  function renderTable(data: ChartRow[]): void {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.style.animation = "none";
    setTimeout(() => {
      grid.style.animation = "";
    }, 10);

    updateChartHeader();

    if (!data || data.length === 0) {
      grid.innerHTML =
        '<p style="text-align: center; padding: 40px;">No data available for this category.</p>';
      return;
    }

    const excludedCols = SWEATER_EXCLUDED_COLUMNS[currentType] ?? [];
    const allKeys = new Set<string>();
    data.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (
          key !== "size" &&
          key !== "label" &&
          key !== "extended_label" &&
          key !== "" &&
          key !== "__1" &&
          !excludedCols.includes(key)
        ) {
          allKeys.add(key);
        }
      });
    });

    const headers = ["Size", ...Array.from(allKeys)];
    let html = "<table><thead><tr>";
    headers.forEach((header) => {
      const displayHeader = header === "Size" ? header : formatLabel(header);
      html += `<th>${displayHeader}</th>`;
    });
    html += "</tr></thead><tbody>";

    data.forEach((row) => {
      html += "<tr>";
      html += `<td>Size ${String(row.size ?? "")}</td>`;
      Array.from(allKeys).forEach((key) => {
        const value = row[key];
        if (value === "" || value === null || value === undefined) {
          html += "<td>—</td>";
        } else if (typeof value === "number") {
          const displayValue = isMetric ? toCm(value) : value;
          const unit = isMetric ? " cm" : "″";
          html += `<td>${displayValue}${unit}</td>`;
        } else {
          html += `<td>${String(value)}</td>`;
        }
      });
      html += "</tr>";
    });

    html += "</tbody></table>";
    grid.innerHTML = html;
  }

  async function loadData(type: SweaterChartTypeId): Promise<void> {
    const errorMsg = document.getElementById(errorId);
    if (errorMsg) errorMsg.style.display = "none";

    const url = SWEATER_CHART_DATA_URLS_BY_TYPE[type];
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load data");
      currentData = (await response.json()) as ChartRow[];
      renderTable(currentData);
    } catch {
      if (errorMsg) {
        errorMsg.style.display = "block";
        errorMsg.textContent = "Error loading sizing data. Please try again later.";
      }
    }
  }

  function getTypeFromHash(): SweaterChartTypeId | null {
    const hash = location.hash.substring(1);
    if (!hash) return null;
    for (const [type, metadata] of Object.entries(SWEATER_CHART_METADATA)) {
      if (metadata.hash === hash) return type as SweaterChartTypeId;
    }
    return null;
  }

  function updateURL(type: SweaterChartTypeId): void {
    const metadata = SWEATER_CHART_METADATA[type];
    if (metadata) {
      history.replaceState(null, "", `#${metadata.hash}`);
    }
  }

  function updateActiveStates(type: SweaterChartTypeId): void {
    document.querySelectorAll<HTMLButtonElement>(pillsSelector).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.type === type);
    });
  }

  const hashType = getTypeFromHash();
  if (hashType) currentType = hashType;

  void loadData(currentType);
  updateActiveStates(currentType);

  document.querySelectorAll<HTMLButtonElement>(pillsSelector).forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const type = button.dataset.type as SweaterChartTypeId | undefined;
      if (!type) return;
      currentType = type;
      updateURL(type);
      updateActiveStates(type);
      void loadData(type);
    });
  });

  const unitToggle = document.getElementById(unitToggleId) as HTMLInputElement | null;
  unitToggle?.addEventListener("change", (e) => {
    isMetric = (e.target as HTMLInputElement).checked;
    renderTable(currentData);
  });

  window.addEventListener("hashchange", () => {
    const newType = getTypeFromHash();
    if (newType && newType !== currentType) {
      currentType = newType;
      updateActiveStates(newType);
      void loadData(currentType);
    }
  });
}
