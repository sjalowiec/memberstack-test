import type { ColumnDef, PgColumnType } from "./types";

const NULL_LITERALS = new Set(["", "null", "NULL"]);

export function isNullLiteral(value: string | undefined | null): boolean {
  if (value == null) {
    return true;
  }
  return NULL_LITERALS.has(value.trim());
}

export function coerceCellValue(
  rawValue: string | undefined,
  column: ColumnDef,
): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (isNullLiteral(rawValue)) {
    if (column.nullable === false) {
      return { ok: false, reason: `${column.pg} is required` };
    }
    return { ok: true, value: null };
  }

  const value = rawValue ?? "";

  switch (column.type) {
    case "text":
      return { ok: true, value };
    case "integer": {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        return { ok: false, reason: `${column.pg} is not a valid integer: ${value}` };
      }
      return { ok: true, value: parsed };
    }
    case "bigint": {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        return { ok: false, reason: `${column.pg} is not a valid bigint: ${value}` };
      }
      return { ok: true, value: parsed };
    }
    case "numeric": {
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        return { ok: false, reason: `${column.pg} is not a valid number: ${value}` };
      }
      return { ok: true, value: parsed };
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return { ok: false, reason: `${column.pg} is not a valid date: ${value}` };
      }
      return { ok: true, value: value.slice(0, 10) };
    }
    case "timestamptz": {
      const parsed = Date.parse(value.replace(" ", "T"));
      if (Number.isNaN(parsed)) {
        return { ok: false, reason: `${column.pg} is not a valid timestamp: ${value}` };
      }
      return { ok: true, value: new Date(parsed) };
    }
    default: {
      const _exhaustive: never = column.type satisfies PgColumnType;
      return _exhaustive;
    }
  }
}
