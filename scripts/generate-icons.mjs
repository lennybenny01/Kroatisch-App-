// Renders the SVG app icon to the PNG sizes required by iOS/Android.
// Uses Playwright's Chromium (no extra dependency needed in CI-less setups).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconSvg = readFileSync(resolve(root, 'public/icons/icon.svg'), 'utf8');
// Full-bleed variant (maskable / iOS): square background, content scaled into the safe zone.
const fullBleed = (scale) =>
  iconSvg
    .replace('<rect width="512" height="512" rx="112" fill="url(#bg)"/>',
      `<rect width="512" height="512" fill="url(#bg)"/><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">`)
    .replace('</svg>', '</g></svg>');
const maskableSvg = fullBleed(0.78);

const targets = [
  { svg: iconSvg, size: 192, out: 'icon-192.png' },
  { svg: iconSvg, size: 512, out: 'icon-512.png' },
  { svg: maskableSvg, size: 512, out: 'icon-maskable-512.png' },
  // iOS draws its own rounded corners, so use the full-bleed variant.
  { svg: fullBleed(0.9), size: 180, out: 'apple-touch-icon-180.png' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { svg, size, out } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.waitForTimeout(50);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(resolve(root, 'public/icons', out), buf);
  console.log('wrote', out);
}
await browser.close();
