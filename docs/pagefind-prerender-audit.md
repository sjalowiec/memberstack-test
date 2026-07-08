# Pagefind Readiness & SSR/Prerender Audit — Knit it Now

_Audit date: Jul 7, 2026 • Target: implement Pagefind site-wide search_

## Core Rule for This Site

`astro.config.mjs` uses `output: "server"`. Therefore **any page without an explicit
`export const prerender = true` is server-rendered (SSR) by default** — no static HTML
file is produced at build time, so **Pagefind cannot index it today**. Only pages
explicitly marked `prerender = true` are indexable right now.

Most *content* pages do NOT actually need SSR — they read from static JSON/`lib`
imports at build time. Only a few genuinely depend on request-time data
(`Astro.url.searchParams`, `Astro.url.hostname`, `Astro.request`); those are the real
risk cases.

## Layout / Integration Notes

- Shared chrome flows through `BaseLayout.astro` + `Header.astro` (nav, banners,
  Memberstack auth, modals). Add `data-pagefind-body` to the main content region and
  `data-pagefind-ignore` to header/nav/banners/modals so search isn't polluted.
- Member gating is **client-side** (Memberstack `data-ms-content`, `ms-logged-in`).
  Gated text is present in the HTML, so Pagefind WOULD index and expose it to
  non-members. Decide per-section: `data-pagefind-ignore` vs. searchable teaser.
- A search UI hook already exists in `Header.astro`: `#openSearchModal` trigger +
  `#searchModal` "coming soon" modal — natural place to mount Pagefind's UI.
- Interactive tool/wizard pages have little body text ? low search payoff.

---

## Section-by-Section Map

Legend: **Indexable today** = has a static HTML file (`prerender = true`) now.

### 1. Help Hub
| Route | File | prerender | Indexable today | Include by Aug 1 | Risk of `prerender = true` |
|---|---|---|---|---|---|
| `/help-hub` | `src/pages/help-hub/index.astro` | default (SSR) | No | Yes | Low — static `help-hub.json` |
| `/help-hub/[slug]` | `src/pages/help-hub/[slug].astro` | `false` (explicit) | No | Yes (HIGH priority) | Medium — SSR only for `?preview=true` drafts; needs public-only `getStaticPaths()` (don't leak drafts) + rehome draft preview |
| `/help-hub/quick-help`, `work-with-sue`, `guided-workshop` | those files | default (SSR) | No | Optional | Low (static marketing) |
| quick-help forms & `-thank-you` | those files | default (SSR) | No | Exclude | Forms, no search value |
| `/help-hub/preview` | `preview.astro` | `false` | No | Exclude | Admin draft viewer |

### 2. Glossary
| Route | File | prerender | Indexable today | Include by Aug 1 | Risk |
|---|---|---|---|---|---|
| `/glossary` | `src/pages/glossary/index.astro` | `true` | Yes | Yes | n/a |
| `/glossary/[slug]` | `src/pages/glossary/[slug].astro` | default (SSR) | No | Yes | Very low — already has `getStaticPaths()`; just add the flag |
| `/glossary/modal/[slug]` | `modal/[slug].astro` | default (SSR) | No | Exclude | Partial HTML fragment ? duplicate index entries |

### 3. Videos
| Route | File | prerender | Indexable today | Include by Aug 1 | Risk |
|---|---|---|---|---|---|
| `/videos` | `src/pages/videos/index.astro` | default (SSR) | No | Yes | Low–Medium — uses `Astro.url.search` + `getPreviewMember(Astro.url)`; prerender loses query-driven preview. Body content is static |
| `/videos/[id]` | `src/pages/videos/[id].astro` | `true` | Yes | Yes | n/a — but client-gated; decide `data-pagefind-ignore` vs teaser |

### 4. Course Index Pages
| Route | File | prerender | Indexable today | Include by Aug 1 | Risk |
|---|---|---|---|---|---|
| `/courses` | `src/pages/courses/index.astro` | default (SSR) | No | Yes | Low — static `coursesCatalog` lib |
| `/courses/legacy` | `courses/legacy/index.astro` | default (SSR) | No | Optional | Low |

### 5. Course Lesson Pages
| Route | File | prerender | Indexable today | Include by Aug 1 | Risk |
|---|---|---|---|---|---|
| `/courses/[courseSlug]` (landing) | `src/pages/courses/[courseSlug].astro` | `false` (explicit) | No | Maybe | Medium — no `getStaticPaths()` yet; must enumerate slugs; loses dynamic 404 |
| `/courses/legacy/[courseSlug]/…` (index, `[lessonSlug]`, `[itemSlug]`) | `courses/legacy/**` | default (SSR) | No | Exclude for launch | High — use `Astro.url.hostname` + `Astro.request` gating; member lesson content would bake into public index |

### 6. Tools
| Route | File | prerender | Indexable today | Include by Aug 1 | Risk |
|---|---|---|---|---|---|
| `/tools` | `src/pages/tools/index.astro` | default (SSR) | No | Yes | Low — static `tools.json` |
| `/tools/[slug]`, `/tools/hand-machine-blanket` | those files | `true` | Yes | Yes | n/a |
| Standalone tools (`gauge-calculator`, `magic-formula`, `yarn-estimator`, `hood-tool`, …) | `src/pages/tools/*.astro` | default (SSR) | No | Optional | Low (only `Astro.url.pathname`), but interactive ? low search payoff |

### 7. Reference Pages
**Already indexable (`prerender = true`):** `/reference`, `/reference/machines` (+`[slug]`),
`/reference/machine-guide/[slug]`, `/reference/bookshelf` (+`[id]`), `/reference/yarn-weight`,
`/reference/clubs`. ? Include all.

**Currently SSR by default — high search value, Low risk to flip:**
`/reference/abbreviations`, `/reference/repairs`, `/reference/sizing-charts`,
`/reference/designaknit-basics`, `/reference/dak-buyers-guide`, `/reference/dak-upgrade`,
`/reference/DAK-brother-cables`, `/reference/machine-brands`, `/reference/machines/choose`,
`/reference/essential-machine-parts`, `/reference/yarn-standards`,
`/reference/minimum-ease-chart`, `/reference/stitch-symbols`
(files: `src/pages/reference/*.astro`). Static content, no request-time data.

**Excluded — not content:** `/reference/machine-database`
(`src/pages/reference/machine-database.astro`) is a **retired 301 redirect stub** to
`/reference/machines`. Keep SSR (or convert to a static redirect rule); do NOT prerender;
exclude from index.

### 8. Pattern Builder Landing / Pages
| Route | File | prerender | Indexable today | Include by Aug 1 | Risk |
|---|---|---|---|---|---|
| `/patterns/about` (Pattern Builders marketing HOME) | `src/pages/patterns/about.astro` | default (SSR) | No | Yes (PRIMARY pattern page) | Low — no request-time data; safe to prerender |
| `/patterns` (catalog) | `src/pages/patterns/index.astro` | default (SSR) | No | Yes (secondary) | Medium — `isDropShoulderProductionBlocked(Astro.url.hostname, …)` freezes per-domain card hiding at build time |
| Builder/flow pages (`patterns/sleeveless/**`, `drop-shoulder/builder`, `review`, `print`, `custom-build/**`, `*-express*`) | `src/pages/patterns/**` | default (SSR) | No | Exclude | High — stateful/gated app flows; some use `Astro.request`; little static text |

`PATTERN_BUILDERS_HOME_HREF` resolves to `/patterns/about` (see
`src/lib/patterns/customPatternProjectNavigation.ts`).

### 9. Shop / Book / Machine Pages
| Route | File | prerender | Indexable today | Include by Aug 1 | Risk |
|---|---|---|---|---|---|
| `/shop/machines/[slug]`, `/shop/ebooks/[slug]` | those files | `true` | Yes | Yes | n/a |
| `/shop`, `/shop/books`, `/shop/ebooks`, `/shop/cables`, `/shop/designaknit`, `/shop/machines`, `/shop/accessories` | `src/pages/shop/*.astro` | default (SSR) | No | Yes (catalogs) | Low — static JSON catalogs |
| `/shop/cables/[id]` | `shop/cables/[id].astro` | default (SSR) | No | Yes | Very low — `getStaticPaths()` already present |
| `/shop/downloads`, `/shop/accessories/coming-soon` | those files | default (SSR) | No | Exclude | Use `Astro.request` (member/download area) |
| `/shop/*-thank-you`, `thank-you-*` | those files | default (SSR) | No | Exclude | Post-purchase, no search value |

---

## Recommended Launch Tiers (before Aug 1)

**Tier 1 — index now, already static (no code change):**
glossary index, all prerendered reference pages, `videos/[id]`, `tools/[slug]`,
`shop/machines/[slug]`, `shop/ebooks/[slug]`.

**Tier 2 — flip to `prerender = true`, low risk, high value:**
`glossary/[slug]`, SSR reference content pages (section 7 list),
`help-hub/index`, `courses/index`, `tools/index`, shop catalog pages,
`shop/cables/[id]`, `patterns/about`.

**Tier 3 — worth it, needs care:**
`help-hub/[slug]` (public-only `getStaticPaths`, rehome draft preview),
`videos/index` and `patterns/index` (accept loss of query/hostname request logic),
`courses/[courseSlug]` (add `getStaticPaths`).

**Exclude for launch:**
legacy course lesson pages, pattern builder flow pages, download/thank-you/form pages,
glossary modal fragments, `reference/machine-database` (redirect stub).

## Open Follow-ups
- Confirm exact Pagefind integration approach for the Netlify adapter build output dir
  (static assets emitted under the adapter's client output folder).
- Decide global policy on member-gated content in the index (ignore vs. teaser).
