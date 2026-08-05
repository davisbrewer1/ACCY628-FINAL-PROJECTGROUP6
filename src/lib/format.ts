import { format, parseISO, isValid } from "date-fns";

function toDate(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : new Date(value);
}

export function formatCurrency(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = toDate(value);
  if (!isValid(date)) {
    return "—";
  }
  return format(date, "MMM d, yyyy");
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = toDate(value);
  if (!isValid(date)) {
    return "—";
  }
  return format(date, "MMM d, yyyy h:mm a");
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) {
    return "—";
  }
  return `${hours.toFixed(2)} hrs`;
}
