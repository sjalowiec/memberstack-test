/**
 * Customer-facing markup for Account purchase history.
 * Renders only the public order fields. Tracking hrefs are sanitized again.
 */
import { escapeHtml } from "../favorites/favoriteStarUi";
import { sanitizeTrackingUrl } from "../watson/orderTrackingLinks";
import type { AccountPurchaseHistory, AccountPurchaseOrder } from "./accountPurchaseHistory";

function itemLine(order: AccountPurchaseOrder): string {
  if (order.items.length === 0) {
    return `<p class="account-purchases__items-empty">No items listed</p>`;
  }
  const rows = order.items
    .map((item) => {
      const quantity = item.quantity
        ? `<span class="account-purchases__qty">Qty ${escapeHtml(item.quantity)}</span>`
        : "";
      return `<li class="account-purchases__item"><span class="account-purchases__item-title">${escapeHtml(item.title)}</span>${quantity}</li>`;
    })
    .join("");
  return `<ul class="account-purchases__items">${rows}</ul>`;
}

function trackingLine(order: AccountPurchaseOrder): string {
  if (order.trackingLinks.length === 0) return "";
  const links = order.trackingLinks
    .map((link) => {
      const url = sanitizeTrackingUrl(link.url);
      const number = link.trackingNumber
        ? `<span class="account-purchases__tracking-number">${escapeHtml(link.trackingNumber)}</span>`
        : "";
      if (url) {
        return `<a class="account-purchases__tracking-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" data-kbm-account-purchase-tracking>${escapeHtml(link.label)}</a>${number}`;
      }
      return `<span class="account-purchases__tracking-text">${escapeHtml(link.label)}</span>${number}`;
    })
    .join("");
  return `<div class="account-purchases__tracking">${links}</div>`;
}

export function renderAccountPurchaseOrder(order: AccountPurchaseOrder): string {
  const date = order.orderDate
    ? escapeHtml(order.orderDate)
    : "Date unavailable";
  return `<article class="account-purchases__order">
    <header class="account-purchases__order-header">
      <h3 class="account-purchases__order-number">Order ${escapeHtml(order.orderNumber)}</h3>
      <p class="account-purchases__date">${date}</p>
    </header>
    <dl class="account-purchases__status">
      <div>
        <dt>Payment</dt>
        <dd>${escapeHtml(order.paymentStatus)}</dd>
      </div>
      <div>
        <dt>Fulfillment</dt>
        <dd>${escapeHtml(order.fulfillmentStatus)}</dd>
      </div>
    </dl>
    ${itemLine(order)}
    ${trackingLine(order)}
  </article>`;
}

export function renderAccountPurchaseOrders(orders: AccountPurchaseOrder[]): string {
  return orders.map(renderAccountPurchaseOrder).join("");
}

export function renderAccountPurchaseNotes(history: Pick<
  AccountPurchaseHistory,
  "syncNote" | "legacyNote" | "emailNote"
>): { syncNote: string; legacyNote: string; emailNote: string } {
  return {
    syncNote: history.syncNote,
    legacyNote: history.legacyNote ?? "",
    emailNote: history.emailNote,
  };
}
