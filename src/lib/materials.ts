import type { ProjectAccess } from "@/lib/access";

type Num = { toString(): string } | number;

/** The hired company can pass a request it received on to the project owner. */
export function canForward(access: ProjectAccess, request: { status: string; toAccountId: string }) {
  return (
    request.status === "SUBMITTED" &&
    request.toAccountId !== access.project.accountId &&
    access.manages(request.toAccountId)
  );
}

/** Materials are matched across requests and reports by name and unit, ignoring case and spacing. */
export function materialKey(name: string, unit: string) {
  const clean = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
  return `${clean(name)}|${clean(unit)}`;
}

export type StockRow = {
  name: string;
  unit: string;
  received: number;
  used: number;
  remaining: number;
  /** Average price per unit over received deliveries that had a price, or null. */
  averagePrice: number | null;
  receivedCost: number;
  usedValue: number | null;
  remainingValue: number | null;
};

/**
 * The project's stock ledger: what was delivered through received material
 * requests, what daily reports say was used, and what should be left.
 */
export function buildStock(
  receivedItems: { name: string; unit: string; receivedQuantity: Num | null; unitPrice: Num | null }[],
  usedItems: { name: string; unit: string; quantity: Num }[],
): StockRow[] {
  const rows = new Map<string, { name: string; unit: string; received: number; used: number; cost: number; pricedQty: number }>();
  const row = (name: string, unit: string) => {
    const key = materialKey(name, unit);
    let entry = rows.get(key);
    if (!entry) {
      entry = { name: name.trim(), unit: unit.trim(), received: 0, used: 0, cost: 0, pricedQty: 0 };
      rows.set(key, entry);
    }
    return entry;
  };

  for (const item of receivedItems) {
    const quantity = Number(item.receivedQuantity ?? 0);
    const entry = row(item.name, item.unit);
    entry.received += quantity;
    if (item.unitPrice !== null) {
      entry.cost += quantity * Number(item.unitPrice);
      entry.pricedQty += quantity;
    }
  }
  for (const item of usedItems) row(item.name, item.unit).used += Number(item.quantity);

  return [...rows.values()]
    .map((entry) => {
      const averagePrice = entry.pricedQty > 0 ? entry.cost / entry.pricedQty : null;
      const remaining = entry.received - entry.used;
      return {
        name: entry.name,
        unit: entry.unit,
        received: entry.received,
        used: entry.used,
        remaining,
        averagePrice,
        receivedCost: entry.cost,
        usedValue: averagePrice === null ? null : entry.used * averagePrice,
        remainingValue: averagePrice === null ? null : Math.max(remaining, 0) * averagePrice,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function itemTotal(item: { quantity: Num; receivedQuantity: Num | null; unitPrice: Num | null }) {
  if (item.unitPrice === null) return null;
  return Number(item.receivedQuantity ?? item.quantity) * Number(item.unitPrice);
}

/** Sum of priced lines, plus how many lines have no price yet. */
export function requestTotal(items: { quantity: Num; receivedQuantity: Num | null; unitPrice: Num | null }[]) {
  let total = 0;
  let unpriced = 0;
  for (const item of items) {
    const line = itemTotal(item);
    if (line === null) unpriced++;
    else total += line;
  }
  return { total, unpriced };
}
