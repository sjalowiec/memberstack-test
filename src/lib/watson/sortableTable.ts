export type SortDirection = "asc" | "desc";
export type SortValueType = "string" | "date";

export function getNextSortDirection(current: SortDirection | null): SortDirection {
  return current === "asc" ? "desc" : "asc";
}

export function compareSortValues(
  left: string,
  right: string,
  type: SortValueType,
): number {
  if (type === "date") {
    const leftTime = left ? Date.parse(left) : Number.NaN;
    const rightTime = right ? Date.parse(right) : Number.NaN;
    const leftValue = Number.isNaN(leftTime) ? Number.NEGATIVE_INFINITY : leftTime;
    const rightValue = Number.isNaN(rightTime) ? Number.NEGATIVE_INFINITY : rightTime;
    return leftValue - rightValue;
  }

  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
}

export function initSortableTable(table: HTMLTableElement): void {
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th[data-sort-key]"));
  if (headers.length === 0) {
    return;
  }

  const tbody = table.tBodies[0];
  if (!tbody) {
    return;
  }

  let activeHeader: HTMLTableCellElement | null = null;
  let activeDirection: SortDirection | null = null;

  const updateHeaderState = (): void => {
    for (const header of headers) {
      header.classList.remove("watson-table__sort--asc", "watson-table__sort--desc");
      header.removeAttribute("aria-sort");
      if (header === activeHeader && activeDirection) {
        header.classList.add(
          activeDirection === "asc" ? "watson-table__sort--asc" : "watson-table__sort--desc",
        );
        header.setAttribute("aria-sort", activeDirection === "asc" ? "ascending" : "descending");
      }
    }
  };

  const sortByHeader = (header: HTMLTableCellElement, forcedDirection?: SortDirection): void => {
    const columnIndex = headers.indexOf(header);
    if (columnIndex === -1) {
      return;
    }

    const nextDirection =
      forcedDirection ??
      (activeHeader === header ? getNextSortDirection(activeDirection) : "asc");
    activeHeader = header;
    activeDirection = nextDirection;

    const sortType = (header.dataset.sortType as SortValueType | undefined) ?? "string";
    const rows = Array.from(tbody.querySelectorAll("tr"));

    rows.sort((leftRow, rightRow) => {
      const leftCell = leftRow.cells[columnIndex];
      const rightCell = rightRow.cells[columnIndex];
      const leftValue = leftCell?.dataset.sortValue ?? leftCell?.textContent?.trim() ?? "";
      const rightValue = rightCell?.dataset.sortValue ?? rightCell?.textContent?.trim() ?? "";
      const comparison = compareSortValues(leftValue, rightValue, sortType);
      return nextDirection === "asc" ? comparison : -comparison;
    });

    for (const row of rows) {
      tbody.appendChild(row);
    }

    updateHeaderState();
  };

  for (const header of headers) {
    header.classList.add("watson-table__sortable");
    const activate = (): void => sortByHeader(header);
    header.addEventListener("click", activate);
    header.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  }

  const defaultHeader = headers.find((header) => header.dataset.sortDefault === "true");
  if (defaultHeader) {
    sortByHeader(
      defaultHeader,
      defaultHeader.dataset.sortDefaultDirection === "asc" ? "asc" : "desc",
    );
  } else {
    updateHeaderState();
  }
}

export function initSortableTables(root: ParentNode = document): void {
  const tables = root.querySelectorAll<HTMLTableElement>("table[data-sortable-table]");
  for (const table of tables) {
    initSortableTable(table);
  }
}
