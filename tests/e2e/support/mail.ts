import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import { MAIL_DIR } from "../../../playwright.config";

interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Waits for the newest email to `to` in the local mail sink and returns its first link. */
export async function linkFromLatestMail(to: string, timeoutMs = 15_000): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const files = (await readdir(MAIL_DIR).catch(() => [])).sort().reverse();
        for (const file of files.filter((f) => f.endsWith(".json"))) {
          let mail: Mail;
          try {
            mail = JSON.parse(await readFile(path.join(MAIL_DIR, file), "utf8")) as Mail;
          } catch {
            continue; // being written; the next poll reads it
          }
          if (mail.to === to) {
            link = mail.text.match(/https?:\/\/\S+/)?.[0];
            return Boolean(link);
          }
        }
        return false;
      },
      { timeout: timeoutMs, message: `no email to ${to}` },
    )
    .toBe(true);
  return link!;
}
