import { brand } from "@/config/brand";
import { translator } from "@/i18n/translator";

/**
 * Transactional email templates. Plain, table-free HTML that survives every client, with a
 * text part. Colours match the default theme but nothing depends on images loading.
 */
function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(opts: { preheader: string; heading: string; paragraphs: string[]; action: { label: string; url: string }; footer: string }) {
  const p = opts.paragraphs.map((t) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2a2f37">${escape(t)}</p>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f2ee;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(opts.preheader)}</span>
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <p style="margin:0 0 28px;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0b0d10">${escape(brand.name)}</p>
  <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b0d10">${escape(opts.heading)}</h1>
  ${p}
  <p style="margin:24px 0 28px"><a href="${escape(opts.action.url)}" style="display:inline-block;background:#0b0d10;color:#f2f0eb;text-decoration:none;font-weight:600;font-size:16px;padding:14px 22px;border-radius:10px">${escape(opts.action.label)}</a></p>
  <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5b6370;word-break:break-all">${escape(opts.action.url)}</p>
  <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#5b6370">${escape(opts.footer)}</p>
</div></body></html>`;
}

export function waitlistConfirmEmail(url: string) {
  const e = translator("email");
  const t = (key: string, values?: Record<string, string>) => e(`waitlistConfirm.${key}` as Parameters<typeof e>[0], values as never);
  const paragraphs = [t("body1"), t("body2")];
  const action = { label: t("action"), url };
  const footer = t("footer", { brand: brand.name });
  return {
    subject: t("subject", { brand: brand.name }),
    html: layout({ preheader: t("preheader"), heading: t("heading"), paragraphs, action, footer }),
    text: [t("heading"), "", ...paragraphs, "", `${action.label}: ${url}`, "", footer].join("\n"),
  };
}
