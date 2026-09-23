import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

const forms = [
  {
    name: "contact page",
    file: "src/pages/contact/index.astro",
    fields: ['name="name"', 'name="email"', 'name="message"', 'name="images"'],
    source: 'name="form_source" value="contact_page"',
    submit: "wireContactFormSubmit",
  },
  {
    name: "contact modal",
    file: "src/components/ContactModal.astro",
    fields: ['name="name"', 'name="email"', 'name="message"', 'name="images"'],
    source: 'name="form_source"',
    submit: "initContactModal",
  },
  {
    name: "help hub",
    file: "src/pages/help-hub/index.astro",
    fields: ['name="firstName"', 'name="email"', 'name="question"'],
    source: 'name="form_source" value="help-hub"',
    submit: "wireContactFormSubmit",
  },
  {
    name: "video search",
    file: "src/pages/video-search.astro",
    fields: ['name="firstName"', 'name="email"', 'name="question"'],
    source: 'name="form_source" value="help-hub"',
    submit: "wireContactFormSubmit",
  },
];

describe("public contact forms", () => {
  it.each(forms)("$name still posts to the contact function with its fields", (form) => {
    const source = fs.readFileSync(path.resolve(form.file), "utf8");
    expect(source).toContain('action="/.netlify/functions/contact"');
    expect(source).toContain('name="bot-field"');
    expect(source).toContain(form.submit);
    expect(source).toContain(form.source);
    for (const field of form.fields) {
      expect(source).toContain(field);
    }
  });

  it("shows the thanks page only after the shared submit helper accepts a 2xx response", () => {
    const helper = fs.readFileSync(path.resolve("src/scripts/contactFormSubmit.ts"), "utf8");
    expect(helper).toContain("res.status >= 200 && res.status < 300");
    expect(helper).toContain("window.location.href = thanksUrl");
    expect(helper).toContain("showSubmitError");
  });
});
