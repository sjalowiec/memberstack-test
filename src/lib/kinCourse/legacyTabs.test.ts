import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { activateLegacyLessonTab, legacyTabTargetId } from "./legacyTabs";

describe("legacy lesson tabs", () => {
  it("reads a Bootstrap tab hash", () => {
    expect(legacyTabTargetId("#section1")).toBe("section1");
    expect(legacyTabTargetId("section1")).toBe("");
    expect(legacyTabTargetId("#")).toBe("");
  });

  it("shows only the chosen pane inside the same lesson block", () => {
    function classList(classes: Set<string>) {
      return {
        contains: (name: string) => classes.has(name),
        toggle(name: string, on: boolean) {
          if (on) classes.add(name);
          else classes.delete(name);
        },
      };
    }
    const panes = [
      { id: "welcome", classes: new Set(["tab-pane", "active"]) },
      { id: "section1", classes: new Set(["tab-pane"]) },
    ].map((pane) => ({ ...pane, classList: classList(pane.classes) }));
    const items = [
      { classes: new Set(["active"]), containsLink: false },
      { classes: new Set<string>(), containsLink: true },
    ].map((item) => ({
      ...item,
      classList: classList(item.classes),
      contains: () => item.containsLink,
    }));
    const tabContent = { querySelectorAll: () => panes };
    const list = { querySelectorAll: () => items };
    const scope = {
      querySelector(selector: string) {
        const id = selector.startsWith("#") ? selector.slice(1) : "";
        return panes.find((item) => item.id === id) ?? null;
      },
    };
    panes.forEach((pane) => {
      Object.assign(pane, { closest: () => tabContent });
    });
    const link = {
      getAttribute: () => "#section1",
      closest(selector: string) {
        if (selector === ".legacy-html" || selector === ".legacy-content") return scope;
        if (selector === ".nav") return list;
        return null;
      },
    };

    expect(activateLegacyLessonTab(link as unknown as HTMLAnchorElement)).toBe(true);
    expect(panes[0]?.classes.has("active")).toBe(false);
    expect(panes[1]?.classes.has("active")).toBe(true);
    expect(items[0]?.classes.has("active")).toBe(false);
    expect(items[1]?.classes.has("active")).toBe(true);
  });

  it("is wired from the lesson player", () => {
    const source = readFileSync(
      resolve("src/components/kinCourse/KinCourseComponents.astro"),
      "utf8",
    );
    expect(source).toContain("bindLegacyLessonTabs");
  });
});
