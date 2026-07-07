import { describe, expect, it } from "vitest";
import {
  buildHelpHubFaqPage,
  buildHelpHubFaqPairs,
  serializeJsonLd,
  stripHtmlToText,
  type HelpHubFaqSource,
} from "./helpHubFaqSchema";

describe("stripHtmlToText", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtmlToText("<p>Hello   <strong>there</strong></p>")).toBe("Hello there");
  });

  it("decodes common entities", () => {
    expect(stripHtmlToText("Yarn &amp; needles &lt; 10 &#39;fine&#39;")).toBe(
      "Yarn & needles < 10 'fine'",
    );
  });

  it("neutralises embedded script blocks", () => {
    expect(stripHtmlToText("Safe<script>alert(1)</script> text")).toBe("Safe text");
  });

  it("returns empty string for non-string input", () => {
    expect(stripHtmlToText(undefined)).toBe("");
    expect(stripHtmlToText(42)).toBe("");
  });
});

describe("buildHelpHubFaqPairs", () => {
  it("keeps only question-shaped headings with real answers", () => {
    const source: HelpHubFaqSource = {
      question: "How do I choose the right knitting machine?",
      bubbleAnswer: "<p>There isn't one best machine.</p>",
      aboutTitle: "Why This Works", // statement, not a question -> excluded
      solutionText: "Some explanation.",
      tryThisTitle: "Try This", // statement -> excluded
      trySteps: ["Step one", "Step two"],
    };
    const pairs = buildHelpHubFaqPairs(source);
    expect(pairs).toEqual([
      {
        question: "How do I choose the right knitting machine?",
        answer: "There isn't one best machine.",
      },
    ]);
  });

  it("includes a second pair when the about heading is genuinely a question", () => {
    const source: HelpHubFaqSource = {
      question: "Do I need a ribber?",
      bubbleAnswer: "Not always.",
      aboutTitle: "What does a ribber actually do?",
      bridge: "<p>It knits the reverse stitches for you.</p>",
    };
    const pairs = buildHelpHubFaqPairs(source);
    expect(pairs).toHaveLength(2);
    expect(pairs[1]).toEqual({
      question: "What does a ribber actually do?",
      answer: "It knits the reverse stitches for you.",
    });
  });

  it("uses trySteps as the answer when the try heading is a question", () => {
    const source: HelpHubFaqSource = {
      question: "Why is my carriage jammed?",
      bubbleAnswer: "Usually a stuck needle.",
      tryThis: { quickActionTitle: "How do I free a stuck carriage?" },
      trySteps: ["Release the needles", "Re-seat the carriage", "..."],
    };
    const pairs = buildHelpHubFaqPairs(source);
    expect(pairs).toHaveLength(2);
    expect(pairs[1]).toEqual({
      question: "How do I free a stuck carriage?",
      answer: "Release the needles Re-seat the carriage",
    });
  });

  it("deduplicates repeated questions and skips empty answers", () => {
    const source: HelpHubFaqSource = {
      question: "Same question?",
      bubbleAnswer: "First answer.",
      aboutTitle: "Same question?",
      solutionText: "Second answer.",
      tryThisTitle: "Unanswered question?",
      trySteps: [],
    };
    const pairs = buildHelpHubFaqPairs(source);
    expect(pairs).toEqual([{ question: "Same question?", answer: "First answer." }]);
  });
});

describe("buildHelpHubFaqPage", () => {
  it("returns null with fewer than 2 valid Q&A items (single-question tip)", () => {
    const source: HelpHubFaqSource = {
      question: "How do I choose the right knitting machine?",
      bubbleAnswer: "There isn't one best machine.",
      aboutTitle: "Why This Works",
      solutionText: "Explanation.",
    };
    expect(buildHelpHubFaqPage(source)).toBeNull();
  });

  it("builds a FAQPage with at least 2 valid Q&A items", () => {
    const source: HelpHubFaqSource = {
      question: "Do I need a ribber?",
      bubbleAnswer: "Not always.",
      aboutTitle: "What does a ribber actually do?",
      bridge: "It knits the reverse stitches for you.",
    };
    expect(buildHelpHubFaqPage(source)).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Do I need a ribber?",
          acceptedAnswer: { "@type": "Answer", text: "Not always." },
        },
        {
          "@type": "Question",
          name: "What does a ribber actually do?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It knits the reverse stitches for you.",
          },
        },
      ],
    });
  });
});

describe("serializeJsonLd", () => {
  it("escapes characters that could break out of a script tag", () => {
    const out = serializeJsonLd({ text: "</script><b>x</b> & more" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
    expect(out).toContain("\\u003e");
    expect(out).toContain("\\u0026");
    // Still valid JSON once parsed back.
    expect(JSON.parse(out)).toEqual({ text: "</script><b>x</b> & more" });
  });
});
