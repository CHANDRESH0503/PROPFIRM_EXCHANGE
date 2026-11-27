/** Fixed-locale formatting so server and client render identical text. */
export function money(cents: number, currency: string, signed = false) {
  const text = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  return signed && cents > 0 ? `+${text}` : text;
}

export function compactMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export function percent(value: number | null) {
  return value === null
    ? "—"
    : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function decimal(value: number | null, digits = 2) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value);
}

export function dayLabel(day: string, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(style === "long" ? { weekday: "short", year: "numeric" } : {}),
  }).format(new Date(`${day}T12:00:00Z`));
}
