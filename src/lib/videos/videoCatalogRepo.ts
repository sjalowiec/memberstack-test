/**
 * Where hosted video saves read and write the catalog.
 * Localhost uses the working tree. Hosted sites (DEV and production) read the
 * latest saved files from GitHub and commit there, never the function disk,
 * so a save survives every later deploy.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import publicGenerated from "../../data/transcripts/generated/public.json";
import memberGenerated from "../../data/transcripts/generated/member.json";
import auditGenerated from "../../data/transcripts/generated/audit.json";
import { gitBlobSha } from "../machines/machineSalesGithub";
import { detectSiteEnvironment, type SiteEnvironment } from "../env/siteEnvironment";
import {
  commitVideoCatalogChanges,
  listGithubTranscriptFiles,
  readGithubBranchHead,
  readGithubFile,
  resolveVideoCatalogGithubConfig,
  VIDEO_CATALOG_REPO_PATH,
  VIDEO_DRAFT_TRANSCRIPT_REPO_DIR,
  VIDEO_GENERATED_TRANSCRIPT_PATHS,
  VIDEO_TRANSCRIPT_REPO_DIR,
  type VideoCatalogGithubConfig,
  type VideoRepoChange,
  type VideoRepoFileEntry,
} from "./videoCatalogGithub";
import { loadMergedVideoCatalog } from "./videoCatalogStore";

export type VideoCatalogSnapshot = {
  /** Commit the files were read from. Null on localhost. */
  ref: string | null;
  catalogRaw: string;
  generated: { public: string; member: string; audit: string };
  transcripts: { published: VideoRepoFileEntry[]; drafts: VideoRepoFileEntry[] };
};

export type VideoCatalogCommitResult = {
  persistedVia: "filesystem" | "github" | "database";
  branch?: string;
  commitSha?: string;
};

export interface VideoCatalogRepo {
  readonly mode: "filesystem" | "github";
  readonly branch?: string;
  readSnapshot(): Promise<VideoCatalogSnapshot>;
  readFile(path: string, ref: string | null): Promise<Buffer | null>;
  commit(snapshot: VideoCatalogSnapshot, changes: VideoRepoChange[], message: string): Promise<VideoCatalogCommitResult>;
}

function text(buffer: Buffer | null, path: string): string {
  if (!buffer) throw new Error(`${path} is missing, so the catalog could not be read.`);
  return buffer.toString("utf8");
}

export function githubVideoCatalogRepo(
  config: VideoCatalogGithubConfig,
  fetcher: typeof fetch = fetch,
): VideoCatalogRepo {
  return {
    mode: "github",
    branch: config.branch,
    async readSnapshot() {
      const ref = await readGithubBranchHead(config, fetcher);
      const [catalog, publicJson, memberJson, auditJson, published, drafts] = await Promise.all([
        readGithubFile(config, VIDEO_CATALOG_REPO_PATH, ref, fetcher),
        ...VIDEO_GENERATED_TRANSCRIPT_PATHS.map((path) => readGithubFile(config, path, ref, fetcher)),
        listGithubTranscriptFiles(config, VIDEO_TRANSCRIPT_REPO_DIR, ref, fetcher),
        listGithubTranscriptFiles(config, VIDEO_DRAFT_TRANSCRIPT_REPO_DIR, ref, fetcher),
      ] as const);
      return {
        ref,
        catalogRaw: text(catalog as Buffer | null, VIDEO_CATALOG_REPO_PATH),
        generated: {
          public: text(publicJson as Buffer | null, VIDEO_GENERATED_TRANSCRIPT_PATHS[0]),
          member: text(memberJson as Buffer | null, VIDEO_GENERATED_TRANSCRIPT_PATHS[1]),
          audit: text(auditJson as Buffer | null, VIDEO_GENERATED_TRANSCRIPT_PATHS[2]),
        },
        transcripts: {
          published: published as VideoRepoFileEntry[],
          drafts: drafts as VideoRepoFileEntry[],
        },
      };
    },
    readFile(path, ref) {
      return readGithubFile(config, path, ref ?? config.branch, fetcher);
    },
    async commit(snapshot, changes, message) {
      if (!snapshot.ref) throw new Error("The catalog was not read from GitHub, so nothing was saved.");
      const result = await commitVideoCatalogChanges({
        config,
        baseSha: snapshot.ref,
        changes,
        message,
        fetcher,
      });
      return { persistedVia: "github", branch: result.branch, commitSha: result.commitSha };
    },
  };
}

export function filesystemVideoCatalogRepo(root: string = process.cwd()): VideoCatalogRepo {
  const full = (path: string) => join(root, ...path.split("/"));
  const list = (dir: string): VideoRepoFileEntry[] => {
    if (!existsSync(full(dir))) return [];
    return readdirSync(full(dir))
      .filter((name) => name.toLowerCase().endsWith(".vtt"))
      .map((name) => ({ name, sha: gitBlobSha(readFileSync(join(full(dir), name))) }));
  };
  return {
    mode: "filesystem",
    async readSnapshot() {
      return {
        ref: null,
        catalogRaw: readFileSync(full(VIDEO_CATALOG_REPO_PATH), "utf8"),
        generated: {
          public: readFileSync(full(VIDEO_GENERATED_TRANSCRIPT_PATHS[0]), "utf8"),
          member: readFileSync(full(VIDEO_GENERATED_TRANSCRIPT_PATHS[1]), "utf8"),
          audit: readFileSync(full(VIDEO_GENERATED_TRANSCRIPT_PATHS[2]), "utf8"),
        },
        transcripts: {
          published: list(VIDEO_TRANSCRIPT_REPO_DIR),
          drafts: list(VIDEO_DRAFT_TRANSCRIPT_REPO_DIR),
        },
      };
    },
    async readFile(path) {
      return existsSync(full(path)) ? readFileSync(full(path)) : null;
    },
    async commit(_snapshot, changes) {
      // Copies read their source before any delete in the same save runs.
      const copies = new Map<string, Buffer>();
      for (const change of changes) {
        if ("copyOf" in change) copies.set(change.path, readFileSync(full(change.copyOf.path)));
      }
      for (const change of changes) {
        if ("delete" in change) {
          rmSync(full(change.path), { force: true });
          continue;
        }
        const content = "copyOf" in change ? copies.get(change.path)! : change.content;
        mkdirSync(dirname(full(change.path)), { recursive: true });
        writeFileSync(full(change.path), content);
      }
      return { persistedVia: "filesystem" };
    },
  };
}

export function videoCatalogSiteEnvironment(hostname: string | null | undefined): SiteEnvironment {
  return detectSiteEnvironment(hostname, {
    isViteDev: typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV),
    publicSiteEnv: typeof import.meta !== "undefined" ? import.meta.env?.PUBLIC_SITE_ENV : undefined,
  });
}

/**
 * Catalog saves do not need GitHub. When the hosted GitHub settings are absent,
 * read the deployed catalog and transcript JSON and store the video in the database.
 */
export function deployedVideoCatalogRepo(): VideoCatalogRepo {
  return {
    mode: "filesystem",
    async readSnapshot() {
      const merged = await loadMergedVideoCatalog();
      return {
        ref: null,
        catalogRaw: `${JSON.stringify(merged, null, 2)}\n`,
        generated: {
          public: JSON.stringify(publicGenerated),
          member: JSON.stringify(memberGenerated),
          audit: JSON.stringify(auditGenerated),
        },
        transcripts: { published: [], drafts: [] },
      };
    },
    async readFile() {
      return null;
    },
    async commit() {
      return { persistedVia: "database" };
    },
  };
}

/** Localhost edits the working tree. Hosted sites use GitHub when it is configured, otherwise the database. */
export function videoCatalogRepoForHost(hostname: string | null | undefined): VideoCatalogRepo {
  const site = videoCatalogSiteEnvironment(hostname);
  if (site === "localhost") return filesystemVideoCatalogRepo();
  try {
    return githubVideoCatalogRepo(resolveVideoCatalogGithubConfig(site));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/GITHUB_|VIDEO_CATALOG_GITHUB_BRANCH/.test(message)) return deployedVideoCatalogRepo();
    throw error;
  }
}
