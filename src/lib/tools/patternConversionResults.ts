function renderConversionResultItem(
  label: "Stitches" | "Rows",
  value: number,
): string {
  return `
    <div class="conversion-result-item">
      <div class="conversion-result-item__value">${value}</div>
      <div class="conversion-result-item__label">${label}</div>
    </div>
  `.trim();
}

export function renderConversionResults(
  stitchConversion: { convertedValue: number } | null,
  rowConversion: { convertedValue: number } | null,
): string {
  const items: string[] = [];

  if (stitchConversion) {
    items.push(renderConversionResultItem("Stitches", stitchConversion.convertedValue));
  }

  if (rowConversion) {
    items.push(renderConversionResultItem("Rows", rowConversion.convertedValue));
  }

  const valuesClass =
    items.length === 1
      ? "conversion-result-card__values conversion-result-card__values--single"
      : "conversion-result-card__values";

  return `
    <section class="conversion-result-card" aria-label="Converted pattern numbers">
      <h3 class="conversion-result-card__heading">Use These Numbers</h3>
      <div class="${valuesClass}">
        ${items.join("")}
      </div>
    </section>
  `.trim();
}
