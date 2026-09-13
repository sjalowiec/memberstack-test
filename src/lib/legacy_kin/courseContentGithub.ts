/**
 * Constrained GitHub Contents API writer for legacy course `.poc.json` files.
 * Not a generic repository writer: path, branch, and repo come only from
 * server env / discovered course filenames.
 */

export const COURSE_CONTENT_GITHUB_DIR = "src/data/legacy_kin/cleaned";
export const COURSE_CONTENT_GITHUB_BRANCH_DEFAULT = "dev";
export const COURSE_CONTENT_GITHUB_ALLOWED_BRANCHES = ["dev"] as const;

const POC_FILENAME_RE = /^course_\d+[a-z0-9_]*\.poc\.json$/;
const REPO_RE = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
const GITHUB_API_VERSION = "2022-11-28";

export type CourseContentGithubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

export type CourseContentGithubCommitResult = {
  commitSha: string;
  branch: string;
  path: string;
  fileSha: string;
};

export type CourseContentGithubCommitInput = {
  filename: string;
  contents: string;
  courseId: number;
  message?: string;
  config?: CourseContentGithubConfig;
  fetcher?: typeof fetch;
};

function readAstroGithubValue(
  name: "GITHUB_TOKEN" | "GITHUB_REPO" | "COURSE_CONTENT_GITHUB_BRANCH",
): string {
  if (typeof import.meta === "undefined" || !import.meta.env) return "";
  if (name === "GITHUB_TOKEN") return String(import.meta.env.GITHUB_TOKEN ?? "").trim();
  if (name === "GITHUB_REPO") return String(import.meta.env.GITHUB_REPO ?? "").trim();
  return String(import.meta.env.COURSE_CONTENT_GITHUB_BRANCH ?? "").trim();
}

export function parseGithubRepo(raw: string): { owner: string; repo: string } {
  const match = REPO_RE.exec(raw.trim());
  if (!match) {
    throw new Error("GITHUB_REPO must be in owner/name format.");
  }
  return { owner: match[1]!, repo: match[2]! };
}

export function resolveCourseContentGithubBranch(raw?: string | null): string {
  const branch = (raw ?? "").trim() || COURSE_CONTENT_GITHUB_BRANCH_DEFAULT;
  if (
    !(COURSE_CONTENT_GITHUB_ALLOWED_BRANCHES as readonly string[]).includes(branch)
  ) {
    throw new Error("Course content GitHub writes are limited to the dev branch.");
  }
  return branch;
}

export function courseContentGithubRepoPath(filename: string): string {
  const base = filename.trim();
  if (
    !POC_FILENAME_RE.test(base) ||
    base.includes("/") ||
    base.includes("\\") ||
    base.includes("..")
  ) {
    throw new Error("Refusing GitHub write: invalid course content filename.");
  }
  return `${COURSE_CONTENT_GITHUB_DIR}/${base}`;
}

export function resolveCourseContentGithubConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { readAstroEnv?: boolean } = {},
): CourseContentGithubConfig {
  const readAstro = options.readAstroEnv !== false;
  const token =
    (readAstro ? readAstroGithubValue("GITHUB_TOKEN") : "") ||
    String(env.GITHUB_TOKEN ?? "").trim();
  const repoRaw =
    (readAstro ? readAstroGithubValue("GITHUB_REPO") : "") ||
    String(env.GITHUB_REPO ?? "").trim();
  const branchRaw =
    (readAstro ? readAstroGithubValue("COURSE_CONTENT_GITHUB_BRANCH") : "") ||
    String(env.COURSE_CONTENT_GITHUB_BRANCH ?? "").trim();

  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured for course content saves.");
  }
  if (!repoRaw) {
    throw new Error("GITHUB_REPO is not configured for course content saves.");
  }

  const { owner, repo } = parseGithubRepo(repoRaw);
  return {
    token,
    owner,
    repo,
    branch: resolveCourseContentGithubBranch(branchRaw),
  };
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "Content-Type": "application/json",
  };
}

export async function commitCourseContentFile(
  options: CourseContentGithubCommitInput,
): Promise<CourseContentGithubCommitResult> {
  const config = options.config ?? resolveCourseContentGithubConfig();
  const path = courseContentGithubRepoPath(options.filename);
  const fetcher = options.fetcher ?? fetch;
  const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
  const headers = githubHeaders(config.token);

  const getResponse = await fetcher(
    `${apiUrl}?ref=${encodeURIComponent(config.branch)}`,
    { headers },
  );
  if (!getResponse.ok) {
    throw new Error(
      `Could not read current course file from GitHub (${getResponse.status}).`,
    );
  }

  const current = (await getResponse.json()) as { sha?: unknown };
  const fileSha = typeof current.sha === "string" ? current.sha.trim() : "";
  if (!fileSha) {
    throw new Error("GitHub did not return a file SHA for the course content file.");
  }

  const putResponse = await fetcher(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message:
        options.message ??
        `Watson course admin: save course ${options.courseId}`,
      content: Buffer.from(options.contents, "utf8").toString("base64"),
      sha: fileSha,
      branch: config.branch,
    }),
  });

  if (!putResponse.ok) {
    if (putResponse.status === 409 || putResponse.status === 422) {
      throw new Error(
        "Course file changed on GitHub before this save finished. Reload and try again.",
      );
    }
    throw new Error(
      `GitHub rejected the course content commit (${putResponse.status}).`,
    );
  }

  const body = (await putResponse.json()) as {
    commit?: { sha?: unknown };
  };
  const commitSha =
    typeof body.commit?.sha === "string" ? body.commit.sha.trim() : "";
  if (!commitSha) {
    throw new Error("GitHub accepted the commit but did not return a commit SHA.");
  }

  return {
    commitSha,
    branch: config.branch,
    path,
    fileSha,
  };
}
