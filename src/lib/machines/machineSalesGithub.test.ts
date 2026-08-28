import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  assertAllowedMachineSalesPublishPath,
  commitMachineSalesFiles,
  gitBlobSha,
  listingImageSrcToRepoPath,
  MACHINE_SALES_JSON_REPO_PATH,
  resolveMachineSalesGithubBranch,
  resolveMachineSalesGithubConfig,
} from "./machineSalesGithub";
import {
  collectMachineSalesPublishCandidatePaths,
  isMachineSalesPublishAllowed,
  planMachineSalesPublish,
} from "./machineSalesPublish";
import { readMachineSalesListings } from "./machineSalesListings";

const validConfig = {
  token: "ghp_test_token",
  owner: "sjalowiec",
  repo: "memberstack-test",
  branch: "main",
};

describe("machine sales GitHub publish constraints", () => {
  it("restricts writes to the main branch", () => {
    expect(resolveMachineSalesGithubBranch("main")).toBe("main");
    expect(resolveMachineSalesGithubBranch("")).toBe("main");
    expect(() => resolveMachineSalesGithubBranch("dev")).toThrow(/main branch/);
    expect(() => resolveMachineSalesGithubBranch("master")).toThrow(/main branch/);
  });

  it("allows only the listings JSON, storefront reader, and referenced machine images", () => {
    expect(() => assertAllowedMachineSalesPublishPath("data/machines-for-sale.json")).not.toThrow();
    expect(() =>
      assertAllowedMachineSalesPublishPath("src/pages/shop/machines.astro"),
    ).not.toThrow();
    expect(() =>
      assertAllowedMachineSalesPublishPath("src/lib/machines/machineSalesListings.ts"),
    ).not.toThrow();
    expect(() =>
      assertAllowedMachineSalesPublishPath("public/images/machines/taxema-bulky1.jpg"),
    ).not.toThrow();
    expect(() => assertAllowedMachineSalesPublishPath("data/machines.json")).toThrow(
      /not a Machines for Sale file/,
    );
    expect(() =>
      assertAllowedMachineSalesPublishPath("public/images/machines/../secrets.txt"),
    ).toThrow();
    expect(() =>
      assertAllowedMachineSalesPublishPath("src/layouts/BaseLayout.astro"),
    ).toThrow(/not a Machines for Sale file/);
  });

  it("maps listing image URLs to the machines image folder and rejects other paths", () => {
    expect(listingImageSrcToRepoPath("/images/machines/taxema-bulky1.jpg")).toBe(
      "public/images/machines/taxema-bulky1.jpg",
    );
    expect(listingImageSrcToRepoPath("/images/machines/taxema_bulky1.jpg")).toBe(
      "public/images/machines/taxema_bulky1.jpg",
    );
    expect(listingImageSrcToRepoPath("/images/machines/../x.jpg")).toBeNull();
    expect(listingImageSrcToRepoPath("/images/accessories/foo.jpg")).toBeNull();
  });

  it("requires GitHub credentials", () => {
    expect(() =>
      resolveMachineSalesGithubConfig({}, { readAstroEnv: false }),
    ).toThrow(/GITHUB_TOKEN is not configured/);
    expect(() =>
      resolveMachineSalesGithubConfig(
        { GITHUB_TOKEN: "token-only" },
        { readAstroEnv: false },
      ),
    ).toThrow(/GITHUB_REPO is not configured/);
  });

  it("rejects a non-main configured branch even when credentials exist", () => {
    expect(() =>
      resolveMachineSalesGithubConfig(
        {
          GITHUB_TOKEN: "token",
          GITHUB_REPO: "sjalowiec/memberstack-test",
          MACHINE_SALES_GITHUB_BRANCH: "dev",
        },
        { readAstroEnv: false },
      ),
    ).toThrow(/main branch/);
  });
});

describe("machine sales publish plan", () => {
  it("blocks production hosts from publishing", () => {
    expect(
      isMachineSalesPublishAllowed("knititnow.com", { isViteDev: false }),
    ).toBe(false);
    expect(
      isMachineSalesPublishAllowed("kin-dev.netlify.app", { isViteDev: false }),
    ).toBe(true);
    expect(isMachineSalesPublishAllowed("localhost", { isViteDev: true })).toBe(true);
  });

  it("collects the listings JSON, storefront reader, and referenced images only", () => {
    const listings = readMachineSalesListings();
    const paths = collectMachineSalesPublishCandidatePaths(listings);
    expect(paths[0]).toBe(MACHINE_SALES_JSON_REPO_PATH);
    expect(paths).toContain("src/pages/shop/machines.astro");
    expect(paths).toContain("src/lib/machines/machineSalesListings.ts");
    expect(paths).toContain("public/images/machines/taxema-bulky1.jpg");
    expect(paths).toContain("public/images/machines/8601.jpg");
    expect(paths).not.toContain("data/machines.json");
    expect(paths).not.toContain("public/images/machines/taxema_bulky1.jpg");
  });

  it("skips files whose GitHub blob SHA already matches", async () => {
    const listings = readMachineSalesListings();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("ref=main");
      expect(url).not.toContain("data/machines.json");
      if (url.includes("/contents/")) {
        const repoPath = decodeURIComponent(
          url.replace(/^.*\/contents\//, "").replace(/\?ref=.*$/, ""),
        );
        const content = readFileSync(path.join(process.cwd(), repoPath));
        return new Response(JSON.stringify({ sha: gitBlobSha(content) }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const { plan, files } = await planMachineSalesPublish({
      listings,
      config: validConfig,
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(files).toHaveLength(0);
    expect(plan.files).toHaveLength(0);
    expect(plan.branch).toBe("main");
  });
});

describe("commitMachineSalesFiles", () => {
  it("commits only supplied allowlisted files onto main", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      calls.push(`${method} ${url}`);
      if (url.endsWith("/git/ref/heads/main") && method === "GET") {
        return new Response(JSON.stringify({ object: { sha: "head-sha" } }), { status: 200 });
      }
      if (url.endsWith("/git/commits/head-sha") && method === "GET") {
        return new Response(JSON.stringify({ tree: { sha: "tree-sha" } }), { status: 200 });
      }
      if (url.endsWith("/git/blobs") && method === "POST") {
        return new Response(JSON.stringify({ sha: "blob-sha" }), { status: 200 });
      }
      if (url.endsWith("/git/trees") && method === "POST") {
        const body = JSON.parse(String(init?.body)) as {
          base_tree?: string;
          tree?: Array<{ path?: string }>;
        };
        expect(body.base_tree).toBe("tree-sha");
        expect(body.tree?.map((item) => item.path)).toEqual(["data/machines-for-sale.json"]);
        return new Response(JSON.stringify({ sha: "new-tree" }), { status: 200 });
      }
      if (url.endsWith("/git/commits") && method === "POST") {
        const body = JSON.parse(String(init?.body)) as { parents?: string[]; tree?: string };
        expect(body.parents).toEqual(["head-sha"]);
        expect(body.tree).toBe("new-tree");
        return new Response(JSON.stringify({ sha: "new-commit" }), { status: 200 });
      }
      if (url.endsWith("/git/refs/heads/main") && method === "PATCH") {
        const body = JSON.parse(String(init?.body)) as { sha?: string };
        expect(body.sha).toBe("new-commit");
        return new Response(JSON.stringify({ object: { sha: "new-commit" } }), { status: 200 });
      }
      throw new Error(`unexpected ${method} ${url}`);
    });

    const result = await commitMachineSalesFiles({
      files: [{ path: "data/machines-for-sale.json", content: Buffer.from("[]\n") }],
      message: "Publish Machines for Sale listings to production.",
      config: validConfig,
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toEqual({
      commitSha: "new-commit",
      branch: "main",
      paths: ["data/machines-for-sale.json"],
    });
    expect(calls.some((call) => call.includes("data/machines.json"))).toBe(false);
  });

  it("refuses to commit a non-allowlisted path", async () => {
    await expect(
      commitMachineSalesFiles({
        files: [{ path: "data/machines.json", content: Buffer.from("{}\n") }],
        message: "nope",
        config: validConfig,
        fetcher: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/not a Machines for Sale file/);
  });
});
