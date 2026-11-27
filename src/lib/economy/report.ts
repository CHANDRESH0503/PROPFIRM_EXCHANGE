/** Read a bounded UTF-8 CSV with quoted commas, embedded newlines and escaped quotes. */
export function parseCommissionCsv(raw: string) {
  if (raw.length > 500_000) throw new Error("size");
  const text = raw.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  function finishField() {
    row.push(field.trim());
    field = "";
    closed = false;
    if (row.length > 64) throw new Error("columns");
  }
  function finishRow() {
    finishField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
    if (rows.length > 501) throw new Error("rows");
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (ch === ",") finishField();
    else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else if (ch === '"' && !field && !closed) quoted = true;
    else if (closed || ch === '"') throw new Error("quotes");
    else field += ch;
  }
  if (quoted) throw new Error("quotes");
  finishRow();
  const header = rows.shift();
  if (
    !header ||
    !rows.length ||
    header.some((h) => !h) ||
    new Set(header).size !== header.length ||
    rows.some((r) => r.length !== header.length)
  )
    throw new Error("shape");
  return { header, rows };
}

export type ReportMapping = { external: string; order: string; amount: string };
export function mapCommissionRows(csv: ReturnType<typeof parseCommissionCsv>, map: ReportMapping) {
  const indices = [map.external, map.order, map.amount].map((k) => csv.header.indexOf(k));
  if (indices.includes(-1) || new Set(indices).size !== 3) throw new Error("mapping");
  return csv.rows.map((row) => {
    const [external, order, amount] = indices.map((i) => row[i]!);
    if (
      !external ||
      external.length > 160 ||
      !order ||
      order.length > 128 ||
      !amount ||
      !/^\d{1,8}(\.\d{1,2})?$/.test(amount)
    )
      throw new Error("value");
    const [whole, dec = ""] = amount.split(".");
    const cents = Number(whole) * 100 + Number(dec.padEnd(2, "0"));
    if (cents <= 0 || cents > 2147483647) throw new Error("amount");
    return { external, order, cents };
  });
}
