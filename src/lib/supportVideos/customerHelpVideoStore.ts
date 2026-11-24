/**
 * Saved customer help videos.
 * Local dev keeps them in memory. kin-dev and production each use their own
 * Netlify Blobs store, so a save on one site does not change the other and
 * does not wait for a deploy.
 */
import { getStore } from "@netlify/blobs";
import { findCustomerHelpVideo, type CustomerHelpVideo } from "../../data/customerHelpVideos";
import {
  CUSTOMER_HELP_VIDEO_KEY,
  CUSTOMER_HELP_VIDEO_STORE,
  addCustomerHelpVideo,
  catalogWithVideo,
  customerHelpPath,
  findListedCustomerHelpVideo,
  parseCustomerHelpCatalog,
  type CustomerHelpVideoCatalog,
  type SavedCustomerHelpVideo,
} from "./customerHelpVideoCatalog";

const READ_ERROR = "Saved support videos could not be read. Nothing was changed.";
const WRITE_ERROR = "The support video could not be saved.";

export type CustomerHelpBlob = {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
};

const devMemory = new Map<string, unknown>();

export function memoryCustomerHelpBlob(memory: Map<string, unknown> = devMemory): CustomerHelpBlob {
  return {
    async get(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    async setJSON(key, value) {
      memory.set(key, value);
    },
  };
}

export function netlifyCustomerHelpBlob(): CustomerHelpBlob {
  const store = getStore({
    name: CUSTOMER_HELP_VIDEO_STORE,
    consistency: "strong",
  });
  return {
    get: (key, options) => store.get(key, options),
    setJSON: (key, value) => store.setJSON(key, value),
  };
}

export function customerHelpBlobForRuntime(): CustomerHelpBlob {
  if (import.meta.env.DEV) return memoryCustomerHelpBlob();
  return netlifyCustomerHelpBlob();
}

export async function readCustomerHelpCatalog(
  blob: CustomerHelpBlob,
): Promise<{ ok: true; catalog: CustomerHelpVideoCatalog } | { ok: false; error: string }> {
  let raw: unknown;
  try {
    raw = await blob.get(CUSTOMER_HELP_VIDEO_KEY, { type: "json" });
  } catch {
    return { ok: false, error: READ_ERROR };
  }
  const catalog = parseCustomerHelpCatalog(raw);
  if (!catalog) return { ok: false, error: READ_ERROR };
  return { ok: true, catalog };
}

export type CreateCustomerHelpVideoResult =
  | {
      ok: true;
      video: SavedCustomerHelpVideo;
      created: boolean;
      changed: boolean;
      path: string;
    }
  | { ok: false; error: string };

export async function createCustomerHelpVideo(
  blob: CustomerHelpBlob,
  input: { title: unknown; vimeoUrl: unknown; now?: string },
): Promise<CreateCustomerHelpVideoResult> {
  const read = await readCustomerHelpCatalog(blob);
  if (!read.ok) return read;
  const draft = addCustomerHelpVideo(read.catalog, input);
  if (!draft.ok) return draft;
  if (draft.created || draft.changed) {
    try {
      await blob.setJSON(CUSTOMER_HELP_VIDEO_KEY, catalogWithVideo(read.catalog, draft.video));
    } catch {
      return { ok: false, error: WRITE_ERROR };
    }
  }
  return {
    ok: true,
    video: draft.video,
    created: draft.created,
    changed: draft.changed,
    path: customerHelpPath(draft.video.slug),
  };
}

/**
 * Shipped pages are returned before the blob is read.
 * A blob problem cannot take /video-help/save-designaknit-file/ offline.
 */
export async function findPublishedCustomerHelpVideo(
  slug: string,
  blob: CustomerHelpBlob = customerHelpBlobForRuntime(),
): Promise<CustomerHelpVideo | undefined> {
  const shipped = findCustomerHelpVideo(slug);
  if (shipped) return shipped;
  const read = await readCustomerHelpCatalog(blob);
  if (!read.ok) return undefined;
  return findListedCustomerHelpVideo(slug, read.catalog);
}
