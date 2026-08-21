import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const FPS = 30;
const mode = process.argv[2] || 'preview';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(DIR, 'demo.html'));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

if (mode === 'preview') {
  const times = process.argv[3]
    ? process.argv[3].split(',').map(Number)
    : [1.2, 5.0, 9.0, 12.5, 15.0, 18.0, 22.5, 25.5, 28.5, 31.0, 36.0];
  fs.mkdirSync(path.join(DIR, 'preview'), { recursive: true });
  for (const t of times) {
    await page.evaluate(t => window.seek(t), t);
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(DIR, 'preview', `t${t.toFixed(1)}.png`) });
    console.log('preview t=' + t);
  }
} else {
  const duration = await page.evaluate(() => window.DURATION);
  const total = Math.round(duration * FPS);
  const framesDir = path.join(DIR, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.seek(t), f / FPS);
    await page.screenshot({ path: path.join(framesDir, `f${String(f).padStart(4, '0')}.png`) });
    if (f % 150 === 0) console.log(`frame ${f}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`done: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
