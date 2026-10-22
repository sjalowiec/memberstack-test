import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bookFindUrl, getAllBooks, getBookById, hasRating } from "../../../lib/bookshelf";

const pageDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(pageDir, "[id].astro"), "utf8");
const bookshelfLibSource = readFileSync(
  join(pageDir, "../../../lib/bookshelf.ts"),
  "utf8",
);
const bookshelfJson = JSON.parse(
  readFileSync(join(pageDir, "../../../data/bookshelf.json"), "utf8"),
) as Array<{ id: string; description: string; url?: string }>;

const SINGLE_BED_STRIPE =
  "https://buy.stripe.com/9B6cN46lUcCL0mWf8K0oM0k";
const DOUBLE_BED_STRIPE =
  "https://buy.stripe.com/5kQcN4bGecCL2v43q20oM0l";

describe("bookshelf detail page", () => {
  it("does not render Community Notes on public book pages", () => {
    expect(pageSource).not.toContain("Community Notes");
    expect(pageSource).not.toContain("No community notes yet for this book.");
    expect(pageSource).not.toContain("community-notes");
    expect(pageSource).not.toContain("getBookComments");
    expect(pageSource).not.toContain("formatCommentDate");

    expect(bookshelfLibSource).not.toContain("getBookComments");
    expect(bookshelfLibSource).not.toContain("bookshelf-comments.json");
  });

  it("still renders core book detail content", () => {
    expect(pageSource).toContain("About this book");
    expect(pageSource).toContain("book-detail__cover");
    expect(pageSource).toContain("Find this book");
    expect(pageSource).toContain("bookFindUrl");
    expect(pageSource).toContain("findBookHref");
    expect(pageSource).toContain("{findBookHref && (");
    expect(pageSource).not.toContain("{resolved.url && (");
    expect(pageSource).toContain("getAllBooks");
    expect(pageSource).toContain("getBookById");
  });

  it("omits Find this book unless the stored url is an absolute http(s) link", () => {
    expect(getBookById("145")?.url).toBe("");
    expect(bookFindUrl(getBookById("145")?.url)).toBeNull();

    // Legacy UrlLink "1" and "NULL" are placeholders, not destinations.
    expect(bookFindUrl("1")).toBeNull();
    expect(bookFindUrl("NULL")).toBeNull();
    expect(bookFindUrl("null")).toBeNull();
    expect(bookFindUrl("")).toBeNull();
    expect(bookFindUrl("/store/product/502/")).toBeNull();

    const book3 = getBookById("3");
    expect(book3?.title).toContain("ABC of Perfect Knitting");
    expect(book3?.author).toBe("");
    expect(book3?.description).toBe("");
    expect(book3?.descriptionText).toBe("");
    expect(book3?.url).toBe("");
    expect(bookFindUrl(book3?.url)).toBeNull();
    expect(bookFindUrl(getBookById("31")?.url)).toBeNull();
    expect(bookFindUrl(getBookById("45")?.url)).toBeNull();
    expect(bookFindUrl(getBookById("46")?.url)).toBeNull();
    expect(bookFindUrl(getBookById("47")?.url)).toBeNull();

    const amazon = "https://amzn.to/3kzaxlu";
    expect(getBookById("42")?.url).toBe(amazon);
    expect(bookFindUrl(getBookById("42")?.url)).toBe(amazon);

    const store =
      "https://www.knititnow.com/store/product/728/add-a-hood-to-any-knitting-pattern/digitialdownload";
    expect(getBookById("77")?.url).toBe(store);
    expect(bookFindUrl(getBookById("77")?.url)).toBe(store);

    for (const book of getAllBooks()) {
      if (!book.url) {
        expect(bookFindUrl(book.url)).toBeNull();
      } else {
        expect(bookFindUrl(book.url)).toBe(book.url);
        expect(book.url.startsWith("https://") || book.url.startsWith("http://")).toBe(true);
      }
    }
  });

  it("hides rating markup when no current rating data is available", () => {
    expect(pageSource).not.toContain("Not yet rated");
    expect(pageSource).not.toContain("book-detail__rating-empty");
    expect(pageSource).toContain("{showRating && (");
    expect(pageSource).toContain("hasRating");

    const book126 = getBookById("126");
    expect(book126).toBeTruthy();
    expect(hasRating(book126!)).toBe(false);

    const unrated = getAllBooks().filter((book) => !hasRating(book));
    expect(unrated.length).toBeGreaterThan(0);
    expect(unrated.some((book) => book.id === "126")).toBe(true);

    const rated = getAllBooks().filter((book) => hasRating(book));
    expect(rated.length).toBeGreaterThan(0);
  });

  it("maps book 126 purchase titles to the correct Stripe checkout links", () => {
    const book = getBookById("126");
    expect(book).toBeTruthy();
    const html = book!.description;

    const deliveryNote =
      "PDF purchases will be delivered to the email address used at checkout within one business day.";
    expect(html).toContain(deliveryNote);
    expect(html.indexOf(deliveryNote)).toBeLessThan(html.indexOf("fa-shopping-cart"));

    const singleMatch = html.match(
      /<a href="([^"]+)"[^>]*>Machine Knitting Trims and Edges - Single Bed<\/a>/,
    );
    const doubleMatch = html.match(
      /<a href="([^"]+)"[^>]*>Machine Knitting Trims and Edges - Double Bed<\/a>/,
    );

    expect(singleMatch?.[1]).toBe(SINGLE_BED_STRIPE);
    expect(doubleMatch?.[1]).toBe(DOUBLE_BED_STRIPE);
    expect(singleMatch?.[1]).not.toBe(doubleMatch?.[1]);

    expect(html).toContain(`href="${SINGLE_BED_STRIPE}" target="_blank" rel="noopener noreferrer"`);
    expect(html).toContain(`href="${DOUBLE_BED_STRIPE}" target="_blank" rel="noopener noreferrer"`);
    expect(html).toContain('class="fa fa-shopping-cart"');
    expect(html).not.toContain("/store/product/502/");
    expect(html).not.toContain("/store/product/505/");

    // Only book 126 should carry these Stripe purchase URLs.
    const booksWithStripe = bookshelfJson.filter(
      (entry) =>
        entry.description?.includes(SINGLE_BED_STRIPE) ||
        entry.description?.includes(DOUBLE_BED_STRIPE) ||
        entry.url === SINGLE_BED_STRIPE ||
        entry.url === DOUBLE_BED_STRIPE,
    );
    expect(booksWithStripe.map((b) => b.id)).toEqual(["126"]);

    const booksWithDeliveryNote = bookshelfJson.filter((entry) =>
      entry.description?.includes(deliveryNote),
    );
    expect(booksWithDeliveryNote.map((b) => b.id)).toEqual(["126"]);
  });
});
