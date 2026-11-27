import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
function keyBytes(key: string) {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== key)
    throw new Error("voucher_key_invalid");
  return bytes;
}
export function sealVoucher(code: string, reward: string, secret: string) {
  const key = keyBytes(secret),
    iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(reward));
  const body = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const hash = createHmac("sha256", key).update("voucher-dedup/v1:").update(code).digest("hex");
  return {
    ciphertext: [
      "v1",
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      body.toString("base64"),
    ].join("."),
    hash,
  };
}
export function openVoucher(ciphertext: string, reward: string, secret: string) {
  const [version, iv, tag, data] = ciphertext.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("invalid_voucher");
  const cipher = createDecipheriv("aes-256-gcm", keyBytes(secret), Buffer.from(iv, "base64"), {
    authTagLength: 16,
  });
  cipher.setAAD(Buffer.from(reward));
  cipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([cipher.update(Buffer.from(data, "base64")), cipher.final()]).toString(
    "utf8",
  );
}
