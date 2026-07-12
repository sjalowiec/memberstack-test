import { hasDisplayValue } from "./memberDetail";
import { formatMemberJoinedDateDisplay, type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export interface LegacyStoreTransactionRow {
  storetransactionid: string | number;
  transactionid: string;
  purchasedate: Date | string | null;
  totalcost: string | number | null;
  transactionmethod: string | null;
  fulfillment_status_current: string | null;
  fulfillment_status: string | null;
  paid: number | null;
}

export interface LegacyStoreTransactionItemRow {
  transaction_itemid: string | number;
  storetransactionid: string | number;
  itemname: string | null;
  quantity: number | null;
  priceperitem: string | number | null;
  totalprice: string | number | null;
  product: string | null;
  saledescripton: string | null;
  color: string | null;
}

export interface MemberOrderItemDisplay {
  transactionItemId: string;
  description: string;
  quantity: string | null;
  itemPrice: string | null;
  lineTotal: string | null;
}

export interface MemberOrderDisplay {
  storeTransactionId: string;
  transactionId: string;
  orderDate: string | null;
  orderDateSort: string;
  orderStatus: string | null;
  orderTotal: string | null;
  orderTotalSort: string;
  paymentMethod: string | null;
  items: MemberOrderItemDisplay[];
}

export const MEMBER_ORDERS_SQL = `
  SELECT
    storetransactionid,
    transactionid,
    purchasedate,
    totalcost,
    transactionmethod,
    fulfillment_status_current,
    fulfillment_status,
    paid
  FROM legacy_store_transactions
  WHERE memberid_fk = $1
  ORDER BY purchasedate DESC NULLS LAST, storetransactionid DESC
`;

export const MEMBER_ORDER_COUNT_SQL = `
  SELECT COUNT(*)::text AS order_count
  FROM legacy_store_transactions
  WHERE memberid_fk = $1
`;

export const MEMBER_ORDER_ITEMS_SQL = `
  SELECT
    transaction_itemid,
    storetransactionid,
    itemname,
    quantity,
    priceperitem,
    totalprice,
    product,
    saledescripton,
    color
  FROM legacy_store_transaction_items
  WHERE storetransactionid = ANY($1::bigint[])
  ORDER BY storetransactionid, transaction_itemid
`;

export function formatLegacyMoney(value: string | number | null | undefined): string | null {
  if (value == null || value === "") {
    return null;
  }
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (Number.isNaN(amount)) {
    return null;
  }
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function formatLegacyOrderStatus(row: Pick<
  LegacyStoreTransactionRow,
  "fulfillment_status_current" | "fulfillment_status" | "paid"
>): string | null {
  if (hasDisplayValue(row.fulfillment_status_current)) {
    return String(row.fulfillment_status_current).trim();
  }
  if (hasDisplayValue(row.fulfillment_status)) {
    return String(row.fulfillment_status).trim();
  }
  if (row.paid === 1) {
    return "Paid";
  }
  if (row.paid === 0) {
    return "Unpaid";
  }
  return null;
}

export function buildOrderItemDescription(item: LegacyStoreTransactionItemRow): string {
  const parts: string[] = [];
  if (hasDisplayValue(item.itemname)) {
    parts.push(String(item.itemname).trim());
  }
  if (hasDisplayValue(item.color)) {
    parts.push(String(item.color).trim());
  }
  if (hasDisplayValue(item.product)) {
    parts.push(String(item.product).trim());
  }
  if (hasDisplayValue(item.saledescripton)) {
    parts.push(String(item.saledescripton).trim());
  }
  return parts.length > 0 ? parts.join(" ù ") : "ù";
}

export function buildOrderItemDisplay(item: LegacyStoreTransactionItemRow): MemberOrderItemDisplay {
  return {
    transactionItemId: String(item.transaction_itemid),
    description: buildOrderItemDescription(item),
    quantity: item.quantity != null ? String(item.quantity) : null,
    itemPrice: formatLegacyMoney(item.priceperitem),
    lineTotal: formatLegacyMoney(item.totalprice),
  };
}

export function buildOrderDisplay(
  order: LegacyStoreTransactionRow,
  items: LegacyStoreTransactionItemRow[],
): MemberOrderDisplay {
  const orderDate = order.purchasedate ? formatMemberJoinedDateDisplay(order.purchasedate) : null;
  const orderDateSort = order.purchasedate
    ? order.purchasedate instanceof Date
      ? order.purchasedate.toISOString()
      : String(order.purchasedate)
    : "";

  const orderTotal = formatLegacyMoney(order.totalcost);

  return {
    storeTransactionId: String(order.storetransactionid),
    transactionId: order.transactionid,
    orderDate,
    orderDateSort,
    orderStatus: formatLegacyOrderStatus(order),
    orderTotal,
    orderTotalSort: order.totalcost != null ? String(order.totalcost) : "",
    paymentMethod: hasDisplayValue(order.transactionmethod)
      ? String(order.transactionmethod).trim()
      : null,
    items: items.map(buildOrderItemDisplay),
  };
}

export function groupOrderItemsByStoreTransactionId(
  items: LegacyStoreTransactionItemRow[],
): Map<string, LegacyStoreTransactionItemRow[]> {
  const grouped = new Map<string, LegacyStoreTransactionItemRow[]>();
  for (const item of items) {
    const key = String(item.storetransactionid);
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  return grouped;
}

export function getVisibleOrderColumns(orders: MemberOrderDisplay[]): {
  showStatus: boolean;
  showPayment: boolean;
} {
  return {
    showStatus: orders.some((order) => order.orderStatus != null),
    showPayment: orders.some((order) => order.paymentMethod != null),
  };
}

export function getVisibleItemColumns(items: MemberOrderItemDisplay[]): {
  showQuantity: boolean;
  showItemPrice: boolean;
  showLineTotal: boolean;
} {
  return {
    showQuantity: items.some((item) => item.quantity != null),
    showItemPrice: items.some((item) => item.itemPrice != null),
    showLineTotal: items.some((item) => item.lineTotal != null),
  };
}

export async function getMemberOrderCount(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const normalized = memberid.trim();
  if (!normalized) {
    return 0;
  }

  const rows = await queryFn<{ order_count: string }>(MEMBER_ORDER_COUNT_SQL, [normalized]);
  const count = Number.parseInt(rows[0]?.order_count ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getMemberOrders(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberOrderDisplay[]> {
  const normalized = memberid.trim();
  if (!normalized) {
    return [];
  }

  const orders = await queryFn<LegacyStoreTransactionRow>(MEMBER_ORDERS_SQL, [normalized]);
  if (orders.length === 0) {
    return [];
  }

  const storeTransactionIds = orders.map((order) => Number(order.storetransactionid));
  const items = await queryFn<LegacyStoreTransactionItemRow>(MEMBER_ORDER_ITEMS_SQL, [
    storeTransactionIds,
  ]);
  const itemsByOrder = groupOrderItemsByStoreTransactionId(items);

  return orders.map((order) =>
    buildOrderDisplay(order, itemsByOrder.get(String(order.storetransactionid)) ?? []),
  );
}
