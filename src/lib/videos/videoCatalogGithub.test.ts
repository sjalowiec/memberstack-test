import { describe, expect, it, vi } from "vitest";
import {
  assertAllowedVideoRepoPath,
  commitVideoCatalogChanges,
  resolveVideoCatalogGithubBranch,
  resolveVideoCatalogGithubConfig,
  VideoCatalogConflictError,
} from "./videoCatalogGithub";

const config = { token: "t", owner: "sjalowiec", repo: "memberstack-test", branch: "dev" };

function githubFake(refStatus = 200) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/git/commits/base")) return json({ tree: { sha: "tree0" } });
    if (url.endsWith("/git/blobs")) return json({ sha: "blob1" });
    if (url.endsWith("/git/trees")) return json({ sha: "tree1" });
    if (url.endsWith("/git/commits")) return json({ sha: "commit1" });
    if (url.includes("/git/refs/heads/")) return json({}, refStatus);
    return json({}, 404);
  });
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}

describe("video catalog GitHub writes", () => {
  it("only writes the catalog, generated transcripts, and VTTs", () => {
    expect(() => assertAllowedVideoRepoPath("src/data/videos-public.json")).not.toThrow();
    expect(() => assertAllowedVideoRepoPath("src/data/transcripts/generated/member.json")).not.toThrow();
    expect(() => assertAllowedVideoRepoPath("src/data/transcripts/en/1239125400.vtt")).not.toThrow();
    expect(() => assertAllowedVideoRepoPath("src/data/transcripts/drafts/en/1239125400_en.vtt")).not.toThrow();
    expect(() => assertAllowedVideoRepoPath("src/pages/index.astro")).toThrow(/not a video catalog file/);
    expect(() => assertAllowedVideoRepoPath("src/data/transcripts/en/../../x.vtt")).toThrow(/invalid path/);
    expect(() => assertAllowedVideoRepoPath("src/data/transcripts/en/notes.vtt")).toThrow();
  });

  it("keeps DEV on dev and production on main", () => {
    expect(resolveVideoCatalogGithubBranch("dev", "dev")).toBe("dev");
    expect(resolveVideoCatalogGithubBranch("main", "production")).toBe("main");
    expect(() => resolveVideoCatalogGithubBranch("main", "dev")).toThrow(/saves videos to the dev branch/);
    expect(() => resolveVideoCatalogGithubBranch("dev", "production")).toThrow(/main branch/);
    expect(() => resolveVideoCatalogGithubBranch("", "dev")).toThrow(/VIDEO_CATALOG_GITHUB_BRANCH is not set/);
    expect(() => resolveVideoCatalogGithubBranch("feature", "localhost")).toThrow(/limited to the dev and main/);
  });

  it("reports missing credentials before touching GitHub", () => {
    expect(() =>
      resolveVideoCatalogGithubConfig("dev", { VIDEO_CATALOG_GITHUB_BRANCH: "dev" }, { readAstroEnv: false }),
    ).toThrow(/GITHUB_TOKEN is not configured/);
    expect(
      resolveVideoCatalogGithubConfig(
        "dev",
        { GITHUB_TOKEN: "t", GITHUB_REPO: "sjalowiec/memberstack-test", VIDEO_CATALOG_GITHUB_BRANCH: "dev" },
        { readAstroEnv: false },
      ),
    ).toEqual(config);
  });

  it("commits on top of the read commit, deletes and copies files, and never forces the branch", async () => {
    const { fetcher, calls } = githubFake();
    const result = await commitVideoCatalogChanges({
      config,
      baseSha: "base",
      fetcher,
      message: "Add video 5004",
      changes: [
        { path: "src/data/videos-public.json", content: Buffer.from("[]\n") },
        { path: "src/data/transcripts/en/777.vtt", copyOf: { path: "src/data/transcripts/drafts/en/777.vtt", sha: "abc" } },
        { path: "src/data/transcripts/drafts/en/777.vtt", delete: true },
      ],
    });
    expect(result).toEqual({
      commitSha: "commit1",
      branch: "dev",
      paths: [
        "src/data/videos-public.json",
        "src/data/transcripts/en/777.vtt",
        "src/data/transcripts/drafts/en/777.vtt",
      ],
    });
    const tree = calls.find((call) => call.url.endsWith("/git/trees"))!.body as { tree: unknown[] };
    expect(tree.tree).toEqual([
      { path: "src/data/videos-public.json", mode: "100644", type: "blob", sha: "blob1" },
      { path: "src/data/transcripts/en/777.vtt", mode: "100644", type: "blob", sha: "abc" },
      { path: "src/data/transcripts/drafts/en/777.vtt", mode: "100644", type: "blob", sha: null },
    ]);
    const commit = calls.find((call) => call.url.endsWith("/git/commits") && call.method === "POST")!.body;
    expect(commit).toMatchObject({ parents: ["base"] });
    const ref = calls.find((call) => call.method === "PATCH")!;
    expect(ref.url).toContain("/git/refs/heads/dev");
    expect(ref.body).toEqual({ sha: "commit1", force: false });
  });

  it("reports a conflict when the branch moved after the catalog was read", async () => {
    const { fetcher } = githubFake(422);
    await expect(
      commitVideoCatalogChanges({
        config,
        baseSha: "base",
        fetcher,
        message: "x",
        changes: [{ path: "src/data/videos-public.json", content: Buffer.from("[]\n") }],
      }),
    ).rejects.toBeInstanceOf(VideoCatalogConflictError);
  });

  it("refuses a disallowed path before calling GitHub", async () => {
    const { fetcher, calls } = githubFake();
    await expect(
      commitVideoCatalogChanges({
        config,
        baseSha: "base",
        fetcher,
        message: "x",
        changes: [{ path: "netlify.toml", content: Buffer.from("") }],
      }),
    ).rejects.toThrow(/not a video catalog file/);
    expect(calls).toHaveLength(0);
  });
});
