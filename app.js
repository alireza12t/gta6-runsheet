// Runsheet app. Plain JS, no build step. Data in ./data, progress in localStorage.
(function () {
  'use strict';

  // ---------- state ----------
  const KEY = 'runsheet.v1';
  const defaults = { chapter: 1, who: 'Lucia', time: 'night', mins: 40, routeCat: 'stunt-jumps', theme: 'auto',
    found: {}, done: {}, waypoint: null, mapCats: ['stunt-jumps'], hideFound: false, run: null };
  let S = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}'));
  const save = () => localStorage.setItem(KEY, JSON.stringify(S));

  let D = null; // data
  let map = null;

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#view');
  const sheetRoot = $('#sheet-root');

  // ---------- theme ----------
  function applyTheme() {
    if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', S.theme);
  }
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'auto') route(); });

  // ---------- data helpers ----------
  const COLORS = { 'stunt-jumps': '#E8590C', 'nine1nine': '#0A84FF', 'curiosity': '#AF52DE', 'jack-of-hearts': '#E0245E',
    'magazine': '#FF9F0A', 'sculpture': '#8E8E93', 'delights': '#FF2D55', 'under-the-bridge': '#5AC8FA', 'book-swap': '#A2845E',
    '1010-mural': '#FFCC00', 'unique-playlist': '#64D2FF', 'animal-crackers': '#BF5AF2', 'arcade-machine': '#5E5CE6',
    'safe': '#30A46C', 'atm-towable': '#34C759', 'bank': '#248A3D', 'big-bank': '#1F7A36', 'payday-loans': '#7CB342',
    'mission': '#D4A017', 'side': '#6E56CF', 'contact': '#7D7AFF', 'safehouse': '#00A3A3',
    'ammu-nation': '#B23A48', 'pay-n-spray': '#2E86DE', 'purchasable-garage': '#576574', 'garage': '#576574',
    'shop': '#F08C00', 'fast-food': '#E8590C', 'street-food': '#F4A261', 'gas-station': '#6D6D72', 'atm': '#2B9348',
    'landmark': '#0096C7', 'transport': '#5856D6', 'vehicle': '#2F9E8F', 'animal': '#8C6D46', 'building': '#7E7E85', 'structure': '#9A9AA0' };
  // One small line icon per category, drawn for this app (24 grid). f: filled shape, otherwise a stroke.
  const ICON_PATHS = {
    bolt: { f: 'M13 2 5 13h6l-1 9 8-11h-6z' }, phone: 'M6.5 3h3.5l1.8 4.6-2.6 1.8a11 11 0 0 0 5.4 5.4l1.8-2.6 4.6 1.8v3.5a2 2 0 0 1-2 2A17 17 0 0 1 4.5 5a2 2 0 0 1 2-2z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', heart: { f: 'M12 20.5s-8-4.8-8-11a4.4 4.4 0 0 1 8-2.6 4.4 4.4 0 0 1 8 2.6c0 6.2-8 11-8 11z' },
    book: 'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z', gem: 'M7 4h10l4 5-9 11L3 9zM3 9h18M9.5 4 12 20 14.5 4',
    spark: { f: 'M12 2.5l2.3 6.6 6.7 2.4-6.7 2.4L12 20.5l-2.3-6.6L3 11.5l6.7-2.4z' }, plane: { f: 'M21 15.5v-2l-8-5V3.6a1.4 1.4 0 0 0-2.8 0V8.5l-8 5v2l8-2.4v5l-2 1.5V21l3.4-1 3.4 1v-1.4l-2-1.5v-5z' },
    brush: 'M19 3l2 2-9.5 9.5-2-2zM9.5 12.5c-2 0-3.5 1.4-3.5 3.2 0 1.5-1 2.6-3 3.3 4 1.6 8.5.4 8.5-4.5', note: 'M9 18V5l11-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    paw: { f: 'M12 12.5c-3 0-5.5 3.2-5.5 5.4 0 1.8 1.8 2.1 5.5 2.1s5.5-.3 5.5-2.1c0-2.2-2.5-5.4-5.5-5.4zM5.5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.5 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14.5 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
    pad: 'M7 8h10a5 5 0 0 1 5 5v1.5a3 3 0 0 1-5.2 2L15 15H9l-1.8 1.5A3 3 0 0 1 2 14.5V13a5 5 0 0 1 5-5zM7 10.5v4M5 12.5h4M16 12h.01M18 14h.01',
    safe: 'M4 4h16v15H4zM12 8.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 11.5h3M6 19v2M18 19v2', cash: 'M12 3v18M16.5 7.5c0-1.6-2-2.8-4.5-2.8S7.5 5.9 7.5 7.8s2.2 2.6 4.5 3.2 4.5 1.3 4.5 3.3-2 3-4.5 3-4.5-1.2-4.5-2.8',
    star: { f: 'M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z' }, ask: 'M8.8 9a3.3 3.3 0 1 1 4.6 3c-.9.4-1.4 1.1-1.4 2.1V15M12 18.6v.2',
    person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0', home: 'M3 11l9-7.5 9 7.5M5.5 9v11.5h13V9M10 20.5v-6h4v6',
    aim: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6', drop: { f: 'M12 2.5s7 7.7 7 12.2a7 7 0 0 1-14 0C5 10.2 12 2.5 12 2.5z' },
    garage: 'M3 10l9-6 9 6v10.5H3zM7 20.5V13h10v7.5M7 16.5h10', bag: 'M5 8h14l-1.2 12.5H6.2zM9 8V6.5a3 3 0 0 1 6 0V8',
    fork: 'M7 3v7.5M4.5 3v4.8a2.5 2.5 0 0 0 5 0V3M7 10.5V21M17 3c-2.3 1.2-3.5 4-3.5 7.5H17V21', fuel: 'M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M5 10h10M15 7.5l3.5 2.5v7.5a1.5 1.5 0 0 0 3 0V9l-3-3',
    camera: 'M3.5 8h3.5l2-3h6l2 3h3.5v11.5h-17zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', train: 'M6.5 3h11a2.5 2.5 0 0 1 2.5 2.5v9.5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5.5A2.5 2.5 0 0 1 6.5 3zM4 11h16M8 18l-2 3.5M16 18l2 3.5',
    car: 'M5 16v-4l2-5h10l2 5v4M3 12h18v4.5H3zM6.5 16.5V19M17.5 16.5V19', city: 'M5 21V4h9v17M14 9h5v12M3 21h18M8 8h3M8 12h3M8 16h3',
  };
  const CAT_ICON = { 'stunt-jumps': 'bolt', nine1nine: 'phone', curiosity: 'eye', 'jack-of-hearts': 'heart', magazine: 'book', sculpture: 'gem',
    delights: 'spark', 'under-the-bridge': 'plane', 'book-swap': 'book', '1010-mural': 'brush', 'unique-playlist': 'note', 'animal-crackers': 'paw',
    'arcade-machine': 'pad', safe: 'safe', 'atm-towable': 'cash', bank: 'cash', 'big-bank': 'cash', 'payday-loans': 'cash', mission: 'star', side: 'ask',
    contact: 'person', safehouse: 'home', 'ammu-nation': 'aim', 'pay-n-spray': 'drop', 'purchasable-garage': 'garage', garage: 'garage',
    shop: 'bag', 'fast-food': 'fork', 'street-food': 'fork', 'gas-station': 'fuel', atm: 'cash', landmark: 'camera', transport: 'train',
    vehicle: 'car', animal: 'paw', building: 'city', structure: 'city' };
  // one hidden sprite, each pin just <use>s its icon
  document.body.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' +
    Object.entries(ICON_PATHS).map(([k, v]) => `<symbol id="ic-${k}" viewBox="0 0 24 24">${typeof v === 'string'
      ? `<path d="${v}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="${v.f}" fill="currentColor"/>`}</symbol>`).join('') + '</svg>');
  const icon = (cat) => `<svg class="pin-ic" aria-hidden="true"><use href="#ic-${CAT_ICON[cat] || 'star'}"/></svg>`;
  const color = (cat) => COLORS[cat] || '#8E8E93';
  const catName = (id) => (D.cats.find((c) => c.id === id) || { name: id }).name;
  const placesOf = (cat) => D.places.filter((p) => p.cat === cat);
  const foundCount = (cat) => placesOf(cat).filter((p) => S.found[p.id]).length;
  const collectCats = () => D.cats.filter((c) => c.group === 'collectible');
  // Positions are shares of the map image (x across, y down). The image is taller than wide, so y is scaled by AR.
  const AR = 3313 / 2560;
  const toLL = (x, y) => [-y * 1000 * AR, x * 1000];
  const fromLL = (ll) => ({ x: ll.lng / 1000, y: -ll.lat / 1000 / AR });
  const nearestRegion = (p) => D.regions.reduce((b, r) => (Math.hypot(r.x - p.x, r.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? r : b));
  const areaOf = (p) => p.area || '';
  const srcTag = (n = 1) => `<span class="tag src">${n} SOURCE${n === 1 ? '' : 'S'}</span>`;

  function toast(msg) {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = document.createElement('div');
    t.className = 'toast glass'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }
  const isDesktop = () => innerWidth >= 900;
  function killMap() { if (map) { map.off(); map.stop(); map.remove(); map = null; } }
  // keep the selected chip visible after a redraw (fix 4)
  function revealChip(row) {
    const on = row && row.querySelector('[aria-pressed="true"]');
    if (on) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
  }

  // ---------- router ----------
  function route() {
    applyTheme();
    if (!D) return; // data still loading
    killMap();
    sheetRoot.innerHTML = '';
    const fr = $('#filters-root'); if (fr) fr.innerHTML = ''; // map filters panel
    document.body.classList.remove('searching');
    view.className = '';
    const [name, arg] = (location.hash.slice(1) || 'plan').split('/');
    document.querySelectorAll('#tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === name ? 'page' : 'false'));
    $('#tabs').style.display = name === 'run' ? 'none' : '';
    ({ plan: renderPlan, map: renderMap, guide: renderGuide, checklist: renderChecklist, run: renderRun }[name] || renderPlan)(arg);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  // switch between phone and desktop layouts when the window crosses 900px
  let wasDesk = innerWidth >= 900;
  addEventListener('resize', () => { const d = innerWidth >= 900; if (d !== wasDesk) { wasDesk = d; route(); } });

  // ---------- credits ----------
  const SOCIALS = [
    ['Website', 'https://alireza12t.github.io/'], ['GitHub', 'https://github.com/alireza12t'],
    ['X', 'https://x.com/DevMvRick'], ['YouTube', 'https://www.youtube.com/@DevMvRick'],
    ['Instagram', 'https://www.instagram.com/devmvrick'], ['LinkedIn', 'https://www.linkedin.com/in/alireza12t'],
  ];
  function creditsCard() {
    return `<section class="card card-pad credits">
      <div class="row-ctl" style="min-height:0"><div><div class="label">Made by</div><div style="font-size:17px;font-weight:700">Alireza Toghiani</div></div>
        <a class="mono" href="https://github.com/alireza12t/gta6-runsheet" target="_blank" rel="noopener" style="font-size:13px;text-decoration:none">Source code</a></div>
      <div class="chips" style="flex-wrap:wrap">${SOCIALS.map(([n, u]) => `<a class="chip" href="${u}" target="_blank" rel="noopener" style="text-decoration:none;background:var(--fill)">${n}</a>`).join('')}</div>
      <div class="muted" style="font-size:12px;line-height:1.45">Map art © Rockstar Games, via the <a href="https://gta.fandom.com/" target="_blank" rel="noopener">GTA Wiki</a>. Locations via <a href="https://gta6tracker.org/" target="_blank" rel="noopener">gta6tracker.org</a>, built on the <a href="https://gta.fandom.com/" target="_blank" rel="noopener">GTA Wiki</a> (CC BY-SA). Unverified. Map library <a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>. Unofficial fan project, not affiliated with Rockstar Games or Take-Two Interactive.</div>
    </section>`;
  }

  // ---------- install ----------
  let installPrompt = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (location.hash.startsWith('#plan') || !location.hash) route(); });
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function installCard() {
    if (standalone() || S.hideInstall || location.search.includes('shot')) return '';
    if (installPrompt) return `<section class="card card-pad" style="flex-direction:row;align-items:center;justify-content:space-between">
      <div><div style="font-weight:700">Install Runsheet</div><div class="muted" style="font-size:13px">Opens full screen and works offline.</div></div>
      <div style="display:flex;gap:6px"><button class="icon-btn" id="hideInstall" aria-label="Dismiss">✕</button><button class="btn primary" id="doInstall" style="height:40px;width:auto;padding:0 16px;font-size:15px">Install</button></div></section>`;
    if (isIOS()) return `<section class="card card-pad" style="flex-direction:row;align-items:center;justify-content:space-between">
      <div><div style="font-weight:700">Add to your Home Screen</div><div class="muted" style="font-size:13px">Tap Share <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-label="share icon" role="img"><path d="M6 1v8M3 4l3-3 3 3M2 7v6h8V7"/></svg> then "Add to Home Screen".</div></div>
      <button class="icon-btn" id="hideInstall" aria-label="Dismiss">✕</button></section>`;
    return '';
  }
  function bindInstall() {
    const d = $('#doInstall'), h = $('#hideInstall');
    if (d) d.onclick = async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; renderPlan(); };
    if (h) h.onclick = () => { S.hideInstall = true; save(); renderPlan(); };
  }

  // ---------- PLAN ----------
  function boardItems() {
    const items = [];
    D.tonight.items.forEach((t) => {
      if (S.done[t.id]) return;
      if (!t.ch.includes(S.chapter)) return;
      if (t.who !== 'any' && t.who !== S.who) return;
      if (t.time !== 'any' && t.time !== S.time) return;
      let status = 'ready', label = 'READY';
      if (t.missable) { status = 'closing'; label = 'CLOSING'; }
      else if (t.time !== 'any' || t.who !== 'any') { status = 'live'; label = 'LIVE NOW'; }
      if (t.kind === 'money') { status = 'money'; label = 'MONEY'; }
      const sub = t.missable && t.closes ? 'Gone ' + t.closes : t.note;
      items.push({ ...t, status, label, sub, order: { closing: 0, live: 1, ready: 2, money: 3 }[status] });
    });
    const rc = S.routeCat, left = placesOf(rc).length - foundCount(rc);
    if (left > 0) items.push({ id: 'route', name: catName(rc), sub: `${left} left on the map`, status: 'ready', label: 'ROUTE', order: 2.5, sources: 1, route: true });
    items.push({ id: 'cash', name: 'Store hold-up, then bank it', sub: 'Carried cash is lost if you are busted', status: 'money', label: 'MONEY', order: 4, sources: 2 });
    return items.sort((a, b) => a.order - b.order);
  }

  function renderPlan() {
    const themeIcon = { auto: 'A', light: '☀', dark: '☾' }[S.theme];
    const items = boardItems();
    const routeChips = collectCats().map((c) => {
      const left = c.count - foundCount(c.id);
      return `<button class="chip" data-route="${c.id}" aria-pressed="${S.routeCat === c.id}"><span class="dot" style="background:${color(c.id)}"></span>${esc(c.name)} <span class="mono muted">${left}</span></button>`;
    }).join('');
    view.innerHTML = `
    <div class="page">
      <div class="top"><span class="eyebrow">RUNSHEET · UNOFFICIAL GTA VI GUIDE</span>
        <button class="icon-btn" id="theme" aria-label="Theme: ${S.theme}. Tap to change" title="Theme: ${S.theme}"><span style="font-size:15px;font-weight:700">${themeIcon}</span></button></div>
      <h1 class="title" style="padding:0 4px">Plan your session</h1>
      ${installCard()}
      <div class="plan-grid"><div class="col">

      <section class="card card-pad">
        <div class="row-ctl"><span class="label">Story progress</span>
          <div class="stepper"><button id="chDown" aria-label="Previous chapter">‹</button><span>Chapter ${S.chapter}</span><button id="chUp" aria-label="Next chapter">›</button></div></div>
        <div class="row-ctl"><span class="label">Playing as</span>
          <div class="seg" style="width:180px">${['Jason', 'Lucia'].map((w) => `<button data-who="${w}" aria-pressed="${S.who === w}">${w}</button>`).join('')}</div></div>
        <div class="row-ctl"><span class="label">In-game time</span>
          <div class="seg" style="width:180px">${['day', 'night'].map((w) => `<button data-time="${w}" aria-pressed="${S.time === w}">${w[0].toUpperCase() + w.slice(1)}</button>`).join('')}</div></div>
      </section>

      <section class="card card-pad">
        <span class="label">How long can you play?</span>
        <div class="seg" role="group" aria-label="Session length">${[20, 40, 60, 90].map((n) => `<button data-mins="${n}" aria-pressed="${S.mins === n}">${n}<small> min</small></button>`).join('')}</div>
        <span class="label" style="margin-top:4px">Collect tonight</span>
        <div class="chips" id="routeChips">${routeChips}</div>
      </section>
      </div><div class="col">

      <section class="card" style="overflow:hidden">
        <div class="row-ctl" style="padding:6px 16px 0"><h2 class="label" style="margin:0">Live board</h2>
          <span class="mono muted" style="font-size:12px">ch ${S.chapter} · ${S.who} · ${S.time}</span></div>
        <ul class="board">${items.map((t) => `
          <li><span class="tag ${t.status}">${t.label}</span>
            <div style="min-width:0"><div class="name">${esc(t.name)}</div><div class="sub">${esc(t.sub || '')}</div></div>
            <span class="mono muted" style="font-size:12px">${t.sources} src</span></li>`).join('')}</ul>
      </section>

      <a class="btn primary" href="#run" id="build">Build my ${S.mins} min run</a>
      <p class="foot">Run size is a first guess (stops, not minutes) until we time real drives. Board entries come from guides; "src" shows how many agree.</p>
      </div></div>
      ${creditsCard()}
    </div>`;

    revealChip($('#routeChips'));
    bindInstall();
    $('#theme').onclick = () => { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme]; save(); route(); };
    $('#chDown').onclick = () => { S.chapter = Math.max(1, S.chapter - 1); save(); renderPlan(); };
    $('#chUp').onclick = () => { S.chapter = Math.min(5, S.chapter + 1); save(); renderPlan(); };
    view.querySelectorAll('[data-who]').forEach((b) => (b.onclick = () => { S.who = b.dataset.who; save(); renderPlan(); }));
    view.querySelectorAll('[data-time]').forEach((b) => (b.onclick = () => { S.time = b.dataset.time; save(); renderPlan(); }));
    view.querySelectorAll('[data-mins]').forEach((b) => (b.onclick = () => { S.mins = +b.dataset.mins; save(); renderPlan(); }));
    view.querySelectorAll('[data-route]').forEach((b) => (b.onclick = () => { S.routeCat = b.dataset.route; save(); renderPlan(); }));
    $('#build').onclick = (e) => { e.preventDefault(); buildRun(); location.hash = 'run'; };
  }

  function startPoint() {
    const w = S.waypoint && D.places.find((p) => p.id === S.waypoint);
    if (w) return w;
    return D.regions.find((r) => r.name === 'Vice City') || D.regions[0];
  }

  function buildRun(placesOverride, title, from) {
    const stops = [];
    if (!placesOverride) {
      boardItems().filter((t) => !t.route && t.status !== 'money').forEach((t) =>
        stops.push({ type: 'task', id: t.id, name: t.name, sub: t.sub, tag: t.label, status: t.status, repeatable: !!t.repeatable }));
    }
    const pool = placesOverride || placesOf(S.routeCat).filter((p) => !S.found[p.id]);
    const n = placesOverride ? pool.length : { 20: 5, 40: 10, 60: 15, 90: 22 }[S.mins];
    const path = Route.nearestSet(pool, from || startPoint(), n);
    path.forEach((p) => stops.push({ type: 'place', id: p.id, name: p.name, sub: catName(p.cat), x: p.x, y: p.y, cat: p.cat }));
    if (!placesOverride) stops.push({ type: 'task', id: 'cash', name: 'Store hold-up, then bank it', sub: 'Carried cash is lost if busted', tag: 'MONEY', status: 'money' });
    S.run = { title: title || `Your ${S.mins} min run`, stops, idx: 0, doneN: 0, skipN: 0 }; showUpcoming = false;
    save();
  }

  // ---------- MAP (shared) ----------
  // Base map: the game's map art cut into tiles (tools/build_tiles.py), with our own borders and labels on top.
  // Labels and borders only appear from a set zoom, and labels are only added while on screen, so panning stays smooth.
  const LABEL_ZOOM = { sea: [0, 9], region: [-2, 1], area: [1, 9], water: [1, 9], town: [2, 9], peak: [2, 9], district: [2, 9], poi: [3, 9] };
  function makeMap(el, opts = {}) {
    const B = D.basemap, T = B.tiles;
    const bounds = L.latLngBounds(T.bounds);
    // the Run map has no pan limit, so a southern route can sit above the card (fix 3)
    const limits = opts.free ? {} : { maxBounds: bounds.pad(0.1), maxBoundsViscosity: 0.8 };
    const m = L.map(el, { crs: L.CRS.Simple, zoomControl: false, attributionControl: true, minZoom: opts.free ? -2 : -1, maxZoom: 4,
      zoomSnap: 1, // whole zoom steps: tiles stay crisp with no seams
      preferCanvas: true, fadeAnimation: false, ...limits });
    m.attributionControl.setPrefix(false);
    m.attributionControl.addAttribution('Map: Rockstar via GTA Wiki · Pins: gta6tracker.org · Unofficial');
    m.createPane('borders').style.zIndex = 380;
    m.createPane('labels').style.zIndex = 420;
    m.createPane('clusters').style.zIndex = 410; // pin bubbles under place names
    m.getPane('borders').style.pointerEvents = m.getPane('labels').style.pointerEvents = 'none';
    // Retina screens get tiles one zoom sharper (drawn at half size). Flat open-sea tiles were never written:
    // meta 'have' lists the tiles that exist, so the app never asks for the others (the map background is the same sea).
    const hd = (window.devicePixelRatio || 1) > 1.4 ? 1 : 0;
    const have = Object.fromEntries(Object.entries(T.have || {}).map(([z, v]) => [z, new Set(v.split(' '))]));
    const Base = L.TileLayer.extend({ createTile(c, done) {
      const z = this._getZoomForUrl(), set = have[z];
      if (set && !set.has(c.x + '_' + c.y)) { const d = document.createElement('div'); setTimeout(() => done(null, d), 0); return d; }
      return L.TileLayer.prototype.createTile.call(this, c, done);
    } });
    new Base('tiles/{z}/{x}_{y}.webp', { tileSize: 256 >> hd, zoomOffset: hd, minNativeZoom: T.minNativeZoom - hd, maxNativeZoom: T.maxNativeZoom - hd,
      minZoom: -2, maxZoom: 5, bounds, noWrap: true, keepBuffer: 3, className: 'base-tiles', attribution: '' }).addTo(m);

    // borders between areas (dashed), drawn once on one canvas; districts get names only
    const ren = L.canvas({ pane: 'borders', padding: 0.3 });
    const coords = (c) => L.latLng(toLL(c[0], c[1]));
    const mkBorders = (k, style) => L.geoJSON({ type: 'FeatureCollection', features: B.features.filter((f) => f.properties.k === k) },
      { coordsToLatLng: coords, interactive: false, renderer: ren, style: () => Object.assign({ fill: false, renderer: ren }, style) });
    const areaB = mkBorders('area', { color: css('--map-border'), weight: 1.4, opacity: 0.85, dashArray: '5 5' });

    // labels: added and removed by zoom and view
    const labels = B.labels.map((l) => ({ ...l, ll: L.latLng(toLL(l.x, l.y)), mk: null }));
    function syncLayers() {
      const z = m.getZoom(), view = m.getBounds().pad(0.15);
      if (z >= 1) areaB.addTo(m); else areaB.remove();
      for (const l of labels) {
        const [lo, hi] = LABEL_ZOOM[l.k] || [9, 9];
        const on = z >= lo && z <= hi && view.contains(l.ll) && !(l.k === 'poi' && S.mapCats.includes('landmark')); // landmark pins already name them
        if (on && !l.mk) l.mk = L.marker(l.ll, { pane: 'labels', interactive: false, keyboard: false,
          icon: L.divIcon({ className: 'map-label', html: `<span class="ml ml-${l.k}">${esc(l.t)}</span>`, iconSize: [0, 0] }) }).addTo(m);
        else if (!on && l.mk) { l.mk.remove(); l.mk = null; }
      }
    }
    m.on('zoomend moveend', syncLayers);
    if (opts.bounds) m.fitBounds(opts.bounds, opts.pad || {});
    else {
      const island = L.latLngBounds(toLL(0.13, 0.13), toLL(0.9, 0.92));
      m.options.zoomSnap = 0; const zf = m.getBoundsZoom(island, false, L.point(24, 24)); m.options.zoomSnap = 1;
      m.setView(island.getCenter(), isDesktop() ? Math.round(zf) : Math.floor(zf));
    }
    syncLayers();
    return m;
  }

  // Groups nearby pins into one numbered bubble when zoomed out. Returns [{pts, ll}] in screen-grid cells.
  function clusterPins(m, pts, cell) {
    const cells = new Map();
    for (const p of pts) {
      const q = m.project(toLL(p.x, p.y), Math.round(m.getZoom()));
      const key = Math.floor(q.x / cell) + ':' + Math.floor(q.y / cell);
      (cells.get(key) || cells.set(key, []).get(key)).push(p);
    }
    return [...cells.entries()].map(([key, g]) => ({ key, pts: g, ll: L.latLng(toLL(g.reduce((a, p) => a + p.x, 0) / g.length, g.reduce((a, p) => a + p.y, 0) / g.length)) }));
  }

  function renderMap(focusId) {
    view.className = 'full';
    view.innerHTML = `
      <div id="map" aria-label="Map of Leonida"></div>
      <div class="map-top">
        <div class="search glass"><svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5"/><path d="m12 12 4 4"/></svg>
          <input id="q" type="search" placeholder="Search ${D.places.length} places" aria-label="Search the map" autocomplete="off">
          <div class="results" id="results" hidden></div></div>
        <div class="chips" id="mapChips"></div>
      </div>
      <div class="map-ctl glass">
        <button id="zin" aria-label="Zoom in">+</button><button id="zout" aria-label="Zoom out">−</button>
        <button id="wp" class="accent" aria-label="Go to waypoint"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M16 2 2 8l6 6 2 6z"/></svg></button>
      </div>
      <button class="map-route glass" id="routeView">Route what's on screen <b id="visCount"></b></button>`;

    map = makeMap($('#map'));
    const layer = L.layerGroup().addTo(map);
    let wpRing = null;

    const chipCats = [...D.cats];
    // Map filters: one Filters button opens a grouped panel; the row only shows what is on (tap a chip to hide it).
    const GROUP_NAMES = { collectible: 'Collectibles', money: 'Money', story: 'Story', services: 'Services', shops: 'Shops & food', places: 'Places' };
    const MORE_ONLY = ['building', 'structure']; // counted, not tracked as found
    const X_ICON = '<svg class="x" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9"/></svg>';
    function drawChips() {
      const on = chipCats.filter((c) => S.mapCats.includes(c.id));
      $('#mapChips').innerHTML = `<button class="chip filters-btn" id="openFilters" aria-haspopup="dialog">
          <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 5h12M5.5 9h7M8 13h2"/></svg>Filters${on.length ? ` <b>${on.length}</b>` : ''}</button>` +
        `<button class="chip" id="hideFound" aria-pressed="${S.hideFound}">Hide found</button>` +
        on.map((c) => `<button class="chip on" data-off="${c.id}" aria-label="Hide ${esc(c.name)}"><span class="dot" style="background:${color(c.id)}"></span>${esc(c.name)}${X_ICON}</button>`).join('');
      $('#openFilters').onclick = openFilters;
      $('#hideFound').onclick = () => { S.hideFound = !S.hideFound; save(); drawChips(); drawPins(); };
      $('#mapChips').querySelectorAll('[data-off]').forEach((b) => (b.onclick = () => {
        S.mapCats = S.mapCats.filter((c) => c !== b.dataset.off); save(); drawChips(); drawPins();
      }));
    }
    function openFilters() {
      // lives on the page (not inside the map view) so it sits above the tab bar
      const root = $('#filters-root') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'filters-root' }));
      const keep = root.querySelector('.fl-body')?.scrollTop || 0;
      const groups = [...new Set(chipCats.map((c) => c.group))];
      const count = (c) => MORE_ONLY.includes(c.id) ? `${c.count}` : `${foundCount(c.id)}/${c.count}`;
      root.innerHTML = `<div class="fl-scrim" id="flScrim"></div>
        <section class="filters glass" role="dialog" aria-label="Map filters">
          <div class="fl-head"><h2>Filters</h2><button class="fl-link" id="flClear">Clear all</button><button class="btn primary fl-done" id="flDone">Done</button></div>
          <div class="fl-body">${groups.map((g) => { const cs = chipCats.filter((c) => c.group === g), all = cs.every((c) => S.mapCats.includes(c.id));
            return `<div class="fl-group"><div class="fl-gh"><span>${esc(GROUP_NAMES[g] || g)}</span><button class="fl-link" data-all="${g}">${all ? 'Hide all' : 'Show all'}</button></div>
              ${cs.map((c) => `<label class="fl-row"><span class="fl-ic" style="--c:${color(c.id)}">${icon(c.id)}</span><span class="fl-name">${esc(c.name)}</span>
                <span class="fl-count mono">${count(c)}</span><input type="checkbox" class="sw" data-cat="${c.id}"${S.mapCats.includes(c.id) ? ' checked' : ''}></label>`).join('')}</div>`; }).join('')}</div>
        </section>`;
      root.querySelector('.fl-body').scrollTop = keep;
      const top = $('.map-top');
      if (isDesktop() && top) Object.assign(root.querySelector('.filters').style, { left: top.getBoundingClientRect().left + 'px' });
      const apply = () => { save(); drawChips(); drawPins(); };
      const close = () => { root.innerHTML = ''; };
      $('#flScrim').onclick = close; $('#flDone').onclick = close;
      $('#flClear').onclick = () => { S.mapCats = []; apply(); openFilters(); };
      root.querySelectorAll('input[data-cat]').forEach((i) => (i.onchange = () => {
        S.mapCats = i.checked ? [...new Set([...S.mapCats, i.dataset.cat])] : S.mapCats.filter((c) => c !== i.dataset.cat); apply();
        const g = chipCats.find((c) => c.id === i.dataset.cat).group, btn = root.querySelector(`[data-all="${g}"]`);
        if (btn) btn.textContent = chipCats.filter((c) => c.group === g).every((c) => S.mapCats.includes(c.id)) ? 'Hide all' : 'Show all';
      }));
      root.querySelectorAll('[data-all]').forEach((b) => (b.onclick = () => {
        const ids = chipCats.filter((c) => c.group === b.dataset.all).map((c) => c.id), all = ids.every((id) => S.mapCats.includes(id));
        S.mapCats = all ? S.mapCats.filter((c) => !ids.includes(c)) : [...new Set([...S.mapCats, ...ids])]; apply(); openFilters();
      }));
    }
    // buildings come in map squares: load the squares on screen while their chip is on, drop the rest (data/more/)
    const MORE_CATS = ['building', 'structure'];
    const more = new Map(); // square key -> places, or 'loading'
    function syncMore() {
      const want = new Set();
      if (MORE_CATS.some((c) => S.mapCats.includes(c)) && D.moreIndex && map.getZoom() >= 2) { // buildings show from zoom 2
        const g = D.moreIndex.grid, b = map.getBounds().pad(0.2), a = fromLL(b.getNorthWest()), z = fromLL(b.getSouthEast());
        for (let i = Math.max(0, Math.floor(a.x * g)); i <= Math.min(g - 1, Math.floor(z.x * g)); i++)
          for (let j = Math.max(0, Math.floor(a.y * g)); j <= Math.min(g - 1, Math.floor(z.y * g)); j++)
            if (D.moreIndex.chunks[i + '_' + j]) want.add(i + '_' + j);
      }
      for (const k of [...more.keys()]) if (!want.has(k)) more.delete(k); // off screen: let it go
      want.forEach((k) => {
        if (more.has(k)) return;
        more.set(k, 'loading');
        fetch(`data/more/${k}.json`).then((r) => r.json()).then((ps) => { if (more.get(k) === 'loading' && map) { more.set(k, ps); drawPins(); } })
          .catch(() => more.delete(k));
      });
    }
    const morePlaces = () => [...more.values()].filter(Array.isArray).flat();
    const shown = () => D.places.concat(morePlaces()).filter((p) => S.mapCats.includes(p.cat) && !(S.hideFound && S.found[p.id]));

    // Pins: only what is on screen is in the page, reused between redraws (keyed), so panning stays light.
    const live = new Map();
    const pinMarker = (p, f) => L.marker(toLL(p.x, p.y), { keyboard: false, riseOnHover: true,
      icon: L.divIcon({ className: 'pin-wrap', iconSize: [36, 36], // 36px tap area (fix 11), 26px pin
        html: `<div class="pin${f ? ' found' : ''}" style="--c:${color(p.cat)}">${icon(p.cat)}</div>` }) })
      .bindTooltip(esc(p.name), { className: 'place-tip', direction: 'top', offset: [0, -16] })
      .on('click', () => { openPlace(p); placeInView(p); });
    const clusterMarker = (g) => { const n = g.pts.length, sz = n < 10 ? 34 : n < 50 ? 38 : n < 200 ? 44 : 50;
      return L.marker(g.ll, { pane: 'clusters', keyboard: false, riseOnHover: true, icon: L.divIcon({ className: 'pin-wrap', iconSize: [sz, sz],
        html: `<div class="cluster" style="width:${sz}px;height:${sz}px">${n}</div>` }) })
        .on('click', () => map.flyToBounds(L.latLngBounds(g.pts.map((p) => toLL(p.x, p.y))).pad(0.3), { duration: 0.5, maxZoom: 4 })); };
    function drawPins() {
      if (!map) return;
      syncMore();
      const z = map.getZoom(), view = map.getBounds().pad(0.25);
      const inView = shown().filter((p) => view.contains(toLL(p.x, p.y)));
      // zoomed out, or a crowded view: group close pins into numbered bubbles; otherwise every pin
      const groups = z >= 4 || (z >= 2 && inView.length <= 250) ? inView.map((p) => ({ key: p.id, pts: [p] })) : clusterPins(map, inView, 64);
      const next = new Map();
      groups.forEach((g) => {
        if (g.pts.length < 3) g.pts.forEach((p) => { const f = !!S.found[p.id]; next.set(`p${p.id}${f ? 'f' : ''}`, () => pinMarker(p, f)); });
        else next.set(`c${z}:${g.key}:${g.pts.length}`, () => clusterMarker(g));
      });
      for (const [k, m] of live) if (!next.has(k)) { layer.removeLayer(m); live.delete(k); }
      for (const [k, make] of next) if (!live.has(k)) { const m = make(); layer.addLayer(m); live.set(k, m); }
      if (wpRing) { wpRing.remove(); wpRing = null; }
      const w = S.waypoint && D.places.concat(morePlaces()).find((p) => p.id === S.waypoint);
      if (w) wpRing = L.circleMarker(toLL(w.x, w.y), { radius: 17, color: css('--accent'), weight: 3, fill: false, interactive: false }).addTo(map);
      updateVis();
    }
    function visible() { if (!map) return []; const b = map.getBounds(); return shown().filter((p) => !S.found[p.id] && b.contains(toLL(p.x, p.y))); }
    function updateVis() {
      if (!map || !$('#visCount')) return; // map already gone (fix 12)
      const n = visible().length; $('#visCount').textContent = n ? `${Math.min(n, 60)} stops` : '';
      $('#routeView').disabled = !n; $('#routeView').style.opacity = n ? 1 : 0.6;
    }

    // centre a pin in the visible part of the map: above the card on phones, left of the panel on desktop
    function placeInView(p, zoom) {
      if (!map) return;
      const sheet = $('.sheet'), size = map.getSize(), z = zoom ?? map.getZoom();
      const top = isDesktop() ? 0 : 112, H = sheet && !isDesktop() ? sheet.offsetHeight : 0, Wp = sheet && isDesktop() ? sheet.offsetWidth + 32 : 0;
      const pt = map.project(toLL(p.x, p.y), z);
      if (zoom == null) { // just tapped: only move if the pin is covered
        const c = map.latLngToContainerPoint(toLL(p.x, p.y));
        const covered = isDesktop() ? c.x > size.x - Wp - 24 : (c.y > size.y - H - 24 || c.y < top);
        if (!covered) return;
      }
      const target = map.unproject(pt.add([Wp / 2, (H - top) / 2]), z);
      if (zoom == null) map.panTo(target, { duration: 0.4 }); else map.flyTo(target, z, { duration: 0.6 });
    }

    // Pin card. Source text like "Shop at Hamlet. Can be entered. Real-life counterpart: X." becomes tags and a fact row.
    const PHOTO_OF_PLACE = new Set(['shop', 'fast-food', 'street-food', 'gas-station', 'atm', 'bank', 'big-bank', 'payday-loans', 'ammu-nation',
      'pay-n-spray', 'garage', 'purchasable-garage', 'safehouse', 'landmark', 'transport', 'building', 'structure', 'safe']);
    function parseDesc(d) {
      let text = d || '', real = '';
      const tags = [];
      text = text.replace(/Real-life counterpart:\s*(.+)$/s, (m, a) => { real = a.trim().replace(/\.$/, ''); return ''; });
      if (/Not confirmed yet\.?/.test(text)) { tags.push('Unconfirmed'); text = text.replace(/Not confirmed yet\.?/, ''); }
      if (/Can be entered\.?/.test(text)) { tags.push('Can go inside'); text = text.replace(/Can be entered\.?/, ''); }
      const first = text.match(/^\s*([A-Z][A-Za-z ]{2,30}?) at [^.]+\.\s*/); // "Train station at Ambrosia." -> tag
      if (first) { if (first[1] !== 'Building') tags.unshift(first[1]); text = text.replace(first[0], ''); }
      return { text: text.trim(), tags, real };
    }
    const nearestUnfound = (p) => D.places.filter((q) => q.cat === p.cat && q.id !== p.id && !S.found[q.id])
      .sort((a, b) => Math.hypot(a.x - p.x, (a.y - p.y) * AR) - Math.hypot(b.x - p.x, (b.y - p.y) * AR))[0];
    function openPlace(p) {
      const isWp = S.waypoint === p.id;
      const same = sheetRoot.querySelector(`.sheet[data-id="${p.id}"]`);
      if (same) return;
      const where = [p.area && !(p.near || '').includes(p.area) ? p.area : '', (p.near || '').replace(/^Near /, '')].filter(Boolean).join(' · ');
      const info = parseDesc(p.desc);
      const help = info.text || (!p.desc && (D.catHelp || {})[p.cat]) || '';
      const empty = !help && !info.tags.length && !info.real;
      const img = p.img && p.img.startsWith('/') ? 'https://gta6tracker.org' + p.img : p.img;
      const cap = p.imgSrc === 'wiki' ? 'Image: GTA Wiki'
        : PHOTO_OF_PLACE.has(p.cat) ? 'Photo: GTADB.ORG, CC BY 4.0' : 'Nearby photo, not the exact spot · GTADB.ORG, CC BY 4.0';
      const tracked = ['collectible', 'money', 'story'].includes((D.cats.find((c) => c.id === p.cat) || {}).group);
      const prog = () => `${foundCount(p.cat)} of ${placesOf(p.cat).length} found`;
      const next = tracked && nearestUnfound(p);
      const link = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5 3 9"/></svg></a>`;
      sheetRoot.innerHTML = `
        <section class="sheet glass" data-id="${p.id}" aria-label="${esc(p.name)}">
          <span class="grab"></span>
          <button class="icon-btn close" id="closeSheet" aria-label="Close"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4 4 14"/></svg></button>
          <div class="pc-body">
            <div class="pc-head">
              <div class="pc-kind"><span class="pc-ic" style="--c:${color(p.cat)}">${icon(p.cat)}</span>
                <span class="kind">${esc(catName(p.cat))}${p.ch ? ' · Chapter ' + p.ch : ''}</span>
                ${tracked ? `<span class="pc-prog mono" id="pcProg">${prog()}</span>` : ''}</div>
              <h2>${esc(p.name)}</h2>
              <div class="pc-meta">${where ? `<span class="pc-near"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 11s4-3.6 4-6.5a4 4 0 0 0-8 0C2 7.4 6 11 6 11z"/><circle cx="6" cy="4.6" r="1.4"/></svg>${esc(where)}</span>` : ''}
                <span class="pc-found" id="pcFound"${S.found[p.id] ? '' : ' hidden'}>Found</span></div>
            </div>
            ${img ? `<figure class="pc-img"><button class="pc-zoom" id="pcZoom" aria-label="Open photo full screen"><img src="${esc(img)}" alt="${esc(p.name)}" decoding="async" referrerpolicy="no-referrer"
              onload="this.classList.add('ok')" onerror="this.closest('figure').remove()"></button><figcaption>${esc(cap)}</figcaption></figure>` : ''}
            ${info.tags.length ? `<div class="pc-tags">${info.tags.map((t) => `<span class="pc-tag">${esc(t)}</span>`).join('')}</div>` : ''}
            ${help || empty ? `<p class="pc-desc${help ? '' : ' none'}">${help ? esc(help) : 'No details for this spot yet. The source page may have more.'}</p>` : ''}
            ${info.real ? `<div class="pc-fact"><span>Real-life spot</span><b>${esc(info.real)}</b></div>` : ''}
            ${next ? `<button class="pc-next" id="pcNext"><span>Next nearest</span><b>${esc(next.name)}</b><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></button>` : ''}
          </div>
          <div class="pc-src"><span>Source</span>
            ${p.slug ? link('https://gta6tracker.org/l/' + encodeURIComponent(p.slug), 'gta6tracker.org') : ''}
            ${p.wiki ? link(p.wiki, 'GTA Wiki') : ''}<span class="pc-unv">unverified</span></div>
          <div class="btn-row">
            <button class="btn secondary" id="setWp">${isWp ? 'Clear waypoint' : 'Set waypoint'}</button>
            <button class="btn primary" id="markFound">${S.found[p.id] ? 'Not found' : 'Mark found'}</button>
          </div>
        </section>`;
      $('#closeSheet').onclick = () => (sheetRoot.innerHTML = '');
      const z = $('#pcZoom');
      if (z) z.onclick = () => {
        document.body.insertAdjacentHTML('beforeend', `<div class="lightbox" role="dialog" aria-label="Photo"><img src="${esc(img)}" alt="${esc(p.name)}" referrerpolicy="no-referrer"><span>${esc(cap)}</span></div>`);
        const lb = document.body.lastElementChild, shut = () => { lb.remove(); removeEventListener('keydown', esc_); };
        const esc_ = (e) => { if (e.key === 'Escape') shut(); };
        lb.onclick = shut; addEventListener('keydown', esc_);
      };
      if (next) $('#pcNext').onclick = () => { openPlace(next); placeInView(next, Math.max(2, map.getZoom())); };
      // update labels in place, no re-animation (fix 6)
      $('#setWp').onclick = (e) => {
        const was = S.waypoint === p.id; S.waypoint = was ? null : p.id; save(); drawPins();
        e.currentTarget.textContent = was ? 'Set waypoint' : 'Clear waypoint'; toast(was ? 'Waypoint cleared' : 'Waypoint set');
      };
      $('#markFound').onclick = (e) => {
        const was = !!S.found[p.id]; if (was) delete S.found[p.id]; else S.found[p.id] = Date.now(); save(); drawPins();
        e.currentTarget.textContent = was ? 'Mark found' : 'Not found';
        $('#pcFound').hidden = was; if ($('#pcProg')) $('#pcProg').textContent = prog();
        toast(was ? 'Marked not found' : 'Found! ' + foundCount(p.cat) + '/' + placesOf(p.cat).length);
      };
    }

    // search
    const q = $('#q'), results = $('#results');
    q.oninput = () => {
      const s = q.value.trim().toLowerCase();
      if (s.length < 2) { results.hidden = true; document.body.classList.remove('searching'); return; }
      document.body.classList.add('searching');
      const hits = D.places.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 12);
      results.innerHTML = hits.length ? hits.map((p) => `<button data-id="${p.id}"><span>${esc(p.name)}</span><span>${esc(catName(p.cat))}</span></button>`).join('')
        : '<button disabled><span>No matches</span><span></span></button>';
      results.hidden = false;
      results.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => {
        const p = D.places.find((x) => x.id === b.dataset.id);
        if (!S.mapCats.includes(p.cat)) { S.mapCats.push(p.cat); save(); drawChips(); drawPins(); }
        results.hidden = true; document.body.classList.remove('searching'); q.value = ''; q.blur();
        openPlace(p); placeInView(p, Math.max(2, map.getZoom()));
      }));
    };

    $('#zin').onclick = () => map.zoomIn();
    $('#zout').onclick = () => map.zoomOut();
    $('#wp').onclick = () => {
      const w = S.waypoint && D.places.find((p) => p.id === S.waypoint);
      if (!w) return toast('No waypoint yet. Tap a pin to set one.');
      openPlace(w); placeInView(w, Math.max(2, map.getZoom()));
    };
    $('#routeView').onclick = () => {
      const pts = visible();
      if (!pts.length) return;
      const c = fromLL(map.getCenter());
      const near = pts.slice().sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, 60);
      buildRun(near, `${near.length} stops on screen`, c);
      location.hash = 'run';
    };
    map.on('moveend', drawPins); // also runs updateVis
    map.on('click', () => { sheetRoot.innerHTML = ''; results.hidden = true; document.body.classList.remove('searching'); });
    q.onkeydown = (e) => { if (e.key === 'Escape') { q.value = ''; results.hidden = true; document.body.classList.remove('searching'); } };

    drawChips(); drawPins();
    if (focusId) { const p = D.places.find((x) => x.id === focusId); if (p) { if (!S.mapCats.includes(p.cat)) { S.mapCats.push(p.cat); save(); drawChips(); drawPins(); } map.setView(toLL(p.x, p.y), 2); openPlace(p); placeInView(p, 2); } }
  }

  // ---------- RUN ----------
  let showUpcoming = false;
  function renderRun() {
    if (!S.run || !S.run.stops.length) { location.hash = 'plan'; return; }
    killMap();
    view.className = 'full';
    const R = S.run, total = R.stops.length, idx = Math.min(R.idx, total);
    R.doneN = R.doneN || 0; R.skipN = R.skipN || 0;
    const placeStops = R.stops.filter((s) => s.type === 'place');
    view.innerHTML = `<div class="run-map" id="runMap" aria-label="Route map"></div>
      <a class="back glass" href="#plan" aria-label="Back to Plan"><svg viewBox="0 0 10 16" aria-hidden="true"><path d="M8 2 2 8l6 6"/></svg></a>`;

    // 1) draw the card first, so the map can fit the route around it (fix 3)
    if (idx >= total) {
      const sk = R.skipN;
      sheetRoot.innerHTML = `<section class="run-card glass"><span class="grab"></span>
        <span class="tag ready">RUN COMPLETE</span>
        <div class="next"><h2>${R.doneN} done${sk ? `, ${sk} skipped` : ''}.</h2>
          <div class="muted" style="font-size:14px;margin-top:4px">${R.doneN ? 'Nice work. Your checklist is updated.' : 'Nothing ticked this time.'}</div></div>
        <div class="btn-row"><a class="btn secondary" href="#guide">See progress</a><a class="btn primary" href="#plan" id="again">Plan another</a></div></section>`;
      $('#again').onclick = () => { S.run = null; save(); };
    } else {
      const cur = R.stops[idx];
      const pct = Math.round((idx / total) * 100);
      const upcoming = R.stops.slice(idx + 1, idx + 5);
      const compact = !isDesktop(); // phones: keep the card short so the route stays visible
      const list = upcoming.length ? `<ul class="list" style="margin-top:6px">${upcoming.map((s, i) => `
          <li><div class="check-row" style="grid-template-columns:28px 1fr auto;padding-left:0"><span class="mono muted">${idx + i + 2}</span>
            <span class="name" style="font-size:15px">${esc(s.name)}</span>${s.type === 'task' ? `<span class="tag ${s.status}">${esc(s.tag)}</span>` : `<span class="muted" style="font-size:12px">${esc(s.sub)}</span>`}</div></li>`).join('')}</ul>` : '';
      sheetRoot.innerHTML = `
      <section class="run-card glass" aria-label="Run in progress">
        <span class="grab"></span>
        <div class="run-head"><span class="label run-title">${esc(R.title)}</span><span class="mono label">${idx + 1}/${total}</span></div>
        <div class="run-line"><span class="num">${idx}</span><span class="track"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></span><span class="num muted">${total}</span></div>
        <div class="run-ends"><span>${esc(short(R.stops[0].name))}</span><span>${total - idx} to go</span><span>${esc(short(R.stops[total - 1].name))}</span></div>
        <div class="next"><span class="label" style="color:var(--accent-text)">${cur.type === 'place' ? 'Next: ' + esc(cur.sub) : esc(cur.tag)}</span><h2>${esc(cur.name)}</h2>
          <div class="muted next-sub">${cur.type === 'task' ? esc(cur.sub || '') : ''}</div></div>
        <div class="btn-row"><button class="btn secondary" id="skip">Skip</button><button class="btn primary" id="doneNext">Done, next</button></div>
        ${list ? (compact && !showUpcoming
          ? `<button class="link-btn" id="moreUp" style="align-self:flex-start">Coming up (${upcoming.length})</button>`
          : `<div><span class="label">Coming up</span>${list}</div>`) : ''}
      </section>`;
      const step = (done) => {
        if (done) { if (cur.type === 'place') S.found[cur.id] = Date.now(); else if (cur.id !== 'cash' && !cur.repeatable) S.done[cur.id] = Date.now(); R.doneN++; }
        else R.skipN++;
        R.idx++; save(); renderRun();
      };
      $('#skip').onclick = () => step(false);
      $('#doneNext').onclick = () => step(true);
      const more = $('#moreUp'); if (more) more.onclick = () => { showUpcoming = true; renderRun(); };
    }

    // 2) map, fitted into the space the card leaves free
    const pts = placeStops.map((s) => toLL(s.x, s.y));
    const card = $('.run-card');
    const pad = isDesktop()
      ? { paddingTopLeft: [60, 60], paddingBottomRight: [(card ? card.offsetWidth : 380) + 60, 60], maxZoom: 3 }
      : { paddingTopLeft: [36, 76], paddingBottomRight: [36, (card ? card.offsetHeight : innerHeight * 0.6) + 24], maxZoom: 3 };
    map = makeMap($('#runMap'), pts.length ? { free: true, bounds: L.latLngBounds(pts), pad } : {});
    if (pts.length) {
      const doneIdx = placeStops.filter((s) => R.stops.indexOf(s) < idx).length;
      const curIsPlace = idx < total && R.stops[idx].type === 'place';
      if (doneIdx > 0) L.polyline(pts.slice(0, doneIdx + 1), { color: css('--text-3'), weight: 4, opacity: 0.9 }).addTo(map);
      L.polyline(pts.slice(Math.max(0, doneIdx)), { color: css('--card'), weight: 8, opacity: 1 }).addTo(map);
      L.polyline(pts.slice(Math.max(0, doneIdx)), { color: css('--accent'), weight: 4 }).addTo(map);
      placeStops.forEach((s, i) => {
        const past = i < doneIdx, cur = curIsPlace && i === doneIdx;
        L.circleMarker(pts[i], { radius: cur ? 8 : 5, color: cur ? css('--card') : (past ? css('--text-3') : css('--accent')), weight: cur ? 3 : 2,
          fillColor: cur ? css('--accent') : css('--card'), fillOpacity: 1 }).bindTooltip(esc(s.name), { className: 'place-tip' }).addTo(map);
      });
    }
  }
  const short = (s) => s.replace(/ Stunt Jump$/, '').replace(/ Stunt$/, '');

  // ---------- GUIDE ----------
  function renderGuide(tab) {
    tab = tab || 'collect';
    const cc = collectCats();
    const total = cc.reduce((s, c) => s + c.count, 0), got = cc.reduce((s, c) => s + foundCount(c.id), 0);
    const tabs = [['collect', 'Collect'], ['missions', 'Missions'], ['money', 'Money'], ['cheats', 'Cheats']];
    let body = '';
    if (tab === 'collect') {
      body = `<ul class="list card two-col">${cc.map((c) => { const f = foundCount(c.id); return `
        <li><a class="item" href="#checklist/${c.id}" style="color:inherit;text-decoration:none">
          <span class="name">${esc(c.name)}</span><span class="bar ${f === c.count ? 'done' : ''}"><i style="width:${Math.round(f / c.count * 100)}%"></i></span>
          <span class="count">${f}<small>/${c.count}</small></span><svg class="chev" viewBox="0 0 8 14" aria-hidden="true"><path d="m1 1 6 6-6 6"/></svg></a></li>`; }).join('')}</ul>`;
    } else if (tab === 'missions') {
      const g = {};
      D.guide.missions.forEach((m) => { const k = m.ch == null ? 'Chapter not listed yet' : (m.ch === 0 ? 'Prologue' : 'Chapter ' + m.ch); (g[k] = g[k] || []).push(m); });
      const order = Object.keys(g).sort((a, b) => (a === 'Prologue' ? -1 : b === 'Prologue' ? 1 : a.startsWith('Chapter n') ? 1 : b.startsWith('Chapter n') ? -1 : a.localeCompare(b)));
      const withCh = D.guide.missions.filter((m) => m.ch != null).length;
      body = `<p class="foot" style="padding-bottom:0">${D.guide.missions.length} of 91 story missions listed so far, ${withCh} with a chapter. More as the data fills in.</p>` + order.map((k) => `<h3 class="section-h">${esc(k)}</h3><ul class="list card">${g[k].map((m) => checkRow(m.id, m.name, m.area || '')).join('')}</ul>`).join('') +
        `<h3 class="section-h">Strangers &amp; Freaks</h3><ul class="list card">${D.guide.side.map((m) => checkRow(m.id, m.name, m.giver ? 'Given by ' + m.giver : '')).join('')}</ul>
        <p class="foot">The trophy needs 8 qualifying questlines. Guides disagree on which ones count.</p>`;
    } else if (tab === 'money') {
      body = `<section class="card" style="overflow:hidden"><div class="card-pad" style="padding-bottom:4px"><span class="label">Rules of the cash</span></div>
        <ul class="board">${D.money.rules.map((r) => `<li style="grid-template-columns:1fr auto"><div class="sub" style="color:var(--text);font-size:15px">${esc(r.text)}</div>${srcTag(r.sources)}</li>`).join('')}</ul></section>
        <section class="card" style="overflow:hidden"><div class="card-pad" style="padding-bottom:4px"><span class="label">Ways to make money</span></div>
        <ul class="board">${D.money.methods.map((m) => `<li style="grid-template-columns:1fr auto"><div><div class="name">${esc(m.name)}</div><div class="sub">${esc(m.when)} · ${esc(m.note)}</div>
          ${m.cat ? `<a href="#map" data-showcat="${m.cat}" style="font-size:13px;font-weight:600;text-decoration:none">Show on map</a>` : ''}</div>${srcTag(m.sources)}</li>`).join('')}</ul></section>
        <p class="foot">No payout numbers yet. Nobody has confirmed them, so we don't guess.</p>`;
    } else {
      body = `<h3 class="section-h">Cheats</h3><ul class="list card">${D.guide.cheats.map((c) => `<li><div class="check-row" style="grid-template-columns:1fr auto"><span class="name">${esc(c.name)}</span><span class="sub">${esc(c.unlock || '')}</span></div></li>`).join('')}</ul>
        <h3 class="section-h">Trophies</h3><ul class="list card">${D.guide.trophies.map((t) => checkRow(t.id, t.name, t.how || '')).join('')}</ul>`;
    }
    view.innerHTML = `<div class="page wide">
      <h1 class="title" style="padding:0 4px">Guide</h1>
      <section class="card card-pad"><div class="row-ctl" style="min-height:0"><span class="label">Collectibles found</span>
        <span class="big-count">${got}<small> / ${total}</small></span></div><span class="bar"><i style="width:${Math.round(got / total * 100)}%"></i></span></section>
      <div class="seg" role="tablist">${tabs.map(([id, n]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}" aria-pressed="${tab === id}">${n}</button>`).join('')}</div>
      ${body}
      ${creditsCard()}</div>`;
    view.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => (location.hash = 'guide/' + b.dataset.tab)));
    bindChecks(() => renderGuide(tab));
    view.querySelectorAll('[data-showcat]').forEach((a) => (a.onclick = () => { S.mapCats = [a.dataset.showcat]; save(); }));
  }
  function checkRow(id, name, sub) {
    const on = !!S.done[id];
    return `<li><div class="check-row ${on ? 'done' : ''}"><button class="check" data-done="${id}" aria-pressed="${on}" aria-label="${esc(name)} done"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="m2 7 3.5 3.5L12 3"/></svg></button>
      <div style="min-width:0"><div class="name">${esc(name)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div><span></span></div></li>`;
  }
  function bindChecks(rerender) {
    view.querySelectorAll('[data-done]').forEach((b) => (b.onclick = () => { const id = b.dataset.done; if (S.done[id]) delete S.done[id]; else S.done[id] = Date.now(); save(); rerender(); }));
  }

  // ---------- CHECKLIST ----------
  function renderChecklist(cat) {
    const cats = D.cats.filter((c) => c.group === 'collectible' || c.group === 'money');
    cat = cat && cats.find((c) => c.id === cat) ? cat : cats[0].id;
    const items = placesOf(cat).slice().sort((a, b) => (!!S.found[a.id] - !!S.found[b.id]) || a.name.localeCompare(b.name));
    const f = foundCount(cat), n = items.length;
    view.innerHTML = `<div class="page wide">
      <h1 class="title" style="padding:0 4px">Checklist</h1>
      <div class="chips" id="checkChips">${cats.map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${c.id === cat}"><span class="dot" style="background:${color(c.id)}"></span>${esc(c.name)}</button>`).join('')}</div>
      <section class="card card-pad"><div class="row-ctl" style="min-height:0"><span class="label">${esc(catName(cat))}</span>
        <span class="big-count" id="ckCount">${f}<small> / ${n}</small></span></div><span class="bar ${f === n ? 'done' : ''}" id="ckBar"><i style="width:${Math.round(f / n * 100)}%"></i></span>
        <button class="btn secondary" id="routeLeft" ${f === n ? 'disabled' : ''}>Route the ${n - f} left</button></section>
      <ul class="list card">${items.map((p) => { const on = !!S.found[p.id]; return `
        <li><div class="check-row ${on ? 'done' : ''}"><button class="check" data-found="${p.id}" aria-pressed="${on}" aria-label="${esc(p.name)} found"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="m2 7 3.5 3.5L12 3"/></svg></button>
          <div style="min-width:0"><div class="name">${esc(p.name)}</div><div class="sub">${esc(areaOf(p))}</div></div>
          <a class="link-btn" href="#map/${p.id}" style="text-decoration:none">Map</a></div></li>`; }).join('')}</ul>
    </div>`;
    view.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => (location.hash = 'checklist/' + b.dataset.cat)));
    revealChip($('#checkChips'));
    // tick in place; rows only re-sort next time the list opens (fix 9)
    view.querySelectorAll('[data-found]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.found, on = !S.found[id];
      if (on) S.found[id] = Date.now(); else delete S.found[id]; save();
      b.setAttribute('aria-pressed', on); b.closest('.check-row').classList.toggle('done', on);
      const nf = foundCount(cat);
      $('#ckCount').innerHTML = `${nf}<small> / ${n}</small>`;
      $('#ckBar').classList.toggle('done', nf === n); $('#ckBar i').style.width = Math.round(nf / n * 100) + '%';
      const rl = $('#routeLeft'); rl.textContent = `Route the ${n - nf} left`; rl.disabled = nf === n;
    }));
    $('#routeLeft').onclick = () => { const left = items.filter((p) => !S.found[p.id]); buildRun(left, `${catName(cat)}, ${left.length} left`); location.hash = 'run'; };
  }

  // ---------- boot ----------
  Promise.all(['places', 'guide', 'tonight', 'money', 'basemap', 'more'].map((n) => fetch(`data/${n}.json`).then((r) => r.json())))
    .then(([p, guide, tonight, money, basemap, moreIndex]) => { D = { ...p, guide, tonight, money, basemap, moreIndex }; route(); })
    .catch((e) => { view.innerHTML = `<div class="page"><h1 class="title">Couldn't load data</h1><p class="muted">${esc(e.message)}</p></div>`; });
})();
