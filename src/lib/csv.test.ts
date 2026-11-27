import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("neutralises formulas but keeps numbers", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-40")).toBe("-40");
    expect(csvCell(-40)).toBe("-40");
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell(null)).toBe("");
    expect(csvCell("a,b")).toBe('"a,b"');
  });
  it("writes a header and CRLF rows", () => {
    expect(toCsv([{ a: 1, b: "x" }], ["a", "b"])).toBe("a,b\r\n1,x\r\n");
  });
});
