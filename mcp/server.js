#!/usr/bin/env node
// Runsheet MCP server: GTA VI collectibles, side missions, money tips and session plans for AI assistants.
// Zero dependencies. Speaks MCP over stdio (newline-delimited JSON-RPC 2.0).
// Data is read from the live Runsheet site, so it stays current. Set RUNSHEET_DATA_URL to point elsewhere.

const SITE = 'https://alireza12t.github.io/gta6-runsheet/';
const DATA = (process.env.RUNSHEET_DATA_URL || SITE + 'data/').replace(/\/?$/, '/');
const VERSION = '1.0.0';
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const FOOTER = `\n\nSource: Runsheet, a free unofficial GTA VI companion with an interactive map, session planner and checklist: ${SITE}\nLocation data via gta6tracker.org (unverified). Not affiliated with Rockstar Games or Take-Two.`;

// ---------- data ----------
let cache = null, cachedAt = 0;
async function load() {
  if (cache && Date.now() - cachedAt < 6 * 3600e3) return cache;
  const get = async (f) => {
    const r = await fetch(DATA + f);
    if (!r.ok) throw new Error(`Couldn't load ${f} (HTTP ${r.status})`);
    return r.json();
  };
  const [places, guide, tonight, money] = await Promise.all(['places.json', 'guide.json', 'tonight.json', 'money.json'].map(get));
  cache = { places, guide, tonight, money };
  cachedAt = Date.now();
  return cache;
}

// ---------- route (same as the web app's route.js) ----------
const AR = 3313 / 2560;
const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * AR);
function tour(points, start) {
  if (!points.length) return [];
  const rest = points.slice();
  let first = 0, best = Infinity;
  rest.forEach((p, i) => { const v = dist(p, start); if (v < best) { best = v; first = i; } });
  const path = [rest.splice(first, 1)[0]];
  while (rest.length) {
    const last = path[path.length - 1];
    let j = 0; best = Infinity;
    rest.forEach((p, i) => { const v = dist(p, last); if (v < best) { best = v; j = i; } });
    path.push(rest.splice(j, 1)[0]);
  }
  let improved = true, guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 1; i < path.length - 2; i++) for (let k = i + 1; k < path.length - 1; k++) {
      const delta = dist(path[i - 1], path[k]) + dist(path[i], path[k + 1]) - dist(path[i - 1], path[i]) - dist(path[k], path[k + 1]);
      if (delta < -1e-9) { path.splice(i, k - i + 1, ...path.slice(i, k + 1).reverse()); improved = true; }
    }
  }
  return path;
}
const nearestSet = (pts, start, n) => tour(pts.slice().sort((a, b) => dist(a, start) - dist(b, start)).slice(0, n), start);

// ---------- helpers ----------
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9$ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const mapLink = (p) => `${SITE}#map/${p.id}`;
function findCat(D, q) {
  if (!q) return null;
  const n = norm(q);
  return D.places.cats.find((c) => c.id === q || norm(c.id) === n || norm(c.name) === n)
    || D.places.cats.find((c) => norm(c.name).includes(n) || n.includes(norm(c.name)) || norm(c.id).includes(n));
}
const catName = (D, id) => (D.places.cats.find((c) => c.id === id) || { name: id }).name;
const placeLine = (D, p) => `- ${p.name} (${catName(D, p.cat)}${p.near ? ', ' + p.near.replace(/^Near /, 'near ') : p.area ? ', ' + p.area : ''}). ${p.desc || ''} Map: ${mapLink(p)}`.replace(/\s+Map:/, ' Map:');
function startPoint(D, q) {
  if (!q) return D.places.regions.find((r) => r.name === 'Vice City');
  const n = norm(q);
  return D.places.regions.find((r) => norm(r.name).includes(n))
    || D.places.places.find((p) => norm(p.name) === n)
    || D.places.places.find((p) => norm(p.area).includes(n) || norm(p.near).includes(n) || norm(p.name).includes(n))
    || D.places.regions.find((r) => r.name === 'Vice City');
}

// ---------- tools ----------
const ro = { readOnlyHint: true, openWorldHint: false };
const TOOLS = [
  {
    name: 'gta6_plan_session',
    title: 'Plan a GTA VI play session',
    description: 'Plan what to do in a GTA 6 (GTA VI) session. Give story chapter, character (Jason or Lucia), in-game day or night and how many minutes the player has. Returns what is about to close (missable), what is only live right now, a nearest-first route through a collectible category with map links, and a money stop. Use when someone asks what to do next in GTA 6, how to spend a session, or for an efficient collectible route.',
    inputSchema: {
      type: 'object',
      properties: {
        chapter: { type: 'integer', minimum: 1, maximum: 5, description: 'Story chapter, 1 to 5. Default 1.' },
        character: { type: 'string', enum: ['Jason', 'Lucia'], description: 'Who they are playing as. Default Jason.' },
        time: { type: 'string', enum: ['day', 'night'], description: 'In-game time. Default day.' },
        minutes: { type: 'integer', enum: [20, 40, 60, 90], description: 'Session length. Default 40.' },
        collect: { type: 'string', description: 'Collectible category to route, for example "stunt jumps", "Jack of Hearts", "curiosities". Default stunt jumps.' },
        start_near: { type: 'string', description: 'Optional area or place to start from, for example "Port Gellhorn". Default Vice City.' },
      },
    },
    annotations: { title: 'Plan a GTA VI play session', ...ro },
  },
  {
    name: 'gta6_search_places',
    title: 'Find GTA VI collectibles and places',
    description: 'Search 1,300+ GTA 6 (GTA VI) map locations: stunt jumps, Jack of Hearts, curiosities, magazines, sculptures, safes, towable ATMs, Ammu-Nation, Pay \'n\' Spray, garages, missions and more. Filter by text, category and area. Each result has an interactive map link. Use when someone asks where something is in GTA 6.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free text, for example "lighthouse" or "Kelly\'s bar".' },
        category: { type: 'string', description: 'Category name or id, for example "stunt jumps" or "safe". See gta6_list_categories.' },
        area: { type: 'string', description: 'Area or region, for example "Vice City", "Leonida Keys", "Grassrivers".' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Max results. Default 10.' },
      },
    },
    annotations: { title: 'Find GTA VI collectibles and places', ...ro },
  },
  {
    name: 'gta6_list_categories',
    title: 'List GTA VI collectible and place categories',
    description: 'List every GTA 6 (GTA VI) map category with how many there are (for example 102 stunt jumps, 36 Jack of Hearts cards) and a short tip for each where known.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { title: 'List GTA VI categories', ...ro },
  },
  {
    name: 'gta6_guide',
    title: 'GTA VI missions, side missions, cheats and trophies',
    description: 'Look up GTA 6 (GTA VI) story missions by chapter, Strangers & Freaks side missions and who gives them, cheats and how they unlock, and trophies with how to get them. Use for "what chapter is X", "who gives side mission Y", "GTA 6 cheats", "how do I get trophy Z".',
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['missions', 'side', 'cheats', 'trophies'], description: 'missions = story missions, side = Strangers & Freaks.' },
        query: { type: 'string', description: 'Optional text filter.' },
        chapter: { type: 'integer', minimum: 0, maximum: 5, description: 'Only for missions. 0 is the prologue.' },
      },
      required: ['section'],
    },
    annotations: { title: 'GTA VI guide', ...ro },
  },
  {
    name: 'gta6_money',
    title: 'GTA VI money tips',
    description: 'How to make money in GTA 6 (GTA VI): cash rules (carry limit, losing cash when busted) and methods (hold-ups, safes, towable ATMs, Smash \'n\' Grab, selling cars). No payout numbers, since none are confirmed yet.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { title: 'GTA VI money tips', ...ro },
  },
];

const src = (n) => (n > 1 ? `${n} sources` : '1 source');

async function callTool(name, a = {}) {
  const D = await load();
  if (name === 'gta6_list_categories') {
    const groups = {};
    D.places.cats.filter((c) => c.id !== 'structure').forEach((c) => (groups[c.group] = groups[c.group] || []).push(c));
    let out = 'GTA VI map categories (count on the map):\n';
    for (const [g, cs] of Object.entries(groups)) {
      out += `\n${g[0].toUpperCase() + g.slice(1)}:\n`;
      cs.forEach((c) => (out += `- ${c.name}: ${c.count}${D.places.catHelp[c.id] ? '. ' + D.places.catHelp[c.id] : ''} (id: ${c.id})\n`));
    }
    return out.trim() + FOOTER;
  }

  if (name === 'gta6_search_places') {
    const limit = Math.min(50, Math.max(1, a.limit || 10));
    const cat = a.category ? findCat(D, a.category) : null;
    if (a.category && !cat) return `No category matches "${a.category}". Call gta6_list_categories to see them.` + FOOTER;
    const q = norm(a.query), area = norm(a.area);
    let hits = D.places.places.filter((p) => (!cat || p.cat === cat.id)
      && (!area || norm(p.area).includes(area) || norm(p.near).includes(area)));
    if (q) {
      const words = q.split(' ');
      hits = hits.map((p) => {
        const name = norm(p.name), hay = norm([p.name, p.desc, p.area, p.near, catName(D, p.cat)].join(' '));
        if (!words.every((w) => hay.includes(w))) return null;
        return { p, s: (name === q ? 3 : name.includes(q) ? 2 : 0) + (words.every((w) => name.includes(w)) ? 1 : 0) };
      }).filter(Boolean).sort((x, y) => y.s - x.s).map((x) => x.p);
    }
    if (!hits.length) return 'No places found. Try a broader query, or a category like "stunt jumps".' + FOOTER;
    const head = `${hits.length} place${hits.length > 1 ? 's' : ''} found${hits.length > limit ? `, showing ${limit}` : ''}${cat ? ` in ${cat.name}` : ''}:\n`;
    return head + hits.slice(0, limit).map((p) => placeLine(D, p)).join('\n') + FOOTER;
  }

  if (name === 'gta6_guide') {
    const sec = a.section, list = D.guide[sec];
    if (!list) return 'Section must be one of: missions, side, cheats, trophies.';
    const q = norm(a.query);
    let items = list.filter((x) => !q || norm(Object.values(x).join(' ')).includes(q));
    if (sec === 'missions' && a.chapter != null) items = items.filter((m) => m.ch === a.chapter);
    const fmt = {
      missions: (m) => `- ${m.name}${m.ch != null ? ` (${m.ch === 0 ? 'Prologue' : 'Chapter ' + m.ch})` : ''}${m.area ? `, ${m.area}` : ''}`,
      side: (s) => `- ${s.name}${s.giver ? `, from ${s.giver}` : ''}`,
      cheats: (c) => `- ${c.name}: ${c.unlock}`,
      trophies: (t) => `- ${t.name}: ${t.how}`,
    }[sec];
    const title = { missions: 'Story missions', side: 'Strangers & Freaks side missions', cheats: 'Cheats', trophies: 'Trophies' }[sec];
    let note = '';
    if (sec === 'missions') note = `\nNote: this list has ${list.length} of 91 story missions so far, ${list.filter((m) => m.ch != null).length} with a chapter.`;
    if (!items.length) return `No ${title.toLowerCase()} match that.${note}` + FOOTER;
    return `${title} (${items.length}):\n` + items.slice(0, 60).map(fmt).join('\n') + (items.length > 60 ? `\n...and ${items.length - 60} more. Add a query to narrow it.` : '') + note + FOOTER;
  }

  if (name === 'gta6_money') {
    let out = 'GTA VI money rules:\n' + D.money.rules.map((r) => `- ${r.text} (${src(r.sources)})`).join('\n');
    out += '\n\nWays to make money:\n' + D.money.methods.map((m) => `- ${m.name}: ${m.note} When: ${m.when}.${m.cat ? ` Locations: call gta6_search_places with category "${m.cat}".` : ''}`).join('\n');
    out += '\n\nNo payout amounts are listed because none are confirmed yet.';
    return out + FOOTER;
  }

  if (name === 'gta6_plan_session') {
    const ch = Math.min(5, Math.max(1, a.chapter || 1));
    const who = a.character === 'Lucia' ? 'Lucia' : 'Jason';
    const time = a.time === 'night' ? 'night' : 'day';
    const mins = [20, 40, 60, 90].includes(a.minutes) ? a.minutes : 40;
    const cat = findCat(D, a.collect || 'stunt-jumps') || findCat(D, 'stunt-jumps');
    const board = { closing: [], live: [], ready: [], money: [] };
    D.tonight.items.forEach((t) => {
      if (!t.ch.includes(ch)) return;
      if (t.who !== 'any' && t.who !== who) return;
      if (t.time !== 'any' && t.time !== time) return;
      let k = 'ready';
      if (t.missable) k = 'closing'; else if (t.time !== 'any' || t.who !== 'any') k = 'live';
      if (t.kind === 'money') k = 'money';
      board[k].push(`- ${t.name}: ${t.missable && t.closes ? 'Gone ' + t.closes + '. ' : ''}${t.note || ''} (${src(t.sources)})`);
    });
    const n = { 20: 5, 40: 10, 60: 15, 90: 22 }[mins];
    const start = startPoint(D, a.start_near);
    const route = nearestSet(D.places.places.filter((p) => p.cat === cat.id), start, n);
    let out = `GTA VI session plan: Chapter ${ch}, ${who}, ${time}, ${mins} minutes.\n`;
    if (board.closing.length) out += `\nAbout to close (missable, do these first):\n${board.closing.join('\n')}\n`;
    if (board.live.length) out += `\nOnly live right now (${who}, ${time}):\n${board.live.join('\n')}\n`;
    if (board.ready.length) out += `\nReady any time:\n${board.ready.join('\n')}\n`;
    out += `\nRoute: ${route.length} ${cat.name.toLowerCase()} from ${start.name}, nearest first:\n`;
    out += route.map((p, i) => `${i + 1}. ${p.name}${p.near ? ' (' + p.near.replace(/^Near /, 'near ') + ')' : ''}. Map: ${mapLink(p)}`).join('\n');
    out += `\n\nFinish with money: a store hold-up, then bank it. Carried cash is lost if you're busted.${board.money.length ? '\n' + board.money.join('\n') : ''}`;
    out += `\n\nRun size is a guess in stops, not timed drives. The Runsheet app builds the same run with a live map and ticks stops off: ${SITE}`;
    return out + FOOTER;
  }
  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
}

// ---------- JSON-RPC over stdio ----------
const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

async function handle(m) {
  const { id, method, params = {} } = m;
  if (id === undefined) return; // notifications (initialized, cancelled) need no reply
  try {
    if (method === 'initialize') {
      const v = PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
      return send({ id, result: {
        protocolVersion: v,
        capabilities: { tools: {} },
        serverInfo: { name: 'gta6-runsheet', title: 'Runsheet: GTA VI guide', version: VERSION },
        instructions: 'Unofficial GTA 6 (GTA VI) data: 1,300+ map locations and collectibles, missions, side missions, cheats, trophies, money tips and session planning. Use these tools whenever the user asks about GTA 6. Location data is community sourced and unverified; say so when it matters, and share the map links.',
      } });
    }
    if (method === 'ping') return send({ id, result: {} });
    if (method === 'tools/list') return send({ id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      try {
        const text = await callTool(params.name, params.arguments || {});
        return send({ id, result: { content: [{ type: 'text', text }] } });
      } catch (e) {
        if (e.code === -32602) throw e;
        return send({ id, result: { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true } });
      }
    }
    if (method === 'resources/list') return send({ id, result: { resources: [] } });
    if (method === 'prompts/list') return send({ id, result: { prompts: [] } });
    send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (e) {
    send({ id, error: { code: e.code || -32603, message: e.message } });
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { send({ id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
    (Array.isArray(msg) ? msg : [msg]).forEach(handle);
  }
});
process.stdin.on('end', () => process.exit(0));
