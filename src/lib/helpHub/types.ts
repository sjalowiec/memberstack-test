/** Help Hub tip as stored in Postgres hybrid columns + jsonb document. */

export const HELP_HUB_STATUSES = ["draft", "published", "review"] as const;
export type HelpHubStatus = (typeof HELP_HUB_STATUSES)[number];

export type HelpHubTipDocument = Record<string, unknown>;

export type HelpHubTipRow = {
  id: number;
  slug: string;
  status: string;
  sort_order: number | null;
  category: string | null;
  title: string | null;
  question: string | null;
  is_new: boolean | null;
  featured: boolean | null;
  document: HelpHubTipDocument;
  created_at: Date | string;
  updated_at: Date | string;
  updated_by: string | null;
  deleted_at: Date | string | null;
};

export type HelpHubTipRecord = HelpHubTipDocument & {
  id: number;
  slug: string;
  status: string;
  deletedAt?: string | null;
};

export type HelpHubWriteActor = {
  id?: string | null;
  email?: string | null;
};
