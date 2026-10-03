# Knit-able inspiration template

New Knit-ables use the Coco Loco Tank layout through `KnitAbleInspirationPage`. Copy, images, colors, pattern and builder links, affiliate URLs, and lesson references stay in that Knit-able’s data module. The shared layout does not contain a specific Knit-able’s details.

Branch Out Tank, Teenage Kicks Socks, and Worsted Color-Block Socks keep their own pages.

## Add the next Knit-able

1. Put images in `public/images/knit-ables/{slug}/`.
2. Add `src/lib/knit-ables/{name}.ts` and export a `KnitAbleInspirationPageContent` object. `src/lib/knit-ables/cocoLocoTank.ts` is the working example.
3. Add `src/pages/knit-ables/{slug}.astro`. Keep `export const prerender = false`, call `loadKnitAblePageAccess` with the page path, set the response status when the page is hidden, and render `KnitAbleInspirationPage` only when `knitAbleAccess.visible` is true. Unpublished and scheduled pages stay real 404s. Watson can preview with `?preview=1`.
4. Add a card to `KNIT_ABLES_CARDS` in `src/lib/knit-ables/knitAblesLanding.ts`. The schedule only recognizes slugs from that list. Leave the slug out of `KNIT_ABLE_INITIAL_PUBLISH_DATES` so it stays unpublished until Watson saves a date.

## Required fields

| Field | Use |
| --- | --- |
| `path` | Page path, such as `/knit-ables/your-slug`. Also the return path after lesson sign-in. |
| `canonicalUrl` | Public canonical URL. |
| `title` | Page title. The layout adds `\| Knit it Now`. |
| `description` | Meta description. |
| `hero` | Inspiration photo: `src`, `alt`, `width`, `height`. It links to the original pattern. |
| `tagline` | Short line under the puzzle logo and title. |
| `intro` | Introduction under the tagline. |
| `builder.heading` | Soft green panel heading. |
| `builder.introduction` | Panel introduction. `before` is required. Add `link` and `after` when the builder name sits in the middle of the sentence. |
| `builder.steps` | Compact indented bullets. An empty list omits the bullets. |
| `builder.cta` | Member and visitor actions. Pass the pattern landing page `cta`. The layout shows the checking state, the member button, and the visitor membership and sign-in links. |
| `pattern` | Original pattern heading, copy, button label, and URL. |
| `yarn` | Yarn section heading, card heading, paragraphs, button label, and URL. |

On desktop the photo sits beside the title block, and the pattern and yarn sections sit beside each other. On narrow screens those pairs stack.

## Optional fields

Omit the field, or leave a list empty, and the layout drops that piece.

| Field | Use |
| --- | --- |
| `palette` | Color inspiration. `colors` are hex values (`#e56b93` or `#fff`). Set `bordered: true` on a near-white swatch. `label` and `caption` are optional. These colors can come from the suggested yarn rather than the photographed garment. |
| `builder.closing` | Paragraphs after the bullets. Set `emphasis: true` on the bold closing line. |
| `hero.href` / `hero.rel` | Override the photo link. The default is the original pattern link with the affiliate `rel`. |
| `pattern.rel` / `yarn.rel` | Override the affiliate `rel` for a non-affiliate link. |
| `yarn.image` | Optional yarn photo. `featured` and `imagePlacement` (`above` or `beside`) match `KnitAbleYarnCard`. |
| `lessons` | Helpful member lessons. The panel is collapsed. The summary count is `items.length`. Each `href` must be `/videos/{contentId}` so the existing lesson modal and membership check can open it. |
| `affiliateDisclosure` | Affiliate note at the end of the page. Include it when the page has affiliate links. |

## Shared pieces the template already uses

- `KnitAblePageHeader` for the puzzle logo, eyebrow, and title
- `KnitAbleLinkedImage` and `KnitAbleYarnCard`
- `KnitAblePreviewBanner` and the request-time schedule gate
- `initPatternBuilderLandingCta` for member and visitor actions
- `bootHelpHubMemberLessonGates` for the lesson list and authorized video modal
