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
    'ammu-nation': '#B23A48', 'pay-n-spray': '#2E86DE', 'purchasable-garage': '#576574', 'garage': '#576574' };
  const color = (cat) => COLORS[cat] || '#8E8E93';
  const catName = (id) => (D.cats.find((c) => c.id === id) || { name: id }).name;
  const placesOf = (cat) => D.places.filter((p) => p.cat === cat);
  const foundCount = (cat) => placesOf(cat).filter((p) => S.found[p.id]).length;
  const collectCats = () => D.cats.filter((c) => c.group === 'collectible');
  const toLL = (x, y) => [-y * 1000, x * 1000];
  const fromLL = (ll) => ({ x: ll.lng / 1000, y: -ll.lat / 1000 });
  const nearestRegion = (p) => D.regions.reduce((b, r) => (Math.hypot(r.x - p.x, r.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? r : b));
  const areaOf = (p) => p.area || '';
  const srcTag = (n) => `<span class="tag src">${n} SOURCE${n === 1 ? '' : 'S'}</span>`;

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast glass'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  // ---------- router ----------
  function route() {
    applyTheme();
    if (!D) return; // data still loading
    if (map) { map.remove(); map = null; }
    sheetRoot.innerHTML = '';
    view.className = '';
    const [name, arg] = (location.hash.slice(1) || 'plan').split('/');
    document.querySelectorAll('#tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === name ? 'page' : 'false'));
    $('#tabs').style.display = name === 'run' ? 'none' : '';
    ({ plan: renderPlan, map: renderMap, guide: renderGuide, checklist: renderChecklist, run: renderRun }[name] || renderPlan)(arg);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---------- install ----------
  let installPrompt = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (location.hash.startsWith('#plan') || !location.hash) route(); });
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function installCard() {
    if (standalone() || S.hideInstall) return '';
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
        <div class="chips">${routeChips}</div>
      </section>

      <section class="card" style="overflow:hidden">
        <div class="row-ctl" style="padding:6px 16px 0"><h2 class="label" style="margin:0">Live board</h2>
          <span class="mono muted" style="font-size:12px">ch ${S.chapter} · ${S.who} · ${S.time}</span></div>
        <ul class="board">${items.map((t) => `
          <li><span class="tag ${t.status}">${t.label}</span>
            <div style="min-width:0"><div class="name">${esc(t.name)}</div><div class="sub">${esc(t.sub || '')}</div></div>
            <span class="mono muted" style="font-size:12px">${t.sources} src</span></li>`).join('')}</ul>
      </section>

      <a class="btn primary" href="#run" id="build">Build my ${S.mins} min run</a>
      <p class="foot">Run size is a first guess (stops, not minutes) until we time real drives. Board entries come from guides; "src" shows how many agree. Not affiliated with Rockstar Games or Take-Two.</p>
    </div>`;

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
    S.run = { title: title || `Your ${S.mins} min run`, stops, idx: 0 };
    save();
  }

  // ---------- MAP (shared) ----------
  function makeMap(el, opts = {}) {
    const m = L.map(el, { crs: L.CRS.Simple, zoomControl: false, attributionControl: true, minZoom: -1, maxZoom: 4, zoomSnap: 0.25,
      preferCanvas: true, maxBounds: [[-1000, -50], [0, 1050]], maxBoundsViscosity: 0.8 });
    m.attributionControl.setPrefix(false);
    m.attributionControl.addAttribution('Locations via gta6tracker.org (unverified) · Unofficial');
    const coords = (c) => L.latLng(-c[1] * 1000, c[0] * 1000);
    L.geoJSON(D.outline, { coordsToLatLng: coords, interactive: false,
      style: { color: css('--shallow'), weight: 18, fillColor: css('--land'), fillOpacity: 1, opacity: 1, lineJoin: 'round' } }).addTo(m);
    L.geoJSON(D.outline, { coordsToLatLng: coords, interactive: false,
      style: { color: css('--land'), weight: 1, fillOpacity: 0, opacity: 1 } }).addTo(m);
    D.regions.forEach((r) => L.marker(toLL(r.x, r.y), { interactive: false,
      icon: L.divIcon({ className: '', html: `<span class="region-label">${esc(r.name)}</span>`, iconSize: [0, 0] }) }).addTo(m));
    m.fitBounds(opts.bounds || [toLL(0.42, 0.35), toLL(0.88, 0.9)], opts.pad || {});
    return m;
  }

  function renderMap(focusId) {
    view.className = 'full';
    view.innerHTML = `
      <div id="map" aria-label="Map of Leonida"></div>
      <div class="map-top">
        <div class="search glass"><svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5"/><path d="m12 12 4 4"/></svg>
          <input id="q" type="search" placeholder="Search ${D.places.length} places" aria-label="Search the map" autocomplete="off">
          <div class="results glass" id="results" hidden></div></div>
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
    function drawChips() {
      $('#mapChips').innerHTML = `<button class="chip" id="hideFound" aria-pressed="${S.hideFound}">Hide found</button>` +
        chipCats.map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${S.mapCats.includes(c.id)}"><span class="dot" style="background:${color(c.id)}"></span>${esc(c.name)} <span class="mono" style="opacity:.6">${c.count}</span></button>`).join('');
      $('#hideFound').onclick = () => { S.hideFound = !S.hideFound; save(); drawChips(); drawPins(); };
      $('#mapChips').querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
        const id = b.dataset.cat;
        S.mapCats = S.mapCats.includes(id) ? S.mapCats.filter((c) => c !== id) : [...S.mapCats, id];
        save(); drawChips(); drawPins();
      }));
    }
    const shown = () => D.places.filter((p) => S.mapCats.includes(p.cat) && !(S.hideFound && S.found[p.id]));
    function drawPins() {
      layer.clearLayers();
      shown().forEach((p) => {
        const f = !!S.found[p.id];
        L.circleMarker(toLL(p.x, p.y), { bubblingMouseEvents: false, radius: 7, color: css('--pin-ring'), weight: 2, fillColor: color(p.cat), fillOpacity: f ? 0.35 : 1, opacity: f ? 0.5 : 1 })
          .bindTooltip(esc(p.name), { className: 'place-tip', direction: 'top', offset: [0, -6] })
          .on('click', () => openPlace(p)).addTo(layer);
      });
      if (wpRing) { wpRing.remove(); wpRing = null; }
      const w = S.waypoint && D.places.find((p) => p.id === S.waypoint);
      if (w) wpRing = L.circleMarker(toLL(w.x, w.y), { radius: 14, color: css('--accent'), weight: 3, fill: false, interactive: false }).addTo(map);
      updateVis();
    }
    function visible() { const b = map.getBounds(); return shown().filter((p) => !S.found[p.id] && b.contains(toLL(p.x, p.y))); }
    function updateVis() { const n = visible().length; $('#visCount').textContent = n ? `${n} stops` : ''; $('#routeView').disabled = !n; $('#routeView').style.opacity = n ? 1 : 0.6; }

    function openPlace(p) {
      const f = !!S.found[p.id], isWp = S.waypoint === p.id;
      sheetRoot.innerHTML = `
        <section class="sheet glass" aria-label="${esc(p.name)}">
          <span class="grab"></span>
          <button class="icon-btn close" id="closeSheet" aria-label="Close"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4 4 14"/></svg></button>
          <div style="display:flex;flex-direction:column;gap:4px;padding-right:40px">
            <span class="kind">${esc(catName(p.cat))}${p.ch ? ' · Chapter ' + p.ch : ''}</span>
            <h2>${esc(p.name)}</h2>
            <span class="muted" style="font-size:14px">${esc(areaOf(p))}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center">${srcTag(p.sources)}<span class="muted" style="font-size:12px">${esc(p.source)}</span></div>
          <div class="btn-row">
            <button class="btn secondary" id="setWp">${isWp ? 'Clear waypoint' : 'Set waypoint'}</button>
            <button class="btn primary" id="markFound">${f ? 'Not found' : 'Mark found'}</button>
          </div>
        </section>`;
      $('#closeSheet').onclick = () => (sheetRoot.innerHTML = '');
      $('#setWp').onclick = () => { S.waypoint = isWp ? null : p.id; save(); drawPins(); openPlace(p); toast(isWp ? 'Waypoint cleared' : 'Waypoint set'); };
      $('#markFound').onclick = () => { if (f) delete S.found[p.id]; else S.found[p.id] = Date.now(); save(); drawPins(); openPlace(p); toast(f ? 'Marked not found' : 'Found! ' + foundCount(p.cat) + '/' + placesOf(p.cat).length); };
    }

    // search
    const q = $('#q'), results = $('#results');
    q.oninput = () => {
      const s = q.value.trim().toLowerCase();
      if (s.length < 2) { results.hidden = true; return; }
      const hits = D.places.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 12);
      results.innerHTML = hits.length ? hits.map((p) => `<button data-id="${p.id}"><span>${esc(p.name)}</span><span>${esc(catName(p.cat))}</span></button>`).join('')
        : '<button disabled><span>No matches</span><span></span></button>';
      results.hidden = false;
      results.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => {
        const p = D.places.find((x) => x.id === b.dataset.id);
        if (!S.mapCats.includes(p.cat)) { S.mapCats.push(p.cat); save(); drawChips(); drawPins(); }
        results.hidden = true; q.value = ''; q.blur();
        map.flyTo(toLL(p.x, p.y), 2.5, { duration: 0.6 }); openPlace(p);
      }));
    };

    $('#zin').onclick = () => map.zoomIn();
    $('#zout').onclick = () => map.zoomOut();
    $('#wp').onclick = () => {
      const w = S.waypoint && D.places.find((p) => p.id === S.waypoint);
      if (!w) return toast('No waypoint yet. Tap a pin to set one.');
      map.flyTo(toLL(w.x, w.y), 2.5, { duration: 0.6 }); openPlace(w);
    };
    $('#routeView').onclick = () => {
      const pts = visible();
      if (!pts.length) return;
      const c = fromLL(map.getCenter());
      const near = pts.slice().sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, 60);
      buildRun(near, `${near.length} stops on screen`, c);
      location.hash = 'run';
    };
    map.on('moveend', updateVis);
    map.on('click', () => { sheetRoot.innerHTML = ''; results.hidden = true; });

    drawChips(); drawPins();
    if (focusId) { const p = D.places.find((x) => x.id === focusId); if (p) { if (!S.mapCats.includes(p.cat)) { S.mapCats.push(p.cat); save(); drawChips(); drawPins(); } map.setView(toLL(p.x, p.y), 2.5); openPlace(p); } }
  }

  // ---------- RUN ----------
  function renderRun() {
    if (!S.run || !S.run.stops.length) { location.hash = 'plan'; return; }
    if (map) { map.remove(); map = null; }
    view.className = 'full';
    const R = S.run, total = R.stops.length, idx = Math.min(R.idx, total);
    const placeStops = R.stops.filter((s) => s.type === 'place');
    view.innerHTML = `<div class="run-map" id="runMap" aria-label="Route map"></div>
      <a class="back glass" href="#plan" aria-label="Back to Plan"><svg viewBox="0 0 10 16" aria-hidden="true"><path d="M8 2 2 8l6 6"/></svg></a>`;
    const pts = placeStops.map((s) => toLL(s.x, s.y));
    // fit the route into the space above the bottom card
    map = makeMap($('#runMap'), pts.length ? { bounds: L.latLngBounds(pts),
      pad: { paddingTopLeft: [40, 80], paddingBottomRight: [40, Math.round(innerHeight * 0.62)], maxZoom: 3 } } : {});
    if (pts.length) {
      const doneIdx = placeStops.filter((s) => R.stops.indexOf(s) < idx).length;
      if (doneIdx > 0) L.polyline(pts.slice(0, doneIdx + 1), { color: css('--text-3'), weight: 4, opacity: 0.9 }).addTo(map);
      L.polyline(pts.slice(Math.max(0, doneIdx)), { color: css('--card'), weight: 8, opacity: 1 }).addTo(map);
      L.polyline(pts.slice(Math.max(0, doneIdx)), { color: css('--accent'), weight: 4 }).addTo(map);
      placeStops.forEach((s, i) => {
        const past = i < doneIdx, cur = i === doneIdx && idx < total;
        L.circleMarker(pts[i], { radius: cur ? 8 : 5, color: cur ? css('--card') : (past ? css('--text-3') : css('--accent')), weight: cur ? 3 : 2,
          fillColor: cur ? css('--accent') : css('--card'), fillOpacity: 1 }).bindTooltip(esc(s.name), { className: 'place-tip' }).addTo(map);
      });
    }

    if (idx >= total) {
      sheetRoot.innerHTML = `<section class="run-card glass"><span class="grab" style="align-self:center;width:36px;height:5px;border-radius:3px;background:var(--fill-2)"></span>
        <span class="tag ready">RUN COMPLETE</span><div class="next"><h2>Nice. ${total} stops done.</h2></div>
        <div class="btn-row"><a class="btn secondary" href="#guide">See progress</a><a class="btn primary" href="#plan" id="again">Plan another</a></div></section>`;
      $('#again').onclick = () => { S.run = null; save(); };
      return;
    }
    const cur = R.stops[idx];
    const first = R.stops[0].name, last = R.stops[total - 1].name;
    const pct = Math.round((idx / total) * 100);
    const upcoming = R.stops.slice(idx + 1, idx + 5);
    sheetRoot.innerHTML = `
      <section class="run-card glass" aria-label="Run in progress">
        <span style="align-self:center;width:36px;height:5px;border-radius:3px;background:var(--fill-2)"></span>
        <div class="row-ctl" style="min-height:0"><span class="label">${esc(R.title)} · stop ${idx + 1} of ${total}</span><span class="tag live">IN PROGRESS</span></div>
        <div class="run-line"><span class="num">${idx}</span><span class="track"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></span><span class="num muted">${total}</span></div>
        <div class="run-ends"><span>${esc(short(first))}</span><span>${total - idx} to go</span><span>${esc(short(last))}</span></div>
        <div class="next"><span class="label" style="color:var(--accent-text)">${cur.type === 'place' ? 'Next: ' + esc(cur.sub) : esc(cur.tag)}</span><h2>${esc(cur.name)}</h2>
          ${cur.type === 'task' ? `<div class="muted" style="font-size:14px;margin-top:4px">${esc(cur.sub || '')}</div>` : ''}</div>
        <div class="btn-row"><button class="btn secondary" id="skip">Skip</button><button class="btn primary" id="doneNext">Done, next</button></div>
        ${upcoming.length ? `<div><span class="label">Coming up</span><ul class="list" style="margin-top:6px">${upcoming.map((s, i) => `
          <li><div class="check-row" style="grid-template-columns:28px 1fr auto;padding-left:0"><span class="mono muted">${idx + i + 2}</span>
            <span class="name" style="font-size:15px">${esc(s.name)}</span>${s.type === 'task' ? `<span class="tag ${s.status}">${esc(s.tag)}</span>` : `<span class="muted" style="font-size:12px">${esc(s.sub)}</span>`}</div></li>`).join('')}</ul></div>` : ''}
      </section>`;
    $('#skip').onclick = () => { R.idx++; save(); renderRun(); };
    $('#doneNext').onclick = () => {
      if (cur.type === 'place') S.found[cur.id] = Date.now(); else if (cur.id !== 'cash' && !cur.repeatable) S.done[cur.id] = Date.now();
      R.idx++; save(); if (map) { map.remove(); map = null; } renderRun();
    };
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
      body = `<ul class="list card">${cc.map((c) => { const f = foundCount(c.id); return `
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
    view.innerHTML = `<div class="page">
      <h1 class="title" style="padding:0 4px">Guide</h1>
      <section class="card card-pad"><div class="row-ctl" style="min-height:0"><span class="label">Collectibles found</span>
        <span class="big-count">${got}<small> / ${total}</small></span></div><span class="bar"><i style="width:${Math.round(got / total * 100)}%"></i></span></section>
      <div class="seg" role="tablist">${tabs.map(([id, n]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}" aria-pressed="${tab === id}">${n}</button>`).join('')}</div>
      ${body}
      <p class="foot">Unofficial fan guide. Not affiliated with Rockstar Games or Take-Two Interactive.</p></div>`;
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
    view.innerHTML = `<div class="page">
      <h1 class="title" style="padding:0 4px">Checklist</h1>
      <div class="chips">${cats.map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${c.id === cat}"><span class="dot" style="background:${color(c.id)}"></span>${esc(c.name)}</button>`).join('')}</div>
      <section class="card card-pad"><div class="row-ctl" style="min-height:0"><span class="label">${esc(catName(cat))}</span>
        <span class="big-count">${f}<small> / ${n}</small></span></div><span class="bar ${f === n ? 'done' : ''}"><i style="width:${Math.round(f / n * 100)}%"></i></span>
        <button class="btn secondary" id="routeLeft" ${f === n ? 'disabled' : ''}>Route the ${n - f} left</button></section>
      <ul class="list card">${items.map((p) => { const on = !!S.found[p.id]; return `
        <li><div class="check-row ${on ? 'done' : ''}"><button class="check" data-found="${p.id}" aria-pressed="${on}" aria-label="${esc(p.name)} found"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="m2 7 3.5 3.5L12 3"/></svg></button>
          <div style="min-width:0"><div class="name">${esc(p.name)}</div><div class="sub">${esc(areaOf(p))}</div></div>
          <a class="link-btn" href="#map/${p.id}" style="text-decoration:none">Map</a></div></li>`; }).join('')}</ul>
    </div>`;
    view.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => (location.hash = 'checklist/' + b.dataset.cat)));
    view.querySelectorAll('[data-found]').forEach((b) => (b.onclick = () => { const id = b.dataset.found; if (S.found[id]) delete S.found[id]; else S.found[id] = Date.now(); save(); renderChecklist(cat); }));
    $('#routeLeft').onclick = () => { buildRun(items.filter((p) => !S.found[p.id]), `${catName(cat)}, ${n - f} left`); location.hash = 'run'; };
  }

  // ---------- boot ----------
  Promise.all(['places', 'guide', 'tonight', 'money', 'outline'].map((n) => fetch(`data/${n}.json`).then((r) => r.json())))
    .then(([p, guide, tonight, money, outline]) => { D = { ...p, guide, tonight, money, outline }; route(); })
    .catch((e) => { view.innerHTML = `<div class="page"><h1 class="title">Couldn't load data</h1><p class="muted">${esc(e.message)}</p></div>`; });
})();
