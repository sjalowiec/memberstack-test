import { afterEach, describe, expect, it, vi } from "vitest";

import { hydrateGatedJumpLinks, paintGatedJumpLinks } from "./videoDetailGatedJumpLinks";

class HostElement {
  innerHTML = "";
  jumplinks: HostElement | null = null;
  parent: HostElement | null = null;
  head: HostElement | null = null;
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

  remove() {
    if (this.parent) this.parent.head = null;
  }

  insertAdjacentHTML(position: string, html: string) {
    if (position === "beforebegin" && this.parent) {
      const head = new HostElement();
      head.innerHTML = html;
      head.parent = this.parent;
      this.parent.head = head;
    }
  }

  querySelector(selector: string) {
    if (selector === "#jumplinks") return this.jumplinks;
    if (selector === ".jumplinks-head") return this.head;
    if (selector === "button.jumplink") {
      return this.innerHTML.includes("jumplink") ? this : null;
    }
    return null;
  }
}

const originalHtmlElement = globalThis.HTMLElement;
const originalDocument = globalThis.document;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.HTMLElement = originalHtmlElement;
  globalThis.document = originalDocument;
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mountDeniedNav() {
  globalThis.HTMLElement = HostElement as unknown as typeof HTMLElement;
  const links = new HostElement();
  const nav = new HostElement();
  nav.jumplinks = links;
  links.parent = nav;
  nav.setAttribute("hidden", "");
  globalThis.document = {
    querySelector(selector: string) {
      return selector.includes('data-content-id="266"') ? nav : null;
    },
  } as unknown as Document;
  return { nav, links };
}

describe("gated video jump links", () => {
  it("keeps the Jump to section hidden and empty when access is denied", async () => {
    const { nav, links } = mountDeniedNav();
    links.innerHTML = '<button class="jumplink">Cast on</button>';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await hydrateGatedJumpLinks({ contentId: "266", hasAccess: false });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(links.innerHTML).toBe("");
    expect(nav.getAttribute("hidden")).toBe("");
    expect(links.innerHTML).not.toContain("Cast on");
  });

  it("shows Jump to and the authorized links after access is confirmed", async () => {
    const { nav, links } = mountDeniedNav();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, jumplinks: [{ label: "Cast on", time: 12 }] }),
    })) as unknown as typeof fetch;

    await hydrateGatedJumpLinks({ contentId: "266", hasAccess: true });

    expect(nav.getAttribute("hidden")).toBeNull();
    expect(nav.head?.innerHTML).toContain("Jump to");
    expect(links.innerHTML).toContain("Cast on");
    expect(links.innerHTML).toContain('data-video-jump="12"');
  });

  it("hides the section again when authorized links are cleared", () => {
    const { nav, links } = mountDeniedNav();
    paintGatedJumpLinks("266", [{ label: "Cast on", time: 12 }]);
    expect(nav.getAttribute("hidden")).toBeNull();

    paintGatedJumpLinks("266", []);
    expect(links.innerHTML).toBe("");
    expect(nav.getAttribute("hidden")).toBe("");
  });
});
