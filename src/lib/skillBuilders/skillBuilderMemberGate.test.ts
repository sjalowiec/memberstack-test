/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MEMBERSHIPS } from "../../config/memberships";
import { hasMemberAccess } from "../memberAccess";
import {
  SKILL_BUILDER_MEMBER_BODY_MOUNT_ATTR,
  SKILL_BUILDER_MEMBER_BODY_TEMPLATE_ATTR,
  SKILL_BUILDER_MEMBER_LOCK_ATTR,
  mountSkillBuilderMemberBody,
  resetSkillBuilderMemberGateBindForTests,
  skillBuilderMemberBodyIsMounted,
  syncSkillBuilderMemberGate,
  unmountSkillBuilderMemberBody,
} from "./skillBuilderMemberGate";

vi.mock("../../scripts/gatedVimeoEmbedClient", () => ({
  initGatedVimeoEmbeds: vi.fn(),
}));

const pagesDir = join(process.cwd(), "src/pages/learn/skill-builders");
const componentsDir = join(process.cwd(), "src/components/skill-builders");

function readPage(...parts: string[]): string {
  return readFileSync(join(pagesDir, ...parts), "utf8");
}

function readComponent(name: string): string {
  return readFileSync(join(componentsDir, `${name}.astro`), "utf8");
}

const GATED_ROUTES = [
  ["round-necklines-shaped-shoulders", "index.astro"],
  ["round-necklines-shaped-shoulders", "[exercise].astro"],
  ["join-beautiful-shoulder-seams.astro"],
] as const;

const PUBLIC_ROUTES = [
  ["round-neckline-basics", "index.astro"],
  ["round-neckline-basics", "[exercise].astro"],
] as const;

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
  content?: FakeDocumentFragment;
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  replaceChildren(...nodes: FakeNode[]): void;
  replaceWith(node: FakeNode): void;
  querySelector(sel: string): FakeEl | null;
  querySelectorAll(sel: string): FakeEl[];
};

type FakeDocumentFragment = FakeNode & {
  childElementCount: number;
  children: FakeEl[];
  querySelector(sel: string): FakeEl | null;
  querySelectorAll(sel: string): FakeEl[];
};

function kebabToCamel(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

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
      child.parentNode = this;
      this.childNodes.push(child);
      if ((child as FakeEl).tagName) this.children.push(child as FakeEl);
      return child;
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

function makeEl(tag: string): FakeEl {
  const el: FakeEl = {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    childNodes: [],
    parentNode: null,
    textContent: "",
    attributes: new Map(),
    dataset: {},
    children: [],
    hidden: false,
    get childElementCount() {
      return this.children.length;
    },
    setAttribute(name, value) {
      this.attributes.set(name, value);
      if (name.startsWith("data-")) {
        this.dataset[kebabToCamel(name.slice(5))] = value;
      }
      if (name === "hidden") this.hidden = true;
    },
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name.startsWith("data-")) {
        delete this.dataset[kebabToCamel(name.slice(5))];
      }
      if (name === "hidden") this.hidden = false;
    },
    hasAttribute(name) {
      return this.attributes.has(name);
    },
    getAttribute(name) {
      return this.attributes.has(name) ? (this.attributes.get(name) ?? "") : null;
    },
    appendChild(child: FakeNode) {
      if (child.nodeType === 11) {
        for (const nested of [...child.childNodes]) this.appendChild(nested);
        return child;
      }
      child.parentNode = this;
      this.childNodes.push(child);
      if ((child as FakeEl).tagName) this.children.push(child as FakeEl);
      return child;
    },
    replaceChildren(...nodes: FakeNode[]) {
      this.childNodes = [];
      this.children = [];
      for (const node of nodes) this.appendChild(node);
    },
    replaceWith() {},
    cloneNode(deep = false) {
      const copy = makeEl(this.tagName);
      for (const [k, v] of this.attributes) copy.setAttribute(k, v);
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
  };
  if (tag.toLowerCase() === "template") {
    el.content = makeFragment();
  }
  return el;
}

function matches(el: FakeEl, sel: string): boolean {
  if (sel.startsWith("[") && sel.endsWith("]")) {
    const body = sel.slice(1, -1);
    if (body.includes("=")) {
      const [rawName, rawVal] = body.split("=");
      const val = rawVal.trim().replace(/^["']|["']$/g, "");
      return el.getAttribute(rawName.trim()) === val;
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
  }
  return null;
}

function queryAllIn(els: FakeEl[], sel: string): FakeEl[] {
  const out: FakeEl[] = [];
  for (const el of els) {
    if (matches(el, sel)) out.push(el);
    out.push(...queryAllIn(el.children, sel));
  }
  return out;
}

function installGateDom() {
  const body = makeEl("body");
  const lock = makeEl("div");
  lock.setAttribute(SKILL_BUILDER_MEMBER_LOCK_ATTR, "");
  lock.setAttribute("data-gated", "locked");

  const template = makeEl("template");
  template.setAttribute(SKILL_BUILDER_MEMBER_BODY_TEMPLATE_ATTR, "");
  const worksheet = makeEl("section");
  worksheet.setAttribute("data-sb-results", "");
  worksheet.textContent = "Full Practice-Piece Diagram";
  const checklist = makeEl("ol");
  checklist.setAttribute("data-sb-checklist", "");
  checklist.textContent = "Shoulder Seam Checklist";
  template.content!.appendChild(worksheet);
  template.content!.appendChild(checklist);

  const mount = makeEl("div");
  mount.setAttribute(SKILL_BUILDER_MEMBER_BODY_MOUNT_ATTR, "");
  mount.setAttribute("hidden", "");

  body.appendChild(lock);
  body.appendChild(template);
  body.appendChild(mount);

  const doc = {
    body,
    createElement(tag: string) {
      return makeEl(tag);
    },
    querySelector(sel: string) {
      if (sel === `template[${SKILL_BUILDER_MEMBER_BODY_TEMPLATE_ATTR}]`) return template;
      if (sel === `[${SKILL_BUILDER_MEMBER_BODY_MOUNT_ATTR}]`) return mount;
      if (sel === `[${SKILL_BUILDER_MEMBER_LOCK_ATTR}]`) return lock;
      return queryIn(body.children, sel);
    },
    querySelectorAll(sel: string) {
      return queryAllIn(body.children, sel);
    },
  };

  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", {
    document: doc,
    addEventListener() {},
    dispatchEvent() {
      return true;
    },
    $memberstackDom: undefined,
  });

  return { body, lock, template, mount, doc };
}

function memberPayload(planId: string | null) {
  return {
    data: {
      member: {
        id: "mem_test",
        auth: { email: "test@example.com" },
        planConnections: planId ? [{ planId, status: "ACTIVE", active: true }] : [],
      },
    },
  };
}

afterEach(() => {
  resetSkillBuilderMemberGateBindForTests();
  vi.unstubAllGlobals();
});

describe("Skill Builder membership gate wiring", () => {
  const gate = readComponent("SkillBuilderMemberGate");
  const gateLib = readFileSync(
    join(process.cwd(), "src/lib/skillBuilders/skillBuilderMemberGate.ts"),
    "utf8",
  );

  it("defers protected markup in a template and uses MemberLockOverlay with hasMemberAccess", () => {
    expect(gate).toContain("MemberLockOverlay");
    expect(gate).toContain("data-sb-member-lock");
    expect(gate).toContain('data-gated="locked"');
    expect(gate).toContain("data-sb-member-body-template");
    expect(gate).toContain("data-sb-member-body-mount");
    expect(gate).toContain("bindSkillBuilderMemberGate");
    expect(gateLib).toContain("hasMemberAccess");
    expect(gateLib).toContain("initGatedVimeoEmbeds");
  });

  it("keeps Basics landing and exercise routes public", () => {
    for (const parts of PUBLIC_ROUTES) {
      const source = readPage(...parts);
      expect(source).not.toContain("memberOnly");
      expect(source).not.toContain("SkillBuilderMemberGate");
      expect(source).not.toContain("data-sb-member-lock");
    }
  });

  it("gates every Shaped Shoulders and Shoulder Seams route", () => {
    expect(readPage("round-necklines-shaped-shoulders", "index.astro")).toContain("memberOnly");
    expect(readPage("round-necklines-shaped-shoulders", "[exercise].astro")).toContain("memberOnly");
    expect(readPage("join-beautiful-shoulder-seams.astro")).toContain("JoiningShoulderSeamsSkillBuilder");
    expect(readComponent("JoiningShoulderSeamsSkillBuilder")).toContain("SkillBuilderMemberGate");
    expect(readComponent("RoundNecklineSkillBuilderLanding")).toContain("SkillBuilderMemberGate");
    expect(readComponent("RoundNecklineSkillBuilderExercise")).toContain("SkillBuilderMemberGate");
    expect(GATED_ROUTES).toHaveLength(3);
  });
});

describe("Skill Builder membership gate live DOM", () => {
  it("does not expose worksheet or checklist in the live DOM when logged out", () => {
    const { lock, mount } = installGateDom();

    syncSkillBuilderMemberGate(false);

    expect(lock.hidden).toBe(false);
    expect(skillBuilderMemberBodyIsMounted(mount)).toBe(false);
    expect(mount.childElementCount).toBe(0);
    expect(mount.hidden).toBe(true);
    expect(hasMemberAccess(null)).toBe(false);
  });

  it("mounts protected instructional content for a confirmed member", () => {
    const { lock, mount } = installGateDom();
    const member = memberPayload(MEMBERSHIPS.membership.memberstackPlanId);
    expect(hasMemberAccess(member)).toBe(true);

    syncSkillBuilderMemberGate(true);

    expect(lock.hidden).toBe(true);
    expect(skillBuilderMemberBodyIsMounted(mount)).toBe(true);
    expect(mount.childElementCount).toBe(2);
    expect(mount.hidden).toBe(false);
    expect(mount.querySelector("[data-sb-results]")?.textContent).toBe("Full Practice-Piece Diagram");
    expect(mount.querySelector("[data-sb-checklist]")?.textContent).toBe("Shoulder Seam Checklist");
  });

  it("unmounts protected content again when access is withdrawn", () => {
    const { mount } = installGateDom();
    mountSkillBuilderMemberBody();
    expect(skillBuilderMemberBodyIsMounted(mount)).toBe(true);

    unmountSkillBuilderMemberBody();
    expect(skillBuilderMemberBodyIsMounted(mount)).toBe(false);
    expect(mount.childElementCount).toBe(0);
  });
});
