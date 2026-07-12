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

function getSortableRowGroups(tbody: HTMLTableSectionElement): HTMLTableRowElement[][] {
  const groups: HTMLTableRowElement[][] = [];
  const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr"));

  for (const row of rows) {
    if (row.hasAttribute("data-sort-ignore")) {
      continue;
    }
    if (!row.hasAttribute("data-sort-row")) {
      groups.push([row]);
      continue;
    }

    const group = [row];
    let next = row.nextElementSibling;
    while (next instanceof HTMLTableRowElement && next.hasAttribute("data-sort-ignore")) {
      group.push(next);
      next = next.nextElementSibling;
    }
    groups.push(group);
  }

  return groups;
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
    const columnIndex = header.cellIndex;
    if (columnIndex < 0) {
      return;
    }

    const nextDirection =
      forcedDirection ??
      (activeHeader === header ? getNextSortDirection(activeDirection) : "asc");
    activeHeader = header;
    activeDirection = nextDirection;

    const sortType = (header.dataset.sortType as SortValueType | undefined) ?? "string";
    const groups = getSortableRowGroups(tbody);

    groups.sort((leftGroup, rightGroup) => {
      const leftCell = leftGroup[0]?.cells[columnIndex];
      const rightCell = rightGroup[0]?.cells[columnIndex];
      const leftValue = leftCell?.dataset.sortValue ?? leftCell?.textContent?.trim() ?? "";
      const rightValue = rightCell?.dataset.sortValue ?? rightCell?.textContent?.trim() ?? "";
      const comparison = compareSortValues(leftValue, rightValue, sortType);
      return nextDirection === "asc" ? comparison : -comparison;
    });

    for (const group of groups) {
      for (const row of group) {
        tbody.appendChild(row);
      }
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
