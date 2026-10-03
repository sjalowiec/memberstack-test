import toolsData from "../../../data/tools.json";

export type CatalogTool = {
  id?: number | string;
  title?: string;
  href?: string;
  icon?: string;
  membersonly?: boolean;
};

const catalog = toolsData as CatalogTool[];

/**
 * Path used to match a tool page to `data/tools.json`.
 * Prerendered pages and Help Hub links may include a trailing slash;
 * catalog hrefs do not.
 */
export function toolRequestPath(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";

  let path = trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      path = new URL(trimmed).pathname;
    } catch {
      return "";
    }
  }

  const withoutQuery = path.split(/[?#]/)[0] ?? "";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

export function findToolByRequestPath(pathname: string): CatalogTool | null {
  const target = toolRequestPath(pathname);
  if (!target) return null;
  return (
    catalog.find(
      (tool) => typeof tool.href === "string" && toolRequestPath(tool.href) === target,
    ) ?? null
  );
}

export function isMemberOnlyToolPath(href: string): boolean {
  return findToolByRequestPath(href)?.membersonly === true;
}
