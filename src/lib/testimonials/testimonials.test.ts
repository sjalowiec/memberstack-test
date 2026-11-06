import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isolatedLocalTestimonialDatabase } from "./testimonialDatabase";
import { resolveLegacyImportDestination } from "./legacyImportTarget";
import { resolveTestimonialConnection } from "./testimonialQuery";
import { summarizeLegacyReviews } from "./legacyReviewImport";
import { parseReviewsCsv } from "./parseReviewsCsv";
import { testimonialPlainText, testimonialDeleteConfirmation, quoteWithHighlight } from "./testimonialPlainText";
import { memberSubmissionAllowed, parseDisplayCorrection, parseTestimonialDraft, HIGHLIGHT_RESELECT_MESSAGE, highlightWasInvalidated } from "./testimonialDraft";
import {
  LEGACY_IMPORT_PRESERVED_COLUMNS,
  legacyImportUpsertSql,
} from "./testimonialRules";
import {
  acceptPublicBrowseBatch,
  failPublicBrowseLoad,
  publicBrowseButtonLabel,
  publicBrowseStatus,
  startPublicBrowseLoad,
} from "./publicTestimonialBrowse";
import {
  PUBLIC_TESTIMONIAL_SQL,
  DELETE_TESTIMONIAL_SQL,
  listPublicTestimonials,
  listTestimonialsForAdmin,
  testimonialAdminCollectionClause,
  testimonialAdminListOrder,
} from "./testimonialStore";

describe("testimonial publication rules", () => {
  it("removes legacy HTML and links before public display", () => {
    const text = testimonialPlainText(
      'Thank you for the<a href="/challenge/103/ultimate-brother-workshop"> Brother course</a>. See https://www.knititnow.com/v/857 <b>today</b>.',
    );
    expect(text).toBe("Thank you for the Brother course. See today.");
    expect(text).not.toMatch(/<|https?:/);
  });

  it("keeps inactive rows off the public query and hides member ids", () => {
    expect(PUBLIC_TESTIMONIAL_SQL).toMatch(/WHERE active = TRUE/);
    expect(PUBLIC_TESTIMONIAL_SQL).not.toMatch(/legacy_member_id|memberstack_member_id|email/i);
  });

  it("does not let a repeat import change activation or display edits", () => {
    const sql = legacyImportUpsertSql();
    expect(sql).toMatch(/'legacy_import', FALSE/);
    const update = sql.split("DO UPDATE SET")[1] ?? "";
    for (const column of LEGACY_IMPORT_PRESERVED_COLUMNS) {
      expect(update).not.toContain(`${column} = EXCLUDED.${column}`);
    }
    expect(update).toContain("original_quote = EXCLUDED.original_quote");
    expect(update).toContain("legacy_member_id = EXCLUDED.legacy_member_id");
    expect(update).toContain("legacy_show = EXCLUDED.legacy_show");
    expect(sql).toContain("testimonial_deleted_legacy_ids");
    expect(sql).toMatch(/WHERE NOT EXISTS \([\s\S]*legacy_rating_id = \$1/);
  });

  it("asks for confirmation with the attribution and a short quote preview", () => {
    const message = testimonialDeleteConfirmation(
      "Ada <b>Knitter</b>",
      `${"Thank you for the clear lessons. ".repeat(8)}https://example.com/secret`,
    );
    expect(message).toContain("Ada Knitter");
    expect(message).not.toMatch(/<|https?:/);
    expect(message).toContain("Thank you for the clear lessons.");
    expect(message.length).toBeLessThan(180);
  });

  it("keeps only the legacy rating id when a deleted review is remembered", () => {
    const migration = readFileSync(
      "supabase/migrations/20261105160000_testimonial_deleted_legacy_ids.sql",
      "utf8",
    );
    expect(migration).toContain("legacy_rating_id INTEGER PRIMARY KEY");
    expect(migration).not.toMatch(/quote|attribution|email|member/i);
    expect(DELETE_TESTIMONIAL_SQL).toContain(
      "INSERT INTO testimonial_deleted_legacy_ids (legacy_rating_id)",
    );
    expect(DELETE_TESTIMONIAL_SQL).not.toMatch(/original_quote|original_attribution|memberstack_member_id/);
  });

  it("keeps a remote testimonial override off the shared database", () => {
    expect(resolveTestimonialConnection({}).mode).toBe("shared");
    expect(
      resolveTestimonialConnection({
        TESTIMONIALS_DATABASE_URL: "postgresql://postgres:secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres",
      }).mode,
    ).toBe("refused");
    expect(
      resolveTestimonialConnection({
        TESTIMONIALS_DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:54329/knititnow_testimonials",
      }).mode,
    ).toBe("local");
  });

  it("refuses schema changes on the shared Supabase database", () => {
    const shared = isolatedLocalTestimonialDatabase(
      "postgresql://postgres:secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres",
    );
    expect(shared.ok).toBe(false);
    const local = isolatedLocalTestimonialDatabase("postgresql://postgres:secret@127.0.0.1:5432/watson");
    expect(local.ok).toBe(true);
  });

  it("writes to the configured Watson database only when that target is applied", () => {
    const pooler = "postgresql://postgres:secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres";
    const local = "postgresql://postgres:secret@127.0.0.1:54329/knititnow_testimonials";
    const plainApply = resolveLegacyImportDestination({
      apply: true,
      target: null,
      localUrl: pooler,
      watsonUrl: pooler,
    });
    expect(plainApply.ok).toBe(false);
    const namedOnly = resolveLegacyImportDestination({
      apply: false,
      target: "configured-watson",
      localUrl: local,
      watsonUrl: pooler,
    });
    expect(namedOnly.ok && namedOnly.write).toBe(false);
    const namedApply = resolveLegacyImportDestination({
      apply: true,
      target: "configured-watson",
      localUrl: local,
      watsonUrl: pooler,
    });
    expect(namedApply.ok && namedApply.write).toBe(true);
    if (namedApply.ok && namedApply.write) expect(namedApply.url).toBe(pooler);
    const localApply = resolveLegacyImportDestination({
      apply: true,
      target: null,
      localUrl: local,
      watsonUrl: pooler,
    });
    expect(localApply.ok && localApply.write).toBe(true);
    if (localApply.ok && localApply.write) expect(localApply.url).toBe(local);
  });

  it("keeps duplicate legacy rows and missing member ids", () => {
    const summary = summarizeLegacyReviews(
      parseReviewsCsv(
        [
          "ratingid,Rating,Consumer,Dateadd,Description,Show,Memberid,Viewed,UseInEmail",
          '1,10,Ada,2020-01-01,Hello from Ada,1,NULL,1,0',
          '2,10,Ada,2020-01-02,Hello from Ada,0,ABC-1,0,1',
        ].join("\n"),
      ),
    );
    expect(summary.rows).toBe(2);
    expect(summary.missingMemberId).toBe(1);
    expect(summary.duplicateQuoteGroups).toBe(1);
    expect(summary.inactiveOnInsert).toBe(true);
  });

  it("ignores a browser-supplied member id and requires agreement separately", () => {
    const parsed = parseTestimonialDraft({
      attribution: "Ada",
      quote: "This is a long enough note about machine knitting.",
      memberstackMemberId: "mem_from_browser",
      email: "ada@example.com",
      active: true,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).not.toHaveProperty("memberstackMemberId");
      expect(parsed.value.attribution).toBe("Ada");
    }
    expect(memberSubmissionAllowed(3)).toBe(false);
    expect(memberSubmissionAllowed(2)).toBe(true);
  });

  it("requires both display fields, or neither, so the original text remains available", () => {
    expect(parseDisplayCorrection({ displayQuote: "Edited", displayAttribution: "" }).ok).toBe(false);
    const cleared = parseDisplayCorrection({ displayQuote: "  ", displayAttribution: "" });
    expect(cleared).toEqual({ ok: true, displayQuote: null, displayAttribution: null, highlight: null });
  });

  it("keeps one exact highlight, including a repeated word and punctuation", () => {
    const quote = "I love this class. I love the clear photos!";
    const second = quote.lastIndexOf("love");
    const saved = parseDisplayCorrection({
      displayQuote: quote,
      displayAttribution: "Ada",
      highlight: { start: second, end: second + "love the clear photos!".length },
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(quote.slice(saved.highlight?.start, saved.highlight?.end)).toBe("love the clear photos!");
      expect(saved.highlight?.start).toBe(second);
    }
    const parts = quoteWithHighlight(quote, second, second + 4);
    expect(parts.highlight).toBe("love");
    expect(`${parts.before}${parts.highlight}${parts.after}`).toBe(quote);
    expect(parts.before.endsWith("I ")).toBe(true);
  });

  it("asks for a new highlight when the saved selection no longer matches", () => {
    const outside = parseDisplayCorrection({
      displayQuote: "Short note.",
      displayAttribution: "Ada",
      highlight: { start: 2, end: 40 },
    });
    expect(outside).toEqual({ ok: false, error: HIGHLIGHT_RESELECT_MESSAGE });
    expect(quoteWithHighlight("Short note.", 2, 40).highlight).toBeNull();
    expect(
      highlightWasInvalidated(
        "I love the lessons.",
        { start: 2, end: 6 },
        "I lost the lessons.",
        { start: 2, end: 6 },
      ),
    ).toBe(true);
    expect(
      highlightWasInvalidated(
        "I love the lessons.",
        { start: 2, end: 6 },
        "I love the lessons now.",
        { start: 2, end: 6 },
      ),
    ).toBe(false);
  });

  it("does not publish testimonials from the membership page", () => {
    const membership = readFileSync("src/pages/membership.astro", "utf8");
    const page = readFileSync("src/pages/testimonials.astro", "utf8");
    expect(membership).toContain("Wisdom from Fellow Knitters");
    expect(membership).not.toContain("What members say");
    expect(page).toContain("What Knitters Say");
    expect(page).toContain("Every knitter has a story.");
    expect(page).toContain("listPublicTestimonials");
    expect(page).toContain("Show more stories");
    expect(page).toContain('id="testimonial-list"');
    expect(page.indexOf('id="testimonial-list"')).toBeLessThan(page.indexOf("show-more-stories"));
    expect(page).not.toContain("set:html");
    expect(page).not.toContain("innerHTML");
    expect(page).toContain("testimonials-page__sharebar");
    const css = readFileSync("src/styles/testimonials-public.css", "utf8");
    expect(css).toContain(".testimonials-page__list > .testimonials-page__card:nth-child(even)");
    const admin = readFileSync("src/pages/admin/testimonials.astro", "utf8");
    expect(admin).toContain("Inactive first");
    expect(admin).toContain("Active first");
    expect(admin).toContain("Include previously unpublished legacy reviews");
    expect(admin).toContain("includeUnpublishedLegacy");
    expect(admin).toContain("Save &amp; Activate");
    expect(admin).toContain("Unsaved changes");
    expect(admin).toContain("testimonial-admin__editor");
    expect(admin).toContain("testimonial-admin__list");
    expect(testimonialAdminListOrder("inactive")).toBe(
      "active ASC, review_date DESC NULLS LAST, created_at DESC",
    );
    expect(testimonialAdminListOrder("active")).toBe(
      "active DESC, review_date DESC NULLS LAST, created_at DESC",
    );
    expect(testimonialAdminListOrder()).toBe(testimonialAdminListOrder("inactive"));
    expect(page.match(/Share your experience/g)?.length).toBe(2);
    expect(page).not.toContain("set:html");
    expect(readFileSync("src/pages/account.astro", "utf8")).toContain('href="/testimonials/share"');
  });

  it("returns public batches in a stable order without member fields", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      if (sql.includes("COUNT")) return [{ total: 10 }];
      const offset = Number(params?.[2] ?? 0);
      const limit = Number(params?.[1] ?? 8);
      return Array.from({ length: Math.min(limit, Math.max(10 - offset, 0)) }, (_, index) => ({
        original_quote: `Story ${offset + index} about learning to knit.`,
        original_attribution: `Knitter ${offset + index}`,
        display_quote: offset + index === 8 ? "Saved display quote." : null,
        display_attribution: null,
        display_highlight_start: offset + index === 8 ? 6 : null,
        display_highlight_end: offset + index === 8 ? 13 : null,
        review_date: "2020-05-02",
      }));
    };
    const seed = "a".repeat(32);
    const first = await listPublicTestimonials({ seed, offset: 0 }, query);
    const second = await listPublicTestimonials({ seed, offset: first.nextOffset }, query);
    expect(first.testimonials).toHaveLength(8);
    expect(first.hasMore).toBe(true);
    expect(second.testimonials).toHaveLength(2);
    expect(second.hasMore).toBe(false);
    expect(second.testimonials[0]?.highlight).toBe("display");
    const names = [...first.testimonials, ...second.testimonials].map((item) => item.attribution);
    expect(new Set(names).size).toBe(names.length);
    expect(names[0]).toBe("Knitter 0");
    expect(names[8]).toBe("Knitter 8");
    expect(Object.keys(first.testimonials[0] ?? {}).sort()).toEqual([
      "after",
      "attribution",
      "before",
      "highlight",
      "reviewDate",
    ]);
    expect(calls[1]?.sql).toContain("ORDER BY md5($1 || id::text), id");
    expect(calls[1]?.sql).toContain("LIMIT $2 OFFSET $3");
    expect(calls[1]?.sql).not.toMatch(/legacy_member_id|memberstack_member_id|email/i);
    expect(calls[1]?.params).toEqual([seed, 8, 0]);
    expect(calls[3]?.params).toEqual([seed, 8, 8]);
    expect(testimonialAdminCollectionClause(false)).toBe("(source <> 'legacy_import' OR legacy_show IS TRUE)");
    expect(testimonialAdminCollectionClause(false)).not.toContain("active");
    expect(testimonialAdminCollectionClause(true)).toBe("TRUE");
  });

  it("applies the legacy Show collection before pagination", async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      if (sql.includes("COUNT")) return [{ total: 90 }];
      return [];
    };
    const hidden = await listTestimonialsForAdmin(
      { q: "ada", status: "inactive", sort: "active", limit: 40, offset: 80 },
      query,
    );
    expect(hidden.total).toBe(90);
    expect(calls[0]?.sql).toContain("(source <> 'legacy_import' OR legacy_show IS TRUE)");
    expect(calls[1]?.sql).toContain("active DESC, review_date DESC NULLS LAST, created_at DESC");
    expect(calls[1]?.sql).toContain("LIMIT $4 OFFSET $5");
    expect(calls[0]?.params).toEqual(["%ada%", "ada", false]);
    expect(calls[1]?.params).toEqual(["%ada%", "ada", false, 40, 80]);
    await listTestimonialsForAdmin({ includeUnpublishedLegacy: true, status: "active" }, query);
    expect(calls[2]?.sql).toContain("AND TRUE");
    expect(calls[2]?.sql).not.toContain("legacy_show IS TRUE");
    expect(calls[2]?.params?.[2]).toBe(true);
  });

  it("keeps shown stories when another batch fails and hides the control after the last batch", () => {
    const shown = { nextOffset: 8, hasMore: true, cardCount: 8, phase: "ready" as const };
    const loading = startPublicBrowseLoad(shown);
    expect(loading.cardCount).toBe(8);
    expect(publicBrowseStatus(loading)).toBe("Loading more stories…");
    const failed = failPublicBrowseLoad(loading);
    expect(failed.cardCount).toBe(8);
    expect(failed.nextOffset).toBe(8);
    expect(publicBrowseButtonLabel(failed)).toBe("Retry");
    expect(publicBrowseStatus(failed)).toBe("Stories could not be loaded.");
    const finished = acceptPublicBrowseBatch(shown, {
      testimonials: ["a", "b"],
      nextOffset: 10,
      hasMore: false,
    });
    expect(finished.cardCount).toBe(10);
    expect(finished.nextOffset).toBe(10);
    expect(publicBrowseButtonLabel(finished)).toBeNull();
  });
});
