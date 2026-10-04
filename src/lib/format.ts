// Dates stored as @db.Date come back as UTC midnight, so always format in UTC.

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** YYYY-MM-DD for <input type="date">. */
export function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Parses the YYYY-MM-DD value of a date input as a UTC date. */
export function fromDateInput(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatMoney(amount: { toString(): string } | number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(amount));
  } catch {
    return `${Number(amount).toLocaleString("en")} ${currency}`;
  }
}

export function formatQuantity(quantity: { toString(): string } | number) {
  return Number(quantity).toLocaleString("en", { maximumFractionDigits: 3 });
}
