/**
 * Shared shell for LeadGennie's own (transactional) emails — invites, welcome. It mirrors the dashboard theme: a light
 * canvas, one white bordered card, neutral-900 primary button, neutral-500 secondary text, the black rounded logo mark.
 * Email clients ignore most CSS, so this is table layout with inline styles; nothing here needs an external stylesheet.
 * Pure functions: the base URL and every string arrive as arguments.
 */

export type EmailContent = { subject: string; html: string; text: string };

const INK = "#171717";
const MUTED = "#737373";
const BORDER = "#e5e5e5";
const CANVAS = "#fafafa";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export const paragraph = (html: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#404040;">${html}</p>`;

export function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:10px;background:${INK};">
<a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
</td></tr></table>`;
}

/** A numbered step, like the checklist rows in the app. */
export function step(n: number, title: string, detail: string): string {
  return `<tr><td valign="top" style="padding:0 12px 14px 0;width:28px;"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${INK};color:#ffffff;font-size:12px;font-weight:600;text-align:center;">${n}</div></td>
<td valign="top" style="padding:0 0 14px;font-family:${FONT};font-size:14px;line-height:21px;color:#404040;"><strong style="color:${INK};">${esc(title)}</strong><br>${esc(detail)}</td></tr>`;
}

export function screenshot(src: string, alt: string, caption?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr><td style="border:1px solid ${BORDER};border-radius:12px;overflow:hidden;background:#ffffff;">
<img src="${esc(src)}" alt="${esc(alt)}" width="536" style="display:block;width:100%;height:auto;border:0;border-radius:12px;">
</td></tr>${caption ? `<tr><td style="padding:8px 2px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${esc(caption)}</td></tr>` : ""}</table>`;
}

export function renderLayout(opts: { preheader: string; heading: string; body: string; footer: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:${CANVAS};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CANVAS};">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td style="padding:0 4px 20px;font-family:${FONT};">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:28px;height:28px;border-radius:8px;background:${INK};color:#ffffff;text-align:center;font-size:15px;line-height:28px;">&#10022;</td>
        <td style="padding-left:9px;font-size:16px;font-weight:600;letter-spacing:-0.01em;color:${INK};">LeadGennie</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${BORDER};border-radius:16px;padding:32px 32px 12px;font-family:${FONT};">
      <h1 style="margin:0 0 14px;font-size:24px;line-height:30px;font-weight:600;letter-spacing:-0.02em;color:${INK};">${esc(opts.heading)}</h1>
      ${opts.body}
    </td></tr>
    <tr><td style="padding:18px 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${opts.footer}</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
