/**
 * Constrained GitHub writer for the video catalog and its English transcripts.
 * Reuses the GITHUB_TOKEN / GITHUB_REPO Git Data API pattern from
 * Machines for Sale. Hosted video saves write one commit of allowlisted files
 * to the branch the site builds from. The token never leaves the server.
 */
import { parseGithubRepo } from "../legacy_kin/courseContentGithub";
import type { SiteEnvironment } from "../env/siteEnvironment";

export const VIDEO_CATALOG_REPO_PATH = "src/data/videos-public.json";
export const VIDEO_TRANSCRIPT_REPO_DIR = "src/data/transcripts/en";
/** VTTs for videos that are not published. The transcript build does not read this folder. */
export const VIDEO_DRAFT_TRANSCRIPT_REPO_DIR = "src/data/transcripts/drafts/en";
export const VIDEO_GENERATED_TRANSCRIPT_PATHS = [
  "src/data/transcripts/generated/public.json",
  "src/data/transcripts/generated/member.json",
  "src/data/transcripts/generated/audit.json",
] as const;

export const VIDEO_CATALOG_GITHUB_ALLOWED_BRANCHES = ["dev", "main"] as const;

const GITHUB_API_VERSION = "2022-11-28";
const TRANSCRIPT_FILE_RE = /^\d+(?:_en(?:-US)?)?\.vtt$/i;

export type VideoCatalogGithubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

/** One file change in a save. `copyOf` reuses an existing blob without downloading it. */
export type VideoRepoChange =
  | { path: string; content: Buffer }
  | { path: string; copyOf: { path: string; sha: string } }
  | { path: string; delete: true };

export type VideoRepoFileEntry = { name: string; sha: string };

export class VideoCatalogConflictError extends Error {
  constructor() {
    super("Someone else saved the catalog at the same time. Nothing was saved.");
    this.name = "VideoCatalogConflictError";
  }
}

function readAstroGithubValue(
  name: "GITHUB_TOKEN" | "GITHUB_REPO" | "VIDEO_CATALOG_GITHUB_BRANCH",
): string {
  if (typeof import.meta === "undefined" || !import.meta.env) return "";
  if (name === "GITHUB_TOKEN") return String(import.meta.env.GITHUB_TOKEN ?? "").trim();
  if (name === "GITHUB_REPO") return String(import.meta.env.GITHUB_REPO ?? "").trim();
  return String(import.meta.env.VIDEO_CATALOG_GITHUB_BRANCH ?? "").trim();
}

/**
 * The DEV site may only write `dev`, and production may only write `main`,
 * so a misconfigured branch cannot publish DEV work to the live site.
 */
export function resolveVideoCatalogGithubBranch(
  raw: string | null | undefined,
  site: SiteEnvironment,
): string {
  const branch = (raw ?? "").trim();
  if (!branch) {
    throw new Error(
      "VIDEO_CATALOG_GITHUB_BRANCH is not set on this site, so video saves are turned off. Nothing was saved.",
    );
  }
  if (!(VIDEO_CATALOG_GITHUB_ALLOWED_BRANCHES as readonly string[]).includes(branch)) {
    throw new Error("Video saves are limited to the dev and main branches. Nothing was saved.");
  }
  const expected = site === "production" ? "main" : "dev";
  if (site !== "localhost" && branch !== expected) {
    throw new Error(
      `This site saves videos to the ${expected} branch, but VIDEO_CATALOG_GITHUB_BRANCH is ${branch}. Nothing was saved.`,
    );
  }
  return branch;
}

export function resolveVideoCatalogGithubConfig(
  site: SiteEnvironment,
  env: NodeJS.ProcessEnv = process.env,
  options: { readAstroEnv?: boolean } = {},
): VideoCatalogGithubConfig {
  const readAstro = options.readAstroEnv !== false;
  const token =
    (readAstro ? readAstroGithubValue("GITHUB_TOKEN") : "") ||
    String(env.GITHUB_TOKEN ?? "").trim();
  const repoRaw =
    (readAstro ? readAstroGithubValue("GITHUB_REPO") : "") ||
    String(env.GITHUB_REPO ?? "").trim();
  const branchRaw =
    (readAstro ? readAstroGithubValue("VIDEO_CATALOG_GITHUB_BRANCH") : "") ||
    String(env.VIDEO_CATALOG_GITHUB_BRANCH ?? "").trim();

  if (!token) throw new Error("GITHUB_TOKEN is not configured for video saves. Nothing was saved.");
  if (!repoRaw) throw new Error("GITHUB_REPO is not configured for video saves. Nothing was saved.");

  const { owner, repo } = parseGithubRepo(repoRaw);
  return { token, owner, repo, branch: resolveVideoCatalogGithubBranch(branchRaw, site) };
}

export function assertAllowedVideoRepoPath(repoPath: string): void {
  const path = repoPath.trim();
  if (!path || path.includes("..") || path.startsWith("/") || path.includes("\\")) {
    throw new Error(`Refusing GitHub write: invalid path "${repoPath}".`);
  }
  if (path === VIDEO_CATALOG_REPO_PATH) return;
  if ((VIDEO_GENERATED_TRANSCRIPT_PATHS as readonly string[]).includes(path)) return;
  for (const dir of [VIDEO_TRANSCRIPT_REPO_DIR, VIDEO_DRAFT_TRANSCRIPT_REPO_DIR]) {
    if (path.startsWith(`${dir}/`) && TRANSCRIPT_FILE_RE.test(path.slice(dir.length + 1))) return;
  }
  throw new Error(`Refusing GitHub save: ${path} is not a video catalog file.`);
}

function githubHeaders(token: string, accept = "application/vnd.github+json"): Record<string, string> {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "Content-Type": "application/json",
  };
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
    throw new Error(`${errorLabel} (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`);
  }
  return (await response.json()) as T;
}

function apiBase(config: VideoCatalogGithubConfig): string {
  return `https://api.github.com/repos/${config.owner}/${config.repo}`;
}

function contentsUrl(config: VideoCatalogGithubConfig, path: string, ref: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${apiBase(config)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
}

export async function readGithubBranchHead(
  config: VideoCatalogGithubConfig,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const ref = await githubJson<{ object?: { sha?: unknown } }>(
    fetcher,
    `${apiBase(config)}/git/ref/heads/${encodeURIComponent(config.branch)}`,
    { headers: githubHeaders(config.token) },
    "Could not read the GitHub branch",
  );
  const sha = typeof ref.object?.sha === "string" ? ref.object.sha.trim() : "";
  if (!sha) throw new Error("GitHub did not return the current branch commit.");
  return sha;
}

/** Raw file bytes at `ref`, or null when the file does not exist. */
export async function readGithubFile(
  config: VideoCatalogGithubConfig,
  path: string,
  ref: string,
  fetcher: typeof fetch = fetch,
): Promise<Buffer | null> {
  const response = await fetcher(contentsUrl(config, path, ref), {
    headers: githubHeaders(config.token, "application/vnd.github.raw+json"),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read ${path} from GitHub (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

/** `.vtt` files in a folder at `ref`. A missing folder is empty. */
export async function listGithubTranscriptFiles(
  config: VideoCatalogGithubConfig,
  dir: string,
  ref: string,
  fetcher: typeof fetch = fetch,
): Promise<VideoRepoFileEntry[]> {
  const response = await fetcher(contentsUrl(config, dir, ref), {
    headers: githubHeaders(config.token),
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Could not list ${dir} on GitHub (${response.status}).`);
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) return [];
  return body
    .filter((item) => item && item.type === "file" && typeof item.name === "string" && typeof item.sha === "string")
    .filter((item) => item.name.toLowerCase().endsWith(".vtt"))
    .map((item) => ({ name: String(item.name), sha: String(item.sha) }));
}

/**
 * Create one commit on top of `baseSha` and move the branch to it.
 * The branch update is not forced: if someone else committed since `baseSha`
 * was read, this throws VideoCatalogConflictError and nothing changes.
 */
export async function commitVideoCatalogChanges(options: {
  config: VideoCatalogGithubConfig;
  baseSha: string;
  changes: VideoRepoChange[];
  message: string;
  fetcher?: typeof fetch;
}): Promise<{ commitSha: string; branch: string; paths: string[] }> {
  const { config, baseSha } = options;
  if (options.changes.length === 0) throw new Error("There are no video changes to save.");
  const fetcher = options.fetcher ?? fetch;
  const headers = githubHeaders(config.token);
  const api = apiBase(config);

  for (const change of options.changes) assertAllowedVideoRepoPath(change.path);

  const baseCommit = await githubJson<{ tree?: { sha?: unknown } }>(
    fetcher,
    `${api}/git/commits/${baseSha}`,
    { headers },
    "Could not read the GitHub tree",
  );
  const baseTreeSha = typeof baseCommit.tree?.sha === "string" ? baseCommit.tree.sha.trim() : "";
  if (!baseTreeSha) throw new Error("GitHub did not return the current tree.");

  const tree: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
  for (const change of options.changes) {
    if ("delete" in change) {
      tree.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    if ("copyOf" in change) {
      assertAllowedVideoRepoPath(change.copyOf.path);
      tree.push({ path: change.path, mode: "100644", type: "blob", sha: change.copyOf.sha });
      continue;
    }
    const blob = await githubJson<{ sha?: unknown }>(
      fetcher,
      `${api}/git/blobs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ content: change.content.toString("base64"), encoding: "base64" }),
      },
      `GitHub rejected ${change.path}`,
    );
    const blobSha = typeof blob.sha === "string" ? blob.sha.trim() : "";
    if (!blobSha) throw new Error(`GitHub did not store ${change.path}.`);
    tree.push({ path: change.path, mode: "100644", type: "blob", sha: blobSha });
  }

  const nextTree = await githubJson<{ sha?: unknown }>(
    fetcher,
    `${api}/git/trees`,
    { method: "POST", headers, body: JSON.stringify({ base_tree: baseTreeSha, tree }) },
    "GitHub rejected the video catalog tree",
  );
  const treeSha = typeof nextTree.sha === "string" ? nextTree.sha.trim() : "";
  if (!treeSha) throw new Error("GitHub did not return a tree for the save.");

  const commit = await githubJson<{ sha?: unknown }>(
    fetcher,
    `${api}/git/commits`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ message: options.message, tree: treeSha, parents: [baseSha] }),
    },
    "GitHub rejected the video catalog commit",
  );
  const commitSha = typeof commit.sha === "string" ? commit.sha.trim() : "";
  if (!commitSha) throw new Error("GitHub accepted the save but did not return a commit.");

  const update = await fetcher(`${api}/git/refs/heads/${encodeURIComponent(config.branch)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
  if (update.status === 422 || update.status === 409) throw new VideoCatalogConflictError();
  if (!update.ok) {
    const detail = await update.text().catch(() => "");
    throw new Error(`GitHub rejected updating the branch (${update.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`);
  }

  return { commitSha, branch: config.branch, paths: options.changes.map((change) => change.path) };
}
