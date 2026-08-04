/**
 * Public /whats-new column "Show more" / "Show less" toggles.
 * Extra cards use the HTML `hidden` attribute; page CSS must keep
 * `.whats-new__card[hidden] { display: none !important }` so card
 * `display` rules do not override the native hidden behavior.
 */
export function initWhatsNewColumnToggles(
  root: Pick<ParentNode, "querySelector" | "querySelectorAll"> = document,
): void {
  const buttons = root.querySelectorAll("[data-wn-column-toggle]");
  buttons.forEach((node) => {
    const button = node as Element & {
      textContent: string | null;
      addEventListener: (type: string, listener: () => void) => void;
    };
    button.addEventListener("click", () => {
      const listId = button.getAttribute("aria-controls");
      if (!listId) return;
      const list = root.querySelector(`#${listId}`);
      if (!list) return;

      const expanded = button.getAttribute("aria-expanded") === "true";
      const nextExpanded = !expanded;
      const extras = list.querySelectorAll("[data-wn-extra]");

      extras.forEach((item) => {
        const el = item as Element;
        if (nextExpanded) {
          el.removeAttribute("hidden");
        } else {
          el.setAttribute("hidden", "");
        }
      });

      button.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
      button.textContent = nextExpanded ? "Show less" : "Show more";
    });
  });
}
