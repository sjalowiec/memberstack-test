import { describe, expect, it } from "vitest";

import {
  buildMembershipHistoryRow,
  formatMembershipHistoryDate,
} from "./membershipHistoryRow";
import type { MembershipHistoryEvent } from "./membershipHistory";

interface FakeElement {
  tagName: string;
  className: string;
  textContent: string | null;
  children: FakeElement[];
  attributes: Record<string, string>;
  appendChild(child: FakeElement): FakeElement;
  setAttribute(name: string, value: string): void;
}

/** Minimal, environment-agnostic DOM stub - no jsdom/happy-dom required. */
function createFakeDocument(): { doc: Document } {
  const doc = {
    createElement(tag: string): FakeElement {
      return {
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
    },
  };
  return { doc: doc as unknown as Document };
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

function classesOf(el: FakeElement): string[] {
  const out: string[] = [];
  const walk = (node: FakeElement) => {
    out.push(node.className);
    node.children.forEach(walk);
  };
  walk(el);
  return out;
}

function textOf(el: FakeElement): string {
  let out = "";
  const walk = (node: FakeElement) => {
    if (node.textContent != null) out += node.textContent;
    node.children.forEach(walk);
  };
  walk(el);
  return out;
}

describe("formatMembershipHistoryDate", () => {
  it("formats YYYY-MM-DD sort keys as MM/DD/YYYY", () => {
    expect(formatMembershipHistoryDate(event({ dateSort: "2026-04-30" }))).toBe("04/30/2026");
    expect(formatMembershipHistoryDate(event({ dateSort: "2026-04-27" }))).toBe("04/27/2026");
    expect(formatMembershipHistoryDate(event({ dateSort: "2025-03-15" }))).toBe("03/15/2025");
  });
});

describe("buildMembershipHistoryRow", () => {
  it("renders a true two-column row: MM/DD/YYYY date in its own <time>, then a content column", () => {
    const { doc } = createFakeDocument();
    const row = buildMembershipHistoryRow(
      doc,
      event({ type: "renewed", title: "Monthly Membership Renewed", dateSort: "2026-04-30" }),
    ) as unknown as FakeElement;

    expect(row.tagName).toBe("LI");
    expect(row.className).toBe("membership-history-row");

    // Column 1: the date, as a <time> element with MM/DD/YYYY text + datetime.
    const time = row.children[0];
    expect(time.tagName).toBe("TIME");
    expect(time.className).toBe("membership-history-date");
    expect(time.textContent).toBe("04/30/2026");
    expect(time.attributes.datetime).toBe("2026-04-30");

    // Column 2: a single content container holding the label.
    const content = row.children[1];
    expect(content.tagName).toBe("DIV");
    expect(content.className).toBe("membership-history-content");
    const label = content.children[0];
    expect(label.tagName).toBe("SPAN");
    expect(label.className).toBe("membership-history-label");
    expect(label.textContent).toBe("Monthly Membership Renewed");

    // Exactly two top-level columns; nothing runs full-width.
    expect(row.children).toHaveLength(2);
  });

  it("groups the description inside the content column, not as a full-width row sibling", () => {
    const { doc } = createFakeDocument();
    const row = buildMembershipHistoryRow(
      doc,
      event({ description: "Your Knit it Now account moved to our new platform." }),
    ) as unknown as FakeElement;

    // The <li> still has only the two columns (date + content).
    expect(row.children).toHaveLength(2);
    expect(row.children.map((c) => c.tagName)).toEqual(["TIME", "DIV"]);

    const content = row.children[1];
    // Label + description both live in the second column.
    expect(content.children.map((c) => c.className)).toEqual([
      "membership-history-label",
      "membership-history-description",
    ]);
    const description = content.children[1];
    expect(description.tagName).toBe("P");
    expect(description.textContent).toBe(
      "Your Knit it Now account moved to our new platform.",
    );

    // The description must NOT be a direct child of the row (no full-width sibling).
    expect(row.children.some((c) => c.className === "membership-history-description")).toBe(
      false,
    );
  });

  it("no longer emits timeline connector or checkmark markup", () => {
    const { doc } = createFakeDocument();
    const row = buildMembershipHistoryRow(
      doc,
      event({ description: "Your Knit it Now account moved to our new platform." }),
    ) as unknown as FakeElement;

    const classes = classesOf(row);
    expect(classes.some((c) => c.includes("marker"))).toBe(false);
    expect(classes).not.toContain("account-membership-panel__event-title");
    expect(textOf(row)).not.toContain("\u2713");
  });
});
