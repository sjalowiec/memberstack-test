export function initOrderItemToggles(root: ParentNode = document): void {
  const toggles = root.querySelectorAll<HTMLButtonElement>("[data-order-toggle]");
  for (const toggle of toggles) {
    if (toggle.dataset.orderToggleBound === "true") {
      continue;
    }
    toggle.dataset.orderToggleBound = "true";
    toggle.addEventListener("click", () => {
      const orderId = toggle.dataset.orderToggle;
      if (!orderId) {
        return;
      }
      const itemsRow = root.querySelector<HTMLTableRowElement>(
        `[data-order-items-row="${orderId}"]`,
      );
      if (!itemsRow) {
        return;
      }
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      itemsRow.hidden = expanded;
      toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      toggle.textContent = expanded ? "Show items" : "Hide items";
    });
  }
}
