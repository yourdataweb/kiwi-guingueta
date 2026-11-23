/* ==========================================================================
   Kiwi Guingueta — progressive enhancement
   Content is server-rendered in each locale, so this file only adds behaviour:
   sticky header, mobile drawer, live open/closed status, today's hours row.
   Nothing here is required to read the page.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const HOURS = [
    { day: 0, open: '10:00', close: '00:00' },
    { day: 1, open: '10:00', close: '00:00' },
    { day: 2, open: '10:00', close: '00:00' },
    { day: 3, open: '10:00', close: '00:00' },
    { day: 4, open: '10:00', close: '00:00' },
    { day: 5, open: '10:00', close: '00:00' },
    { day: 6, open: '10:00', close: '00:00' }
  ];
  const TIME_ZONE = 'Europe/Madrid';

  /* ---------- header ---------- */
  function initHeader() {
    const header = $('.site-header');
    const toggle = $('.nav-toggle');
    const drawer = $('#mobile-nav');
    if (!header) return;

    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (!toggle || !drawer) return;

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      const labelOpen = toggle.dataset.labelOpen || 'Open menu';
      const labelClose = toggle.dataset.labelClose || 'Close menu';
      toggle.setAttribute('aria-label', open ? labelClose : labelOpen);
      drawer.hidden = !open;
      document.body.classList.toggle('nav-open', open);
    };

    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    drawer.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    // close the drawer if the viewport grows past the mobile breakpoint
    const mq = window.matchMedia('(min-width: 781px)');
    const onChange = (e) => { if (e.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
  }

  /* ---------- live open/closed status ---------- */
  function localNow() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        hour: '2-digit', minute: '2-digit',
        weekday: 'short', hour12: false
      }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t)?.value;
      const idx = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return {
        day: idx[get('weekday')] ?? new Date().getDay(),
        minutes: Number(get('hour')) * 60 + Number(get('minute'))
      };
    } catch {
      const d = new Date();
      return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  function initStatus() {
    const el = $('#open-status');
    const dot = $('#status-dot');
    if (!el) return;

    const { day, minutes } = localNow();
    const today = HOURS.find((h) => h.day === day);
    if (!today) return;

    const openM = toMinutes(today.open);
    let closeM = toMinutes(today.close);
    if (closeM <= openM) closeM += 1440;           // closes after midnight

    // A bar open 10:00–00:00 is also "open" in the small hours of the next day.
    let nowM = minutes;
    let isOpen = nowM >= openM && nowM < closeM;

    if (!isOpen) {
      const prev = HOURS.find((h) => h.day === (day + 6) % 7);
      if (prev) {
        const prevOpen = toMinutes(prev.open);
        let prevClose = toMinutes(prev.close);
        if (prevClose <= prevOpen) prevClose += 1440;
        if (minutes + 1440 >= prevOpen && minutes + 1440 < prevClose) isOpen = true;
      }
    }

    const openTpl = el.dataset.openTemplate || 'Abierto ahora · hasta las {close}';
    const closedTpl = el.dataset.closedTemplate || 'Cerrado · abre a las {open}';

    el.textContent = isOpen
      ? openTpl.replace('{close}', today.close)
      : closedTpl.replace('{open}', today.open);

    if (dot && !isOpen) dot.classList.add('is-closed');

    // mark today's row
    const row = $(`#hours-list li[data-day="${day}"]`);
    if (row) {
      row.classList.add('is-today');
      const dayCell = $('.hours-day', row);
      if (dayCell && !dayCell.dataset.suffix) {
        const suffix = el.dataset.todayLabel || 'Hoy';
        const badge = document.createElement('span');
        badge.className = 'hours-today';
        badge.textContent = suffix;
        dayCell.appendChild(badge);
        dayCell.dataset.suffix = '1';
      }
    }
  }

  /* ---------- misc ---------- */
  function initMisc() {
    const y = $('#year');
    if (y) y.textContent = String(new Date().getFullYear());

    // External links: make the "new tab" behaviour explicit for assistive tech
    // without relying on the visually-hidden note alone.
    $$('a[target="_blank"]').forEach((a) => {
      if (!a.getAttribute('rel')?.includes('noopener')) {
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  function boot() {
    initHeader();
    initStatus();
    initMisc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
