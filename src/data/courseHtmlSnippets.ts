/** Add snippets here — the admin panel reads this list automatically. */

export type CourseHtmlSnippet = {
  id: string;
  name: string;
  html: string;
  /** Optional grouping label for future UI (e.g. "links", "media", "layout"). */
  category?: string;
};

export const COURSE_HTML_SNIPPETS: CourseHtmlSnippet[] = [
  {
    id: "button",
    name: "Button",
    category: "links",
    html: `<a href="/your-link" class="btn btn-primary">Button Text</a>`,
  },
  {
    id: "download-button",
    name: "Download Button",
    category: "links",
    html: `<a href="/downloads/file.pdf" class="btn btn-primary">Download PDF</a>`,
  },
  {
    id: "external-link-button",
    name: "External Link Button",
    category: "links",
    html: `<a href="https://example.com" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
  Visit Website
</a>`,
  },
  {
    id: "glossary-entry",
    name: "Glossary Entry",
    category: "links",
    html: `<a href="/glossary/TERM-SLUG" class="glossary-link">TERM NAME</a>`,
  },
  {
    id: "image",
    name: "Image",
    category: "media",
    html: `<img src="/images/example.webp" alt="">`,
  },
  {
    id: "image-with-caption",
    name: "Image with Caption",
    category: "media",
    html: `<figure>
  <img src="/images/example.webp" alt="">
  <figcaption>Caption text</figcaption>
</figure>`,
  },
  {
    id: "vimeo-embed",
    name: "Vimeo Embed",
    category: "media",
    html: `<div class="vimeo-embed-wrapper">
  <div class="vimeo-embed-container">
    <iframe src="https://player.vimeo.com/video/123456789" title="Video" allowfullscreen loading="lazy"></iframe>
  </div>
</div>`,
  },
  {
    id: "accordion-section",
    name: "Accordion Section",
    category: "layout",
    html: `<details>
  <summary>Click to expand</summary>
  <p>Accordion content goes here.</p>
</details>`,
  },
  {
    id: "callout-box",
    name: "Callout Box",
    category: "layout",
    html: `<div class="callout">
  Important information goes here.
</div>`,
  },
  {
    id: "text-image-row",
    name: "Text + Image Row",
    category: "layout",
    html: `<div style="
    display:flex;
    gap:2rem;
    align-items:flex-start;
    flex-wrap:wrap;
    margin:1.5rem 0;
">
    <div style="flex:1;">
        <h3>Your Heading Here</h3>

        <p>
            Add your text here.
        </p>
    </div>

    <div style="width:40%; min-width:250px;">
        <img
            src="/challenge/images/v2/50/example.jpg"
            alt=""
            style="width:100%; height:auto; display:block;"
        >
    </div>
</div>`,
  },
];
