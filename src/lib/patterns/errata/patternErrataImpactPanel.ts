import { fetchAdminJson } from "../../admin/adminAuthClient";

type ImpactReport = {
  scanned: number;
  potentiallyAffected: { patternCount: number; ownerCount: number };
  customized: { patternCount: number; ownerCount: number };
  currentDefault: { patternCount: number };
  uncertain: { patternCount: number };
  rows: Array<{
    projectName: string;
    projectId: string;
    ownerId: string | null;
    builder: string | null;
    audience: string | null;
    size: string | null;
    lengthInches: number | null;
    upperArmInches: number | null;
    matchedMeasurements: string[];
    createdAt: string | null;
    classification: string;
    reason: string;
  }>;
};

export type ImpactPanelElement = {
  dataset: { impactId?: string };
  textContent: string;
  replaceChildren: () => void;
  append: (...nodes: unknown[]) => void;
};

/**
 * Memberstack headers only when the DOM package is already ready.
 * Do not wait for it. The HttpOnly Watson admin cookie is sent by the browser
 * on a same-origin request and is enough for this read-only report.
 */
export async function memberstackHeadersIfAlreadyReady(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const memberstack = window.$memberstackDom;
  if (!memberstack?.getMemberCookie) return {};
  try {
    const token = await memberstack.getMemberCookie();
    if (typeof token === "string" && token.trim()) {
      const value = token.trim();
      return {
        Authorization: `Bearer ${value}`,
        "X-Kin-Member-Token": value,
      };
    }
  } catch {
    /* The Watson cookie is still sent with the request. */
  }
  return {};
}

function cell(text: string, create: (tag: string) => { textContent: string }): { textContent: string } {
  const td = create("td");
  td.textContent = text;
  return td;
}

/**
 * Loads the read-only impact report into the edit page section.
 * Saving a correction does not use this function and still requires Memberstack.
 */
export async function loadPatternErrataImpactReport(
  impact: ImpactPanelElement | null,
  options: {
    fetchImpl?: typeof fetch;
    getHeaders?: () => Promise<Record<string, string>>;
    createElement?: (tag: string) => {
      textContent: string;
      className?: string;
      append: (...nodes: unknown[]) => void;
    };
  } = {},
): Promise<void> {
  if (!impact) return;
  const id = impact.dataset.impactId?.trim() ?? "";
  if (!id) return;
  const create = options.createElement ?? ((tag: string) => document.createElement(tag));
  const result = await fetchAdminJson<{ report?: ImpactReport }>(
    `/api/admin/pattern-errata/${encodeURIComponent(id)}/impact`,
    {
      method: "GET",
      allowMissingToken: true,
      fetchImpl: options.fetchImpl,
      getHeaders: options.getHeaders ?? memberstackHeadersIfAlreadyReady,
    },
  );
  impact.replaceChildren();
  if (!result.ok || !result.data.report) {
    impact.textContent = result.ok
      ? "Impact report was empty."
      : result.error || "Could not load the impact report.";
    return;
  }
  const report = result.data.report;
  const summary = create("p");
  summary.textContent = `Scanned ${report.scanned} saved patterns. Potentially affected: ${report.potentiallyAffected.patternCount} patterns, ${report.potentiallyAffected.ownerCount} owners. Customized: ${report.customized.patternCount} patterns, ${report.customized.ownerCount} owners. Already on the corrected default: ${report.currentDefault.patternCount}. Uncertain: ${report.uncertain.patternCount}. Uncertain matches are not counted as affected.`;
  impact.append(summary);
  if (report.rows.length === 0) return;
  const table = create("table");
  table.className = "pattern-errata-edit__impact";
  const head = create("tr");
  for (const label of ["Pattern", "Owner", "Builder", "Size", "Saved measurements", "Saved", "Match", "Why"]) {
    const th = create("th");
    th.textContent = label;
    head.append(th);
  }
  const thead = create("thead");
  thead.append(head);
  const tbody = create("tbody");
  for (const row of report.rows) {
    const tr = create("tr");
    tr.append(
      cell(row.projectName || row.projectId, create),
      cell(row.ownerId ?? "Unknown owner", create),
      cell(row.builder ?? "", create),
      cell([row.audience, row.size].filter(Boolean).join(" "), create),
      cell(
        [
          row.lengthInches === null ? "" : `length ${row.lengthInches}`,
          row.upperArmInches === null ? "" : `upper arm ${row.upperArmInches}`,
        ]
          .filter(Boolean)
          .join(", "),
        create,
      ),
      cell(row.createdAt ? row.createdAt.slice(0, 10) : "", create),
      cell(
        row.classification.replaceAll("_", " ") +
          (row.matchedMeasurements.length > 0 ? `: ${row.matchedMeasurements.join(", ")}` : ""),
        create,
      ),
      cell(row.reason, create),
    );
    tbody.append(tr);
  }
  table.append(thead, tbody);
  impact.append(table);
}
