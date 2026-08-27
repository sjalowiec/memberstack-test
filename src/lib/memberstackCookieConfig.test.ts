import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const baseLayout = readFileSync(resolve("src/layouts/BaseLayout.astro"), "utf8");
const kinCourseLayout = readFileSync(
  resolve("src/layouts/KinCourseLayout.astro"),
  "utf8",
);
const header = readFileSync(resolve("src/components/Header.astro"), "utf8");

const MEMBERSTACK_APP_ID = "app_cmfh3d1n802vb0wy706205810";
const MEMBERSTACK_CDN = "https://static.memberstack.com/scripts/v2/memberstack.js";

function expectRootCookieSession(layout: string, label: string): void {
  const configIdx = layout.indexOf("var memberstackConfig");
  const scriptIdx = layout.indexOf(MEMBERSTACK_CDN);

  expect(configIdx, `${label} defines memberstackConfig`).toBeGreaterThan(-1);
  expect(scriptIdx, `${label} loads the Memberstack CDN`).toBeGreaterThan(-1);
  expect(configIdx).toBeLessThan(scriptIdx);

  const configBlock = layout.slice(configIdx, scriptIdx);
  expect(configBlock).toContain("useCookies: true");
  expect(configBlock).toContain("setCookieOnRootDomain: true");
  expect(configBlock).toContain('"_ms-mid"');
  expect(configBlock).toContain("Max-Age=0; Path=/");
  expect(configBlock).toContain("localStorage");
  expect(configBlock).not.toContain("Domain=.knititnow.com");

  expect(layout).toContain(`data-memberstack-app="${MEMBERSTACK_APP_ID}"`);
  expect(layout).toContain("data-memberstack-use-cookies");
  expect(layout).not.toMatch(/\$memberstackDom\?\.init\?\(\s*\)/);
  expect(layout).toContain(
    "window.$memberstackDom?.init?.(window.memberstackConfig)",
  );
}

describe("Memberstack root-domain cookie session", () => {
  it("defines cookie config before the Memberstack CDN script", () => {
    expectRootCookieSession(baseLayout, "BaseLayout");
  });

  it("uses the same cookie boot on the KIN course player layout without origin cleanup", () => {
    const configIdx = kinCourseLayout.indexOf("var memberstackConfig");
    const scriptIdx = kinCourseLayout.indexOf(MEMBERSTACK_CDN);

    expect(configIdx, "KinCourseLayout defines memberstackConfig").toBeGreaterThan(-1);
    expect(scriptIdx, "KinCourseLayout loads the Memberstack CDN").toBeGreaterThan(-1);
    expect(configIdx).toBeLessThan(scriptIdx);

    const configBlock = kinCourseLayout.slice(configIdx, scriptIdx);
    expect(configBlock).toContain("useCookies: true");
    expect(configBlock).toContain("setCookieOnRootDomain: true");
    expect(configBlock).not.toContain("Max-Age=0; Path=/");
    expect(configBlock).not.toContain("clearMsStorage");
    expect(configBlock).not.toContain("Domain=.knititnow.com");

    expect(kinCourseLayout).toContain(`data-memberstack-app="${MEMBERSTACK_APP_ID}"`);
    expect(kinCourseLayout).toContain("data-memberstack-use-cookies");
    expect(kinCourseLayout).not.toMatch(/\$memberstackDom\?\.init\?\(\s*\)/);
    expect(kinCourseLayout).toContain(
      "window.$memberstackDom?.init?.(window.memberstackConfig)",
    );
    expect(kinCourseLayout).not.toContain("clearMsStorage");
    expect(kinCourseLayout).not.toContain("Max-Age=0; Path=/");
  });

  it("keeps the live Memberstack app id on the CDN script", () => {
    expect(baseLayout).toContain(
      `data-memberstack-app="${MEMBERSTACK_APP_ID}"`,
    );
    expect(baseLayout).toContain("data-memberstack-use-cookies");
    expect(baseLayout).toContain(MEMBERSTACK_CDN);
  });

  it("does not re-init Memberstack without the cookie options", () => {
    expect(baseLayout).not.toMatch(/\$memberstackDom\?\.init\?\(\s*\)/);
    expect(baseLayout).toContain(
      "window.$memberstackDom?.init?.(window.memberstackConfig)",
    );
  });

  it("still logs out through Memberstack logout", () => {
    expect(header).toContain("await ms.logout()");
    expect(header).toContain('data-ms-action="logout"');
  });
});
