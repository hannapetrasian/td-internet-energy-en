// Offline demo mode: ?host&demo and ?room=TEST&demo
// A fake room with 5 players. Right arrow moves to the next step, left arrow goes back.
// Open a phase directly: ?host&demo&phase=scales&step=2
// Test a big group: add &players=30

// computeNext comes from app.js as a parameter, so app.js never loads twice.
import { SCALES, CATS } from './content.js?v=en10';

const NAMES = ['Anna', 'Leo', 'Maya', 'Sam', 'Hanna', 'Omar', 'Lena', 'Diego', 'Yuki', 'Priya',
  'Tom', 'Sara', 'Ivan', 'Zoe', 'Ali', 'Nina', 'Ben', 'Mia', 'Raj', 'Eva',
  'Kai', 'Lucy', 'Max', 'Aisha', 'Noah', 'Ella', 'Hugo', 'Lina', 'Theo', 'Rosa'];

const PHASES = ['lobby', 'scales', 'end'];

// Same numbers every time, so screenshots are stable
function seeded(i, s) {
  const x = Math.sin((i + 1) * 12.9898 + (s + 1) * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function makePlayers(n) {
  const players = {};
  for (let i = 0; i < n; i++) {
    const round = Math.floor(i / NAMES.length);
    players[`p${i + 1}`] = { name: NAMES[i % NAMES.length] + (round ? ` ${round + 1}` : ''), cat: CATS[(i * 5) % CATS.length].id, joinedAt: i + 1 };
  }
  return players;
}

function makeScaleValues(ids) {
  return SCALES.map((_, s) => Object.fromEntries(ids.map((id, i) => [id, Math.round(seeded(i, s) * 100)])));
}

export function createDemoStore(params, computeNext) {
  const code = 'TEST';
  const count = Math.max(2, Math.min(80, Number(params.get('players') || 5)));
  const phase = PHASES.includes(params.get('phase')) ? params.get('phase') : 'lobby';
  const step = Number(params.get('step') || 0);
  const players = makePlayers(count);
  const ids = Object.keys(players);
  const values = makeScaleValues(ids);
  const atOrPast = (ph) => PHASES.indexOf(phase) >= PHASES.indexOf(ph);

  const room = {
    meta: { createdAt: 1, hostToken: 'demo', phase, step, shown: phase === 'scales' ? params.get('shown') !== '0' : null },
    players,
    scales: {},
  };
  // Scales: past ones are full. The current one is partly answered if not shown yet.
  const lastScale = phase === 'scales' ? step : (atOrPast('end') ? SCALES.length - 1 : -1);
  for (let i = 0; i <= lastScale; i++) {
    room.scales[i] = { ...values[i] };
    if (phase === 'scales' && i === step && !room.meta.shown) for (const id of ids.slice(-2)) delete room.scales[i][id];
  }

  // The demo player on the phone is p4 unless &fresh asks for the join screen.
  if (params.has('fresh')) localStorage.removeItem(`tcats.player.${code}`);
  if (!params.has('host') && !params.has('fresh') && !localStorage.getItem(`tcats.player.${code}`)) {
    const me = players.p4 || players.p1;
    localStorage.setItem(`tcats.player.${code}`, JSON.stringify({ playerId: players.p4 ? 'p4' : 'p1', name: me.name, cat: me.cat }));
  }

  return makeStore(room, code, values, computeNext);
}

function makeStore(room, code, values, computeNext) {
  const subs = [];
  const history = [];
  const getPath = (path) => path.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), room);
  const setPath = (path, value) => {
    const keys = path.split('/').filter(Boolean);
    if (!keys.length) { Object.assign(room, value); return; }
    let o = room;
    for (const k of keys.slice(0, -1)) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
    const last = keys[keys.length - 1];
    if (value === null || value === undefined) delete o[last]; else o[last] = value;
  };
  const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const notify = () => subs.forEach((s) => s.cb(clone(getPath(s.path))));

  const store = {
    demoCode: code,
    subscribe(_code, path, cb) {
      const s = { path, cb };
      subs.push(s);
      setTimeout(() => cb(clone(getPath(path))), 0);
      return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); };
    },
    async get(_code, path) { await new Promise((r) => setTimeout(r, 30)); return clone(getPath(path)); },
    async set(_code, path, value) { setPath(path, value); notify(); },
    async update(_code, updates) { for (const [p, v] of Object.entries(updates)) setPath(p, v); notify(); },
    ts: () => Date.now(),
    onConnected(cb) { cb(true); },
    demoNext() {
      history.push(clone(room));
      const u = computeNext(room);
      if (!u) return;
      // Fill in fake answers so every step looks real
      const ph = u['meta/phase'] || room.meta.phase, st = u['meta/step'] ?? room.meta.step;
      if (ph === 'scales') {
        const shown = u['meta/shown'] === true;
        const vals = values[st] || {};
        const entries = Object.entries(vals);
        room.scales[st] = shown ? { ...vals } : Object.fromEntries(entries.slice(0, Math.max(1, entries.length - 2)));
      }
      store.update(code, u);
    },
    demoPrev() {
      const prev = history.pop();
      if (!prev) return;
      for (const k of Object.keys(room)) delete room[k];
      Object.assign(room, prev);
      notify();
    },
  };
  return store;
}
