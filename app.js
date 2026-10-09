// Team Cats: routing, state, subscriptions, phase rendering.
// Static site, no build step. ESM. Firebase loads on demand. Demo mode works offline.
// Flow: lobby, then five scales, then the final screen.

import { SCALES, CATS, CAT_BY_ID, PHASE_ACCENT, TEXT } from './content.js?v=en10';

/* ============================================================
   Utilities
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Stable "random" tilt: the same key always gives the same angle.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
const tiltFor = (key, range = 6) => +((hash(String(key)) * 2 - 1) * range).toFixed(2);

const CODE_ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ';
const genCode = () => Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
const genId = () => Math.random().toString(36).slice(2, 10);
const isValidCode = (c) => /^[A-HJ-NP-Z]{4}$/.test(c || '');

const roomUrl = (code) => `${location.origin}${location.pathname}?room=${code}`;
const shortUrl = (code) => `${location.host}${location.pathname}?room=${code}`;

function sortedPlayers(players) {
  return Object.entries(players || {})
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

// Group size decides how big the cats are on the main screen.
const crowdClass = (n) => (n <= 6 ? 'n-few' : n <= 12 ? 'n-mid' : n <= 30 ? 'n-crowd' : 'n-huge');

// Fit any number of cats into a box: pick the biggest cat size that fits all of them.
// If even the smallest size does not fit, show as many as fit and a "+N" chip for the rest.
function fitGrid(box, n, { max = 140, min = 44, nameH = 34, gapX = 10, gapY = 14 } = {}) {
  const W = box.clientWidth, H = box.clientHeight;
  if (!W || !H || !n) return { size: max, cols: Math.max(1, n), capacity: n };
  for (let size = max; size >= min; size -= 2) {
    const cellW = Math.max(size + 16, 104), cellH = size + nameH;
    const cols = Math.max(1, Math.floor((W + gapX) / (cellW + gapX)));
    const rows = Math.max(1, Math.floor((H + gapY) / (cellH + gapY)));
    if (cols * rows >= n) {
      const needRows = Math.ceil(n / cols);
      return { size, cols: Math.ceil(n / needRows), capacity: n };
    }
  }
  const cellW = Math.max(min + 16, 104), cellH = min + nameH;
  const cols = Math.max(1, Math.floor((W + gapX) / (cellW + gapX)));
  const rows = Math.max(1, Math.floor((H + gapY) / (cellH + gapY)));
  return { size: min, cols, capacity: cols * rows };
}

// Apply fitGrid to a container of avatars. Extra avatars hide behind a "+N" chip.
function applyFit(box, items, opts) {
  const n = items.length;
  const { size, cols, capacity } = fitGrid(box, n, opts);
  box.style.setProperty('--fit-size', `${size}px`);
  box.style.setProperty('--fit-cols', cols);
  const shown = capacity >= n ? n : capacity - 1;
  items.forEach((it, i) => it.classList.toggle('hidden', i >= shown));
  let chip = box.querySelector('.more-chip');
  if (shown < n) {
    if (!chip) { chip = el(`<div class="more-chip"></div>`); box.appendChild(chip); }
    chip.textContent = `+${n - shown}`;
    box.appendChild(chip);
  } else if (chip) chip.remove();
}

// Final title: order of joining, shifted by the room code. Titles repeat only after the list ends.
function titleFor(players, pid, code) {
  const list = sortedPlayers(players);
  const idx = Math.max(0, list.findIndex((p) => p.id === pid));
  const shift = Math.floor(hash('titles:' + code) * TEXT.end.titles.length);
  return TEXT.end.titles[(idx + shift) % TEXT.end.titles.length];
}

function setAccent(phase) {
  const [a, s] = PHASE_ACCENT[phase] || PHASE_ACCENT.lobby;
  const root = document.documentElement;
  root.className = root.className.split(' ').filter((c) => !/^(accent|surprise)-/.test(c)).join(' ');
  root.classList.add(`accent-${a}`, `surprise-${s}`);
}

/* ============================================================
   Components (HTML strings)
   ============================================================ */

function catSticker(catId, { size, key = catId, cls = '', pop = null, splash = null, idle = false } = {}) {
  const cat = CAT_BY_ID[catId] || CATS[0];
  const style = `--tilt:${tiltFor('cat:' + key)}deg;${size ? `--size:${size}px;` : ''}${pop !== null ? `--i:${pop};` : ''}`;
  const splashEl = splash ? `<span class="splash ${splash === 'blob' ? 'blob' : ''}" style="--splash-rot:${tiltFor('splash:' + key, 20)}deg"></span>` : '';
  return `<span class="sticker cat ${cls} ${cat.baked ? 'photo' : ''} ${pop !== null ? 'pop' : ''} ${idle ? 'idle' : ''}" style="${style}">${splashEl}<img src="assets/cats/${cat.file}" alt="${esc(cat.label)}" draggable="false"></span>`;
}

function tag(text, color = '', key = text, extra = '') {
  const v = 1 + Math.floor(hash('brush:' + key) * 3);
  return `<span class="tag ${color} ${extra}" data-v="${v}" style="--tilt:${tiltFor('tag:' + key, 4)}deg"><span class="tag-in">${esc(text)}</span></span>`;
}

// First name only: "Priya Ramaswamy" -> "Priya", "Alexandra-Marie" -> "Alexandra"
const firstName = (name) => String(name || '').trim().split(/[\s-]+/)[0] || name;

function avatar(p, { size, name = true, pop = null, key = p.id, short = false } = {}) {
  return `<div class="avatar ${pop !== null ? 'pop' : ''}" style="${pop !== null ? `--i:${pop};` : ''}" data-pid="${esc(p.id)}">
    ${catSticker(p.cat, { size, key })}
    ${name ? `<div class="name" title="${esc(p.name)}">${esc(short ? firstName(p.name) : p.name)}</div>` : ''}
  </div>`;
}

// Long names shrink until they fit their slot. Only if they still do not fit, the "..." stays.
function fitNames(root, min = 17) {
  for (const n of root.querySelectorAll('.name, .nm')) {
    if (!n.offsetParent) continue;
    n.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(n).fontSize);
    while (n.scrollWidth > n.clientWidth + 1 && fs > min) { fs -= 1; n.style.fontSize = `${fs}px`; }
  }
}

function doodle(id, style = '', cls = '') {
  return `<svg class="doodle ${cls}" style="${style}" aria-hidden="true"><use href="assets/doodles/sprite.svg?v=en10#${id}"></use></svg>`;
}

const hand = (text, rot = -3, style = '') => `<span class="hand" style="--rot:${rot}deg;${style}">${esc(text)}</span>`;

/* ============================================================
   Effects
   ============================================================ */

function confetti(n = 30) {
  if (reduced()) return;
  const colors = ['#FF5C5C', '#3155FF', '#C8F43D', '#B8A4FF', '#FFD85A'];
  const ox = window.innerWidth / 2, oy = window.innerHeight * 0.4;
  for (let i = 0; i < n; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.background = colors[i % colors.length];
    piece.style.left = `${ox}px`; piece.style.top = `${oy}px`;
    if (i % 3 === 0) piece.style.borderRadius = '50%';
    document.body.appendChild(piece);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const dist = 220 + Math.random() * 420;
    const dur = 550 + Math.random() * 400;
    const vx = Math.cos(angle) * dist, vy = Math.sin(angle) * dist;
    const g = 900;
    const rot = (Math.random() - 0.5) * 720;
    const frames = [];
    for (let s = 0; s <= 6; s++) {
      const t = s / 6, tt = t * (dur / 1000);
      frames.push({ transform: `translate(${vx * t}px, ${vy * t + 0.5 * g * tt * tt}px) rotate(${rot * t}deg)`, opacity: t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25, offset: t });
    }
    piece.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' }).onfinish = () => piece.remove();
  }
}

/* ============================================================
   Storage: Firebase or demo
   ============================================================ */

async function createFirebaseStore() {
  const { firebaseConfig } = await import('./config.js?v=en10');
  const [{ initializeApp }, db] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js'),
  ]);
  const app = initializeApp(firebaseConfig);
  const database = db.getDatabase(app);
  const r = (code, path = '') => db.ref(database, `rooms/${code}${path ? '/' + path : ''}`);
  return {
    subscribe(code, path, cb) { return db.onValue(r(code, path), (snap) => cb(snap.val())); },
    async get(code, path) { return (await db.get(r(code, path))).val(); },
    set(code, path, value) { return db.set(r(code, path), value); },
    update(code, updates) { return db.update(r(code), updates); },
    ts: () => db.serverTimestamp(),
    onConnected(cb) { return db.onValue(db.ref(database, '.info/connected'), (s) => cb(s.val() === true)); },
  };
}

/* ============================================================
   Phase transitions (pure logic, used by the host and the demo)
   ============================================================ */

export function computeNext(room) {
  const m = room.meta || {};
  const step = m.step || 0;
  switch (m.phase) {
    case 'lobby':
      return { 'meta/phase': 'scales', 'meta/step': 0, 'meta/shown': false };
    case 'scales':
      if (!m.shown) return { 'meta/shown': true };
      if (step < SCALES.length - 1) return { 'meta/phase': 'scales', 'meta/step': step + 1, 'meta/shown': false };
      return { 'meta/phase': 'end', 'meta/step': 0, 'meta/shown': null };
    default:
      return null;
  }
}

// Label of the host's main button for each phase
function nextLabel(meta) {
  if (meta.phase === 'lobby') return TEXT.lobby.start;
  if (meta.phase === 'scales' && !meta.shown) return TEXT.scales.show;
  return TEXT.next;
}

/* ============================================================
   Scale layout: cats keep their real position and never overlap.
   ============================================================ */

const SCALE_SIZES = {
  'n-few':   { size: 184, gap: 156, laneH: 230, lanes: 2 },
  'n-mid':   { size: 116, gap: 150, laneH: 160, lanes: 3 },
  'n-crowd': { size: 80,  gap: 104, laneH: 112, lanes: 4 },
  'n-huge':  { size: 60,  gap: 78,  laneH: 84,  lanes: 5 },
};

function layoutScale(items, trackW, mode, maxLanesOverride = 0) {
  const { gap, lanes: maxLanes } = SCALE_SIZES[mode];
  const lo = gap / 2, hi = trackW - gap / 2;
  const sorted = items.slice().sort((a, b) => a.v - b.v);

  if (mode === 'n-few') {
    // Small group: one row, close cats move apart, then alternate two shelves.
    const xs = sorted.map((it) => (it.v / 100) * trackW);
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] < gap) xs[i] = xs[i - 1] + gap;
      const over = xs.length ? xs[xs.length - 1] - hi : 0;
      if (over > 0) for (let i = 0; i < xs.length; i++) xs[i] -= over;
      for (let i = xs.length - 2; i >= 0; i--) if (xs[i + 1] - xs[i] < gap) xs[i] = xs[i + 1] - gap;
      if (xs.length && xs[0] < lo) { const d = lo - xs[0]; for (let i = 0; i < xs.length; i++) xs[i] += d; }
    }
    let lane = 0;
    return sorted.map((it, i) => {
      lane = i > 0 && xs[i] - xs[i - 1] < gap + 24 ? (lane ? 0 : 1) : 0;
      return { ...it, x: (xs[i] / trackW) * 100, lane };
    });
  }

  // Bigger group: each cat stays at its value and stacks up on shelves.
  // When every shelf is busy there, it moves sideways to the nearest free spot,
  // always inside the scale, so cats never sit on top of each other.
  const lanes = Math.max(1, maxLanesOverride || maxLanes);
  const placed = Array.from({ length: lanes }, () => []);
  const free = (lane, x) => placed[lane].every((px) => Math.abs(px - x) >= gap);
  const step = gap / 2;
  return sorted.map((it) => {
    const x0 = Math.min(hi, Math.max(lo, (it.v / 100) * trackW));
    for (let k = 0; k <= 2 * Math.ceil(trackW / step); k++) {
      const d = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
      const x = x0 + d;
      if (x < lo - 0.5 || x > hi + 0.5) continue;
      for (let lane = 0; lane < lanes; lane++) {
        if (free(lane, x)) { placed[lane].push(x); return { ...it, x: (x / trackW) * 100, lane }; }
      }
    }
    placed[0].push(x0);   // only if the scale is completely full
    return { ...it, x: (x0 / trackW) * 100, lane: 0 };
  });
}

// Shelves that fit in the free space above the track, measured on the stage
function shelvesThatFit(node, track, mode) {
  const { size, laneH, lanes } = SCALE_SIZES[mode];
  const title = $('.q .display', node);
  if (!title) return lanes;
  const tr = track.getBoundingClientRect();
  const s = tr.width / (track.offsetWidth || 1);          // stage scale
  const free = (tr.top - title.getBoundingClientRect().bottom) / s - 24;
  const pinH = size + 44;          // cat + name
  return Math.max(1, Math.min(lanes + 1, Math.floor((free - 26 - pinH) / laneH) + 1));
}

// The biggest cluster: the 20-point window with the most answers. Needs at least 3 people
// and at least a quarter of the group, otherwise there is no clear "most of us".
function densestWindow(values, width = 20) {
  const v = values.slice().sort((a, b) => a - b);
  let best = { from: 0, to: 0, count: 0 };
  for (let i = 0, j = 0; i < v.length; i++) {
    while (v[i] - v[j] > width) j++;
    if (i - j + 1 > best.count) best = { from: v[j], to: v[i], count: i - j + 1 };
  }
  return best;
}

function drawClusterRing(track, layout, tries = 0) {
  track.querySelector('.cluster-ring')?.remove();
  if (layout.length < 4) return;
  // Wait until every cat has arrived: a hidden tab can delay the move animation.
  const W = track.offsetWidth || 1;
  const moving = [...track.querySelectorAll('.pin')].some((pin) =>
    Math.abs(pin.offsetLeft - (parseFloat(pin.style.getPropertyValue('--x')) / 100) * W) > 3
    || pin.getAnimations({ subtree: true }).some((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity));
  if ((moving || document.hidden) && tries < 40) { setTimeout(() => drawClusterRing(track, layout, tries + 1), 250); return; }
  const values = layout.map((it) => it.v);
  const win = densestWindow(values);
  if (win.count < Math.max(3, Math.ceil(layout.length * 0.25)) || win.count === layout.length) return;
  // A tie between two groups: no single "most of the team", so no ring.
  const rest = values.filter((v) => v < win.from - 20 || v > win.to + 20);
  if (rest.length && densestWindow(rest).count >= win.count) return;
  const ids = new Set(layout.filter((it) => it.v >= win.from && it.v <= win.to).map((it) => it.p.id));
  const tr = track.getBoundingClientRect();
  const s = tr.width / (track.offsetWidth || 1);
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  for (const pin of track.querySelectorAll('.pin')) {
    if (!ids.has(pin.dataset.pid)) continue;
    const img = pin.querySelector('img'), name = pin.querySelector('.name');
    for (const box of [img?.getBoundingClientRect(), name?.getBoundingClientRect()]) {
      if (!box) continue;
      l = Math.min(l, (box.left - tr.left) / s); r = Math.max(r, (box.right - tr.left) / s);
      t = Math.min(t, (box.top - tr.top) / s); b = Math.max(b, (box.bottom - tr.top) / s);
    }
  }
  if (!isFinite(l)) return;
  const padX = 30;
  const top = t - 22, bottom = -6;          // track coordinates: the line is at y = 0
  const ring = el(doodle('ring', `left:${l - padX}px;top:${top}px;width:${r - l + padX * 2}px;height:${bottom - top}px`, 'draw cluster-ring'));
  track.appendChild(ring);
}

/* ============================================================
   Host screen
   ============================================================ */

function fitHostStage() {
  const stage = $('#host-stage');
  if (!stage) return;
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.setProperty('--s', s.toFixed(4));
}

function hostTop({ code, mid = '', right = '' }) {
  return `<div class="h-top">
    <div class="brand"><span class="label">${TEXT.brand}</span></div>
    <div class="mid">${mid}</div>
    <div class="right">${code ? `<span class="room-chip">${TEXT.room} ${esc(code)}</span>` : right}</div>
  </div>`;
}

function hostBottom({ status = '', button = '', disabled = false }) {
  return `<div class="h-bottom">
    <div class="status">${status}</div>
    <div class="actions">${button ? `<button class="btn next" ${disabled ? 'disabled' : ''}>${esc(button)}</button>` : ''}</div>
  </div>`;
}

function drawQr(canvas, text, size) {
  if (!canvas || !window.QRCode) return;
  window.QRCode.toCanvas(canvas, text, { width: size, margin: 1, color: { dark: '#181818', light: '#FFFDF8' } }, () => {});
}

const credit = () => `<span class="credit">${esc(TEXT.credit)}</span>`;

class Host {
  constructor(store, { demo = false } = {}) {
    this.store = store;
    this.demo = demo;
    this.stage = $('#host-shaker');
    this.code = null;
    this.room = null;
    this.screenKey = null;
    this.screen = null;
    this.unsub = null;
    this.busy = false;
    window.addEventListener('resize', fitHostStage);
    fitHostStage();
    document.addEventListener('keydown', (e) => {
      if (!this.demo) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this.store.demoNext?.(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.store.demoPrev?.(); }
    });
  }

  /* --- entry --- */

  async start() {
    if (this.demo) return this.attach(this.store.demoCode);
    const params = new URLSearchParams(location.search);
    const fromUrl = (params.get('room') || '').toUpperCase();
    const last = localStorage.getItem('tcats.host.last');
    const code = isValidCode(fromUrl) ? fromUrl : last;
    if (code && localStorage.getItem(`tcats.host.${code}`)) {
      const meta = await this.store.get(code, 'meta');
      if (meta) return this.attach(code);
    }
    this.renderStart();
  }

  renderStart(error = '') {
    setAccent('lobby');
    const screen = el(`<div class="screen">
      ${hostTop({})}
      <div class="h-main"><div class="h-start"><div class="inner">
        ${doodle('star', 'left:-120px;top:-40px;width:70px;height:70px', 'surprise')}
        <h1 class="display xl">${TEXT.title}</h1>
        <button class="btn create">${esc(TEXT.lobby.create)}</button>
        <div class="restore">
          <label class="label restore-label" for="code-input">${esc(TEXT.lobby.restoreLabel)}</label>
          <div class="row"><input id="code-input" class="input code-input" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD"><button class="btn secondary restore-btn">${esc(TEXT.lobby.restore)}</button></div>
          <div class="body err" role="alert">${esc(error)}</div>
        </div>
      </div></div></div>
      ${hostBottom({ status: credit() })}
    </div>`);
    $('.create', screen).onclick = () => this.createRoom();
    const go = () => this.restore($('.code-input', screen).value.trim().toUpperCase());
    $('.restore-btn', screen).onclick = go;
    $('.code-input', screen).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    this.swap('start', screen);
  }

  async createRoom() {
    if (this.busy) return;
    this.busy = true;
    try {
      let code = genCode();
      for (let i = 0; i < 5; i++) {
        if (!(await this.store.get(code, 'meta'))) break;
        code = genCode();
      }
      const hostToken = genId() + genId();
      await this.store.set(code, '', { meta: { createdAt: this.store.ts(), hostToken, phase: 'lobby', step: 0 } });
      localStorage.setItem(`tcats.host.${code}`, JSON.stringify({ hostToken, createdAt: Date.now() }));
      localStorage.setItem('tcats.host.last', code);
      await this.attach(code);
    } catch (e) {
      console.error(e);
      this.renderStart(TEXT.errors.create + (e.message || e));
    } finally { this.busy = false; }
  }

  async restore(code) {
    if (!isValidCode(code)) return this.renderStart(TEXT.errors.codeFormat);
    const meta = await this.store.get(code, 'meta');
    if (!meta) return this.renderStart(TEXT.errors.noRoom(code));
    localStorage.setItem(`tcats.host.${code}`, JSON.stringify({ hostToken: meta.hostToken || '', createdAt: Date.now() }));
    localStorage.setItem('tcats.host.last', code);
    this.attach(code);
  }

  attach(code) {
    this.code = code;
    if (this.unsub) this.unsub();
    this.unsub = this.store.subscribe(code, '', (room) => {
      if (!room || !room.meta) return this.renderStart(TEXT.errors.deleted(code));
      this.room = room;
      this.render();
    });
  }

  /* --- transitions --- */

  async next() {
    // Demo: the button does the same as the right arrow, so fake answers appear too
    if (this.demo) { this.store.demoNext?.(); return; }
    if (this.busy || !this.room) return;
    const updates = computeNext(this.room);
    if (!updates) return;
    this.busy = true;
    const btn = $('.btn.next', this.stage);
    if (btn) btn.disabled = true;
    try { await this.store.update(this.code, updates); }
    catch (e) { console.error(e); if (btn) btn.disabled = false; }
    finally { this.busy = false; if (this.room) this.render(); }
  }

  /* --- rendering --- */

  swap(key, screen) {
    const old = this.screen;
    this.screen = screen;
    this.screenKey = key;
    if (old && !reduced()) {
      old.classList.add('leave');
      screen.classList.add('enter');
      setTimeout(() => old.remove(), 320);
      setTimeout(() => screen.classList.remove('enter'), 400);
    } else if (old) {
      old.remove();
    }
    this.stage.appendChild(screen);
    const btn = $('.btn.next', screen);
    if (btn) btn.onclick = () => this.next();
  }

  render() {
    const m = this.room.meta;
    setAccent(m.phase);
    const key = `${m.phase}:${m.step || 0}`;
    if (key !== this.screenKey) {
      const builder = this.screens[m.phase] || this.screens.lobby;
      const { node, update } = builder.call(this, this.room);
      this.update = update;
      this.swap(key, node);
    }
    this.update?.(this.room);
    const btn = $('.btn.next', this.screen);
    if (btn && !this.busy) {
      btn.textContent = nextLabel(m);
      btn.disabled = m.phase === 'lobby' && sortedPlayers(this.room.players).length < 2;
    }
  }

  get screens() {
    return {
      /* ---------- Lobby ---------- */
      lobby() {
        const code = this.code;
        const node = el(`<div class="screen">
          ${hostTop({ code: null, mid: tag('LOBBY', 'surprise', 'lobby-tag'), right: credit() })}
          <div class="h-main"><div class="h-lobby">
            <div class="left">
              <div class="title-wrap">
                <h1 class="display">${esc(TEXT.titleLines[0])} <span class="ring">${esc(TEXT.titleLines[1])}${doodle('oval', 'left:-34px;top:-22px;width:calc(100% + 68px);height:calc(100% + 44px)', 'draw')}</span></h1>
                ${doodle('star', 'right:-90px;top:-30px;width:72px;height:72px', 'surprise twinkle')}
              </div>
              <div class="code-wrap">
                <span class="label">${esc(TEXT.lobby.roomCode)}</span>
                <div class="code">${esc(code)}</div>
                <div class="url">${esc(shortUrl(code))}</div>
              </div>
            </div>
            <div class="right">
              ${doodle('arrow', 'left:-170px;top:110px;width:160px;height:100px;transform:rotate(-20deg)', 'draw')}
              <div class="card qr-card"><span class="tape tl"></span><span class="tape tr"></span><canvas class="qr" width="280" height="280"></canvas><div class="qr-caption label">${esc(TEXT.lobby.scan)}</div></div>
            </div>
            <div class="players n-few"></div>
          </div></div>
          ${hostBottom({ status: tag(TEXT.lobby.players(0), 'surprise', 'lobby-count'), button: TEXT.lobby.start, disabled: true })}
        </div>`);
        drawQr($('.qr', node), roomUrl(code), 280);
        const seen = new Set();
        let first = true;
        const update = (room) => {
          const players = sortedPlayers(room.players);
          const wrap = $('.players', node);
          const mode = crowdClass(players.length);
          wrap.className = `players ${mode === 'n-huge' ? 'n-crowd' : mode}`;
          $('.h-lobby', node).classList.toggle('compact', players.length > 12);
          players.forEach((p, i) => {
            if (seen.has(p.id)) return;
            seen.add(p.id);
            wrap.appendChild(el(avatar(p, { pop: first ? i : 0 })));
          });
          for (const a of wrap.querySelectorAll('.avatar')) if (!room.players?.[a.dataset.pid]) { seen.delete(a.dataset.pid); a.remove(); }
          first = false;
          if (players.length > 12) requestAnimationFrame(() => applyFit(wrap, [...wrap.querySelectorAll('.avatar')], { max: 120, min: 44, nameH: 46 }));
          else { wrap.style.removeProperty('--fit-size'); wrap.querySelector('.more-chip')?.remove(); wrap.querySelectorAll('.avatar.hidden').forEach((a) => a.classList.remove('hidden')); }
          requestAnimationFrame(() => requestAnimationFrame(() => fitNames(wrap)));
          $('.status', node).innerHTML = tag(TEXT.lobby.players(players.length), 'surprise', 'lobby-count')
            + (players.length < 2 ? `<span class="hint">${esc(TEXT.lobby.needTwo)}</span>` : '');
        };
        return { node, update };
      },

      /* ---------- Scales ---------- */
      scales(room) {
        const step = room.meta.step || 0;
        const sc = SCALES[step];
        const node = el(`<div class="screen">
          ${hostTop({ code: this.code, mid: tag(TEXT.scales.round(step + 1, SCALES.length), 'surprise', 'round' + step) })}
          <div class="h-main"><div class="h-scales">
            <div class="q">
              <h1 class="display">${esc(sc.q)}${doodle('bolt', 'right:-96px;top:0;width:60px;height:90px', 'accent float')}</h1>
              ${hand(TEXT.scales.noRight, 2, 'justify-self:start;margin-left:8px')}
            </div>
            <div class="track-wrap">
              <div class="track n-few"></div>
              <div class="ends"><div class="end l">${esc(sc.left)}</div><div class="end r">${esc(sc.right)}</div></div>
            </div>
          </div></div>
          ${hostBottom({ status: tag(`0 / 0 ${TEXT.scales.answered}`, '', 'ans' + step), button: TEXT.scales.show })}
        </div>`);
        let shownAt = null;
        let ringTimer = null;
        const update = (room) => {
          const players = sortedPlayers(room.players);
          const answers = room.scales?.[step] || {};
          const answered = players.filter((p) => answers[p.id] !== undefined);
          $('.status', node).innerHTML = tag(`${answered.length} / ${Math.max(players.length, 1)} ${TEXT.scales.answered}`, room.meta.shown ? 'surprise' : '', 'ans' + step);
          if (!room.meta.shown) return;
          if (shownAt === null) shownAt = performance.now();
          const track = $('.track', node);
          const mode = crowdClass(answered.length);
          track.className = `track ${mode}`;
          const trackW = track.clientWidth || 1680;
          $('.q .hand', node)?.classList.add('fade-away');   // the hint is not needed once answers are shown
          const lanesFit = shelvesThatFit(node, track, mode);
          const layout = layoutScale(answered.map((p) => ({ p, v: Number(answers[p.id]) })), trackW, mode, lanesFit);
          const late = performance.now() - shownAt > 1500;
          layout.forEach((it, i) => {
            let pin = track.querySelector(`.pin[data-pid="${it.p.id}"]`);
            if (!pin) {
              pin = el(`<div class="pin" data-pid="${esc(it.p.id)}" style="--x:50%;--i:${late ? 0 : Math.min(i, 12)};--lane:${it.lane}">${avatar(it.p, { pop: late ? 0 : Math.min(i, 12), short: mode !== 'n-few' })}</div>`);
              track.appendChild(pin);
              requestAnimationFrame(() => requestAnimationFrame(() => { pin.style.setProperty('--x', `${it.x}%`); }));
            } else {
              pin.style.setProperty('--x', `${it.x}%`);
              pin.style.setProperty('--lane', it.lane);
            }
          });
          // After the cats settle, circle the place where most of the team stands.
          requestAnimationFrame(() => fitNames(track));
          clearTimeout(ringTimer);
          const settle = late || reduced() ? 150 : 700 + Math.min(layout.length, 13) * 120 + 250;
          ringTimer = setTimeout(() => drawClusterRing(track, layout), settle);
        };
        return { node, update };
      },

      /* ---------- Final ---------- */
      end(room) {
        const code = this.code;
        const players = sortedPlayers(room.players);
        const mode = players.length <= 5 ? 'n-few' : players.length <= 10 ? 'n-mid' : 'n-crowd';   // n-crowd here means 11 and more
        const showTitles = mode !== 'n-crowd';
        const node = el(`<div class="screen">
          ${hostTop({ code, mid: tag('GAME OVER', 'surprise', 'over') })}
          <div class="h-main"><div class="h-end">
            <div class="head">
              <div class="titles">
                <div style="position:relative;display:inline-block">
                  <h1 class="display">${esc(TEXT.end.title)}</h1>
                  ${doodle('crown', 'right:-110px;top:-6px;width:80px;height:70px', 'surprise twinkle')}
                  ${doodle('heart', 'right:-150px;top:84px;width:44px;height:44px', 'accent float')}
                </div>
              </div>
            </div>
            <div class="team ${mode}">
              ${players.map((p, i) => `<div class="member pop" style="--i:${Math.min(i, 12)}">
                ${catSticker(p.cat, { key: p.id, splash: showTitles ? (i % 2 ? 'blob' : 'burst') : null, idle: showTitles })}
                <div class="nm">${esc(p.name)}</div>
                ${showTitles ? tag(titleFor(room.players, p.id, code), i % 2 ? 'lavender' : 'surprise', 'title' + p.id) : ''}
              </div>`).join('')}
            </div>
          </div></div>
          ${hostBottom({ status: credit() })}
        </div>`);
        if (mode === 'n-crowd') {
          const team = $('.team', node);
          requestAnimationFrame(() => applyFit(team, [...team.querySelectorAll('.member')], { max: 140, min: 44, nameH: 48, gapY: 18 }));
        }
        requestAnimationFrame(() => requestAnimationFrame(() => fitNames($('.team', node))));
        setTimeout(() => confetti(), 300);
        return { node, update: () => {} };
      },
    };
  }
}

/* ============================================================
   Player screen (phone)
   ============================================================ */

function playerTop(mid = '') {
  return `<div class="p-top"><div class="brand"><span class="label">${TEXT.brand}</span></div><div class="right">${mid}</div></div>`;
}

class Player {
  constructor(store, code, { demo = false } = {}) {
    this.store = store;
    this.code = code;
    this.demo = demo;
    this.root = $('#player-root');
    this.meta = null;
    this.players = null;
    this.me = this.loadMe();
    this.screenKey = null;
    this.screen = null;
    if (demo) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.store.demoNext?.(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.store.demoPrev?.(); }
      });
    }
  }

  loadMe() {
    try { return JSON.parse(localStorage.getItem(`tcats.player.${this.code}`)) || null; } catch { return null; }
  }
  saveMe(me) { this.me = me; localStorage.setItem(`tcats.player.${this.code}`, JSON.stringify(me)); }

  get mine() { return this.me && this.players?.[this.me.playerId] ? { id: this.me.playerId, ...this.players[this.me.playerId] } : null; }

  start() {
    this.store.subscribe(this.code, 'meta', (meta) => { this.meta = meta; this.render(); });
    this.store.subscribe(this.code, 'players', (players) => { this.players = players || {}; this.render(); });
  }

  swap(key, screen) {
    if (this.screen) this.screen.remove();
    this.screen = screen;
    this.screenKey = key;
    this.root.appendChild(screen);
    window.scrollTo(0, 0);
  }

  render() {
    if (!this.meta || this.players === null) {
      if (this.meta === null && this.players !== null) this.renderNoRoom();
      return;
    }
    const m = this.meta;
    setAccent(m.phase);
    const mine = this.mine;
    const key = mine ? `${m.phase}:${m.step || 0}` : 'join';
    if (key !== this.screenKey) {
      const builder = mine ? (this.screens[m.phase] || this.screens.lobby) : this.screens.join;
      const { node, update } = builder.call(this, m);
      this.update = update;
      this.swap(key, node);
    }
    this.update?.(m);
  }

  renderNoRoom() {
    setAccent('lobby');
    this.swap('noroom', el(`<div class="screen">${playerTop()}<div class="p-main"><div class="p-center">
      <h1 class="display">${TEXT.errors.noRoomTitle}</h1><p class="body">${esc(TEXT.errors.checkCode(this.code))}</p></div></div></div>`));
  }

  // Screen frame: top bar, main area, bottom area
  frame({ mid = '', main = '', bottom = '' }) {
    return el(`<div class="screen">${playerTop(mid)}<div class="p-main">${main}</div><div class="p-bottom">${bottom}</div></div>`);
  }

  get screens() {
    return {
      /* ---------- Join ---------- */
      join(meta) {
        const late = meta.phase !== 'lobby';
        const node = this.frame({
          mid: late ? tag('LIVE', 'surprise', 'live') : '',
          main: `
            <h1 class="display">${TEXT.lobby.pickCat}</h1>
            <p class="body muted p-hint">${esc(late ? TEXT.lobby.gameOn : TEXT.lobby.pickHint)}</p>
            <div class="cat-grid" role="radiogroup" aria-label="${esc(TEXT.lobby.pickCat)}">
              ${CATS.map((c) => `<button type="button" class="cat-tile" role="radio" aria-checked="false" aria-label="${esc(c.label)}" data-cat="${c.id}">${catSticker(c.id, { size: 96, key: 'tile' + c.id })}</button>`).join('')}
            </div>
            <label class="field"><span class="label">${esc(TEXT.lobby.nameLabel)}</span><input class="input name" maxlength="16" autocomplete="off" enterkeyhint="go" placeholder="${esc(TEXT.lobby.namePlaceholder)}"></label>`,
          bottom: `<button class="btn block join" disabled>${esc(TEXT.lobby.join)}</button>`,
        });
        const grid = $('.cat-grid', node), nameInput = $('.name', node), joinBtn = $('.join', node);
        let picked = null;
        const refresh = () => {
          for (const t of grid.querySelectorAll('.cat-tile')) {
            const on = picked === t.dataset.cat;
            t.classList.toggle('picked', on);
            t.setAttribute('aria-checked', on ? 'true' : 'false');
          }
          grid.classList.toggle('has-pick', !!picked);
          joinBtn.disabled = !(picked && nameInput.value.trim());
        };
        grid.addEventListener('click', (e) => {
          const t = e.target.closest('.cat-tile');
          if (!t) return;
          picked = picked === t.dataset.cat ? null : t.dataset.cat;
          refresh();
        });
        nameInput.addEventListener('input', refresh);
        nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !joinBtn.disabled) joinBtn.click(); });
        joinBtn.onclick = async () => {
          const name = nameInput.value.trim().slice(0, 16);
          const cat = picked;
          if (!cat || !name) return;
          joinBtn.disabled = true;
          const playerId = this.me?.playerId || genId();
          try {
            await this.store.set(this.code, `players/${playerId}`, { name, cat, joinedAt: this.store.ts() });
            this.saveMe({ playerId, name, cat });
            this.render();   // the subscription may fire before "me" is saved
          } catch (e) { console.error(e); joinBtn.disabled = false; }
        };
        return { node, update: refresh };
      },

      /* ---------- Lobby: you are in ---------- */
      lobby() {
        const me = this.mine;
        const node = this.frame({
          mid: tag('LOBBY', 'surprise', 'lobby'),
          main: `<div class="p-center">
            ${doodle('star', 'right:-6px;top:-10px;width:48px;height:48px', 'surprise twinkle')}
            <h1 class="display">${TEXT.lobby.joined}</h1>
            <p class="body" style="margin:0">${esc(TEXT.lobby.lookUp)}</p>
            <div class="avatar pop" style="margin-top:12px">${catSticker(me.cat, { size: 200, key: me.id, splash: 'burst', idle: true })}<div class="name">${esc(me.name)}</div></div>
          </div>`,
          bottom: '',
        });
        return { node, update: () => {} };
      },

      /* ---------- Scales ---------- */
      scales(meta) {
        const step = meta.step || 0, sc = SCALES[step], me = this.mine;
        const node = this.frame({
          mid: tag(TEXT.scales.round(step + 1, SCALES.length), 'surprise', 'r' + step),
          main: `<div class="p-scale-head"><h1 class="display sm">${esc(sc.q)}</h1>${hand(TEXT.scales.noRight, -2)}</div>
            <div class="p-scale">
              <div class="ends"><div class="end l">${esc(sc.left)}</div><div class="end r">${esc(sc.right)}</div></div>
              <input type="range" class="range" min="0" max="100" value="50" aria-label="${esc(sc.q)}">
              <div class="pick-hint label">${esc(TEXT.scales.moveHint)}</div>
              <div class="state" role="status" style="min-height:60px;display:grid;place-items:center"></div>
            </div>`,
          bottom: `<button class="btn block done">${esc(TEXT.scales.done)}</button>`,
        });
        const range = $('.range', node), btn = $('.done', node), state = $('.state', node);
        range.addEventListener('input', () => { $('.pick-hint', node)?.classList.add('hidden'); }, { once: true });
        const lock = (v) => {
          range.value = v; range.disabled = true; btn.classList.add('hidden'); $('.pick-hint', node)?.classList.add('hidden');
          state.innerHTML = `<div class="got-row">${catSticker(me.cat, { size: 84, key: me.id, pop: 0 })}${tag(TEXT.scales.gotIt, 'surprise', 'got' + step, 'pop')}</div><div class="body muted wait-text">${esc(TEXT.scales.wait)}</div>`;
        };
        this.store.get(this.code, `scales/${step}/${me.id}`).then((v) => { if (v !== null && v !== undefined) lock(v); });
        btn.onclick = async () => {
          btn.disabled = true;
          const v = Number(range.value);
          try { await this.store.set(this.code, `scales/${step}/${me.id}`, v); lock(v); }
          catch (e) { console.error(e); btn.disabled = false; }
        };
        return { node, update: () => {} };
      },

      /* ---------- Final ---------- */
      end() {
        const me = this.mine;
        const node = this.frame({
          mid: tag('GAME OVER', 'surprise', 'over'),
          main: `<div class="p-center" style="gap:18px">
            ${doodle('crown', 'right:-4px;top:-58px;width:56px;height:50px', 'surprise')}
            <h1 class="display">${esc(TEXT.end.title)}</h1>
            <div class="avatar pop" style="margin-top:10px">${catSticker(me.cat, { size: 220, key: me.id, splash: 'blob', idle: true })}</div>
            <div class="body p-name">${esc(me.name)}</div>
            ${tag(titleFor(this.players, me.id, this.code), 'surprise', 'title' + me.id, 'lg')}
          </div>`,
          bottom: '',
        });
        setTimeout(() => confetti(), 300);
        return { node, update: () => {} };
      },
    };
  }
}

/* ============================================================
   Empty address
   ============================================================ */

function renderIndex() {
  setAccent('lobby');
  $('#index-root').innerHTML = `<div class="inner">
    ${doodle('star', 'right:-30px;top:-30px;width:56px;height:56px', 'surprise')}
    <span class="label">${TEXT.brand}</span>
    <h1 class="display">${TEXT.title}</h1>
    <p class="body">${esc(TEXT.index.text)}</p>
    <a class="btn" href="?host">${esc(TEXT.index.host)}</a>
    ${credit()}
  </div>`;
}

/* ============================================================
   Network
   ============================================================ */

function watchConnection(store) {
  const banner = $('#net-banner');
  let ready = false;
  store.onConnected?.((ok) => {
    if (ok) ready = true;
    banner.textContent = TEXT.offline;
    banner.classList.toggle('hidden', ok || !ready);
  });
}

/* ============================================================
   Routing
   ============================================================ */

async function main() {
  const params = new URLSearchParams(location.search);
  const demo = params.has('demo');
  if (params.has('still')) document.documentElement.classList.add('still');
  const isHost = params.has('host');
  const code = (params.get('room') || '').toUpperCase();

  const show = (name) => {
    for (const s of document.querySelectorAll('[data-screen]')) s.classList.toggle('hidden', s.dataset.screen !== name);
  };

  // Show something while the SDK loads
  show('index');
  $('#index-root').innerHTML = `<div class="inner"><span class="label">${TEXT.brand}</span><p class="body muted">${esc(TEXT.loading)}</p></div>`;

  let store;
  try {
    store = demo ? await (await import('./demo.js?v=en10')).createDemoStore(params, computeNext) : await createFirebaseStore();
  } catch (e) {
    console.error(e);
    show('index');
    $('#index-root').innerHTML = `<div class="inner"><h1 class="display">${TEXT.errors.title}</h1><p class="body">${esc(TEXT.errors.connect)}</p><pre style="white-space:pre-wrap;font-size:13px;text-align:left">${esc(e.message || e)}</pre></div>`;
    return;
  }
  if (!demo) watchConnection(store);

  if (isHost) {
    show('host');
    const host = new Host(store, { demo });
    window.tcats = { host, store };
    await host.start();
  } else if (isValidCode(code)) {
    show('player');
    const player = new Player(store, code, { demo });
    window.tcats = { player, store };
    player.start();
  } else {
    show('index');
    renderIndex();
  }
}

main();
