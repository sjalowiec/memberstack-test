import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  buildSleevelessFinishingStepIds,
  cardiganFrontEdgeRowsFromDebug,
  coreAssemblyFinishingStepIds,
  sleevelessCardiganFrontEdgeFinishingMode,
  sleevelessFinishingFromPattern,
} from "./sleevelessPatternFinishing";
import {
  buildSleevelessFinishingPrintListHtml,
  buildSleevelessFinishingStepsHtml,
} from "./sleevelessPatternFinishingHtml";
import { isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";

function baseMeasurements() {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
  };
}

function gauge() {
  return {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  };
}

function pulloverPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline: "round", frontStyle: "closed" },
    yarnGaugeMachine: gauge(),
  };
}

function cardiganPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline: "round", frontStyle: "open" },
    yarnGaugeMachine: gauge(),
  };
}

function vNeckCardiganPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline: "v-neck", frontStyle: "open" },
    yarnGaugeMachine: gauge(),
  };
}

function dropShoulderPulloverPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: {
      neckline: "round",
      frontStyle: "closed",
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
    },
    yarnGaugeMachine: gauge(),
  };
}

describe("buildSleevelessFinishingStepIds", () => {
  it("pullover core order: shoulders, armholes, neckline, side seams", () => {
    expect(coreAssemblyFinishingStepIds({ isCardigan: false })).toEqual([
      "joinShoulders",
      "finishArmholes",
      "finishNeckline",
      "joinSideSeams",
    ]);
  });

  it("cardigan core order inserts finishFrontEdges before neckline", () => {
    expect(coreAssemblyFinishingStepIds({ isCardigan: true })).toEqual([
      "joinShoulders",
      "finishArmholes",
      "finishFrontEdges",
      "finishNeckline",
      "joinSideSeams",
    ]);
  });

  it("pullover does not include finishFrontEdges", () => {
    expect(buildSleevelessFinishingStepIds({ isCardigan: false })).not.toContain("finishFrontEdges");
  });

  it("cardigan includes finishFrontEdges", () => {
    expect(buildSleevelessFinishingStepIds({ isCardigan: true })).toContain("finishFrontEdges");
  });

  it("drop-shoulder pullover omits finishArmholes", () => {
    expect(buildSleevelessFinishingStepIds({ isCardigan: false, isDropShoulder: true })).not.toContain(
      "finishArmholes",
    );
    expect(coreAssemblyFinishingStepIds({ isCardigan: false, isDropShoulder: true })).toEqual([
      "joinShoulders",
      "finishNeckline",
      "attachSleeves",
      "joinSideSeams",
    ]);
  });
});

describe("generateSleevelessBackPattern finishing integration", () => {
  it("pullover: no front-edge pickup debug fields", () => {
    const r = generateSleevelessBackPattern(pulloverPattern());
    expect(r.debug.cardiganFrontEdgeRows).toBeUndefined();
    expect(r.debug.cardiganFrontEdgePickupSts).toBeUndefined();
    const finishing = sleevelessFinishingFromPattern(pulloverPattern(), r.debug);
    expect(finishing.isCardigan).toBe(false);
    expect(finishing.steps.some((s) => s.id === "finishFrontEdges")).toBe(false);
  });

  it("cardigan front-edge finishing mode follows neckline", () => {
    expect(sleevelessCardiganFrontEdgeFinishingMode(cardiganPattern())).toBe("pickup");
    expect(sleevelessCardiganFrontEdgeFinishingMode(vNeckCardiganPattern())).toBe("verticalBand");
    expect(sleevelessCardiganFrontEdgeFinishingMode(pulloverPattern())).toBeUndefined();
  });

  it("round-neck cardigan: front-edge row count and pickup stitches from neckline start RC", () => {
    const pattern = cardiganPattern();
    const r = generateSleevelessBackPattern(pattern);
    expect(r.debug.frontNecklineStartRC).toBeGreaterThan(1);
    const expectedRows = cardiganFrontEdgeRowsFromDebug({
      frontNecklineStartRC: r.debug.frontNecklineStartRC,
    });
    expect(r.debug.cardiganFrontEdgeRows).toBe(expectedRows);
    expect(r.debug.cardiganFrontEdgePickupSts).toBeGreaterThan(0);
    const finishing = sleevelessFinishingFromPattern(pattern, r.debug);
    expect(finishing.isCardigan).toBe(true);
    expect(finishing.cardiganFrontEdgeFinishingMode).toBe("pickup");
    expect(finishing.frontEdgePickupSts).toBe(r.debug.cardiganFrontEdgePickupSts);
    const titles = finishing.steps.map((s) => s.title);
    expect(titles).toContain("Finish Front Edges");
    const coreTitles = finishing.steps
      .filter((s) =>
        ["joinShoulders", "finishArmholes", "finishFrontEdges", "finishNeckline", "joinSideSeams"].includes(
          s.id,
        ),
      )
      .map((s) => s.title);
    expect(coreTitles).toEqual([
      "Join Shoulders",
      "Finish Armholes",
      "Finish Front Edges",
      "Finish Neckline",
      "Join Side Seams",
    ]);
  });

  it("v-neck cardigan: debug pickup math unchanged; finishing uses vertical bands", () => {
    const pattern = vNeckCardiganPattern();
    const r = generateSleevelessBackPattern(pattern);
    expect(r.debug.cardiganFrontEdgePickupSts).toBeGreaterThan(0);
    const finishing = sleevelessFinishingFromPattern(pattern, r.debug);
    expect(finishing.isCardigan).toBe(true);
    expect(finishing.cardiganFrontEdgeFinishingMode).toBe("verticalBand");
    expect(finishing.frontEdgePickupSts).toBeUndefined();
    expect(finishing.steps.map((s) => s.id)).toContain("finishFrontEdges");
  });
});

describe("buildSleevelessFinishingStepsHtml", () => {
  const deps = {
    escapeHtml: (s: string) => s,
    glossaryTooltip: (_id: number, term: string) => term,
    neckFinishingVideoKey: "onePieceBand",
    neckFinishingButtonLabel: "One-piece neckband",
    neckFinishingLeadHtml: "",
  };

  it("round-neck cardigan finish front edges includes turning row instructions", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "pickup",
      frontEdgePickupSts: 99,
      deps,
    });
    expect(html).toContain("Knit 1 turning row.");
    expect(html).toContain("Fold the band on the turning row and stitch it down.");
  });

  it("renders numbered steps without duplicate numbers for round-neck cardigan", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "pickup",
      frontEdgePickupSts: 99,
      deps,
    });
    expect(html).toContain("Finish Front Edges");
    expect(html).toContain("Pick up approximately 99 stitches");
    expect(html).not.toMatch(/5\. Finish Neckline[\s\S]*6\. Finish Armholes/);
    const finishFrontMatch = html.match(/(\d+)\. Finish Front Edges/);
    const finishNeckMatch = html.match(/(\d+)\. Finish Neckline/);
    const finishArmMatch = html.match(/(\d+)\. Finish Armholes/);
    expect(finishArmMatch && finishFrontMatch && finishNeckMatch).toBeTruthy();
    expect(Number(finishArmMatch![1])).toBeLessThan(Number(finishFrontMatch![1]));
    expect(Number(finishFrontMatch![1])).toBeLessThan(Number(finishNeckMatch![1]));
  });

  it("v-neck cardigan finish front edges uses vertical band instructions", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "verticalBand",
      deps,
    });
    expect(html).toContain("Finish Front Edges");
    expect(html).toContain("vertical front band");
    expect(html).toContain("Knit the band vertically to match the front edge length");
    expect(html).not.toContain("Pick up approximately");
    expect(html).not.toContain("turning row");
  });

  it("pullover html omits Finish Front Edges", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      deps,
    });
    expect(html).not.toContain("Finish Front Edges");
    expect(html).toMatch(/3\. Finish Armholes/);
    expect(html).toMatch(/4\. Finish Neckline/);
    expect(html).toMatch(/5\. Join Side Seams/);
  });

  it("drop-shoulder pullover html omits Finish Armholes and uses cuff-to-hem side seams", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      isDropShoulder: true,
      deps,
    });
    expect(html).not.toContain("Finish Armholes");
    expect(html).toMatch(/3\. Finish Neckline/);
    expect(html).toMatch(/4\. Attach Sleeves/);
    expect(html).toMatch(/5\. Join Side Seams/);
    expect(html).toContain("Join side seams from cuff to hem.");
    expect(html).not.toContain("Seam from hem to underarm.");
  });

  it("drop-shoulder bottom-up finishing includes bound-off and waste-yarn sleeve attachment", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      isDropShoulder: true,
      dropShoulderSleeveDirection: "cuff-up",
      deps,
    });
    expect(html).toContain("If you bound off the sleeve, sew the sleeve into the armhole.");
    expect(html).toContain("If the sleeve stitches are on waste yarn, attach the sleeve to the armhole as follows:");
    expect(html).not.toContain("picked up stitches from the armhole");
    expect(html).not.toContain("scrap cast-on");
  });

  it("drop-shoulder top-down finishing includes pickup and scrap cast-on sleeve attachment", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      isDropShoulder: true,
      dropShoulderSleeveDirection: "top-down",
      deps,
    });
    expect(html).toContain("If you picked up stitches from the armhole, your sleeve is already attached.");
    expect(html).toContain("If you began the sleeve with a scrap cast-on, attach the sleeve to the armhole as follows:");
    expect(html).not.toContain("bound off the sleeve");
    expect(html).not.toContain("waste yarn");
  });

  it("drop-shoulder pullover finishing from pattern omits armhole step", () => {
    const finishing = sleevelessFinishingFromPattern(dropShoulderPulloverPattern(), {});
    expect(finishing.isDropShoulder).toBe(true);
    expect(finishing.steps.some((s) => s.id === "finishArmholes")).toBe(false);
    expect(finishing.steps.some((s) => s.id === "attachSleeves")).toBe(true);
    expect(finishing.steps.find((s) => s.id === "joinSideSeams")?.stepNumber).toBe(5);
  });

  it("shows only the catalog finishing video that matches the selected neckline", () => {
    const families = [
      { name: "Sleeveless", options: {} },
      { name: "Drop Shoulder", options: { isDropShoulder: true } },
      { name: "Set-in Sleeve", options: { isSetInSleeve: true } },
    ] as const;
    const necklines = [
      {
        neckline: "round",
        href: "/videos/695",
        label: "Round Neck Finishing Instructions",
        otherHref: "/videos/386",
        otherLabel: "V-Neck Finishing Instructions",
        videoKey: "onePieceBand",
        buttonLabel: "One-piece neckband",
      },
      {
        neckline: "v-neck",
        href: "/videos/386",
        label: "V-Neck Finishing Instructions",
        otherHref: "/videos/695",
        otherLabel: "Round Neck Finishing Instructions",
        videoKey: "vNeckBandFinishing",
        buttonLabel: "Optional V-Neck Band Tutorial",
      },
    ] as const;

    for (const family of families) {
      for (const neck of necklines) {
        const pattern = { style: { neckline: neck.neckline } };
        const videoKey = isSleevelessVNeckChoice(pattern) ? "vNeckBandFinishing" : "onePieceBand";
        expect(videoKey, `${family.name} ${neck.neckline}`).toBe(neck.videoKey);

        const html = buildSleevelessFinishingStepsHtml({
          isCardigan: false,
          ...family.options,
          deps: {
            ...deps,
            neckFinishingVideoKey: videoKey,
            neckFinishingButtonLabel: neck.buttonLabel,
          },
        });

        expect(html, `${family.name} ${neck.neckline}`).toContain(
          `data-sleeveless-help-video="${videoKey}"`,
        );
        if (family.name === "Set-in Sleeve") {
          expect(html, `${family.name} ${neck.neckline}`).not.toContain("Need help finishing the neckline?");
          expect(html, `${family.name} ${neck.neckline}`).not.toContain(`href="${neck.href}"`);
          expect(html, `${family.name} ${neck.neckline}`).not.toContain(`href="${neck.otherHref}"`);
          expect(html, `${family.name} ${neck.neckline}`).toContain('href="/videos/580"');
          expect(html, `${family.name} ${neck.neckline}`).toContain("Set In Sleeve Perfection");
          expect(html.match(/\/videos\/580/g), `${family.name} ${neck.neckline}`).toHaveLength(1);
        } else {
          expect(html, `${family.name} ${neck.neckline}`).toContain("Need help finishing the neckline?");
          expect(html, `${family.name} ${neck.neckline}`).toContain(`href="${neck.href}"`);
          expect(html, `${family.name} ${neck.neckline}`).toContain(neck.label);
          expect(html, `${family.name} ${neck.neckline}`).not.toContain(`href="${neck.otherHref}"`);
          expect(html, `${family.name} ${neck.neckline}`).not.toContain(neck.otherLabel);
          expect(html, `${family.name} ${neck.neckline}`).not.toContain("app.knititnow.com");
          expect(html, `${family.name} ${neck.neckline}`).toContain('target="_blank"');
          expect(html, `${family.name} ${neck.neckline}`).not.toContain("/videos/580");
        }
        const printHtml = buildSleevelessFinishingPrintListHtml({
          isCardigan: false,
          ...family.options,
        });
        expect(printHtml, `${family.name} ${neck.neckline} print`).not.toContain("/videos/580");
        expect(printHtml, `${family.name} ${neck.neckline} print`).not.toContain("Need help finishing the neckline?");

        expect(html, `${family.name} ${neck.neckline}`).toContain(neck.buttonLabel);
        expect(html, `${family.name} ${neck.neckline}`).toContain("Work the neckline trim or neckband.");
        expect(html, `${family.name} ${neck.neckline}`).toContain("Finish the neckband as desired.");

        if (family.name === "Drop Shoulder") {
          expect(html, `${family.name} ${neck.neckline}`).not.toContain("seamingPuttingItAllTogether");
        } else {
          expect(html, `${family.name} ${neck.neckline}`).toContain(
            'data-sleeveless-help-video="seamingPuttingItAllTogether"',
          );
          expect(html, `${family.name} ${neck.neckline}`).toContain("Seaming – Putting It All Together");
        }
      }
    }
  });
});

describe("set-in sleeve flat sleeve insertion", () => {
  const deps = {
    escapeHtml: (s: string) => s,
    glossaryTooltip: (_id: number, term: string) => term,
    neckFinishingVideoKey: "onePieceBand",
    neckFinishingButtonLabel: "One-piece neckband",
    neckFinishingLeadHtml: "",
  };
  const flatSleevePhrases = [
    "Lay the front and back flat with the shoulder seams joined and the side seams open.",
    "Match the center of the sleeve cap to the shoulder seam.",
    "Match the sleeve-cap underarm edges to the corresponding armhole underarm edges.",
    "Pin or clip the sleeve cap evenly around the armhole, matching shaping points.",
    "Seam the sleeve cap into the armhole.",
    "Repeat for the second sleeve.",
    "Fold the sweater with right sides together, matching the front and back edges and sleeve underarm edges.",
    "Match any markers placed during knitting.",
    "Starting at the sleeve cuff, seam along the sleeve underarm to the body underarm, then continue down the body side seam to the hem.",
    "Repeat for the other side.",
  ];

  function expectFlatSleeveInsertion(html: string, label: string) {
    for (const phrase of flatSleevePhrases) {
      expect(html, `${label}: ${phrase}`).toContain(phrase);
    }
    expect(html, label).not.toContain("Seam each sleeve.");
    expect(html, label).not.toMatch(/Set the sleeves? into the armhole/i);
    expect(html, label).not.toContain("Match the sleeve underarm seam to the body underarm seam.");
    expect(html, label).not.toContain("Seam from hem to underarm.");
    expect(html, label).toContain('data-sleeveless-help-video="seamingPuttingItAllTogether"');
    expect(html, label).toContain("Linker");
  }

  it("pullover round neck and V-neck use steps 4 and 5 for flat insertion", () => {
    for (const neckFinishingVideoKey of ["onePieceBand", "vNeckBandFinishing"] as const) {
      const html = buildSleevelessFinishingStepsHtml({
        isCardigan: false,
        isSetInSleeve: true,
        deps: { ...deps, neckFinishingVideoKey },
      });
      expectFlatSleeveInsertion(html, neckFinishingVideoKey);
      expect(html).toMatch(/1\. Block Pieces \(Optional\)/);
      expect(html).toMatch(/2\. Join Shoulders/);
      expect(html).toMatch(/3\. Finish Neckline/);
      expect(html).toMatch(/4\. Attach Sleeves/);
      expect(html).toMatch(/5\. Join Side and Sleeve Seams/);
      expect(html).toMatch(/6\. Final Pressing/);
      expect(html).not.toContain("Finish Front Edges");
      expect(html).not.toContain("Finish Armholes");
    }
  });

  it("cardigan round neck and V-neck keep front-edge finishing and insert the sleeves flat", () => {
    for (const mode of ["pickup", "verticalBand"] as const) {
      const html = buildSleevelessFinishingStepsHtml({
        isCardigan: true,
        isSetInSleeve: true,
        cardiganFrontEdgeFinishingMode: mode,
        frontEdgePickupSts: 99,
        deps,
      });
      expectFlatSleeveInsertion(html, mode);
      expect(html).toMatch(/3\. Finish Front Edges/);
      expect(html).toMatch(/4\. Finish Neckline/);
      expect(html).toMatch(/5\. Attach Sleeves/);
      expect(html).toMatch(/6\. Join Side and Sleeve Seams/);
      expect(html).toMatch(/7\. Final Pressing/);
      if (mode === "pickup") expect(html).toContain("Pick up approximately 99 stitches");
      else expect(html).toContain("vertical front band");
    }
  });

  it("prints the flat insertion and leaves drop-shoulder and sleeveless side seams unchanged", () => {
    const setInPrint = buildSleevelessFinishingPrintListHtml({
      isCardigan: false,
      isSetInSleeve: true,
    });
    expect(setInPrint).toContain("4. Attach sleeves: lay the front and back flat");
    expect(setInPrint).toContain("5. Join side and sleeve seams:");
    expect(setInPrint).toContain("side seams open");
    expect(setInPrint).not.toContain("seam each sleeve");

    const sleeveless = buildSleevelessFinishingStepsHtml({ isCardigan: false, deps });
    expect(sleeveless).toMatch(/5\. Join Side Seams/);
    expect(sleeveless).toContain("Seam from hem to underarm.");
    expect(sleeveless).not.toContain("side seams open");

    const dropShoulder = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      isDropShoulder: true,
      deps,
    });
    expect(dropShoulder).toMatch(/5\. Join Side Seams/);
    expect(dropShoulder).toContain("Join side seams from cuff to hem.");
    expect(dropShoulder).not.toContain("side seams open");
  });
});

describe("buildSleevelessFinishingPrintListHtml", () => {
  it("round-neck cardigan print line includes pickup stitch count", () => {
    const html = buildSleevelessFinishingPrintListHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "pickup",
      frontEdgePickupSts: 99,
    });
    expect(html).toContain("pick up 99 stitches");
    expect(html).not.toContain("knit each front band vertically");
  });

  it("v-neck cardigan print line describes vertical bands", () => {
    const html = buildSleevelessFinishingPrintListHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "verticalBand",
    });
    expect(html).toContain("knit each front band vertically");
    expect(html).not.toContain("pick up");
  });

  it("drop-shoulder print list varies attach-sleeves wording by sleeve construction", () => {
    const bottomUp = buildSleevelessFinishingPrintListHtml({
      isCardigan: false,
      isDropShoulder: true,
      dropShoulderSleeveDirection: "cuff-up",
    });
    const topDown = buildSleevelessFinishingPrintListHtml({
      isCardigan: false,
      isDropShoulder: true,
      dropShoulderSleeveDirection: "top-down",
    });
    expect(bottomUp).toContain("if you bound off the sleeve, sew it into the armhole");
    expect(bottomUp).toContain("sleeve stitches are on waste yarn");
    expect(topDown).toContain("picked up stitches from the armhole");
    expect(topDown).toContain("began with a scrap cast-on");
  });
});
