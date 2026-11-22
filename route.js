// Route solver: nearest neighbour, then 2-opt to remove crossings.
// Straight-line map distance only. It suggests an order, not a drive time.
(function () {
  // y is stretched on the map image (3313 x 2560), so scale it to measure real distance
  const AR = 3313 / 2560;
  const d = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * AR);

  function tour(points, start) {
    if (!points.length) return [];
    const rest = points.slice();
    let first = 0;
    if (start) {
      let best = Infinity;
      rest.forEach((p, i) => { const v = d(p, start); if (v < best) { best = v; first = i; } });
    }
    const path = [rest.splice(first, 1)[0]];
    while (rest.length) {
      const last = path[path.length - 1];
      let j = 0, best = Infinity;
      rest.forEach((p, i) => { const v = d(p, last); if (v < best) { best = v; j = i; } });
      path.push(rest.splice(j, 1)[0]);
    }
    // open-path 2-opt; keep the first stop fixed
    let improved = true, guard = 0;
    while (improved && guard++ < 50) {
      improved = false;
      for (let i = 1; i < path.length - 2; i++) {
        for (let k = i + 1; k < path.length - 1; k++) {
          const delta = d(path[i - 1], path[k]) + d(path[i], path[k + 1]) - d(path[i - 1], path[i]) - d(path[k], path[k + 1]);
          if (delta < -1e-9) { path.splice(i, k - i + 1, ...path.slice(i, k + 1).reverse()); improved = true; }
        }
      }
    }
    return path;
  }

  // Pick the n remaining points closest to a start point, then order them.
  function nearestSet(points, start, n) {
    const sorted = points.slice().sort((a, b) => d(a, start) - d(b, start));
    return tour(sorted.slice(0, n), start);
  }

  const length = (path) => path.reduce((s, p, i) => (i ? s + d(path[i - 1], p) : 0), 0);

  window.Route = { tour, nearestSet, length };
})();
