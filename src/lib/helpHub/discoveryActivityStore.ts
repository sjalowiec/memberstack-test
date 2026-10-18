/**
 * Append-only Help Hub discovery activity.
 * Netlify Blobs on a configured site. Local astro dev uses a gitignored
 * directory under `.netlify/` so a check can read the same event back.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getStore, type Store } from "@netlify/blobs";

import { resolveSearchActivityEnvironment } from "../searchActivity";
import type { HelpHubDiscoveryActivityEvent } from "./discoveryActivity";

export const HELP_HUB_DISCOVERY_ACTIVITY_STORE = "help-hub-discovery-activity";
export const HELP_HUB_DISCOVERY_EVENT_PREFIX = "events/";

const LOCAL_DIR = path.join(process.cwd(), ".netlify", "help-hub-discovery-activity-dev");

type BlobLike = {
  set(key: string, value: string): Promise<void>;
};

let backendPromise: Promise<BlobLike> | null = null;
let connectOverride: (() => Promise<BlobLike>) | null = null;

function sanitizeKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export function helpHubDiscoveryEventKey(event: { id: string; createdAt: string }): string {
  const day = event.createdAt.slice(0, 10);
  return `${HELP_HUB_DISCOVERY_EVENT_PREFIX}${sanitizeKeySegment(day)}/${sanitizeKeySegment(event.id)}.json`;
}

function fileBackend(directory: string): BlobLike {
  return {
    async set(key, value) {
      const file = path.join(directory, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, value, "utf8");
    },
  };
}

async function netlifyBlobBackend(): Promise<BlobLike | null> {
  try {
    const store: Store = getStore({
      name: HELP_HUB_DISCOVERY_ACTIVITY_STORE,
      consistency: "strong",
    });
    await store.list({ prefix: HELP_HUB_DISCOVERY_EVENT_PREFIX });
    return {
      set: (key, value) => store.set(key, value),
    };
  } catch (error) {
    if (resolveSearchActivityEnvironment() === "production") throw error;
    return null;
  }
}

async function connectBackend(): Promise<BlobLike> {
  if (connectOverride) return connectOverride();
  const blobs = await netlifyBlobBackend();
  if (blobs) return blobs;
  if (resolveSearchActivityEnvironment() === "production") {
    throw new Error("Help Hub discovery activity store is unavailable.");
  }
  return fileBackend(LOCAL_DIR);
}

async function backend(): Promise<BlobLike> {
  if (backendPromise) return backendPromise;
  const pending = connectBackend();
  backendPromise = pending;
  try {
    return await pending;
  } catch (error) {
    if (backendPromise === pending) backendPromise = null;
    throw error;
  }
}

export function resetHelpHubDiscoveryActivityBackendForTests(): void {
  backendPromise = null;
  connectOverride = null;
}

export function useHelpHubDiscoveryActivityConnectorForTests(
  connect: (() => Promise<BlobLike>) | null,
): void {
  backendPromise = null;
  connectOverride = connect;
}

export function useFileHelpHubDiscoveryActivityBackendForTests(directory: string): void {
  backendPromise = Promise.resolve(fileBackend(directory));
}

export async function appendHelpHubDiscoveryEvent(
  event: HelpHubDiscoveryActivityEvent,
): Promise<void> {
  try {
    const store = await backend();
    await store.set(helpHubDiscoveryEventKey(event), JSON.stringify(event));
  } catch (error) {
    backendPromise = null;
    throw error;
  }
}

export async function readHelpHubDiscoveryEventFileForTests(
  directory: string,
  event: { id: string; createdAt: string },
): Promise<string> {
  return readFile(path.join(directory, helpHubDiscoveryEventKey(event)), "utf8");
}
