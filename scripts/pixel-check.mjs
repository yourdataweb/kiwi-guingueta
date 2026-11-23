import { createRequire } from 'node:module';
const require = createRequire('/home/davidoc/.openclaw/workspace/');
const puppeteer = require('puppeteer');
const fs = require('node:fs');
const zlib = require('node:zlib');

const BASE = process.env.BASE || 'http://127.0.0.1:8099/';

/** Minimal PNG reader for 8-bit RGB/RGBA non-interlaced screenshots. */
function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : null;
  if (!ch) throw new Error('colorType ' + colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? out[(y - 1) * stride + x - ch] : 0;
      let v = raw[src + x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) v += paeth(a, b, c);
      out[y * stride + x] = v & 0xff;
    }
  }
  return { w, h, ch, data: out, px(x, y) {
    const i = y * stride + x * ch;
    return [out[i], out[i + 1], out[i + 2]];
  }};
}

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1000));

const shots = {
  hero: '/tmp/kiwi-shots/desktop-hero.png',
  about: '/tmp/kiwi-shots/about.png',
  reviews: '/tmp/kiwi-shots/reviews.png',
  visit: '/tmp/kiwi-shots/visit.png'
};

for (const [name, path] of Object.entries(shots)) {
  if (!fs.existsSync(path)) { console.log(`${name}: MISSING`); continue; }
  const img = decodePNG(fs.readFileSync(path));
  let sumL = 0, n = 0, uniq = new Set();
  for (let y = 0; y < img.h; y += 7) {
    for (let x = 0; x < img.w; x += 7) {
      const p = img.px(x, y);
      sumL += lum(p);
      n++;
      uniq.add((p[0] >> 4) + ',' + (p[1] >> 4) + ',' + (p[2] >> 4));
    }
  }
  const avg = (sumL / n).toFixed(1);
  const verdict = uniq.size < 3 ? 'BLANK!' : uniq.size < 12 ? 'LOW VARIETY' : 'ok';
  console.log(`${name.padEnd(8)} ${img.w}x${img.h}  avgLum=${avg.padStart(6)}  distinctColors=${String(uniq.size).padStart(4)}  ${verdict}`);
}

// Hero readability: text region luminance range (should have spread from scrim)
const hero = decodePNG(fs.readFileSync(shots.hero));
const band = [];
for (let y = 400; y < 760; y += 5) for (let x = 100; x < 1200; x += 5) band.push(lum(hero.px(x, y)));
band.sort((a, b) => a - b);
console.log(`\nhero text band: min=${band[0].toFixed(0)} p50=${band[(band.length * .5) | 0].toFixed(0)} max=${band[(band.length - 1)].toFixed(0)}`);

await browser.close();
