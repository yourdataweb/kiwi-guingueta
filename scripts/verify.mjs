import { createRequire } from 'node:module';
const require = createRequire('/home/davidoc/.openclaw/workspace/');
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://127.0.0.1:8099/';
const SHOTS = process.env.SHOTS || '/tmp/kiwi2';
const fs = require('node:fs');
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('requestfailed', (r) => {
  const u = r.url();
  if (!/fonts\.g|googleusercontent|maps\.g|gstatic/.test(u)) {
    errors.push('REQFAIL: ' + u + ' — ' + r.failure()?.errorText);
  }
});

async function inspect(url, label) {
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
  await new Promise((r) => setTimeout(r, 900));

  const data = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    return {
      htmlLang: document.documentElement.lang,
      title: document.title,
      h1: q('#hero-title')?.innerText?.replace(/\s+/g, ' ').trim(),
      navLabels: qa('.nav a').map((a) => a.textContent.trim()),
      langOpts: qa('.lang-switch .lang-opt').map((a) => ({
        text: a.textContent.trim(), href: a.getAttribute('href'), active: a.classList.contains('is-active')
      })),
      socialLinks: qa('.social-bar .social-link').map((a) => ({
        label: a.getAttribute('aria-label'), href: a.href
      })),
      reviews: qa('#review-grid .review').length,
      reviewLangs: qa('#review-grid .review-lang').map((e) => e.textContent.trim()),
      ratingBadge: !!q('.rating-badge'),
      ratingValue: q('.rating-value')?.textContent?.trim(),
      reviewCountText: q('.rating-meta span')?.textContent?.trim(),
      waLinks: qa('a[href*="wa.me"]').length,
      waHref: q('a[href*="wa.me"]')?.href,
      telLinks: qa('a[href^="tel:"]').map((a) => a.getAttribute('href')),
      hoursRows: qa('#hours-list li').length,
      todayRow: q('#hours-list li.is-today')?.textContent?.replace(/\s+/g, ' ').trim(),
      todayBadge: q('.hours-today')?.textContent?.trim(),
      status: q('#open-status')?.textContent?.trim(),
      caps: qa('.cap').length,
      capHeadings: qa('.cap-group h4').map((h) => h.textContent.trim()),
      canonical: q('link[rel="canonical"]')?.href,
      hreflangs: qa('link[rel="alternate"][hreflang]').map((l) => l.hreflang + '=' + l.href),
      ogLocale: q('meta[property="og:locale"]')?.content,
      mapSrc: q('#map-frame')?.src?.includes('output=embed'),
      structured: (() => {
        try {
          const j = JSON.parse(q('script[type="application/ld+json"]').textContent);
          return { type: j['@type'], name: j.name, rating: j.aggregateRating?.ratingValue, lang: j.inLanguage, sameAs: j.sameAs?.length };
        } catch { return null; }
      })(),
      skipLink: q('.skip')?.textContent?.trim(),
      imgAlts: qa('img').map((i) => i.alt),
      headingOrder: qa('h1,h2,h3').map((h) => h.tagName),
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth
    };
  });

  console.log(`\n===== ${label} =====`);
  console.log(JSON.stringify(data, null, 2));
  return data;
}

const es = await inspect(BASE, 'ES (default, /)');
const en = await inspect(BASE + 'en/', 'EN (/en/)');

// screenshots
for (const [name, url] of [['es', BASE], ['en', BASE + 'en/']]) {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: `${SHOTS}/${name}-desktop.png`, fullPage: true });

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: `${SHOTS}/${name}-mobile.png`, fullPage: true });

  const ov = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, i: window.innerWidth }));
  console.log(`\n${name} mobile overflow: ${ov.s > ov.i + 1 ? '❌ ' + ov.s + ' > ' + ov.i : '✓ none'}`);
}

// language switch navigation actually works
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle2' });
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle2' }),
  page.click('.lang-switch .lang-opt[lang="en"]')
]);
console.log('\nES → EN switch landed on:', page.url(), '| lang attr:', await page.evaluate(() => document.documentElement.lang));

await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle2' }),
  page.click('.lang-switch .lang-opt[lang="es"]')
]);
console.log('EN → ES switch landed on:', page.url(), '| lang attr:', await page.evaluate(() => document.documentElement.lang));

// mobile nav + keyboard
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.click('.nav-toggle');
await new Promise((r) => setTimeout(r, 350));
const opened = await page.evaluate(() => ({
  expanded: document.querySelector('.nav-toggle').getAttribute('aria-expanded'),
  hidden: document.querySelector('#mobile-nav').hidden,
  socialInDrawer: document.querySelectorAll('.social-bar--mobile .social-link').length,
  langInDrawer: document.querySelectorAll('.lang-switch--mobile .lang-opt').length
}));
console.log('mobile drawer open:', JSON.stringify(opened));

await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 300));
console.log('escape closes drawer:', await page.evaluate(() => document.querySelector('#mobile-nav').hidden));

console.log('\nERRORS:', errors.length ? JSON.stringify([...new Set(errors)], null, 2) : 'none');
await browser.close();
