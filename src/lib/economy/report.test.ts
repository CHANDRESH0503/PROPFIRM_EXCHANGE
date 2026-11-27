import { expect, it } from "vitest";
import { parseCommissionCsv, mapCommissionRows } from "./report";
it("maps quoted CSV and exact dollar amounts", () => {
  const csv = parseCommissionCsv(
    '\uFEFFCommission,Transaction,Order\r\n22.50,"a,""b""",item-3\r\n',
  );
  expect(
    mapCommissionRows(csv, { external: "Transaction", order: "Order", amount: "Commission" }),
  ).toEqual([{ external: 'a,"b"', order: "item-3", cents: 2250 }]);
});
it("rejects ambiguous headers, truncated quotes and fractional cents", () => {
  expect(() => parseCommissionCsv("a,a\n1,2")).toThrow();
  expect(() => parseCommissionCsv('a,b\n"test,2')).toThrow();
  expect(() =>
    mapCommissionRows(parseCommissionCsv("a,b,c\n1,2,0.001"), {
      external: "a",
      order: "b",
      amount: "c",
    }),
  ).toThrow();
});
