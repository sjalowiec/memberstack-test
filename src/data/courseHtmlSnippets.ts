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
];
