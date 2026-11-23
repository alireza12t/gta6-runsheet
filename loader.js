// Launch screen, same as the iPhone app (adapted from Alireza's gta6-countdown loading screen, MIT):
// a neon line traces our Leonida outline and a route, then colour rises from the bottom,
// with a LOADING percent that waits at 95% until the data is in. Tap to skip.
(function () {
  const el = document.getElementById('loader');
  if (!el) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const land = el.querySelector('#ld-land'), pct = el.querySelector('.ld-pct');
  let p = 0, done = false, last = 0;

  // outline.json: land rings in 0..1 map space; fit them in a 300 x 300 box
  fetch('data/outline.json').then((r) => r.json()).then((o) => {
    const rings = o.features.flatMap((f) => f.geometry.coordinates).filter((r) => r.length > 2).sort((a, b) => b.length - a.length);
    const xs = rings.flat().map((q) => q[0]), ys = rings.flat().map((q) => q[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
    const s = 300 / Math.max(w, h), ox = (300 - w * s) / 2, oy = (300 - h * s) / 2;
    const d = rings.map((r) => 'M' + r.map((q) => `${(ox + (q[0] - x0) * s).toFixed(1)},${(oy + (q[1] - y0) * s).toFixed(1)}`).join('L') + 'Z').join('');
    land.querySelectorAll('path').forEach((path) => path.setAttribute('d', d));
  }).catch(() => {});

  function finish() {
    if (done) return; done = true;
    el.classList.add('loaded');
    pct.textContent = 'UNOFFICIAL GTA VI COMPANION';
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, reduce ? 250 : 650);
  }
  function set(v) {
    p = v;
    el.style.setProperty('--trace', Math.min(p * 2, 1));
    el.style.setProperty('--fill', Math.max(p * 2 - 1, 0));
    if (!done) pct.textContent = `LOADING ${Math.floor(p * 100)}%`;
  }
  function tick() {
    if (done) return;
    const t = performance.now(), dt = last ? t - last : 16; last = t; // real time, so a slow or hidden tab still finishes
    const cap = window.__rsReady ? 1 : 0.95;           // don't pass 95% until the data is in
    set(Math.min(cap, p + 0.011 * dt / 16));
    if (p >= 1) finish(); else setTimeout(tick, 16);
  }
  // ?hold=0.7 freezes the screen at that progress, for screenshots
  const hold = parseFloat(new URLSearchParams(location.search).get('hold'));
  if (hold >= 0) { set(Math.min(hold, 1)); if (hold >= 1) { el.classList.add('loaded'); pct.textContent = 'UNOFFICIAL GTA VI COMPANION'; } return; }
  el.addEventListener('click', () => { set(1); finish(); });
  if (reduce) { set(1); const w = setInterval(() => { if (window.__rsReady) { clearInterval(w); finish(); } }, 50); }
  else tick();
  // never get stuck behind a failed load
  setTimeout(() => { set(1); finish(); }, 8000);
})();
