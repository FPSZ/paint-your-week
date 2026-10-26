// README images: node promo/shots.js  →  docs/banner-light.png, docs/banner-dark.png
import puppeteer from 'puppeteer-core';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1280, height: 440, deviceScaleFactor: 2 } });
const p = await b.newPage();
for (const theme of ['light', 'dark']) {
  await p.goto('file:///' + path.join(ROOT, 'promo/banner.html').replace(/\\/g, '/') + (theme === 'dark' ? '?dark' : ''));
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 400));
  await p.screenshot({ path: path.join(ROOT, `docs/banner-${theme}.png`) });
}
await b.close();
console.log('banners written');
