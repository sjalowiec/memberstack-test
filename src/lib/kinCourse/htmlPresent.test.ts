import { describe, expect, it } from "vitest";
import {
  applyKinCourseSrcRewrites,
  applyLegacyGlossaryHrefRewrites,
  presentKinCourseHtml,
  readKinCourseGlossary,
  restoreLegacyBootstrapThumbnailGrid,
} from "./htmlPresent";
import { buildKinCourseLanding, readKinCoursePresentation } from "./presentation";

describe("Course 111 DEV asset presentation", () => {
  const presentation = readKinCoursePresentation(111);

  it("uses the same SK840 catalog image as /courses, not a production /challenge/ path", () => {
    const landing = buildKinCourseLanding({
      id: 111,
      title: "Mastering the Silver Reed SK840: A Comprehensive Course",
      slug: "mastering-the-silver-reed-sk840-a-comprehensive-course",
      thumbnail: "/images/courses/2022-course_thumbnail.webp",
      sections: [],
    });
    expect(landing.image.src).toBe("/images/courses/mastering-silver-reed-sk840.png");
    expect(landing.image.src).not.toContain("/challenge/");
  });

  it("rewrites leftover /challenge/images/v2/111/ URLs onto local course-content copies", () => {
    const html = presentKinCourseHtml(
      '<img src="/challenge/images/v2/111/learn_dak_logos.png"><span data-image="/challenge/images/v2/111/sensor.jpg"></span>',
      6104,
      presentation,
    );
    expect(html).toContain("/images/course-content/111/learn_dak_logos.png");
    expect(html).toContain('data-image="/images/course-content/111/sensor.jpg"');
    expect(html).not.toContain("/challenge/images/v2/111/");
  });

  it("does not require ?preview=true to select those rewrites", () => {
    expect(
      applyKinCourseSrcRewrites("/challenge/images/v2/111/cast_on_checklist.jpg", presentation),
    ).toBe("/images/course-content/111/cast_on_checklist.jpg");
  });
});

describe("restoreLegacyBootstrapThumbnailGrid", () => {
  const manualsHtml = `
12345678
<div class="text-center"><a href="/images/course-content/111/sk840_knitting_manual.pdf" target="_blank"><img class="img-thumbnail" src="/images/course-content/111/manual_thumb.jpg"><br><i class="fa fa-download" aria-hidden="true"></i> Knitting Manual</a></div>
	<div class="text-center"><a href="/images/course-content/111/sk840_operation_manual.pdf" target="_blank"><img class="img-thumbnail" src="/images/course-content/111/operation_manual_thumb.jpg"> <br><i class="fa fa-download" aria-hidden="true"></i> Operation Manual</a></div>
	<div class="text-center"><a href="/images/course-content/111/pattern.pdf" target="_blank"><img class="img-thumbnail" src="/images/course-content/111/pattern_thumb.jpg"> <br><i class="fa fa-download" aria-hidden="true"></i> Stitch patterns</a></div>



<br>
	<div class="text-center">
<a target="_blank" href="/images/course-content/111/rj1_ribber_carriage.pdf"> <img class="img-thumbnail" src="/images/course-content/111/rj1 ribber_manual1.jpg"><br><i class="fa fa-download" aria-hidden="true"></i> RJ1 Ribber Manual</a></div>`;

  it("restores production row/col-sm-2 wrappers around consecutive thumbnail cards", () => {
    const html = restoreLegacyBootstrapThumbnailGrid(manualsHtml);
    expect(html).toContain("12345678");
    expect(html.match(/<div class="row">/g)?.length).toBe(2);
    expect(html.match(/col-sm-2 col-xs-12/g)?.length).toBe(4);
    expect(html).toContain("Knitting Manual");
    expect(html).toContain("RJ1 Ribber Manual");
  });

  it("leaves production HTML that already has col-sm-2 alone", () => {
    const production = `<div class="row"><div class="col-sm-2 col-xs-12 text-center "><a href="/x.pdf"><img class="img-thumbnail" src="/x.jpg"><br>Manual</a></div></div>`;
    expect(restoreLegacyBootstrapThumbnailGrid(production)).toBe(production);
  });

  it("does not wrap a standalone img-thumbnail that is not a text-center card", () => {
    const html = '<img class="img-thumbnail" src="/images/course-content/111/russel-levers-silver-sk840-knitting-machine.gif">';
    expect(restoreLegacyBootstrapThumbnailGrid(html)).toBe(html);
  });

  it("runs during presentKinCourseHtml so the player uses the restored grid", () => {
    const html = presentKinCourseHtml(manualsHtml, 6085);
    expect(html).toContain('class="row"');
    expect(html).toContain("col-sm-2");
  });
});

describe("legacy glossary href adapter", () => {
  const glossary = readKinCourseGlossary(111);
  const presentation = readKinCoursePresentation(111);

  it("rewrites production /glossary/{id}/{slug}/term hrefs onto the in-player modal", () => {
    const html = presentKinCourseHtml(
      '<a href="/glossary/283/cast-on-comb/term">Cast on comb</a>',
      6088,
      presentation,
      glossary,
    );
    expect(html).toContain('href="#glossary-283"');
    expect(html).toContain('data-GlossaryId="283"');
    expect(html).toContain("glossaryhelp");
    expect(html).not.toContain("/glossary/283/cast-on-comb/term");
  });

  it("rewrites absolute knititnow.com glossary term URLs the same way", () => {
    const html = presentKinCourseHtml(
      '<a href="https://www.knititnow.com/glossary/249/ravel-cord/term">Ravel Cord</a>',
      6088,
      presentation,
      glossary,
    );
    expect(html).toContain('href="#glossary-249"');
    expect(html).not.toContain("https://www.knititnow.com/glossary/249/ravel-cord/term");
  });

  it("falls back to /glossary/{slug}/ when the legacy id is not in the course catalog", () => {
    const html = applyLegacyGlossaryHrefRewrites(
      '<a href="/glossary/999/some-term/term">Unknown</a>',
      glossary,
    );
    expect(html).toContain('href="/glossary/some-term/"');
    expect(html).not.toContain("/glossary/999/some-term/term");
  });

  it("leaves current-site glossary slug hrefs and glossaryhelp data-GlossaryId links alone", () => {
    const current = presentKinCourseHtml(
      '<a href="/glossary/gauge/">Gauge</a>',
      6098,
      presentation,
      glossary,
    );
    expect(current).toContain('href="/glossary/gauge/"');

    const help = presentKinCourseHtml(
      '<a data-GlossaryId="662" class="glossaryhelp">Gauge Ruler</a>',
      6097,
      presentation,
      glossary,
    );
    expect(help).toContain('href="#glossary-662"');
    expect(help).toContain('data-GlossaryId="662"');
  });
});
