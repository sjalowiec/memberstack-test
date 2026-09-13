import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const detailsComponent = readFileSync(
  resolve("src/components/patterns/PatternProjectDetails.astro"),
  "utf8",
);
const onlineNotesComponent = readFileSync(
  resolve("src/components/patterns/PatternProjectOnlineNotes.astro"),
  "utf8",
);
const sleevelessPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderPage = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);
const hatSummaryPage = readFileSync(
  resolve("src/pages/patterns/hat/summary/index.astro"),
  "utf8",
);
const hatPatternPage = readFileSync(resolve("src/pages/patterns/hat/pattern.astro"), "utf8");
const hatSummaryScript = readFileSync(resolve("src/scripts/hat-pattern-summary-page.ts"), "utf8");
const hatPatternScript = readFileSync(resolve("src/scripts/hat-pattern-page.ts"), "utf8");
const sweaterHeaderScript = readFileSync(
  resolve("src/scripts/sleevelessPatternOnlineProjectHeader.ts"),
  "utf8",
);
const sweaterDrawerScript = readFileSync(
  resolve("src/scripts/sleevelessPatternEditDrawerPrototype.ts"),
  "utf8",
);
const socksWorkspace = readFileSync(
  resolve("src/components/patterns/SocksPatternEditWorkspace.astro"),
  "utf8",
);
const socksEditScript = readFileSync(resolve("src/scripts/socks-edit-page.ts"), "utf8");

describe("shared Pattern Project Details Lego block", () => {
  it("owns the Pattern title + Notes markup once", () => {
    expect(detailsComponent).toContain("Pattern title");
    expect(detailsComponent).toContain("Notes");
    expect(detailsComponent).toContain("data-pattern-project-title");
    expect(detailsComponent).toContain("data-pattern-project-notes");
    expect(detailsComponent).toContain("data-sl-notes-field");
    expect(detailsComponent).toContain('id={titleId}');
    expect(detailsComponent).toContain('id={notesId}');
    expect(onlineNotesComponent).toContain("Project notes");
    expect(onlineNotesComponent).toContain("sleeveless-pattern-project-notes");
  });

  it("is used by Sleeveless, Drop Shoulder, Hat, and Socks instead of duplicate implementations", () => {
    expect(sleevelessPage).toContain("PatternProjectDetails");
    expect(dropShoulderPage).toContain("PatternProjectDetails");
    expect(hatSummaryPage).toContain("PatternProjectDetails");
    expect(socksWorkspace).toContain("PatternProjectDetails");
    expect(sleevelessPage).toContain("PatternProjectOnlineNotes");
    expect(dropShoulderPage).toContain("PatternProjectOnlineNotes");
    expect(hatPatternPage).toContain("PatternProjectOnlineNotes");

    expect(sleevelessPage).not.toContain('id="sl-edit-title"');
    expect(dropShoulderPage).not.toContain('id="sl-edit-title"');
    expect(sleevelessPage).not.toContain('id="sl-edit-notes"');
    expect(dropShoulderPage).not.toContain('id="sl-edit-notes"');
    expect(hatSummaryPage).not.toContain("<textarea");
    expect(socksWorkspace).not.toContain("<textarea");
    expect(hatPatternPage).not.toContain("sleeveless-pattern-project-notes__text");
  });

  it("keeps sweater Save Changes wired to the shared title/notes IDs and helper", () => {
    expect(sleevelessPage).toContain('titlePlaceholder="Sleeveless sweater"');
    expect(dropShoulderPage).toContain('titlePlaceholder="Drop shoulder sweater"');
    expect(sweaterDrawerScript).toContain("bindPatternProjectNotesField");
    expect(sweaterDrawerScript).toContain('#sl-edit-title');
    expect(sweaterHeaderScript).toContain("applyPatternProjectOnlineNotes");
  });

  it("wires Hat notes through the same helpers rather than a Hat-only notes system", () => {
    expect(hatSummaryPage).toContain('titleId="hat-edit-title"');
    expect(hatSummaryPage).toContain('notesId="hat-edit-notes"');
    expect(hatSummaryScript).toContain("bindPatternProjectNotesField");
    expect(hatSummaryScript).toContain("applyHatPatternProjectDetailsToDraft");
    expect(hatPatternScript).toContain("applyPatternProjectOnlineNotes");
    expect(hatPatternScript).toContain("HAT_PATTERN_ONLINE_NOTES_SELECTORS");
    expect(hatPatternPage).toContain("data-hat-pattern-online-notes-wrap");
  });

  it("wires Socks name through the same helpers rather than a Socks-only naming system", () => {
    expect(socksWorkspace).toContain('titleId="socks-edit-title"');
    expect(socksWorkspace).toContain('notesId="socks-edit-notes"');
    expect(socksWorkspace).toContain('titlePlaceholder="Socks"');
    expect(socksWorkspace).toContain("data-socks-edit-title");
    expect(socksEditScript).toContain("bindPatternProjectNotesField");
    expect(socksEditScript).toContain("applySockPatternProjectDetailsToDraft");
    expect(socksEditScript).toContain("persistSockPatternProject");
  });
});
