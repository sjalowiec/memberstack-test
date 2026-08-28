/**
 * Environment-aware persistence for Machines for Sale listings and images.
 * Localhost writes the filesystem. Hosted DEV commits only allowlisted data
 * files to the GitHub `dev` branch. Production publishing stays on `main`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";
import {
  commitMachineSalesFiles,
  getGithubFileBlobSha,
  MACHINE_SALES_IMAGE_REPO_DIR,
  MACHINE_SALES_JSON_REPO_PATH,
  resolveMachineSalesDevGithubConfig,
  type MachineSalesGithubConfig,
} from "./machineSalesGithub";
import {
  decodeImageDataBase64,
  sanitizeMachineSalesUploadFilename,
  uniqueMachineSalesImageFilenameAsync,
  writeMachineSalesImage,
  type ImageUploadInput,
} from "./machineSalesImageUpload";
import {
  MACHINE_SALES_IMAGE_DIR,
  MACHINE_SALES_IMAGE_DISK_DIR,
  serializeMachineSalesListings,
  writeMachineSalesListings,
  type MachineSalesListing,
} from "./machineSalesListings";

export type MachineSalesPersistMode = "filesystem" | "github";

export type MachineSalesImagePersistResult = {
  filename: string;
  imageSrc: string;
  persistedVia: MachineSalesPersistMode;
  branch?: string;
  commitSha?: string;
};

export type MachineSalesListingsPersistResult = {
  listings: MachineSalesListing[];
  persistedVia: MachineSalesPersistMode;
  branch?: string;
  commitSha?: string;
};

function defaultEnv(options?: DetectSiteEnvironmentOptions): DetectSiteEnvironmentOptions {
  if (options) return options;
  return {
    isViteDev: typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV),
    publicSiteEnv:
      typeof import.meta !== "undefined" ? import.meta.env?.PUBLIC_SITE_ENV : undefined,
  };
}

export function isMachineSalesDevWriteAllowed(
  hostname: string | null | undefined,
  env?: DetectSiteEnvironmentOptions,
): boolean {
  return detectSiteEnvironment(hostname, defaultEnv(env)) !== "production";
}

export function resolveMachineSalesPersistMode(
  hostname: string | null | undefined,
  env?: DetectSiteEnvironmentOptions,
): MachineSalesPersistMode {
  const site = detectSiteEnvironment(hostname, defaultEnv(env));
  if (site === "production") {
    throw new Error("Machines for Sale can only be saved from DEV, not from production.");
  }
  if (site === "localhost") return "filesystem";
  return "github";
}

async function githubImageNameTaken(
  config: MachineSalesGithubConfig,
  filename: string,
  fetcher: typeof fetch,
): Promise<boolean> {
  if (existsSync(path.join(MACHINE_SALES_IMAGE_DISK_DIR, filename))) return true;
  const sha = await getGithubFileBlobSha(
    config,
    `${MACHINE_SALES_IMAGE_REPO_DIR}/${filename}`,
    fetcher,
  );
  return sha != null;
}

export async function persistMachineSalesImage(
  input: ImageUploadInput,
  options: {
    hostname?: string | null;
    env?: DetectSiteEnvironmentOptions;
    config?: MachineSalesGithubConfig;
    fetcher?: typeof fetch;
  } = {},
): Promise<MachineSalesImagePersistResult> {
  const mode = resolveMachineSalesPersistMode(options.hostname, options.env);
  if (mode === "filesystem") {
    const saved = writeMachineSalesImage(input);
    return { ...saved, persistedVia: "filesystem" };
  }

  const mime = input.mimeType.trim().toLowerCase();
  const safeName = sanitizeMachineSalesUploadFilename(input.filename, mime);
  const buffer = decodeImageDataBase64(input.dataBase64);
  const config = options.config ?? resolveMachineSalesDevGithubConfig();
  const fetcher = options.fetcher ?? fetch;
  const filename = await uniqueMachineSalesImageFilenameAsync(safeName, (name) =>
    githubImageNameTaken(config, name, fetcher),
  );
  const repoPath = `${MACHINE_SALES_IMAGE_REPO_DIR}/${filename}`;
  const result = await commitMachineSalesFiles({
    files: [{ path: repoPath, content: buffer }],
    message: `Save Machines for Sale image ${filename} on DEV.`,
    config,
    fetcher,
    pathGuard: "dev-save",
  });
  return {
    filename,
    imageSrc: `${MACHINE_SALES_IMAGE_DIR}${encodeURIComponent(filename)}`,
    persistedVia: "github",
    branch: result.branch,
    commitSha: result.commitSha,
  };
}

export async function persistMachineSalesListings(
  listings: MachineSalesListing[],
  options: {
    hostname?: string | null;
    env?: DetectSiteEnvironmentOptions;
    config?: MachineSalesGithubConfig;
    fetcher?: typeof fetch;
  } = {},
): Promise<MachineSalesListingsPersistResult> {
  const mode = resolveMachineSalesPersistMode(options.hostname, options.env);
  if (mode === "filesystem") {
    writeMachineSalesListings(listings);
    return { listings, persistedVia: "filesystem" };
  }

  const config = options.config ?? resolveMachineSalesDevGithubConfig();
  const result = await commitMachineSalesFiles({
    files: [
      {
        path: MACHINE_SALES_JSON_REPO_PATH,
        content: Buffer.from(serializeMachineSalesListings(listings), "utf8"),
      },
    ],
    message: "Save Machines for Sale listings on DEV.",
    config,
    fetcher: options.fetcher,
    pathGuard: "dev-save",
  });
  return {
    listings,
    persistedVia: "github",
    branch: result.branch,
    commitSha: result.commitSha,
  };
}
