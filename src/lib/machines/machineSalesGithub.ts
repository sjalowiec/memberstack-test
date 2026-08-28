/**
 * Constrained GitHub writer for Machines for Sale production publishes.
 * Reuses the same GITHUB_TOKEN / GITHUB_REPO Contents+Git Data API pattern as
 * course-content saves, but only writes allowlisted machine-sale paths to main.
 */
import { createHash } from "node:crypto";
import { parseGithubRepo } from "../legacy_kin/courseContentGithub";

export const MACHINE_SALES_GITHUB_BRANCH_DEFAULT = "main";
export const MACHINE_SALES_GITHUB_ALLOWED_BRANCHES = ["main"] as const;

export const MACHINE_SALES_JSON_REPO_PATH = "data/machines-for-sale.json";
export const MACHINE_SALES_IMAGE_REPO_DIR = "public/images/machines";
export const MACHINE_SALES_STOREFRONT_REPO_PATHS = [
  "src/pages/shop/machines.astro",
  "src/lib/machines/machineSalesListings.ts",
] as const;

const GITHUB_API_VERSION = "2022-11-28";
const IMAGE_FILE_RE = /^[a-z0-9][a-z0-9._-]*$/i;

export type MachineSalesGithubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

export type MachineSalesGithubFile = {
  path: string;
  content: Buffer;
};

export type MachineSalesGithubCommitResult = {
  commitSha: string;
  branch: string;
  paths: string[];
};

function readAstroGithubValue(
  name: "GITHUB_TOKEN" | "GITHUB_REPO" | "MACHINE_SALES_GITHUB_BRANCH",
): string {
  if (typeof import.meta === "undefined" || !import.meta.env) return "";
  if (name === "GITHUB_TOKEN") return String(import.meta.env.GITHUB_TOKEN ?? "").trim();
  if (name === "GITHUB_REPO") return String(import.meta.env.GITHUB_REPO ?? "").trim();
  return String(import.meta.env.MACHINE_SALES_GITHUB_BRANCH ?? "").trim();
}

export function resolveMachineSalesGithubBranch(raw?: string | null): string {
  const branch = (raw ?? "").trim() || MACHINE_SALES_GITHUB_BRANCH_DEFAULT;
  if (!(MACHINE_SALES_GITHUB_ALLOWED_BRANCHES as readonly string[]).includes(branch)) {
    throw new Error("Machines for Sale GitHub publishes are limited to the main branch.");
  }
  return branch;
}

export function listingImageSrcToRepoPath(imageSrc: string): string | null {
  const raw = imageSrc.trim();
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const match = /^\/images\/machines\/([^/?#]+)$/.exec(decoded);
  if (!match) return null;
  const filename = match[1] ?? "";
  if (!IMAGE_FILE_RE.test(filename) || filename.includes("..")) return null;
  return `${MACHINE_SALES_IMAGE_REPO_DIR}/${filename}`;
}

export function assertAllowedMachineSalesPublishPath(repoPath: string): void {
  const path = repoPath.trim().replace(/\\/g, "/");
  if (!path || path.includes("..") || path.startsWith("/") || path.includes("\\")) {
    throw new Error(`Refusing GitHub write: invalid path "${repoPath}".`);
  }
  if (path === MACHINE_SALES_JSON_REPO_PATH) return;
  if ((MACHINE_SALES_STOREFRONT_REPO_PATHS as readonly string[]).includes(path)) return;
  if (path.startsWith(`${MACHINE_SALES_IMAGE_REPO_DIR}/`)) {
    const filename = path.slice(MACHINE_SALES_IMAGE_REPO_DIR.length + 1);
    if (IMAGE_FILE_RE.test(filename) && !filename.includes("/")) return;
  }
  throw new Error(`Refusing GitHub write: path is not a Machines for Sale file (${path}).`);
}

export function gitBlobSha(content: Buffer): string {
  const header = Buffer.from(`blob ${content.length}\0`);
  return createHash("sha1").update(header).update(content).digest("hex");
}

export function resolveMachineSalesGithubConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { readAstroEnv?: boolean } = {},
): MachineSalesGithubConfig {
  const readAstro = options.readAstroEnv !== false;
  const token =
    (readAstro ? readAstroGithubValue("GITHUB_TOKEN") : "") ||
    String(env.GITHUB_TOKEN ?? "").trim();
  const repoRaw =
    (readAstro ? readAstroGithubValue("GITHUB_REPO") : "") ||
    String(env.GITHUB_REPO ?? "").trim();
  const branchRaw =
    (readAstro ? readAstroGithubValue("MACHINE_SALES_GITHUB_BRANCH") : "") ||
    String(env.MACHINE_SALES_GITHUB_BRANCH ?? "").trim();

  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured for Machines for Sale publish.");
  }
  if (!repoRaw) {
    throw new Error("GITHUB_REPO is not configured for Machines for Sale publish.");
  }

  const { owner, repo } = parseGithubRepo(repoRaw);
  return {
    token,
    owner,
    repo,
    branch: resolveMachineSalesGithubBranch(branchRaw),
  };
}

export function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "Content-Type": "application/json",
  };
}

export async function getGithubFileBlobSha(
  config: MachineSalesGithubConfig,
  repoPath: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  assertAllowedMachineSalesPublishPath(repoPath);
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetcher(url, { headers: githubHeaders(config.token) });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Could not read ${repoPath} from GitHub (${response.status}).`);
  }
  const body = (await response.json()) as { sha?: unknown };
  return typeof body.sha === "string" && body.sha.trim() ? body.sha.trim() : null;
}

async function githubJson<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  errorLabel: string,
): Promise<T> {
  const response = await fetcher(url, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `${errorLabel} (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
    );
  }
  return (await response.json()) as T;
}

/**
 * Create one commit on the production branch containing only the given files.
 * Does not read git status or the rest of the working tree.
 */
export async function commitMachineSalesFiles(options: {
  files: MachineSalesGithubFile[];
  message: string;
  config?: MachineSalesGithubConfig;
  fetcher?: typeof fetch;
}): Promise<MachineSalesGithubCommitResult> {
  if (options.files.length === 0) {
    throw new Error("No Machines for Sale files to publish.");
  }

  const config = options.config ?? resolveMachineSalesGithubConfig();
  const fetcher = options.fetcher ?? fetch;
  const headers = githubHeaders(config.token);
  const api = `https://api.github.com/repos/${config.owner}/${config.repo}`;

  const paths: string[] = [];
  for (const file of options.files) {
    assertAllowedMachineSalesPublishPath(file.path);
    paths.push(file.path);
  }

  const ref = await githubJson<{ object?: { sha?: unknown } }>(
    fetcher,
    `${api}/git/ref/heads/${encodeURIComponent(config.branch)}`,
    { headers },
    "Could not read the production branch from GitHub",
  );
  const headSha = typeof ref.object?.sha === "string" ? ref.object.sha.trim() : "";
  if (!headSha) {
    throw new Error("GitHub did not return the current production commit SHA.");
  }

  const headCommit = await githubJson<{ tree?: { sha?: unknown } }>(
    fetcher,
    `${api}/git/commits/${headSha}`,
    { headers },
    "Could not read the production tree from GitHub",
  );
  const baseTreeSha =
    typeof headCommit.tree?.sha === "string" ? headCommit.tree.sha.trim() : "";
  if (!baseTreeSha) {
    throw new Error("GitHub did not return the current production tree SHA.");
  }

  const treeItems: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> = [];
  for (const file of options.files) {
    const blob = await githubJson<{ sha?: unknown }>(
      fetcher,
      `${api}/git/blobs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: file.content.toString("base64"),
          encoding: "base64",
        }),
      },
      `GitHub rejected the blob for ${file.path}`,
    );
    const blobSha = typeof blob.sha === "string" ? blob.sha.trim() : "";
    if (!blobSha) {
      throw new Error(`GitHub did not return a blob SHA for ${file.path}.`);
    }
    treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blobSha });
  }

  const tree = await githubJson<{ sha?: unknown }>(
    fetcher,
    `${api}/git/trees`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    },
    "GitHub rejected the Machines for Sale tree",
  );
  const treeSha = typeof tree.sha === "string" ? tree.sha.trim() : "";
  if (!treeSha) {
    throw new Error("GitHub did not return a tree SHA for the publish commit.");
  }

  const commit = await githubJson<{ sha?: unknown }>(
    fetcher,
    `${api}/git/commits`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: options.message,
        tree: treeSha,
        parents: [headSha],
      }),
    },
    "GitHub rejected the Machines for Sale commit",
  );
  const commitSha = typeof commit.sha === "string" ? commit.sha.trim() : "";
  if (!commitSha) {
    throw new Error("GitHub accepted the commit but did not return a commit SHA.");
  }

  await githubJson(
    fetcher,
    `${api}/git/refs/heads/${encodeURIComponent(config.branch)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: commitSha }),
    },
    "GitHub rejected updating the production branch",
  );

  return {
    commitSha,
    branch: config.branch,
    paths,
  };
}
