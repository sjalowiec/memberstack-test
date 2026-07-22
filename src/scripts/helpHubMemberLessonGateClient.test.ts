/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../config/memberships";
import { hasMemberAccess, getViewerAccessState } from "../lib/memberAccess";
import {
  LESSON_MEMBER_BODY_MOUNT_ATTR,
  LESSON_MEMBER_BODY_TEMPLATE_ATTR,
} from "../lib/lessonMemberBodyGate";

vi.mock("./gatedVimeoEmbedClient", () => ({
  initGatedVimeoEmbeds: vi.fn(),
}));
vi.mock("./lessonVideoModal", () => ({
  initLessonVideoModal: vi.fn(),
}));
vi.mock("../lib/memberstackLogin", () => ({
  openMemberstackLoginModal: vi.fn(),
}));

type FakeNode = {
  nodeType: number;
  childNodes: FakeNode[];
  parentNode: FakeNode | null;
  textContent: string;
  cloneNode(deep?: boolean): FakeNode;
  appendChild(child: FakeNode): FakeNode;
};

type FakeEl = FakeNode & {
  tagName: string;
  attributes: Map<string, string>;
  dataset: Record<string, string>;
  children: FakeEl[];
  childElementCount: number;
  classList: { contains: (c: string) => boolean; add: (c: string) => void; remove: (c: string) => void };
  content?: FakeDocumentFragment;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  replaceChildren(...nodes: FakeNode[]): void;
  querySelector(sel: string): FakeEl | null;
  querySelectorAll(sel: string): FakeEl[];
  addEventListener: typeof document.addEventListener;
};

type FakeDocumentFragment = FakeNode & {
  childElementCount: number;
  children: FakeEl[];
  querySelector(sel: string): FakeEl | null;
  querySelectorAll(sel: string): FakeEl[];
};

function makeFragment(): FakeDocumentFragment {
  const frag: FakeDocumentFragment = {
    nodeType: 11,
    childNodes: [],
    parentNode: null,
    textContent: "",
    children: [],
    get childElementCount() {
      return this.children.length;
    },
    cloneNode(deep = false) {
      const copy = makeFragment();
      if (deep) {
        for (const child of this.childNodes) {
          copy.appendChild(child.cloneNode(true));
        }
      }
      return copy;
    },
    appendChild(child: FakeNode) {
      return appendChildCompat(this, child);
    },
    querySelector(sel: string) {
      return queryIn(this.children, sel);
    },
    querySelectorAll(sel: string) {
      return queryAllIn(this.children, sel);
    },
  };
  return frag;
}

function appendChildCompat(parent: FakeNode & { children?: FakeEl[] }, child: FakeNode): FakeNode {
  // DocumentFragment: move children (browser appendChild / replaceChildren behavior).
  if (child.nodeType === 11) {
    const frag = child as FakeDocumentFragment;
    const kids = [...frag.childNodes];
    frag.childNodes = [];
    frag.children = [];
    for (const k of kids) appendChildCompat(parent, k);
    return child;
  }
  child.parentNode = parent;
  parent.childNodes.push(child);
  if ((child as FakeEl).tagName && parent.children) {
    parent.children.push(child as FakeEl);
  }
  return child;
}

function makeEl(tag: string): FakeEl {
  const classes = new Set<string>();
  const el: FakeEl = {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    childNodes: [],
    parentNode: null,
    textContent: "",
    attributes: new Map(),
    dataset: {},
    children: [],
    get childElementCount() {
      return this.children.length;
    },
    classList: {
      contains: (c) => classes.has(c),
      add: (c) => {
        classes.add(c);
      },
      remove: (c) => {
        classes.delete(c);
      },
    },
    setAttribute(name, value) {
      this.attributes.set(name, value);
      if (name.startsWith("data-")) {
        const key = name
          .slice(5)
          .replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
        this.dataset[key] = value;
      }
    },
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name.startsWith("data-")) {
        const key = name
          .slice(5)
          .replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
        delete this.dataset[key];
      }
    },
    hasAttribute(name) {
      return this.attributes.has(name);
    },
    getAttribute(name) {
      return this.attributes.has(name) ? (this.attributes.get(name) ?? "") : null;
    },
    appendChild(child: FakeNode) {
      return appendChildCompat(this, child);
    },
    replaceChildren(...nodes: FakeNode[]) {
      this.childNodes = [];
      this.children = [];
      for (const n of nodes) this.appendChild(n);
    },
    cloneNode(deep = false) {
      const copy = makeEl(this.tagName);
      for (const [k, v] of this.attributes) copy.setAttribute(k, v);
      // classList is separate from attributes in this stub ? copy known classes.
      for (const name of ["lesson-member-body", "lesson-video-frame"]) {
        if (this.classList.contains(name)) copy.classList.add(name);
      }
      copy.textContent = this.textContent;
      if (deep) {
        for (const child of this.childNodes) copy.appendChild(child.cloneNode(true));
      }
      if (this.content) {
        copy.content = this.content.cloneNode(true) as FakeDocumentFragment;
      }
      return copy;
    },
    querySelector(sel: string) {
      return queryIn(this.children, sel);
    },
    querySelectorAll(sel: string) {
      return queryAllIn(this.children, sel);
    },
    addEventListener() {},
    style: {
      display: "",
      visibility: "",
      removeProperty(name: string) {
        if (name === "display") this.display = "";
        if (name === "visibility") this.visibility = "";
      },
    },
    hidden: false,
  } as FakeEl;
  if (tag.toLowerCase() === "template") {
    el.content = makeFragment();
  }
  return el;
}

function matches(el: FakeEl, sel: string): boolean {
  if (sel.startsWith(".")) {
    return el.classList.contains(sel.slice(1));
  }
  if (sel.startsWith("[") && sel.endsWith("]")) {
    const body = sel.slice(1, -1);
    if (body.includes("=")) {
      const [rawName, rawVal] = body.split("=");
      const name = rawName.trim();
      const val = rawVal.trim().replace(/^["']|["']$/g, "");
      return el.getAttribute(name) === val;
    }
    return el.hasAttribute(body.trim());
  }
  if (sel.includes("[")) {
    const tag = sel.slice(0, sel.indexOf("["));
    const attrSel = sel.slice(sel.indexOf("["));
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    return matches(el, attrSel);
  }
  return el.tagName === sel.toUpperCase();
}

function queryIn(els: FakeEl[], sel: string): FakeEl | null {
  for (const el of els) {
    if (matches(el, sel)) return el;
    const nested = queryIn(el.children, sel);
    if (nested) return nested;
    if (el.content) {
      const inTpl = queryIn(el.content.children, sel);
      if (inTpl) return inTpl;
    }
  }
  return null;
}

function queryAllIn(els: FakeEl[], sel: string): FakeEl[] {
  const out: FakeEl[] = [];
  for (const el of els) {
    if (matches(el, sel)) out.push(el);
    out.push(...queryAllIn(el.children, sel));
    if (el.content) out.push(...queryAllIn(el.content.children, sel));
  }
  return out;
}

function installLessonDom() {
  const body = makeEl("body");
  const locked = makeEl("div");
  locked.setAttribute("data-gated", "locked");
  locked.setAttribute("data-lesson-member-gate", "");

  const template = makeEl("template");
  template.setAttribute(LESSON_MEMBER_BODY_TEMPLATE_ATTR, "");
  const bodyRoot = makeEl("div");
  bodyRoot.setAttribute("data-lesson-member-body", "");
  bodyRoot.classList.add("lesson-member-body");
  const frame = makeEl("div");
  frame.classList.add("lesson-video-frame");
  frame.setAttribute("class", "lesson-video-frame");
  const iframe = makeEl("iframe");
  iframe.setAttribute("src", "https://player.vimeo.com/video/1186687117");
  frame.appendChild(iframe);
  bodyRoot.appendChild(frame);
  template.content!.appendChild(bodyRoot);

  const mount = makeEl("div");
  mount.setAttribute(LESSON_MEMBER_BODY_MOUNT_ATTR, "");
  mount.setAttribute("hidden", "");

  body.appendChild(locked);
  body.appendChild(template);
  body.appendChild(mount);

  const listeners = new Map<string, Set<() => void>>();

  const doc = {
    body,
    querySelector(sel: string) {
      if (sel === `template[${LESSON_MEMBER_BODY_TEMPLATE_ATTR}]`) return template;
      if (sel === `[${LESSON_MEMBER_BODY_MOUNT_ATTR}]`) return mount;
      return queryIn(body.children, sel);
    },
    querySelectorAll(sel: string) {
      return queryAllIn(body.children, sel);
    },
    createElement(tag: string) {
      return makeEl(tag);
    },
    addEventListener(type: string, fn: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    dispatchEvent(ev: { type: string }) {
      for (const fn of listeners.get(ev.type) ?? []) fn();
      return true;
    },
  };

  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", {
    document: doc,
    addEventListener: doc.addEventListener.bind(doc),
    dispatchEvent: doc.dispatchEvent.bind(doc),
    $memberstackDom: undefined as unknown,
  });

  return { body, locked, template, mount, doc };
}

function memberPayload(planId: string | null) {
  return {
    data: {
      member: {
        id: "mem_test",
        auth: { email: "test@example.com" },
        planConnections: planId
          ? [{ planId, status: "ACTIVE", active: true }]
          : [],
      },
    },
  };
}

describe("hasMemberAccess plan allow list (membership / beta / legacy)", () => {
  it("recognizes current membership plan (monthly price uses this plan id)", () => {
    const res = memberPayload(MEMBERSHIPS.membership.memberstackPlanId);
    expect(hasMemberAccess(res)).toBe(true);
    expect(getViewerAccessState(res)).toBe("memberAccess");
  });

  it("recognizes remaining legacy Basic, Beta, and legacy Premium monthly shells", () => {
    expect(
      hasMemberAccess(memberPayload(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId)),
    ).toBe(true);
    expect(hasMemberAccess(memberPayload(MEMBERSHIPS.beta.memberstackPlanId))).toBe(true);
    expect(
      hasMemberAccess(memberPayload(LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId)),
    ).toBe(true);
    expect(
      hasMemberAccess(
        memberPayload(LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId),
      ),
    ).toBe(true);
  });

  it("denies the removed annual Basic plan", () => {
    expect(hasMemberAccess(memberPayload(REMOVED_BASIC_MEMBERSHIP_PLAN_ID))).toBe(false);
  });

  it("denies logged-in members with no active paid plan", () => {
    const res = memberPayload(null);
    expect(hasMemberAccess(res)).toBe(false);
    expect(getViewerAccessState(res)).toBe("loggedInNoAccess");
  });
});

describe("syncLessonPageMemberGate mount behavior", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("A. paid member ? clones template content into the mount", async () => {
    const { template, mount, locked } = installLessonDom();
    expect(template.content!.childElementCount).toBe(1);
    expect(mount.childElementCount).toBe(0);

    const { syncLessonPageMemberGate, lessonMemberBodyIsMounted } = await import(
      "./helpHubMemberLessonGateClient"
    );

    syncLessonPageMemberGate(true);

    expect(lessonMemberBodyIsMounted(mount as never)).toBe(true);
    expect(mount.childElementCount).toBe(1);
    expect(mount.hasAttribute("hidden")).toBe(false);
    expect(locked.hasAttribute("hidden")).toBe(true);
    expect(mount.children[0]?.hasAttribute("data-lesson-member-body")).toBe(true);
    expect(mount.children[0]?.children[0]?.classList.contains("lesson-video-frame")).toBe(
      true,
    );
  });

  it("B. free member ? upgrade/lock gate shown and body not mounted", async () => {
    const { mount, locked } = installLessonDom();
    const { syncLessonPageMemberGate, lessonMemberBodyIsMounted } = await import(
      "./helpHubMemberLessonGateClient"
    );

    syncLessonPageMemberGate(false);

    expect(lessonMemberBodyIsMounted(mount as never)).toBe(false);
    expect(mount.childElementCount).toBe(0);
    expect(mount.hasAttribute("hidden")).toBe(true);
    expect(locked.hasAttribute("hidden")).toBe(false);
  });

  it("C. logged out ? lock gate shown, mount empty", async () => {
    const { mount, locked } = installLessonDom();
    const { syncLessonPageMemberGate } = await import("./helpHubMemberLessonGateClient");

    syncLessonPageMemberGate(false);

    expect(mount.childElementCount).toBe(0);
    expect(mount.hasAttribute("hidden")).toBe(true);
    expect(locked.hasAttribute("hidden")).toBe(false);
  });

  it("D. delayed paid access ? mounts when access arrives later", async () => {
    const { mount, locked } = installLessonDom();
    const { syncLessonPageMemberGate, lessonMemberBodyIsMounted } = await import(
      "./helpHubMemberLessonGateClient"
    );

    syncLessonPageMemberGate(false);
    expect(mount.childElementCount).toBe(0);
    expect(locked.hasAttribute("hidden")).toBe(false);

    syncLessonPageMemberGate(true);
    expect(lessonMemberBodyIsMounted(mount as never)).toBe(true);
    expect(mount.childElementCount).toBe(1);
    expect(mount.hasAttribute("hidden")).toBe(false);
    expect(locked.hasAttribute("hidden")).toBe(true);
  });

  it("E. calling sync twice does not duplicate the body", async () => {
    const { mount } = installLessonDom();
    const { syncLessonPageMemberGate } = await import("./helpHubMemberLessonGateClient");

    syncLessonPageMemberGate(true);
    syncLessonPageMemberGate(true);

    expect(mount.childElementCount).toBe(1);
  });

  it("remounts when mounted flag is set but mount was left empty", async () => {
    const { mount } = installLessonDom();
    const { syncLessonPageMemberGate, lessonMemberBodyIsMounted } = await import(
      "./helpHubMemberLessonGateClient"
    );

    mount.dataset.lessonBodyMounted = "true";
    expect(mount.childElementCount).toBe(0);

    syncLessonPageMemberGate(true);
    expect(lessonMemberBodyIsMounted(mount as never)).toBe(true);
    expect(mount.childElementCount).toBe(1);
  });
});

describe("lesson mount markup contract", () => {
  it("does not put data-gated=content on the deferred mount", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const page = readFileSync(join(here, "../pages/lessons/[slug].astro"), "utf8");
    expect(page).toMatch(
      new RegExp(`<div ${LESSON_MEMBER_BODY_MOUNT_ATTR} hidden></div>`),
    );
    expect(page).not.toMatch(/data-lesson-member-body-mount[^>]*data-gated="content"/);
  });

  it("lesson gate client waits for getAppAndMember only", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "helpHubMemberLessonGateClient.ts"), "utf8");
    expect(src).toContain("getAppAndMember");
    expect(src).toMatch(/waitForMemberstackAppAndMember/);
    expect(src).not.toMatch(/getAppAndMember\s*\?\?\s*ms\?\.getCurrentMember/);
    expect(src).toContain("kin:member-access");
    expect(src).toContain("__KIN_MEMBER_ACCESS__");
  });

  it("lesson page uses a single runtime-selected client script (not a script ternary)", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const page = readFileSync(join(here, "../pages/lessons/[slug].astro"), "utf8");
    expect(page).toContain("bootHelpHubMemberLessonGates");
    expect(page).toContain("bootLessonVideoModalForPublicLesson");
    expect(page).toContain('document.querySelector("[data-lesson-member-gate]")');
    // Astro must not choose between two <script> branches at compile time.
    expect(page).not.toMatch(
      /requiresMemberAccess\s*\?\s*\(\s*<>\s*<script>|requiresMemberAccess\s*\?\s*\(\s*<script>/,
    );
  });
});
