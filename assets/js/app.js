/* ==========================================================================
   Kiwi Guingueta — progressive enhancement
   Site is fully readable without JS; this hydrates it from assets/data/place.json
   and applies the conditional display rules.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- icon set (bar / beach) ---------- */
  const ICONS = {
    umbrella: '<path d="M12 2a10 10 0 0 0-9.95 9h19.9A10 10 0 0 0 12 2Z"/><path d="M12 11v9.5a1.5 1.5 0 0 0 3 0"/>',
    sunbed: '<path d="M3 18h18"/><path d="M4 18v-3a2 2 0 0 1 2-2h1V8a2 2 0 0 1 2-2h2"/><path d="M9 13h11v5"/><circle cx="5.5" cy="14.5" r=".6"/>',
    cocktail: '<path d="M5 4h14l-6.5 7v7"/><path d="M12.5 18H16"/><path d="M8.5 11h7"/><circle cx="17.5" cy="5.5" r="1.6"/>',
    music: '<circle cx="7" cy="17.5" r="2.5"/><circle cx="18" cy="15.5" r="2.5"/><path d="M9.5 17.5V7l11-2v10.5"/>',
    dog: '<path d="M10 5 7 3v4"/><path d="M14 5l3-2v4"/><path d="M6.5 9a5.5 5.5 0 0 1 11 0v5a5.5 5.5 0 0 1-11 0Z"/><circle cx="10" cy="11" r=".8"/><circle cx="14" cy="11" r=".8"/><path d="M11 14.2h2"/><path d="M12 14.2v1.4"/>',
    group: '<circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M18.5 19a6 6 0 0 0-3-5.2"/>',
    check: '<path d="m4 12.5 5 5L20 6.5"/>',
    cross: '<path d="m5 5 14 14M19 5 5 19"/>',
    star: '<path d="m12 2.6 2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.4l-5.8 3.06 1.1-6.46-4.69-4.58 6.49-.94L12 2.6Z"/>'
  };

  const svg = (name, cls = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  const svgFilled = (name) =>
    `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- header: stuck state + mobile nav ---------- */
  function initHeader() {
    const header = $('.site-header');
    const toggle = $('.nav-toggle');
    const mobileNav = $('#mobile-nav');
    if (!header) return;

    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (toggle && mobileNav) {
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        toggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
        mobileNav.hidden = open;
      });
      mobileNav.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', 'Open menu');
          mobileNav.hidden = true;
        }
      });
    }
  }

  /* ---------- phone helpers ---------- */
  // E.164 mobile detection. Spanish mobiles start 6 or 7; +34 followed by 6/7 = mobile.
  const isMobileNumber = (e164) => {
    if (!e164) return false;
    const digits = e164.replace(/\D/g, '');
    if (digits.startsWith('34')) {
      const national = digits.slice(2);
      return /^[67]\d{8}$/.test(national);
    }
    // Generic: many countries use 9–12 digit mobiles; be conservative and allow.
    return digits.length >= 9 && digits.length <= 15;
  };

  /* ---------- opening hours ---------- */
  function currentStatus(hours) {
    if (!hours || !hours.weekdayDescriptions) return null;
    let now;
    try {
      now = new Date(new Date().toLocaleString('en-US', { timeZone: hours.timeZone || 'Europe/Madrid' }));
    } catch {
      now = new Date();
    }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[now.getDay()];
    const todayLine = hours.weekdayDescriptions.find((d) => d.startsWith(todayName));
    return { todayName, todayLine, now };
  }

  function initOpenStatus(place) {
    const el = $('#open-status');
    if (!el || !place.hours) return;
    const status = currentStatus(place.hours);
    if (!status) return;

    // Derive from periods: open 10:00, close 00:00 next day.
    const periods = place.hours.periods || [];
    const todayIdx = status.now.getDay();
    const p = periods.find((x) => x.day === todayIdx);
    if (!p) return;

    const [oh, om] = p.open.split(':').map(Number);
    const [ch, cm] = p.close.split(':').map(Number);
    const mins = status.now.getHours() * 60 + status.now.getMinutes();
    const openM = oh * 60 + om;
    let closeM = ch * 60 + cm;
    if (p.closeNextDay || closeM <= openM) closeM += 1440;
    const effectiveNow = mins < openM && closeM > 1440 ? mins + 1440 : mins;
    const isOpen = effectiveNow >= openM && effectiveNow < closeM;

    const dot = status.todayLine ? '' : '';
    el.textContent = isOpen
      ? `Open now · until ${p.close}`
      : `Closed · opens ${p.open}`;
    const dotEl = $('.hero-eyebrow .dot');
    if (dotEl && !isOpen) dotEl.classList.add('is-closed');

    // highlight today's row
    $$('#hours-list li').forEach((li) => {
      const label = $('span', li)?.textContent?.trim();
      if (label && label.toLowerCase() === status.todayName.toLowerCase()) li.classList.add('is-today');
    });
  }

  /* ---------- hours list from data ---------- */
  function initHours(place) {
    const list = $('#hours-list');
    if (!list || !place.hours?.weekdayDescriptions) return;
    // Normalise "Monday: 10:00 AM – 12:00 AM" -> ["Monday", "10:00 – 00:00"]
    const fmt = (s) => s
      .replace(/\b12:00\s*AM\b/g, '00:00')
      .replace(/\b12:00\s*PM\b/g, '12:00')
      .replace(/\s*([AP]M)\b/g, (m) => '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    list.innerHTML = place.hours.weekdayDescriptions.map((line) => {
      const i = line.indexOf(':');
      const day = line.slice(0, i);
      const rest = fmt(line.slice(i + 1));
      return `<li><span>${esc(day)}</span><span>${esc(rest)}</span></li>`;
    }).join('');
  }

  /* ---------- reviews ---------- */
  function starsMarkup(rating) {
    const full = Math.round(rating);
    return Array.from({ length: 5 }, (_, i) =>
      `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="${i < full ? '' : 'is-empty'}"><path d="m12 2.6 2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.4l-5.8 3.06 1.1-6.46-4.69-4.58 6.49-.94L12 2.6Z"/></svg>`
    ).join('');
  }

  function initRating(place) {
    const rating = Number(place.rating);
    const count = Number(place.userRatingCount);

    // Big star badge only when rating > 4
    const badge = $('#rating-badge');
    if (badge) {
      if (rating > 4) {
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }

    // Count shown only when > 50
    const countEl = $('#rating-count');
    if (countEl) {
      if (count > 50) {
        countEl.textContent = `${count} reviews`;
      } else {
        countEl.closest('.rating-meta').textContent = 'on Google';
      }
    }

    // hero stats mirror
    const heroCount = $('#hero-count');
    if (heroCount) {
      heroCount.textContent = count > 50 ? count.toLocaleString() : '—';
      if (!(count > 50)) heroCount.closest('li').hidden = true;
    }
    const heroRating = $('#hero-rating');
    if (heroRating) heroRating.textContent = rating.toFixed(1);
  }

  function initReviews(place) {
    const grid = $('#review-grid');
    if (!grid) return;

    const positive = (place.reviews || [])
      .filter((r) => Number(r.rating) >= 4 && r.text && r.text.trim().length > 20)
      // longest, most substantive first — better testimonial copy
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, 3);

    if (!positive.length) {
      grid.closest('section').hidden = true;
      return;
    }

    grid.innerHTML = positive.map((r) => `
      <li class="review">
        <span class="review-stars">${starsMarkup(Number(r.rating))}</span>
        <blockquote>${esc(r.text)}</blockquote>
        <footer>
          ${r.avatar
            ? `<img src="${esc(r.avatar)}" alt="" width="40" height="40" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'review-avatar-fallback',textContent:'${esc((r.author || '?').charAt(0))}'}))">`
            : `<span class="review-avatar-fallback">${esc((r.author || '?').charAt(0))}</span>`}
          <span><strong>${esc(r.author)}</strong><small>${esc(r.relativeTime)}</small></span>
        </footer>
      </li>`).join('');
  }

  /* ---------- feature icons ---------- */
  function initFeatureIcons() {
    const map = {
      umbrella: ['seafront terrace', 'terrace', 'outdoor'],
      sunbed: ['sunbed', 'beach', 'hire'],
      cocktail: ['cocktail', 'wine', 'beer', 'drink'],
      music: ['music'],
      dog: ['dog'],
      group: ['group']
    };
    $$('.feature').forEach((card) => {
      const title = ($('h3', card)?.textContent || '').toLowerCase();
      const holder = $('.feature-icon', card);
      if (!holder) return;
      const key = Object.keys(map).find((k) => map[k].some((w) => title.includes(w))) || 'umbrella';
      holder.innerHTML = svg(key);
    });
  }

  /* ---------- capabilities from data ---------- */
  function initCapabilities(place) {
    const holder = $('#feature-columns');
    const f = place.features;
    if (!holder || !f) return;

    const groups = [
      ['Service', f.serviceOptions],
      ['Food & drink', f.foodAndDrink],
      ['Atmosphere', f.atmosphere],
      ['Amenities', f.amenities],
      ['Parking', f.parking],
      ['Accessibility', f.accessibility],
      ['Payments', f.payments]
    ].filter(([, list]) => Array.isArray(list) && list.some((x) => x.value !== null));

    if (!groups.length) return;

    holder.innerHTML = groups.map(([title, list]) => {
      const items = list.filter((x) => x.value !== null).map((x) =>
        `<li class="cap ${x.value ? 'is-yes' : 'is-no'}">${x.value ? svg('check') : svg('cross')}<span>${esc(x.label)}</span></li>`
      ).join('');
      return `<div class="cap-group"><h4>${esc(title)}</h4><ul class="cap-list">${items}</ul></div>`;
    }).join('');

    holder.hidden = false;
  }

  /* ---------- contact wiring ---------- */
  function initContact(place) {
    const mobile = isMobileNumber(place.phoneE164);
    const waUrl = place.whatsappNumber ? `https://wa.me/${place.whatsappNumber}` : null;
    const showWa = mobile && waUrl;

    // Elements that should only exist for mobile numbers
    ['#wa-btn', '#hero-wa', '#wa-fab'].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      if (showWa) {
        el.href = waUrl;
      } else {
        el.remove();
      }
    });

    // Mobile nav CTA
    const mobileCta = $('.mobile-cta');
    if (mobileCta && !showWa) mobileCta.remove();

    // Map + directions from data
    const map = $('#map-frame');
    if (map && place.map?.embedUrl) map.src = place.map.embedUrl;

    const mapLink = $('#map-link');
    if (mapLink && place.map?.placeUri) mapLink.href = place.map.placeUri;

    const dir = $('#directions-btn');
    if (dir && place.map?.directionsUri) dir.href = place.map.directionsUri;

    const allReviews = $('#all-reviews');
    if (allReviews && place.map?.reviewsUri) allReviews.href = place.map.reviewsUri;

    $$('a[href*="write"]').forEach((a) => {
      if (place.map?.writeReviewUri) a.href = place.map.writeReviewUri;
    });

    // Canonical / OG sanity for the deployed path
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && place.codeName) {
      const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname)
        || location.protocol === 'file:';
      const origin = isLocal ? 'https://yourdataweb.github.io' : location.origin;
      canonical.href = `${origin}/${place.codeName}/`;
    }
  }

  /* ---------- misc ---------- */
  function initMisc() {
    const y = $('#year');
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /* ---------- boot ---------- */
  async function boot() {
    initHeader();
    initFeatureIcons();
    initMisc();

    try {
      const res = await fetch('assets/data/place.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`place.json ${res.status}`);
      const data = await res.json();
      const place = {
        ...(data.place || {}),
        map: data.map || {},
        hours: data.hours || null,
        reviews: data.reviews || [],
        features: data.features || null
      };

      initRating(place);
      initReviews(place);
      initCapabilities(place);
      initHours(place);
      initContact(place);
      initOpenStatus(place);
    } catch (err) {
      // Static fallbacks in the HTML stay in place.
      console.warn('[kiwi] data hydration skipped:', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
