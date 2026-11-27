/**
 * CSV cells guarded against spreadsheet formula injection (a cell starting with = + - @ or a
 * control character is prefixed with an apostrophe). Plain numbers, including negatives, are
 * left as numbers so financial exports stay usable.
 */
export function csvCell(value: unknown): string {
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  return (
    [columns.join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join(
      "\r\n",
    ) + "\r\n"
  );
}
