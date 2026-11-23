import { createRequire } from 'node:module';
const require = createRequire('/home/davidoc/.openclaw/workspace/');
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://127.0.0.1:8099/';
const OUT = '/tmp/kiwi-shots';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('requestfailed', (r) => {
  const u = r.url();
  if (!u.includes('fonts.g') && !u.includes('googleusercontent')) {
    errors.push('REQFAIL: ' + u + ' — ' + r.failure()?.errorText);
  }
});

await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));

// --- assertions on rendered DOM ---
const checks = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const reviews = document.querySelectorAll('#review-grid .review');
  const badge = q('#rating-badge');
  const hours = document.querySelectorAll('#hours-list li');
  const caps = document.querySelectorAll('.cap-list .cap');
  const featureCols = q('#feature-columns');
  const waBtns = document.querySelectorAll('#wa-btn, #wa-fab, #hero-wa');
  const mapFrame = q('#map-frame');
  const today = q('#hours-list li.is-today');

  return {
    title: document.title,
    heroH1: q('#hero-title')?.textContent?.trim(),
    ratingValue: q('#rating-value')?.textContent?.trim(),
    ratingBadgeVisible: badge ? !badge.hidden : false,
    reviewCount: q('#rating-count')?.textContent?.trim(),
    reviewsRendered: reviews.length,
    reviewAuthors: [...reviews].map((r) => r.querySelector('strong')?.textContent),
    reviewStarsPresent: !!document.querySelector('#review-grid .review .review-stars svg'),
    hoursRows: hours.length,
    todayHighlighted: today?.textContent?.trim() || null,
    openStatus: q('#open-status')?.textContent?.trim(),
    capsRendered: caps.length,
    capabilitiesVisible: featureCols ? !featureCols.hidden : false,
    waButtons: waBtns.length,
    waHref: q('#wa-fab')?.href || q('#wa-btn')?.href || null,
    mapSrc: mapFrame?.src,
    mapHasEmbed: (mapFrame?.src || '').includes('output=embed'),
    canonical: q('link[rel="canonical"]')?.href,
    featureIcons: document.querySelectorAll('.feature-icon svg').length,
    bodyScrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth
  };
});

console.log(JSON.stringify(checks, null, 2));

// --- screenshots ---
await page.screenshot({ path: `${OUT}/desktop-hero.png` });

for (const [name, sel] of [
  ['about', '#about'],
  ['highlights', '#highlights'],
  ['reviews', '#reviews'],
  ['visit', '#visit']
]) {
  const el = await page.$(sel);
  if (el) await el.screenshot({ path: `${OUT}/${name}.png` });
}

await page.screenshot({ path: `${OUT}/desktop-full.png`, fullPage: true });

// mobile
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${OUT}/mobile-hero.png` });

const mobileOverflow = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  innerW: window.innerWidth
}));

await page.screenshot({ path: `${OUT}/mobile-full.png`, fullPage: true });

console.log('\nMOBILE OVERFLOW:', JSON.stringify(mobileOverflow));
console.log('\nERRORS:', errors.length ? JSON.stringify(errors, null, 2) : 'none');

await browser.close();
