/**
 * Public /whats-new stacked-card accordions (one expanded card per column).
 * Each `[data-wn-stack]` column is independent — opening a card in one column
 * does not affect another.
 *
 * Collapsed panels use the HTML `hidden` attribute. Page CSS must keep
 * `.whats-new__stack-panel[hidden] { display: none !important }` so author
 * display rules cannot reveal them or leave nested CTAs focusable.
 */

type EventTargetLike = {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
};

type ElementLike = Element &
  EventTargetLike & {
    classList: DOMTokenList;
    style: CSSStyleDeclaration;
    textContent: string | null;
  };

function asElement(node: Element): ElementLike {
  return node as ElementLike;
}

/**
 * Wire every stacked column on the public board.
 * Newest card is expanded by default in the markup; this syncs toggles and z-index.
 */
export function initWhatsNewCardStacks(
  root: Pick<ParentNode, "querySelector" | "querySelectorAll"> = document,
): void {
  const stacks = root.querySelectorAll("[data-wn-stack]");
  stacks.forEach((stackNode) => {
    const stack = asElement(stackNode);
    const items = Array.from(stack.querySelectorAll("[data-wn-stack-item]")).map(
      asElement,
    );
    if (items.length === 0) return;

    const applyExpanded = (openItem: ElementLike | null) => {
      const baseZ = items.length;
      items.forEach((item, index) => {
        const isOpen = openItem !== null && item === openItem;
        const toggle = item.querySelector("[data-wn-stack-toggle]");
        const panel = item.querySelector("[data-wn-stack-panel]");
        if (!toggle || !panel) return;

        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        if (isOpen) {
          panel.removeAttribute("hidden");
          item.classList.add("whats-new__card--expanded");
          item.style.zIndex = String(baseZ + 1);
        } else {
          panel.setAttribute("hidden", "");
          item.classList.remove("whats-new__card--expanded");
          // Newer cards (earlier in DOM) sit above older collapsed cards.
          item.style.zIndex = String(baseZ - index);
        }
      });
    };

    // Sync z-index / classes with the SSR default (first expanded, or none).
    const initiallyOpen =
      items.find(
        (item) =>
          item.classList.contains("whats-new__card--expanded") ||
          item
            .querySelector("[data-wn-stack-toggle]")
            ?.getAttribute("aria-expanded") === "true",
      ) ?? null;
    applyExpanded(initiallyOpen);

    items.forEach((item) => {
      const toggle = item.querySelector("[data-wn-stack-toggle]");
      if (!toggle) return;
      asElement(toggle).addEventListener("click", () => {
        // Keep one card open in this column; re-clicking leaves it expanded.
        applyExpanded(item);
      });
    });
  });
}

/** @deprecated Use initWhatsNewCardStacks — same shared stack initializer. */
export const initWhatsNewJustAddedStack = initWhatsNewCardStacks;

/** Wire all public What's New board interactions. */
export function initWhatsNewPublicBoard(
  root: Pick<ParentNode, "querySelector" | "querySelectorAll"> = document,
): void {
  initWhatsNewCardStacks(root);
}
