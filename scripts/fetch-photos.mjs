#!/usr/bin/env node
/**
 * Resolve Google Places photo resource names into local images.
 *
 * The Places API (New) returns photo *names* (places/<id>/photos/<ref>), not URLs.
 * They must be fetched through the media endpoint with an API key:
 *
 *   GET https://places.googleapis.com/v1/{photo.name}/media?maxWidthPx=1600&key=KEY
 *
 * That redirects to the actual image bytes. This script follows the redirect,
 * downloads each photo into assets/photos/, and rewrites assets/data/place.json
 * with local paths so the site has no runtime dependency on the key.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=AIza... node scripts/fetch-photos.mjs
 *   GOOGLE_MAPS_API_KEY=... node scripts/fetch-photos.mjs --max 8 --width 1600
 *
 * Requires: Places API (New) enabled on the key's project. Billing applies
 * per photo request — check current pricing before running with a large --max.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = join(ROOT, 'assets', 'data', 'place.json');
const OUT = join(ROOT, 'assets', 'photos');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAX = Number(flag('max', 8));
const WIDTH = Number(flag('width', 1600));

if (!API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY.\n' +
    'Create one with the Places API (New) enabled, then re-run:\n' +
    '  GOOGLE_MAPS_API_KEY=AIza... node scripts/fetch-photos.mjs');
  process.exit(2);
}

/** Photo resource names live in the original API dump; recover them from PHOTOS below. */
const PHOTOS = [
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydheuYwWevRk4RhuU2dfSte_AZbZa-Drhfqo7C0WjiiK4Za2H0ngsc4IGV_oNpD5U3l_GrwM8xZ9MvSBnBvjSl-S9B2MnTFwRQ_UQg-BTfKMX92ZZn7O0togRmhEwIcDM-N6umBuqQKGn43quH7pkE5-hzmT4p0mydZ73P1R5C7n9I4My5TAkKCA03UD-4N3P6rRmqd7z_Ucc5Lyvm6dMVoYNJNstyOXw5fDtT2Or0W-6WHUI6UULopvsWYLN6bm350RDAny8fBHWaZj5Slm4CLRCpGVeG2_jNbzVrwTJs1ulsxTsp6gPerRCTMgDZisbBbeug3awl7Tj2egx21291YMrcghBHuZEmnsDX4yn5VmMB7IC0tllb1wNXuQimDoNg3025pAbDo1icvLQ_UwzR_IJhy1G7-VaqeGw5FuPHFWai815zVCHKH9sZUHsA',
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydhXnGqd7eriZk9r1ad0-FbfTmMNGvp8ul4UYFSNK83UuSvgppB6a7BekoacL0qabxlLz5SJ1eg0vdpFpOXHRfwBquHrFOcpmkdOxfY09uC2hKCGa0NF4nA2N2g8bGdob0CNsEt1Eaq78Bn4wPPMNKiLZNaUqNmV5yeVgagcN0lIXNLfgsboENWNyC7X59ltMYowkscH2JlsQXoJ6YAvSrf6zL20rcAWrEQpkPBQ_py1NkI2Ozq7M4NPjDsLdJDhk4q57BwhIvHtpzzQSZOzNGocEn1oTIQX1uOJ_C6NzA6vhO5ljWXTNApBNWI9t6BYoBnxfvuySvbq_epslabrYQpZkcKsp5w7lyUshVmXE2RPIXplAHq566k4JAsGyoMDG2mvFWoQcSBSB5p_AqpZf075hz7f7DZRovInZ5Rk6fjaZ4V3YSofZ_jnGRe-VeSl',
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydhXol2AXUYlnklfl2Pza_5f4mAjzAgFtuhtrjvyA_4iHNhkKOSjsu9zLV6pGKdzTwU35MHagu9T19-ou0JizqgRF68KbBCgWMVPI2TCo7OybPru2rtLCR8pirFA3v6_O2KDQWb32vZbemPgQQaWac6F_AtBQlIgtvJ7A3qxTO2au2snhoUw5d6-uEIWx24pf5ysP0SH0FE8P9DePBEG6z5jfcsopfKP3HvtT7PyKjqFipkXTHDBMkVaOGqVlBOSGRKTeZWLOx1o92Wkg2cBVkG4Bc6c6HlFziBZkELNMgO_Pco5PVKHBxI8Jn6KLRat0NhCEceqlvtOcmlcNcADePd3_vT8T3hmou6bPafeRU1CYG4KwVOGueRDTgC_wWM1GYCElpsIYhqzylkddCx868tJA66YgTQKB00ZEgQ_WRNFXk8tKiafVcLx5me9yg',
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydjWKk0mXGNOmx2jeNKrfhkFLWobx3VCsO0HSbXkZVXSdnl1ShltTF7b-UR6vNMBxMrbu8Lgm88DvvaCacuSXo7Wxlkzw5U80QERfxiYcZ971E9k4TR3VYlXMRYugUQq6MsOPWoDYgBeDg0-aFzQk77IXW7_WOl2mkHzyp302X9Mk8ChvksWPOF6wY0VPllfnqTJYulWwPfOIh_c-kSFbjA-kBYEH9la_-gT6S4vKUfNd2gljlRElj572ePZeafZhoeeHfLdk3rOc1HttLzKkmf5Yv03rQj6KXcJDuGTNSY89thzI1jOxzl0FoDDz829h90jlniYD68mHbpmD0FPGPAZ9S8lTL05cYN8VMubuONWGEa41lgopSKlCrBHDRbltR7OqETt9XO4tkQU-CbGCssqhqsI8Q8iyWTwvwesJKEx18NVZecomOiTivhhmULm',
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydhvDAQGdiTcTv_eMYNUT5Nl7IDdno7FJv8LZ6NLYEcLrNV4DiLWNjSRD10JB-RWs006JbmExVBOfIGn7KAOvWM4IdjNIqGV4QMkOH9y-gD9Af86xvbJulkjvRuV1X4g-5t0VDVKqdq6Lt0DJHuoMpFYo4w8d0MN7ZO8mwhJeqQVUe5OD7sD4rJGKFPFvzalutXYoSO2TjFdNMeF3KDlbD8lUYzGrQUvnF6R_CREGn7UGEFMY77xaPjUi4F1nrSVGWk3_DMGiY-1gIBjn_PwABhrqspFQvC6unkdbz5s2r4CugAsCHEu0SJGvpFWkbX4dSBjgbj8xM6c69vSUua0PJPiJCR9pGddoKAk6yA-f0l1MKaH5tU5B5-oyXKdAnjyRJ4NzrgIpw6aKWfkKvG-3mjneB-hFz7ttIWvPB5lL9JHdfsBsK7C6M5B2ALCSshS',
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydjLTDl-huc9haNC8ZrXOqibTP0N2LakKMJA4OXorC-loG_zAEpp8xgXWiFAelJxcGecWiJQRtMhlHg0t2nXFswxLy9bvGvALj-TBeficb-ewl-M7j2xWk8rJotF0jYNCjX_8O3PYbI4e_htB9hCwuHcYwlaUHHLZA45gd9b2vI8ZgKeDsb2lE1GsyASEDsZ7Ld6ueODOZ-lG8UjjO3EO0hKyQonkRYOW_dr7JDWd4sQKIJ3kHhJS5N0-2p42Ah6JqvLfoNV45z5Mx6rwuJ3m9sFCQiPBimw_cmY5K0mb8PJZpcZdjuVKEzVbv8hPMKgAelYQNIqWJq8GvsPB-LzclBIWqG4-gOuMBvJ1d66YX-y5BGb8OoNbXwR8UclwCLH_tatALXMNwndO4EdGU6Ooo7L_T9MMMIprPdfBkGG5IWYuIFB',
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydgJ9SfL1u4ACMUHY4V6riz0WpvfNy9BGzqo4eN0HL-7pEpOcCkwbv1JjxUqgdm5DFlL327qUA969Py4dXdmjgmJkTOFF_G-miqWS7VENhQW8ig2qxjs_KT-LIPNraywZi4s1TdzSS7xlIYvEFBvwy8oUPsWHJNEfOQyNexObmqxqU5aMf2zjub48ZrsmUsDAu_3CgdHlsnSn-L8DydkfppSn_DJrTVYfxn539oTmdeaYY8uO_VXM-xawn2ZnHJLTN6SJFKfN9FC6eGVJecYNvyNvNyqUsSAu8yYvoGu_mT1erwW2sdfE57CAJNlvwo6mk6naPHywnpRrMHYy4MqE_M-MQq0RmtuYp-k4oITOuG4hZHRrf9PceL5bH1SjX-qmWkxQH8VbAq29STDh6LOwLN0JZdyIOPdsHspKk66PWkiJ64',
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydjZrvaexk91ieSkvLg9ki9CBZeHCiPoD3e77nsrqgfCymoHtascjH8WEC5a53zo_0BfI18kfOgnQDWcUIAA1fqZXNeooQcAVvDfelxy9NDs25xfE95aKEp9a3jY7sdFDAjMM8gFnpZoOJyPSAMY-DUG7m_a5H_Vgkz6-1v4Cd2byGInKwhJ1opl1pTAKV9UIyHNTO96qVNjzYCbJZXOnanYP3VLy4sMZMHObr1ylGxsyA6fGEyJ9jnsLzY-1ZbklHlIqHYJu0A4GStvuJVFyVRmXCa4Qsq2H1fAKpznEC7o25NnYjEpcpPJc26CoGo5WRQjK5g60yPY_Q0qzKultWN8hupwS2dj3gV6ZmEMpQmjeG68TcU8hWSUcwqH9T8HZwHy6be-8bk9dN005pwZVgUbjTmbfO37ImmWesZ9QjikKKPu',
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydjUSL2IaTNYyI2er8D8Szwf4Jdta4CvfAVji1dMS56orMunYbX7vycVxN6Mi1UEcRhpHIyNHyE7Ok2Nziq5wpdaA_PwgFDi8my2-8ldKZ-3QlVzNTArvrXCrXkZcTXUqIGKNxgbY2YtUVF0z58j-15slvyzvT8eBwKzuPecGdFyW-5ls5c6oviWrbNo1eOEsMFjuGXzKnmfzsz2PHxbGA5hjL3UFw693FOoR-SyBBJDJf7yJrMNVBsMMRB1PeRaPBMA2WmRjrDtIzVVXmH0jO7YacjQqTtsnDsodDNQZdYuKNYdktbITNGewj_BpzUAftWP7PtSHvyWdzTZnYGxgu9ll9cUjXcN5W30pAgKKCmhiWlOtAbETsYrz-joSNShwbTs0dwica7ntW6mbD_k7lP7-7vYGJp1B8GAqN-7TCzY08TUljld3vLhvDjFsg',
  'places/ChIJu0KdsneHoxIRANbP-eXV3YE/photos/AWCwydhEp7qjym_Aa3cblKW3iumHjxXvZgHEEJNgU1XbfwADcjGzorsCgMDtwKi4culchqaB9C3RFMHw_T3ldZIS3bOEg5Ecx1GGfxZdZG2vW0i4DrP9RRrwnoHVP7lkWka7lgGOieyvqbnvTRNsRygDAuBRe1zRyF6bmLMOI1vwgbgcw6VWfnoQkxL6RroM7-BM1dxi6FuGXBjlPtGv8zLziA6lh82edlYz_LFTuBDyI15eZlp_oqPqS62jaVtcVXsJGm8y0M_HQd7AucmWzbHSVzYg2s01wldkM1-b_AsZUe66u2w4gsp22Xs1ZiDgkd9B0LulUL_GKyC7MH2qWO3C_jlWiRwcqwZAsUl_c79IyYY-CxhygMpNvJ32G2bA6Vyi_tdAO0DmMLNtd51Z26sYkLzZMDTyDTgYaPeAX8yRMU1MCg'
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const data = JSON.parse(await readFile(DATA, 'utf8'));
  const saved = [];

  for (const [i, name] of PHOTOS.slice(0, MAX).entries()) {
    const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${WIDTH}&key=${API_KEY}`;
    process.stdout.write(`→ photo ${i + 1}/${Math.min(MAX, PHOTOS.length)} ... `);
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const file = `place-${String(i + 1).padStart(2, '0')}.jpg`;
      await writeFile(join(OUT, file), buf);
      saved.push(`assets/photos/${file}`);
      console.log(`${(buf.length / 1024).toFixed(0)} kB`);
    } catch (err) {
      console.log(`failed — ${err.message}`);
    }
  }

  if (saved.length) {
    data.heroPhoto = saved[0];
    data.galleryPhotos = saved;
    data.photoNote = `Local photos resolved ${new Date().toISOString().slice(0, 10)}; regenerate with scripts/fetch-photos.mjs.`;
    await writeFile(DATA, JSON.stringify(data, null, 2) + '\n');
    console.log(`\nSaved ${saved.length} photo(s) and updated assets/data/place.json.`);
    console.log('Next: point the hero/about <img> tags at data.heroPhoto (or leave the SVG poster).');
  } else {
    console.log('\nNo photos saved.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
