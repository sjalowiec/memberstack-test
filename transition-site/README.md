# Standalone transition landing page

Minimal static site for deploying the Knit It Now transition page to its **own Netlify site**, without exposing the main app.

## What's included

- `/` and `/transition/` — same transition page
- Shared content from `src/components/transition/` (single source of truth with `/transition` on the main app)
- Styles: `src/styles/global.css`, `src/styles/print.css`
- Assets: logo, Sue photo, signature, favicons (copied into `public/` before build)

## What's excluded

No Memberstack, contact modal, auth modals, video modal, EnvBanner, Hyvor, Pinterest, or other main-app scripts.

Contact links default to `mailto:contact@knititnow.com`. Override with:

```bash
PUBLIC_TRANSITION_CONTACT_URL=https://www.knititnow.com/contact/
```

## Local development

From the **repo root**:

```bash
npm run dev:transition-site
```

Opens on port **4322**.

## Production build

From the **repo root**:

```bash
npm run build:transition-site
```

Output: `transition-site/dist/`

## Netlify deploy (separate site)

**Option A — base directory**

1. Create a new Netlify site linked to this repo.
2. Set **Base directory** to `transition-site`.
3. Build command and publish directory are read from `transition-site/netlify.toml`.

**Option B — repo root**

1. Build command: `npm run build:transition-site`
2. Publish directory: `transition-site/dist`

## Main app unchanged

The main site still serves `/transition` via `src/pages/transition.astro` with the full `BaseLayout` (contact page links, modals, etc.). Only the standalone build is stripped down.
