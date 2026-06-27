export type EmbeddedToolStatus = "available" | "planned" | "retired";

export type EmbeddedToolContext = "course";

export type EmbeddedToolEntry = {
  key: string;
  name: string;
  description: string;
  standalonePath: string;
  status: EmbeddedToolStatus;
  allowedContexts: EmbeddedToolContext[];
};

export const EMBEDDED_TOOL_REGISTRY: EmbeddedToolEntry[] = [
  {
    key: "maximum-knitted-width",
    name: "Maximum Knitted Width",
    description:
      "Calculate the widest piece you can knit based on available needles and stitch gauge.",
    standalonePath: "/tools/maximum-knitted-width",
    status: "available",
    allowedContexts: ["course"],
  },
  {
    key: "gauge-comparison",
    name: "Gauge Comparison",
    description: "See how a gauge difference changes the finished size of your project.",
    standalonePath: "/tools/gauge-comparison",
    status: "planned",
    allowedContexts: ["course"],
  },
  {
    key: "yarn-estimator",
    name: "Yarn Estimator",
    description: "Estimate whether you have enough yarn to finish a project.",
    standalonePath: "/tools/yarn-estimator",
    status: "available",
    allowedContexts: ["course"],
  },
  {
    key: "pattern-conversion",
    name: "Pattern Conversion",
    description: "Convert pattern stitch and row counts to match your gauge.",
    standalonePath: "/tools/pattern-conversion",
    status: "planned",
    allowedContexts: ["course"],
  },
];

export function getEmbeddedToolByKey(key: string): EmbeddedToolEntry | undefined {
  const trimmed = key.trim();
  if (!trimmed) return undefined;
  return EMBEDDED_TOOL_REGISTRY.find((entry) => entry.key === trimmed);
}

export function embeddedToolsForContext(
  context: EmbeddedToolContext,
): EmbeddedToolEntry[] {
  return EMBEDDED_TOOL_REGISTRY.filter((entry) =>
    entry.allowedContexts.includes(context),
  );
}

export function availableEmbeddedToolsForContext(
  context: EmbeddedToolContext,
): EmbeddedToolEntry[] {
  return embeddedToolsForContext(context).filter(
    (entry) => entry.status === "available",
  );
}

export function formatEmbeddedToolContexts(contexts: EmbeddedToolContext[]): string {
  return contexts.join(", ");
}
