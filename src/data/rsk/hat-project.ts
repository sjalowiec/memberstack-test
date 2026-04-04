/** Ready–Set–Knit walkthrough model (built from `ready-set-knit.json` via the loader). */

export type RskPhase = "ready" | "set" | "knit";

export interface RskResourceLink {
  label: string;
  url: string;
}

export interface RskStep {
  id: string;
  phase: RskPhase;
  /** Stage title from source data (e.g. JSON), for pills: "Ready • 3". */
  phaseTitle?: string;
  /** Pill label; kept in sync with phase + global step index by the loader. */
  navLabel: string;
  title: string;
  intro: string;
  showVideoPlaceholder?: boolean;
  actions: string[];
  nextButtonText: string;
  /** Optional longer body (plain text; paragraphs separated by blank lines). */
  content?: string | null;
  videoUrl?: string | null;
  downloads?: RskResourceLink[];
  notes?: string | null;
}

export interface RskProject {
  slug: string;
  title: string;
  intro: string;
  steps: RskStep[];
  /** Public URL or site path to a hero image. */
  heroImage?: string | null;
  /** Optional workflow label (e.g. active, archived). */
  status?: string | null;
}
