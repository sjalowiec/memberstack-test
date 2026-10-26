/**
 * Christmas Stocking “Make it your own” copy.
 * Shared by the landing page and both generated instruction directions.
 * Basic Socks does not use this module.
 *
 * Knitter’s Graph Paper is the free tool at /tools/graph-paper
 * (data/tools.json, membersonly: false). /stitch is the Stitch Browser.
 */

import type { PatternBuilderLandingMakeItYourOwn } from "../patternBuilderLanding";

/** Free Knitters Graph Paper tool. Not the Stitch Browser. */
export const CHRISTMAS_STOCKING_GRAPH_PAPER_HREF = "/tools/graph-paper";
export const CHRISTMAS_STOCKING_GRAPH_PAPER_LABEL = "Knitter’s Graph Paper Tool";

/** Main Stitch Browser (`src/pages/stitch/index.astro`, header nav). */
export const CHRISTMAS_STOCKING_STITCH_BROWSER_HREF = "/stitch";
export const CHRISTMAS_STOCKING_STITCH_BROWSER_LABEL = "Stitch Browser";

export const CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN_HEADING = "Make it your own";

const CHRISTMAS_MOTIF_TEXT = "Christmas 1, Christmas 2, and Christmas 3";

export const CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN: PatternBuilderLandingMakeItYourOwn = {
  heading: CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN_HEADING,
  paragraphs: [
    {
      lead: "Plan your stocking design with the free ",
      link: {
        href: CHRISTMAS_STOCKING_GRAPH_PAPER_HREF,
        label: CHRISTMAS_STOCKING_GRAPH_PAPER_LABEL,
      },
      tail: ". Enter your stitch and row gauge to create graph paper that matches your knitting.",
    },
    {
      lead: `Looking for Christmas motifs? Members can explore ${CHRISTMAS_MOTIF_TEXT} in the `,
      link: {
        href: CHRISTMAS_STOCKING_STITCH_BROWSER_HREF,
        label: CHRISTMAS_STOCKING_STITCH_BROWSER_LABEL,
      },
      tail: ".",
    },
  ],
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Instruction-page block. Uses the existing sock section card so page CSS applies. */
export function christmasStockingMakeItYourOwnHtml(): string {
  const paragraphs = CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN.paragraphs
    .map((paragraph) => {
      const link = paragraph.link
        ? `<a href="${escapeHtml(paragraph.link.href)}">${escapeHtml(paragraph.link.label)}</a>`
        : "";
      return `<p>${escapeHtml(paragraph.lead)}${link}${escapeHtml(paragraph.tail ?? "")}</p>`;
    })
    .join("");
  return (
    `<section class="sock-pattern-section christmas-stocking-make-it-your-own" data-christmas-stocking-make-it-your-own>` +
    `<div class="sock-pattern-section__header">` +
    `<div class="sock-pattern-section__heading"><h4>${escapeHtml(CHRISTMAS_STOCKING_MAKE_IT_YOUR_OWN_HEADING)}</h4></div>` +
    `</div>` +
    `<div class="sock-pattern-section__content">${paragraphs}</div>` +
    `</section>`
  );
}
