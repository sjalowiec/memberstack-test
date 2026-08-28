import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  persistMachineSalesImage,
  persistMachineSalesListings,
  resolveMachineSalesPersistMode,
} from "./machineSalesPersist";
import { MACHINE_SALES_LISTINGS_PATH, readMachineSalesListings } from "./machineSalesListings";

const tinyJpegBase64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAAEAAQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/P09fb3+Pn6/8QAHwEAAwEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A9/ooooA//9k=";

const mainConfig = {
  token: "ghp_test_token",
  owner: "sjalowiec",
  repo: "memberstack-test",
  branch: "main" as const,
};

function mockMainGithubCommit(options?: { existingImage?: string | null }) {
  const existingImage = options?.existingImage ?? null;
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    expect(url).not.toContain("/git/ref/heads/dev");
    expect(url).not.toContain("ref=dev");
    expect(url).not.toContain("data/machines.json");
    if (url.includes("/contents/") && method === "GET") {
      expect(url).toContain("ref=main");
      const repoPath = decodeURIComponent(
        url.replace(/^.*\/contents\//, "").replace(/\?ref=.*$/, ""),
      );
      if (existingImage && repoPath.endsWith(`/${existingImage}`)) {
        return new Response(JSON.stringify({ sha: "existing-sha" }), { status: 200 });
      }
      return new Response("Not Found", { status: 404 });
    }
    if (url.endsWith("/git/ref/heads/main") && method === "GET") {
      return new Response(JSON.stringify({ object: { sha: "main-head" } }), { status: 200 });
    }
    if (url.endsWith("/git/commits/main-head") && method === "GET") {
      return new Response(JSON.stringify({ tree: { sha: "main-tree" } }), { status: 200 });
    }
    if (url.endsWith("/git/blobs") && method === "POST") {
      return new Response(JSON.stringify({ sha: "main-blob" }), { status: 200 });
    }
    if (url.endsWith("/git/trees") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { tree?: Array<{ path?: string }> };
      expect(body.tree?.every((item) => item.path !== "data/machines.json")).toBe(true);
      expect(
        body.tree?.every(
          (item) =>
            item.path === "data/machines-for-sale.json" ||
            item.path?.startsWith("public/images/machines/"),
        ),
      ).toBe(true);
      return new Response(JSON.stringify({ sha: "main-new-tree" }), { status: 200 });
    }
    if (url.endsWith("/git/commits") && method === "POST") {
      return new Response(JSON.stringify({ sha: "main-commit" }), { status: 200 });
    }
    if (url.endsWith("/git/refs/heads/main") && method === "PATCH") {
      return new Response(JSON.stringify({ object: { sha: "main-commit" } }), { status: 200 });
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
}

describe("machine sales persist mode", () => {
  it("writes the filesystem on localhost and GitHub on hosted hosts including production", () => {
    expect(resolveMachineSalesPersistMode("localhost", { isViteDev: true })).toBe("filesystem");
    expect(resolveMachineSalesPersistMode("127.0.0.1", { isViteDev: false })).toBe("filesystem");
    expect(
      resolveMachineSalesPersistMode("kin-dev.netlify.app", { isViteDev: false }),
    ).toBe("github");
    expect(resolveMachineSalesPersistMode("knititnow.com", { isViteDev: false })).toBe("github");
    expect(
      resolveMachineSalesPersistMode("www.knititnow.com", { isViteDev: false }),
    ).toBe("github");
  });
});

describe("machine sales hosted persist", () => {
  it("commits a new image to GitHub main without writing the local disk", async () => {
    const fetcher = mockMainGithubCommit();
    const probeName = "ms-hosted-upload-probe.jpg";
    const saved = await persistMachineSalesImage(
      {
        filename: probeName,
        mimeType: "image/jpeg",
        dataBase64: tinyJpegBase64,
      },
      {
        hostname: "knititnow.com",
        env: { isViteDev: false },
        config: mainConfig,
        fetcher: fetcher as unknown as typeof fetch,
      },
    );

    expect(saved).toMatchObject({
      filename: probeName,
      imageSrc: `/images/machines/${probeName}`,
      persistedVia: "github",
      branch: "main",
      commitSha: "main-commit",
    });
    expect(existsSync(`public/images/machines/${probeName}`)).toBe(false);
  });

  it("does not treat a file on /var/task as taken if GitHub main does not have it", async () => {
    const fetcher = mockMainGithubCommit();
    const saved = await persistMachineSalesImage(
      {
        filename: "taitexma-tr260-ribber.jpg",
        mimeType: "image/jpeg",
        dataBase64: tinyJpegBase64,
      },
      {
        hostname: "knititnow.com",
        env: { isViteDev: false },
        config: mainConfig,
        fetcher: fetcher as unknown as typeof fetch,
      },
    );
    expect(saved.filename).toBe("taitexma-tr260-ribber.jpg");
    expect(saved.branch).toBe("main");
  });

  it("does not overwrite an image that already exists on GitHub main", async () => {
    const fetcher = mockMainGithubCommit({ existingImage: "taxema-bulky1.jpg" });
    const saved = await persistMachineSalesImage(
      {
        filename: "taxema-bulky1.jpg",
        mimeType: "image/jpeg",
        dataBase64: tinyJpegBase64,
      },
      {
        hostname: "knititnow.com",
        env: { isViteDev: false },
        config: mainConfig,
        fetcher: fetcher as unknown as typeof fetch,
      },
    );
    expect(saved.filename).not.toBe("taxema-bulky1.jpg");
    expect(saved.filename.startsWith("taxema-bulky1-")).toBe(true);
    expect(saved.imageSrc).toBe(`/images/machines/${saved.filename}`);
    expect(saved.persistedVia).toBe("github");
    expect(saved.branch).toBe("main");
  });

  it("commits listing JSON to GitHub main instead of /var/task", async () => {
    const fetcher = mockMainGithubCommit();
    const before = readFileSync(MACHINE_SALES_LISTINGS_PATH, "utf8");
    const listings = readMachineSalesListings();
    const result = await persistMachineSalesListings(listings, {
      hostname: "knititnow.com",
      env: { isViteDev: false },
      config: mainConfig,
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(result).toMatchObject({
      persistedVia: "github",
      branch: "main",
      commitSha: "main-commit",
    });
    expect(readFileSync(MACHINE_SALES_LISTINGS_PATH, "utf8")).toBe(before);
    const treeCall = fetcher.mock.calls.find((call) =>
      String(call[0]).endsWith("/git/trees"),
    );
    const body = JSON.parse(String(treeCall?.[1]?.body)) as { tree?: Array<{ path?: string }> };
    expect(body.tree?.map((item) => item.path)).toEqual(["data/machines-for-sale.json"]);
  });
});
