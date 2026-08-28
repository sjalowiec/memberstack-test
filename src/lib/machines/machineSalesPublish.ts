/**
 * Collect and publish the current Machines for Sale listings to production (main).
 * DEV saves commit data files to the GitHub `dev` branch. Hosted DEV publish reads
 * those GitHub `dev` files and promotes the listings JSON and referenced images
 * onto `main`. Localhost still publishes from the working tree disk.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";
import {
  assertAllowedMachineSalesPublishPath,
  commitMachineSalesFiles,
  getGithubFileBlobSha,
  getGithubFileContent,
  gitBlobSha,
  listingImageSrcToRepoPath,
  MACHINE_SALES_JSON_REPO_PATH,
  resolveMachineSalesDevGithubConfig,
  resolveMachineSalesGithubConfig,
  type MachineSalesGithubConfig,
  type MachineSalesGithubFile,
} from "./machineSalesGithub";
import {
  parseMachineSalesListingsFile,
  readMachineSalesListings,
  shopListingImageSrcs,
  type MachineSalesListing,
} from "./machineSalesListings";
import { resolveMachineSalesPersistMode } from "./machineSalesPersist";

export const MACHINE_SALES_PUBLISH_CONFIRM = "PUBLISH";

export type MachineSalesPublishFileAction = "add" | "update";

export type MachineSalesPublishFilePlan = {
  path: string;
  action: MachineSalesPublishFileAction;
};

export type MachineSalesPublishListingSummary = {
  id: string;
  name: string;
  price: number | null;
  priceLabel: string | null;
  status: MachineSalesListing["status"];
  shopifyUrl: string;
  imageSrc: string;
};

export type MachineSalesPublishPlan = {
  branch: string;
  files: MachineSalesPublishFilePlan[];
  listings: MachineSalesPublishListingSummary[];
};

export type MachineSalesPublishResult = MachineSalesPublishPlan & {
  commitSha: string | null;
  published: boolean;
};

function defaultEnv(options?: DetectSiteEnvironmentOptions): DetectSiteEnvironmentOptions {
  if (options) return options;
  return {
    isViteDev: typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV),
    publicSiteEnv:
      typeof import.meta !== "undefined" ? import.meta.env?.PUBLIC_SITE_ENV : undefined,
  };
}

export function isMachineSalesPublishAllowed(
  hostname: string | null | undefined,
  env?: DetectSiteEnvironmentOptions,
): boolean {
  return detectSiteEnvironment(hostname, defaultEnv(env)) !== "production";
}

export function summarizeMachineSalesListings(
  listings: MachineSalesListing[],
): MachineSalesPublishListingSummary[] {
  return listings.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    priceLabel: row.priceLabel,
    status: row.status,
    shopifyUrl: row.shopifyUrl,
    imageSrc: row.imageSrc,
  }));
}

export function collectMachineSalesPublishCandidatePaths(
  listings: MachineSalesListing[],
): string[] {
  const paths = [MACHINE_SALES_JSON_REPO_PATH];
  for (const src of shopListingImageSrcs(listings)) {
    const repoPath = listingImageSrcToRepoPath(src);
    if (!repoPath) {
      throw new Error(`Listing image is not a Machines for Sale upload path: ${src}`);
    }
    paths.push(repoPath);
  }
  for (const repoPath of paths) {
    assertAllowedMachineSalesPublishPath(repoPath);
  }
  return paths;
}

function diskPathForRepoPath(repoPath: string): string {
  return path.join(process.cwd(), ...repoPath.split("/"));
}

export function readMachineSalesPublishFile(repoPath: string): Buffer {
  assertAllowedMachineSalesPublishPath(repoPath);
  const diskPath = diskPathForRepoPath(repoPath);
  if (!existsSync(diskPath)) {
    throw new Error(`Cannot publish missing file: ${repoPath}`);
  }
  return readFileSync(diskPath);
}

async function loadPublishListings(options: {
  listings?: MachineSalesListing[];
  sourceConfig?: MachineSalesGithubConfig;
  fetcher?: typeof fetch;
}): Promise<MachineSalesListing[]> {
  if (options.listings) return options.listings;
  if (options.sourceConfig) {
    const content = await getGithubFileContent(
      options.sourceConfig,
      MACHINE_SALES_JSON_REPO_PATH,
      options.fetcher,
    );
    if (!content) {
      throw new Error("Could not read data/machines-for-sale.json from the GitHub dev branch.");
    }
    return parseMachineSalesListingsFile(content.toString("utf8"));
  }
  return readMachineSalesListings();
}

async function readPublishSourceFile(
  repoPath: string,
  options: {
    sourceConfig?: MachineSalesGithubConfig;
    fetcher?: typeof fetch;
  },
): Promise<Buffer> {
  if (options.sourceConfig) {
    const content = await getGithubFileContent(options.sourceConfig, repoPath, options.fetcher);
    if (!content) {
      throw new Error(`Cannot publish missing file: ${repoPath}`);
    }
    return content;
  }
  return readMachineSalesPublishFile(repoPath);
}

function resolvePublishSourceConfig(options: {
  hostname?: string | null;
  env?: DetectSiteEnvironmentOptions;
  sourceConfig?: MachineSalesGithubConfig;
}): MachineSalesGithubConfig | undefined {
  if (options.sourceConfig) return options.sourceConfig;
  if (!options.hostname) return undefined;
  try {
    if (resolveMachineSalesPersistMode(options.hostname, options.env) !== "github") {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return resolveMachineSalesDevGithubConfig();
}

export async function planMachineSalesPublish(options: {
  listings?: MachineSalesListing[];
  hostname?: string | null;
  env?: DetectSiteEnvironmentOptions;
  config?: MachineSalesGithubConfig;
  sourceConfig?: MachineSalesGithubConfig;
  fetcher?: typeof fetch;
} = {}): Promise<{
  plan: MachineSalesPublishPlan;
  files: MachineSalesGithubFile[];
}> {
  const sourceConfig = resolvePublishSourceConfig(options);
  const listings = await loadPublishListings({
    listings: options.listings,
    sourceConfig,
    fetcher: options.fetcher,
  });
  const config = options.config ?? resolveMachineSalesGithubConfig();
  const fetcher = options.fetcher ?? fetch;
  const candidates = collectMachineSalesPublishCandidatePaths(listings);
  const files: MachineSalesGithubFile[] = [];
  const planFiles: MachineSalesPublishFilePlan[] = [];

  for (const repoPath of candidates) {
    const content = await readPublishSourceFile(repoPath, { sourceConfig, fetcher });
    const remoteSha = await getGithubFileBlobSha(config, repoPath, fetcher);
    const localSha = gitBlobSha(content);
    if (remoteSha === localSha) continue;
    files.push({ path: repoPath, content });
    planFiles.push({
      path: repoPath,
      action: remoteSha ? "update" : "add",
    });
  }

  return {
    plan: {
      branch: config.branch,
      files: planFiles,
      listings: summarizeMachineSalesListings(listings),
    },
    files,
  };
}

export async function publishMachineSalesToProduction(options: {
  listings?: MachineSalesListing[];
  hostname?: string | null;
  env?: DetectSiteEnvironmentOptions;
  config?: MachineSalesGithubConfig;
  sourceConfig?: MachineSalesGithubConfig;
  fetcher?: typeof fetch;
  dryRun?: boolean;
  message?: string;
} = {}): Promise<MachineSalesPublishResult> {
  const { plan, files } = await planMachineSalesPublish(options);
  if (files.length === 0 || options.dryRun) {
    return {
      ...plan,
      commitSha: null,
      published: false,
    };
  }

  const result = await commitMachineSalesFiles({
    files,
    message:
      options.message ??
      "Publish Machines for Sale listings to production.",
    config: options.config,
    fetcher: options.fetcher,
  });

  return {
    ...plan,
    commitSha: result.commitSha,
    published: true,
  };
}
