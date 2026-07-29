import { describe, expect, it } from "vitest";

import { buildMembershipHistoryRow } from "./membershipHistoryRow";
import type { MembershipHistoryEvent } from "./membershipHistory";

interface FakeElement {
  tagName: string;
  className: string;
  textContent: string | null;
  children: FakeElement[];
  appendChild(child: FakeElement): FakeElement;
  setAttribute(name: string, value: string): void;
  attributes: Record<string, string>;
}

/** Minimal, environment-agnostic DOM stub - no jsdom/happy-dom required. */
function createFakeDocument(): { doc: Document; created: FakeElement[] } {
  const created: FakeElement[] = [];
  const doc = {
    createElement(tag: string): FakeElement {
      const el: FakeElement = {
        tagName: tag.toUpperCase(),
        className: "",
        textContent: null,
        children: [],
        attributes: {},
        appendChild(child: FakeElement) {
          this.children.push(child);
          return child;
        },
        setAttribute(name: string, value: string) {
          this.attributes[name] = value;
        },
      };
      created.push(el);
      return el;
    },
  };
  return { doc: doc as unknown as Document, created };
}

function event(overrides: Partial<MembershipHistoryEvent>): MembershipHistoryEvent {
  return {
    type: "migrated",
    title: "Migrated to the new Knit it Now",
    date: "April 27, 2026",
    dateSort: "2026-04-27",
    ...overrides,
  };
}

function allText(el: FakeElement): string[] {
  const out: string[] = [];
  const walk = (node: FakeElement) => {
    if (node.textContent != null) out.push(node.textContent);
    node.children.forEach(walk);
  };
  walk(el);
  return out;
}

function allClasses(el: FakeElement): string[] {
  const out: string[] = [];
  const walk = (node: FakeElement) => {
    out.push(node.className);
    node.children.forEach(walk);
  };
  walk(el);
  return out;
}

describe("buildMembershipHistoryRow", () => {
  it("renders a compact row: date first, label second", () => {
    const { doc } = createFakeDocument();
    const row = buildMembershipHistoryRow(
      doc,
      event({ type: "renewed", title: "Monthly Membership Renewed", date: "April 30, 2026" }),
    ) as unknown as FakeElement;

    expect(row.tagName).toBe("LI");
    expect(row.className).toBe("account-membership-panel__event");
    expect(row.children).toHaveLength(2);

    const [date, label] = row.children;
    expect(date.className).toBe("account-membership-panel__event-date");
    expect(date.textContent).toBe("April 30, 2026");
    expect(label.className).toBe("account-membership-panel__event-label");
    expect(label.textContent).toBe("Monthly Membership Renewed");
  });

  it("renders secondary detail directly below the label", () => {
    const { doc } = createFakeDocument();
    const row = buildMembershipHistoryRow(
      doc,
      event({ description: "Your Knit it Now account moved to our new platform." }),
    ) as unknown as FakeElement;

    expect(row.children).toHaveLength(3);
    const description = row.children[2];
    expect(description.tagName).toBe("P");
    expect(description.className).toBe("account-membership-panel__event-description");
    expect(description.textContent).toBe(
      "Your Knit it Now account moved to our new platform.",
    );
  });

  it("no longer emits timeline connector or checkmark markup", () => {
    const { doc } = createFakeDocument();
    const row = buildMembershipHistoryRow(
      doc,
      event({ description: "Your Knit it Now account moved to our new platform." }),
    ) as unknown as FakeElement;

    const classes = allClasses(row);
    // Old timeline/checkmark markup is gone.
    expect(classes).not.toContain("account-membership-panel__event-marker");
    expect(classes).not.toContain("account-membership-panel__event-title");
    expect(classes.some((c) => c.includes("marker"))).toBe(false);

    // No checkmark glyph anywhere in the row text.
    expect(allText(row).join("")).not.toContain("\u2713");
  });
});
