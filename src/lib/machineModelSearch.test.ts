import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  addMachineModelSearchAliases,
  collapseMachineModels,
  MACHINE_MODEL_PREFIXES,
  prefixesInModelLabels,
} from "./machineModelSearch";

function modelLabels(value: unknown, found: string[] = []): string[] {
  if (!value || typeof value !== "object") return found;
  if ("model" in value && typeof value.model === "string") found.push(value.model);
  for (const child of Object.values(value)) modelLabels(child, found);
  return found;
}

describe("machine model search", () => {
  it("uses the machine library prefixes and no one-letter prefixes", () => {
    const machines = JSON.parse(readFileSync(new URL("../../data/machines.json", import.meta.url), "utf8"));
    expect([...MACHINE_MODEL_PREFIXES]).toEqual(prefixesInModelLabels(modelLabels(machines)));
    expect(MACHINE_MODEL_PREFIXES.some((prefix) => prefix.length < 2)).toBe(false);
  });

  it("joins only a known model prefix to its number", () => {
    expect(collapseMachineModels("LK-150")).toBe("LK150");
    expect(collapseMachineModels("LK 150")).toBe("LK150");
    expect(collapseMachineModels("LK  -  150")).toBe("LK150");
    expect(collapseMachineModels("row 40")).toBe("row 40");
    expect(collapseMachineModels("bind-off")).toBe("bind-off");
    expect(collapseMachineModels("in 2024")).toBe("in 2024");
    expect(collapseMachineModels("fair-isle")).toBe("fair-isle");
    expect(collapseMachineModels("SK150 and LK150")).toBe("SK150 and LK150");
    expect(collapseMachineModels("Passap E 6000")).toBe("Passap E6000");
    expect(collapseMachineModels("E-6000")).toBe("E6000");
    expect(collapseMachineModels("KH 950i")).toBe("KH950i");
    expect(collapseMachineModels("KH-950i")).toBe("KH950i");
    expect(collapseMachineModels("KH 950")).toBe("KH950");
    expect(collapseMachineModels("F 370")).toBe("F370");
    expect(collapseMachineModels("S 9")).toBe("S 9");
    expect(collapseMachineModels("SRP 60N")).toBe("SRP60N");
  });

  it("adds a joined spelling only where a space would split the model", () => {
    const alias = '<span hidden aria-hidden="true" data-machine-model-alias="LK150"> LK150</span>';
    expect(addMachineModelSearchAliases("<p>The LK 150 sponge.</p>")).toBe(`<p>The LK 150${alias} sponge.</p>`);
    expect(addMachineModelSearchAliases("<p>LK-150 and LK\u2013150.</p>")).toBe("<p>LK-150 and LK\u2013150.</p>");
    expect(addMachineModelSearchAliases("<p>bind-off row 40</p>")).toBe("<p>bind-off row 40</p>");
    expect(addMachineModelSearchAliases("<p>SK 150</p>")).toContain("data-machine-model-alias=\"SK150\"> SK150");
    expect(addMachineModelSearchAliases("<p>SK 150</p>")).not.toContain("LK150");
    expect(addMachineModelSearchAliases("<p>Passap E 6000</p>")).toContain(
      'data-machine-model-alias="E6000"> E6000',
    );
    expect(addMachineModelSearchAliases("<p>E-6000</p>")).toBe("<p>E-6000</p>");
    expect(addMachineModelSearchAliases("<p>KH 950i</p>")).toContain(
      'data-machine-model-alias="KH950i"> KH950i',
    );
    expect(addMachineModelSearchAliases("<p>KH 950</p>")).toContain(
      'data-machine-model-alias="KH950"> KH950',
    );
    expect(addMachineModelSearchAliases("<p>KH 950</p>")).not.toContain("KH950i");
    expect(addMachineModelSearchAliases("<p>S 9</p>")).toBe("<p>S 9</p>");

    const spaced = addMachineModelSearchAliases("<p>LK&nbsp;150</p>");
    expect(spaced).toContain(alias);
    expect(addMachineModelSearchAliases(spaced)).toBe(spaced);

    const script = '<script>const name = "LK 150";</script><p>Done</p>';
    expect(addMachineModelSearchAliases(script)).toBe(script);
    expect(addMachineModelSearchAliases("<title>LK 150</title><p>Guide</p>")).toBe("<title>LK 150</title><p>Guide</p>");

    const ignored = '<div data-pagefind-ignore><p>LK 150</p></div><p>SK150</p>';
    const indexed = addMachineModelSearchAliases(ignored);
    expect(indexed.startsWith('<div data-pagefind-ignore><p>LK 150<span hidden')).toBe(true);
    expect(indexed.endsWith("</div><p>SK150</p>")).toBe(true);
  });

  it("rewrites the built HTML before Pagefind indexes it", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      scripts: { build: string };
    };
    const build = pkg.scripts.build;
    expect(build.indexOf("astro build")).toBeLessThan(build.indexOf("addMachineModelSearchAliases"));
    expect(build.indexOf("addMachineModelSearchAliases")).toBeLessThan(build.indexOf("pagefind --site dist"));
  });
});
