import { describe, expect, it } from "vitest";

import { cleanLegacyGarmentDescription } from "./legacyGarmentDescription";

const CARNATION_HTML = `Basic <b>DROP SHOULDER</b> Pullover or Cardigan sweater<br> <div style="padding-left:20px">Your choice:<ul> 		<li>Round or V-neck</li> 		<li>Straight or shaped shoulders</li> 		<li>Optional bust darts</li> 	</ul> </div> Use this basic shape as a jumping-off point for your own designs.<br>Add stripes, stitch patterns, intarsia, fairisle ... you name it!<br> Wide range of sizes, you will use this pattern again and again! <br><br> <a data-popupcontentid="13796" class="pathpopup"> <div class="row"> <div class="col-xs-1 text-right"><img style="width:35px;height:48px;" src="/path/images/133/hood_icon.jpg"></div> <div class="col-xs-8"> Optional Hood Builder Included <i class="fa fa-question-circle-o" aria-hidden="true"></i> </div> </div> </a>`;

const ROSE_HTML = `Basic <b>SET IN SLEEVE</b> sweater<br> <div style="padding-left:20px">Your choice:<ul> <li>Pullover or cardigan</li> 		<li>Round or V-neck</li> 		<li>Straight or shaped shoulders</li> 		<li>Optional bust darts</li> 	</ul> </div> Use this basic shape as a jumping-off point for your own designs.`;

describe("cleanLegacyGarmentDescription", () => {
  it("strips HTML to readable plain text", () => {
    const cleaned = cleanLegacyGarmentDescription("<p>Hello <strong>there</strong></p>");
    expect(cleaned).toBe("Hello there");
    expect(cleaned).not.toMatch(/<[^>]+>/);
  });

  it("turns <br> into readable separation", () => {
    expect(cleanLegacyGarmentDescription("First line<br>Second line")).toBe("First line\nSecond line");
    expect(cleanLegacyGarmentDescription("First<br/><br>Second")).toBe("First\n\nSecond");
  });

  it("keeps <li> content readable and separated", () => {
    const cleaned = cleanLegacyGarmentDescription(
      "<ul><li>Round or V-neck</li><li>Straight or shaped shoulders</li></ul>",
    );
    expect(cleaned).toContain("Round or V-neck");
    expect(cleaned).toContain("Straight or shaped shoulders");
    expect(cleaned).not.toContain("Round or V-neckStraight");
    expect(cleaned).toMatch(/Round or V-neck\s+Straight or shaped shoulders/);
  });

  it("keeps <a> text and removes links and attributes", () => {
    const cleaned = cleanLegacyGarmentDescription(
      'See the <a href="/knit/DynamicPattern/1048/carnation-pullover" class="pathpopup">Misses Carnation</a> pattern',
    );
    expect(cleaned).toBe("See the Misses Carnation pattern");
    expect(cleaned).not.toContain("href");
    expect(cleaned).not.toContain("carnation-pullover");
    expect(cleaned).not.toContain("<a");
  });

  it("removes <img> tags", () => {
    const cleaned = cleanLegacyGarmentDescription(
      'Vest with photo <center><img src="http://www.knititnow.com/blog2/blog_images/brian_vest_v1.jpg" alt="Brian"></center>',
    );
    expect(cleaned).toBe("Vest with photo");
    expect(cleaned).not.toContain("img");
    expect(cleaned).not.toContain("brian_vest");
  });

  it("treats empty descriptions as null", () => {
    expect(cleanLegacyGarmentDescription("")).toBeNull();
    expect(cleanLegacyGarmentDescription("   ")).toBeNull();
    expect(cleanLegacyGarmentDescription(null)).toBeNull();
    expect(cleanLegacyGarmentDescription("<p><br></p>")).toBeNull();
  });

  it("cleans Carnation HTML without storing markup", () => {
    const cleaned = cleanLegacyGarmentDescription(CARNATION_HTML);
    expect(cleaned).toBeTruthy();
    expect(cleaned).not.toMatch(/<[^>]+>/);
    expect(cleaned).toContain("DROP SHOULDER");
    expect(cleaned).toContain("Pullover or Cardigan sweater");
    expect(cleaned).toContain("Your choice:");
    expect(cleaned).toContain("Round or V-neck");
    expect(cleaned).toContain("Straight or shaped shoulders");
    expect(cleaned).toContain("Optional bust darts");
    expect(cleaned).toContain("jumping-off point for your own designs");
    expect(cleaned).not.toContain("pathpopup");
    expect(cleaned).not.toContain("hood_icon.jpg");
    expect(cleaned).not.toContain("data-popupcontentid");
  });

  it("cleans Rose HTML without storing markup", () => {
    const cleaned = cleanLegacyGarmentDescription(ROSE_HTML);
    expect(cleaned).toBeTruthy();
    expect(cleaned).not.toMatch(/<[^>]+>/);
    expect(cleaned).toContain("SET IN SLEEVE");
    expect(cleaned).toContain("Pullover or cardigan");
    expect(cleaned).toContain("Round or V-neck");
    expect(cleaned).toContain("Optional bust darts");
  });
});
