import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { hydrateGatedTranscript, paintGatedTranscript } from "./videoDetailGatedTranscript";

class HostElement {
  innerHTML = "";
  private attributes = new Map<string, string>();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  querySelector() {
    return null;
  }
}

const originalHtmlElement = globalThis.HTMLElement;
const originalDocument = globalThis.document;

afterEach(() => {
  globalThis.HTMLElement = originalHtmlElement;
  globalThis.document = originalDocument;
});

describe("gated transcript logout", () => {
  it("removes a painted member transcript when access is gone", async () => {
    const host = new HostElement();
    host.setAttribute("data-content-id", "266");
    globalThis.HTMLElement = HostElement as unknown as typeof HTMLElement;
    globalThis.document = {
      querySelector(selector: string) {
        return selector.includes('data-content-id="266"') ? host : null;
      },
    } as unknown as Document;

    expect(host.innerHTML).not.toContain("Print Transcript");
    expect(host.innerHTML).not.toContain("Begin by casting on three stitches.");

    paintGatedTranscript("266", ["Begin by casting on three stitches."]);
    expect(host.innerHTML).toContain("Begin by casting on three stitches.");
    expect(host.innerHTML).toContain("Print Transcript");
    expect(host.innerHTML).toContain('data-print-transcript');
    expect(host.getAttribute("hidden")).toBeNull();

    await hydrateGatedTranscript({ contentId: "266", hasAccess: false });
    expect(host.innerHTML).toBe("");
    expect(host.getAttribute("hidden")).toBe("");
    expect(host.innerHTML).not.toContain("Begin by casting on three stitches.");
    expect(host.innerHTML).not.toContain("Print Transcript");
  });

  it("does not paint a print button when authorized paragraphs are empty", () => {
    const host = new HostElement();
    host.setAttribute("data-content-id", "266");
    host.setAttribute("hidden", "");
    globalThis.HTMLElement = HostElement as unknown as typeof HTMLElement;
    globalThis.document = {
      querySelector(selector: string) {
        return selector.includes('data-content-id="266"') ? host : null;
      },
    } as unknown as Document;

    paintGatedTranscript("266", []);
    expect(host.innerHTML).toBe("");
    expect(host.innerHTML).not.toContain("Print Transcript");
    expect(host.getAttribute("hidden")).toBe("");
  });

  it("wires member logout on the video page to the gated transcript refresh", () => {
    const page = readFileSync(join(process.cwd(), "src", "pages", "videos", "[id].astro"), "utf8");
    expect(page).toContain('ms.on("member.logout"');
    expect(page).toContain("refreshJumpLinkAccess");
    expect(page).toContain("hydrateGatedTranscript");
  });
});
