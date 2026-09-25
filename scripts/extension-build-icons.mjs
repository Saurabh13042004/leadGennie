// Renders the extension's toolbar icons (16/32/48/128) from the dashboard's brand mark — the sparkle on the dark
// gradient tile used in the sidebar's workspace menu — using the system Chrome. Run once; the PNGs are committed.
//
//   node scripts/extension-build-icons.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = new URL("../chrome-extension/icons/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262626"/><stop offset="1" stop-color="#0a0a0a"/></linearGradient></defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <rect x="0.5" y="0.5" width="127" height="127" rx="27.5" fill="none" stroke="rgba(255,255,255,.14)"/>
  <g transform="translate(32 32) scale(2.667)"><path fill="#fff" d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z"/></g>
</svg>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size)}</body></html>`);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(join(OUT, `icon${size}.png`), png);
  console.log(`icon${size}.png`);
}
await browser.close();
