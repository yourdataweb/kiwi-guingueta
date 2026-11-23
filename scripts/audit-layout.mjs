import { createRequire } from 'node:module';
const require = createRequire('/home/davidoc/.openclaw/workspace/');
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://127.0.0.1:8099/';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();

const widths = [360, 390, 480, 768, 1024, 1280, 1440, 1920];

for (const w of widths) {
  await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 500));

  const res = await page.evaluate(() => {
    const overflow = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'absolute') {
          overflow.push(`${el.tagName}.${el.className || ''}`.slice(0, 70));
        }
      }
    });
    const poster = document.querySelector('.hero-media img');
    return {
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      overflow: [...new Set(overflow)].slice(0, 6),
      posterLoaded: poster ? poster.naturalWidth > 0 : false,
      posterW: poster?.naturalWidth || 0
    };
  });

  const bad = res.scrollW > res.innerW + 1;
  console.log(`${String(w).padStart(5)}px  scrollW=${String(res.scrollW).padStart(5)}  ${bad ? '❌ OVERFLOW' : '✓'}  poster=${res.posterLoaded ? 'ok(' + res.posterW + ')' : 'MISSING'}`);
  if (res.overflow.length) console.log(`          offenders: ${res.overflow.join(', ')}`);
}

// desktop detail checks
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 800));

const detail = await page.evaluate(() => {
  const cs = (sel, prop) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : null;
  };
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };
  // font actually applied?
  const h1 = document.querySelector('#hero-title');
  const fontsReady = document.fonts ? document.fonts.status : 'n/a';

  // review card equal heights
  const cards = [...document.querySelectorAll('#review-grid .review')].map((c) => Math.round(c.getBoundingClientRect().height));

  // feature cards
  const feats = [...document.querySelectorAll('.feature')].map((c) => Math.round(c.getBoundingClientRect().height));

  // hero text vs background contrast proxy: h1 color + scrim opacity
  return {
    fontStatus: fontsReady,
    h1Family: cs('#hero-title', 'fontFamily'),
    h1Size: cs('#hero-title', 'fontSize'),
    h1Color: cs('#hero-title', 'color'),
    bodyFamily: cs('body', 'fontFamily'),
    headerStuck: document.querySelector('.site-header').classList.contains('is-stuck'),
    heroBox: box('.hero'),
    heroImgBox: box('.hero-media img'),
    mapBox: box('.map-card'),
    mapIframeBox: box('#map-frame'),
    reviewCardHeights: cards,
    reviewHeightsEqual: cards.length > 0 && new Set(cards).size === 1,
    featureHeights: feats,
    waFabBox: box('.wa-fab'),
    featuresShown: document.querySelectorAll('.feature-icon svg').length,
    capsShown: document.querySelectorAll('.cap').length,
    // does the map iframe actually have a document?
    mapSrcPresent: !!document.querySelector('#map-frame')?.src
  };
});

console.log('\n--- desktop detail ---');
console.log(JSON.stringify(detail, null, 2));

// scroll to test sticky header
await page.evaluate(() => window.scrollTo(0, 800));
await new Promise((r) => setTimeout(r, 400));
const stuck = await page.evaluate(() => document.querySelector('.site-header').classList.contains('is-stuck'));
console.log('\nsticky header activates on scroll:', stuck);

// mobile nav toggle
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 400));
const toggle = await page.$('.nav-toggle');
const toggleVisible = await page.evaluate(() => getComputedStyle(document.querySelector('.nav-toggle')).display !== 'none');
await toggle.click();
await new Promise((r) => setTimeout(r, 350));
const navOpen = await page.evaluate(() => !document.querySelector('#mobile-nav').hidden);
await toggle.click();
await new Promise((r) => setTimeout(r, 300));
const navClosed = await page.evaluate(() => document.querySelector('#mobile-nav').hidden);
console.log('mobile nav: toggleVisible=' + toggleVisible + ' opens=' + navOpen + ' closes=' + navClosed);

// reduced motion + print sanity
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.reload({ waitUntil: 'networkidle2' });
console.log('reduced-motion reload: ok');

await browser.close();
