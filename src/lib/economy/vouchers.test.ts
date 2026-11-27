import { expect, it } from "vitest";
import { openVoucher, sealVoucher } from "./vouchers";
it("binds codes to the reward, randomizes ciphertext and identifies repeated stock", () => {
  const key = Buffer.alloc(32, 42).toString("base64"),
    a = sealVoucher("CODE", "one", key),
    b = sealVoucher("CODE", "one", key);
  expect(a.hash).toBe(b.hash);
  expect(a.ciphertext).not.toBe(b.ciphertext);
  expect(openVoucher(a.ciphertext, "one", key)).toBe("CODE");
  expect(() => openVoucher(a.ciphertext, "two", key)).toThrow();
});
