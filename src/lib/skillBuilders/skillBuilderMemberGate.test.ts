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
  SKILL_BUILDER_MEMBER_LOCKED_ATTR,
  SKILL_BUILDER_MEMBER_LOCK_TITLE,
  SKILL_BUILDER_MEMBER_PENDING_ATTR,
  SKILL_BUILDER_MEMBER_PENDING_COPY,
  applySkillBuilderMemberGatePaint,
  bindSkillBuilderMemberGate,
  decideSkillBuilderMemberGatePaint,
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
  ["e-wrap-cast-on-basics.astro"],
  ["short-rows.astro"],
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
    classList: {
      contains() {
        return false;
      },
    },
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

function installGateDom(options?: {
  snapshot?: { hasMemberAccess: boolean; viewerAccessState: string } | null;
}) {
  const body = makeEl("body");
  const lock = makeEl("div");
  lock.setAttribute(SKILL_BUILDER_MEMBER_LOCK_ATTR, "");
  lock.setAttribute("data-gated", "pending");
  lock.setAttribute("data-gate-pending", "");

  const pending = makeEl("p");
  pending.setAttribute(SKILL_BUILDER_MEMBER_PENDING_ATTR, "");
  pending.setAttribute("role", "status");
  pending.textContent = SKILL_BUILDER_MEMBER_PENDING_COPY;

  const lockedCard = makeEl("div");
  lockedCard.setAttribute(SKILL_BUILDER_MEMBER_LOCKED_ATTR, "");
  lockedCard.setAttribute("hidden", "");
  const overlayTitle = makeEl("h2");
  overlayTitle.textContent = SKILL_BUILDER_MEMBER_LOCK_TITLE;
  lockedCard.appendChild(overlayTitle);

  lock.appendChild(pending);
  lock.appendChild(lockedCard);

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
      if (sel === `[${SKILL_BUILDER_MEMBER_PENDING_ATTR}]`) return pending;
      if (sel === `[${SKILL_BUILDER_MEMBER_LOCKED_ATTR}]`) return lockedCard;
      return queryIn(body.children, sel);
    },
    querySelectorAll(sel: string) {
      return queryAllIn(body.children, sel);
    },
  };

  const host = new EventTarget();
  const fakeWindow = Object.assign(host, {
    document: doc,
    __KIN_MEMBER_ACCESS__: options && "snapshot" in options ? options.snapshot : null,
    $memberstackDom: {
      getCurrentMember: vi.fn().mockResolvedValue({ data: null }),
    },
  });

  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", fakeWindow);

  return { body, lock, pending, lockedCard, template, mount, doc, fakeWindow };
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

  it("defers protected markup and keeps the non-member card hidden until auth resolves", () => {
    expect(gate).toContain("MemberLockOverlay");
    expect(gate).toContain("data-sb-member-lock");
    expect(gate).toContain('data-gated="pending"');
    expect(gate).toContain("data-gate-pending");
    expect(gate).toContain("data-sb-member-pending");
    expect(gate).toContain('data-sb-member-locked hidden');
    expect(gate).toContain('aria-hidden="true"');
    expect(gate).toContain("SKILL_BUILDER_MEMBER_PENDING_COPY");
    expect(gate).toContain("data-sb-member-body-template");
    expect(gate).toContain("data-sb-member-body-mount");
    expect(gate).toContain("bindSkillBuilderMemberGate");
    expect(gateLib).toContain("decideSkillBuilderMemberGatePaint");
    expect(gateLib).toContain("kin:member-access");
    expect(gateLib).toContain("__KIN_MEMBER_ACCESS__");
    expect(gateLib).not.toContain("getCurrentMember");
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

  it("gates every Shaped Shoulders, Shoulder Seams, E-Wrap Cast On, and Short Rows route", () => {
    expect(readPage("round-necklines-shaped-shoulders", "index.astro")).toContain("memberOnly");
    expect(readPage("round-necklines-shaped-shoulders", "[exercise].astro")).toContain("memberOnly");
    expect(readPage("join-beautiful-shoulder-seams.astro")).toContain("JoiningShoulderSeamsSkillBuilder");
    expect(readPage("e-wrap-cast-on-basics.astro")).toContain("EWrapCastOnSkillBuilder");
    expect(readPage("short-rows.astro")).toContain("ShortRowsSkillBuilder");
    expect(readComponent("JoiningShoulderSeamsSkillBuilder")).toContain("SkillBuilderMemberGate");
    expect(readComponent("EWrapCastOnSkillBuilder")).toContain("SkillBuilderMemberGate");
    expect(readComponent("ShortRowsSkillBuilder")).toContain("SkillBuilderMemberGate");
    expect(readComponent("RoundNecklineSkillBuilderLanding")).toContain("SkillBuilderMemberGate");
    expect(readComponent("RoundNecklineSkillBuilderExercise")).toContain("memberOnly={memberOnly}");
    expect(readComponent("RoundNecklineSkillBuilderExercise")).toContain(
      "RoundNecklineSkillBuilderLanding",
    );
    expect(GATED_ROUTES).toHaveLength(5);
  });
});

describe("Skill Builder membership gate live DOM", () => {
  it("does not expose worksheet or checklist in the live DOM when logged out", () => {
    const { lock, lockedCard, pending, mount } = installGateDom();

    syncSkillBuilderMemberGate(false);

    expect(lock.hidden).toBe(false);
    expect(lockedCard.hidden).toBe(false);
    expect(pending.hidden).toBe(true);
    expect(skillBuilderMemberBodyIsMounted(mount)).toBe(false);
    expect(mount.childElementCount).toBe(0);
    expect(mount.hidden).toBe(true);
    expect(hasMemberAccess(null)).toBe(false);
  });

  it("mounts protected instructional content for a confirmed member", () => {
    const { lock, lockedCard, mount } = installGateDom();
    const member = memberPayload(MEMBERSHIPS.membership.memberstackPlanId);
    expect(hasMemberAccess(member)).toBe(true);

    syncSkillBuilderMemberGate(true);

    expect(lock.hidden).toBe(true);
    expect(lockedCard.hidden).toBe(true);
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

describe("decideSkillBuilderMemberGatePaint", () => {
  it("keeps unresolved auth pending instead of claiming a non-member", () => {
    expect(decideSkillBuilderMemberGatePaint({})).toBe("pending");
    expect(decideSkillBuilderMemberGatePaint({ snapshot: null })).toBe("pending");
    expect(decideSkillBuilderMemberGatePaint({ snapshot: {} })).toBe("pending");
  });

  it("unlocks a confirmed member snapshot", () => {
    expect(
      decideSkillBuilderMemberGatePaint({
        snapshot: { hasMemberAccess: true, viewerAccessState: "memberAccess" },
      }),
    ).toBe("member");
  });

  it("locks a confirmed logged-out visitor", () => {
    expect(
      decideSkillBuilderMemberGatePaint({
        snapshot: { hasMemberAccess: false, viewerAccessState: "loggedOut" },
      }),
    ).toBe("locked");
  });

  it("locks a logged-in visitor without membership access", () => {
    expect(
      decideSkillBuilderMemberGatePaint({
        snapshot: { hasMemberAccess: false, viewerAccessState: "loggedInNoAccess" },
      }),
    ).toBe("locked");
  });

  it("does not re-lock confirmed member content on a later empty snapshot", () => {
    expect(
      decideSkillBuilderMemberGatePaint({
        confirmedMember: true,
        snapshot: null,
      }),
    ).toBe("member");
    expect(
      decideSkillBuilderMemberGatePaint({
        confirmedMember: true,
        snapshot: {},
      }),
    ).toBe("member");
  });
});

describe("Skill Builder membership gate pending vs confirmed paints", () => {
  it("does not render the non-member membership card while auth is unresolved", () => {
    const { lock, pending, lockedCard, mount } = installGateDom();

    applySkillBuilderMemberGatePaint("pending");

    expect(lock.hidden).toBe(false);
    expect(lock.getAttribute("data-gated")).toBe("pending");
    expect(pending.hidden).toBe(false);
    expect(pending.textContent).toBe(SKILL_BUILDER_MEMBER_PENDING_COPY);
    expect(lockedCard.hidden).toBe(true);
    expect(lockedCard.getAttribute("aria-hidden")).toBe("true");
    expect(skillBuilderMemberBodyIsMounted(mount)).toBe(false);
  });

  it("shows the membership card for a confirmed logged-out visitor", () => {
    const { pending, lockedCard } = installGateDom();

    applySkillBuilderMemberGatePaint("locked");

    expect(pending.hidden).toBe(true);
    expect(lockedCard.hidden).toBe(false);
    expect(lockedCard.getAttribute("aria-hidden")).toBe("false");
    expect(lockedCard.querySelector("h2")?.textContent).toBe(SKILL_BUILDER_MEMBER_LOCK_TITLE);
  });

  it("shows the membership card for a logged-in visitor without access", () => {
    const { pending, lockedCard, mount } = installGateDom();

    applySkillBuilderMemberGatePaint(
      decideSkillBuilderMemberGatePaint({
        snapshot: { hasMemberAccess: false, viewerAccessState: "loggedInNoAccess" },
      }),
    );

    expect(pending.hidden).toBe(true);
    expect(lockedCard.hidden).toBe(false);
    expect(skillBuilderMemberBodyIsMounted(mount)).toBe(false);
  });
});

describe("Skill Builder membership gate shared-auth events", () => {
  it("goes pending → member without ever showing the non-member card", () => {
    const { fakeWindow, pending, lockedCard, mount } = installGateDom();
    const paints: Array<{ lockedVisible: boolean; pendingVisible: boolean; memberMounted: boolean }> =
      [];

    bindSkillBuilderMemberGate();
    paints.push({
      lockedVisible: !lockedCard.hidden,
      pendingVisible: !pending.hidden,
      memberMounted: skillBuilderMemberBodyIsMounted(mount),
    });

    fakeWindow.dispatchEvent(
      new CustomEvent("kin:member-access", {
        detail: { hasMemberAccess: true, viewerAccessState: "memberAccess" },
      }),
    );
    paints.push({
      lockedVisible: !lockedCard.hidden,
      pendingVisible: !pending.hidden,
      memberMounted: skillBuilderMemberBodyIsMounted(mount),
    });

    expect(paints[0]).toEqual({
      lockedVisible: false,
      pendingVisible: true,
      memberMounted: false,
    });
    expect(paints[1]).toEqual({
      lockedVisible: false,
      pendingVisible: false,
      memberMounted: true,
    });
    expect(paints.some((paint) => paint.lockedVisible)).toBe(false);
  });

  it("does not re-lock confirmed member content on a later empty auth:updated", () => {
    const { fakeWindow, lockedCard, mount } = installGateDom({
      snapshot: { hasMemberAccess: true, viewerAccessState: "memberAccess" },
    });

    bindSkillBuilderMemberGate();
    expect(skillBuilderMemberBodyIsMounted(mount)).toBe(true);
    expect(lockedCard.hidden).toBe(true);

    fakeWindow.__KIN_MEMBER_ACCESS__ = null;
    fakeWindow.dispatchEvent(new Event("auth:updated"));

    expect(skillBuilderMemberBodyIsMounted(mount)).toBe(true);
    expect(lockedCard.hidden).toBe(true);
    expect(fakeWindow.$memberstackDom.getCurrentMember).not.toHaveBeenCalled();
  });

  it("uses the shared SkillBuilderMemberGate on every member-only practice page", () => {
    expect(readComponent("JoiningShoulderSeamsSkillBuilder")).toContain("SkillBuilderMemberGate");
    expect(readComponent("EWrapCastOnSkillBuilder")).toContain("SkillBuilderMemberGate");
    expect(readComponent("ShortRowsSkillBuilder")).toContain("SkillBuilderMemberGate");
    expect(readComponent("RoundNecklineSkillBuilderLanding")).toContain("SkillBuilderMemberGate");
    expect(readComponent("RoundNecklineSkillBuilderLanding")).toContain("memberOnly");
  });
});
