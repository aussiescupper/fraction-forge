/* ============ Fraction Forge ============
   Fractions from Level 3 to Level 4, so Henry walks into Grade 4 ready.

   One idea runs through the whole app: a fraction is an INGOT cut into equal
   parts. Every skill is that same bar seen another way — shading it, matching
   two of them on the fraction wall, laying them end to end past one whole,
   or reading the forge scale in decimals. Two lessons sit in front of it:
   what a fraction actually is, and the CUBES routine for word problems.

   A ScupperLab production — vanilla JS, no dependencies, offline-first. */
"use strict";

const L = self.ForgeLogic;
const ROUND_LEN = L.ROUND_LEN;

/* ---------- store ---------- */
const STORE_KEY = "fractionforge.v1";
function loadStore() {
  const base = {
    muted: false,
    career: { stars: 0, rounds: 0 },
    best: { 3: 0, 4: 0, 5: 0 },
    skills: {},                 // kind -> [right, attempts]  (the readiness board)
    seenFraction: false,
    seenCubes: false,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return Object.assign(base, raw, {
      career: Object.assign(base.career, raw.career || {}),
      best: Object.assign(base.best, raw.best || {}),
      skills: Object.assign(base.skills, raw.skills || {}),
    });
  } catch (e) { return base; }
}
let store = loadStore();
function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* private mode */ } }
function noteSkill(kind, right) {
  const s = store.skills[kind] || [0, 0];
  s[1] += 1; if (right) s[0] += 1;
  store.skills[kind] = s;
}

/* ---------- sound ---------- */
let actx = null;
function ac() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx && actx.state !== "running") actx.resume().catch(() => {});
  return actx;
}
function tone(freq, dur, type, gain, delay, slideTo) {
  if (store.muted) return;
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + (delay || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseBurst(dur, gain, delay, hp, lp) {
  if (store.muted) return;
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + (delay || 0);
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const f1 = c.createBiquadFilter(); f1.type = "highpass"; f1.frequency.value = hp || 300;
  const f2 = c.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = lp || 4000;
  const g = c.createGain(); g.gain.setValueAtTime(gain || 0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f1).connect(f2).connect(g).connect(c.destination); src.start(t0);
}
const sfx = {
  tap()     { tone(360, 0.05, "square", 0.05); },
  cut()     { noiseBurst(0.07, 0.09, 0, 1800, 7000); tone(1400, 0.05, "square", 0.03); },
  clink()   { tone(1180, 0.09, "triangle", 0.06, 0, 1600); },
  hammer()  { tone(180, 0.12, "triangle", 0.16, 0, 110); noiseBurst(0.05, 0.08, 0, 300, 1600); },
  good()    { tone(620, 0.14, "triangle", 0.1); tone(830, 0.16, "triangle", 0.09, 0.09); },
  forged()  { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "triangle", 0.1, i * 0.08)); },
  miss()    { tone(220, 0.24, "sawtooth", 0.08, 0, 120); },
  cheer()   { noiseBurst(0.8, 0.08, 0, 2500, 1200); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, "triangle", 0.1, 0.1 + i * 0.11)); },
  whoosh()  { tone(880, 0.25, "sine", 0.08, 0, 1180); },
};

/* ---------- helpers ---------- */
const app = document.getElementById("app");
const fxLayer = document.getElementById("fx-layer");
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
function html(tag, cls, markup) { const n = el(tag, cls); n.innerHTML = markup; return n; }
function popText(x, y, text, gold) {
  const p = el("div", "pop-text" + (gold ? " gold" : ""), text);
  p.style.left = x + "px"; p.style.top = y + "px";
  fxLayer.appendChild(p);
  setTimeout(() => p.remove(), 1150);
}
function stopSpeech() { try { speechSynthesis.cancel(); } catch (e) { /* no tts */ } }
function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = speechSynthesis.getVoices().find((x) => /en[-_]AU/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    u.rate = 0.92;
    speechSynthesis.speak(u);
  } catch (e) { /* no tts */ }
}
const plain = (s) => String(s).replace(/<[^>]+>/g, "");
const frac = (n, d) => `<span class="fr"><span class="fr-n">${n}</span><span class="fr-d">${d}</span></span>`;

/* ---------- THE INGOT BAR ----------
   Every skill is this one drawing seen another way. `parts` lets a bar be cut
   unevenly (the Level 3 "is this fair?" question); everything else is equal. */
function bar(d, opts) {
  opts = opts || {};
  const b = el("div", "bar" + (opts.cls ? " " + opts.cls : ""));
  const parts = opts.parts || Array.from({ length: d }, () => 1 / d);
  parts.forEach((w, i) => {
    const seg = el("div", "seg" + (opts.shaded && opts.shaded.has(i) ? " on" : ""));
    seg.style.flex = String(w);
    if (opts.onTap) {
      seg.addEventListener("click", () => opts.onTap(i, seg));
      seg.classList.add("tappable");
    }
    if (opts.label) { const t = el("span", "seg-label", opts.label(i)); seg.appendChild(t); }
    b.appendChild(seg);
  });
  return b;
}
// a bar longer than one whole: used for mixed numbers and counting past 1
function longBar(wholes, d, n) {
  const wrap = el("div", "long-bar");
  for (let w = 0; w < wholes; w++) {
    const shadedHere = new Set();
    for (let i = 0; i < d; i++) if (w * d + i < n) shadedHere.add(i);
    const b = bar(d, { shaded: shadedHere, cls: "unit" });
    wrap.appendChild(b);
  }
  return wrap;
}

/* ---------- number pad ---------- */
function pad(onKey) {
  const p = el("div", "pad");
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "."].forEach((k) => {
    const b = el("button", "key" + (k === "⌫" ? " del" : k === "." ? " dot" : ""), k);
    b.addEventListener("click", () => { sfx.tap(); onKey(k); });
    p.appendChild(b);
  });
  return p;
}
/* a set of typed boxes; `slots` is [{k, label}] */
function slotRow(slots, state, active, setActive) {
  const row = el("div", "slot-row");
  slots.forEach((s) => {
    const box = el("button", "slot" + (active === s.k ? " active" : ""));
    box.appendChild(el("span", "slot-val", state[s.k] === undefined ? "" : String(state[s.k])));
    if (s.label) box.appendChild(el("span", "slot-label", s.label));
    box.addEventListener("click", () => { sfx.tap(); setActive(s.k); });
    row.appendChild(box);
  });
  return row;
}
/* a stacked fraction the child types into: top box over bottom box */
function fracSlots(state, active, setActive, fixed) {
  const f = el("div", "fr-input");
  const top = el("button", "slot fr-slot" + (active === "n" ? " active" : ""));
  top.appendChild(el("span", "slot-val", state.n === undefined ? "" : String(state.n)));
  top.addEventListener("click", () => { sfx.tap(); setActive("n"); });
  f.appendChild(top);
  f.appendChild(el("div", "fr-rule"));
  if (fixed !== undefined) {
    f.appendChild(el("div", "fr-fixed", String(fixed)));
  } else {
    const bot = el("button", "slot fr-slot" + (active === "d" ? " active" : ""));
    bot.appendChild(el("span", "slot-val", state.d === undefined ? "" : String(state.d)));
    bot.addEventListener("click", () => { sfx.tap(); setActive("d"); });
    f.appendChild(bot);
  }
  return f;
}

/* ================= THE ROUND ================= */
const MODES = {
  3: { name: "Level 3", sub: "what a fraction IS", emoji: "🔥", tag: "Year 3" },
  4: { name: "Level 4", sub: "ready for Grade 4", emoji: "⚒️", tag: "Year 4" },
  5: { name: "Readiness check", sub: "a bit of everything", emoji: "🏅", tag: "mixed" },
};
let G = null;   // current round
let Q = null;   // current question state

function startRound(level) {
  if (!store.seenFraction) { renderLesson("fraction", () => startRound(level)); return; }
  const seed = (Date.now() ^ (Math.random() * 1e9)) | 0;
  G = { level, qs: L.makeRound(level, seed), idx: 0, stars: 0, firstGo: 0 };
  newQ();
  renderQ();
}
function curQ() { return G.qs[G.idx]; }
function newQ() {
  Q = { res: undefined, state: {}, active: null, tries: 0, msg: "", msgKind: "", done: false, shaded: new Set(), orderPick: [] };
  const q = curQ();
  if (q.kind === "name") Q.active = "n";
  if (q.kind === "mixed" && q.toMixed) Q.active = "w";
  if (q.kind === "count") Q.active = "w";
  if (q.kind === "decimal" && !q.toDec) Q.active = "n";
}

function renderQ() {
  stopSpeech();
  app.innerHTML = "";
  const q = curQ();
  const game = el("div", "game");

  const bar0 = el("div", "topbar");
  const n0 = el("div", "tb-item"); n0.innerHTML = `Ingot <b>${G.idx + 1}</b>/${ROUND_LEN}`;
  const s0 = el("div", "tb-item"); s0.innerHTML = `⭐ <b>${G.stars}</b>`;
  const lv = el("div", "tb-item skill-tag", L.SKILLS[q.skill].name);
  const quit = el("button", "quit-btn", "⏹ End");
  quit.addEventListener("click", () => {
    if (!quit.dataset.arm) {
      quit.dataset.arm = "1"; quit.textContent = "End round?";
      setTimeout(() => { if (quit.isConnected) { delete quit.dataset.arm; quit.textContent = "⏹ End"; } }, 2000);
      sfx.tap(); return;
    }
    if (G && G.stars > 0) { store.career.stars += G.stars; saveStore(); }
    sfx.tap(); renderHome();
  });
  bar0.append(n0, s0, lv, quit);
  game.appendChild(bar0);

  const card = el("div", "card prompt-card");
  card.appendChild(html("div", "prompt", q.prompt));
  const say = el("button", "read-btn", "🔈");
  say.title = "Read it to me";
  say.addEventListener("click", () => { sfx.tap(); speak(plain(q.prompt)); });
  card.appendChild(say);
  game.appendChild(card);

  const stage = el("div", "stage");
  buildQuestion(q, stage);
  game.appendChild(stage);

  const fb = el("div", "feedback" + (Q.msgKind ? " " + Q.msgKind : ""));
  fb.innerHTML = Q.msg;
  game.appendChild(fb);

  const deck = el("div", "deck");
  if (Q.done) {
    const next = el("button", "btn primary", G.idx + 1 >= ROUND_LEN ? "See how I went ▶" : "Next ingot ▶");
    next.addEventListener("click", () => {
      G.idx += 1; sfx.tap();
      if (G.idx >= ROUND_LEN) endRound(); else { newQ(); renderQ(); }
    });
    deck.appendChild(next);
  } else if (NEEDS_CHECK.has(q.kind)) {
    const go = el("button", "btn primary", "Check it 🔨");
    go.addEventListener("click", () => submit(q));
    deck.appendChild(go);
  }
  game.appendChild(deck);
  app.appendChild(game);
}

// kinds where he presses Check; the rest submit on the tap that answers them
const NEEDS_CHECK = new Set(["name", "shade", "whole", "ofnum", "equiv", "order", "mixed", "count", "decimal", "addsame"]);

function submit(q) {
  const res = readResponse(q);
  const v = L.verify(q, res);
  Q.tries += 1;
  if (v.ok) {
    const first = Q.tries === 1;
    noteSkill(q.skill, first);
    saveStore();
    const gained = first ? 2 : 1;
    G.stars += gained; if (first) G.firstGo += 1;
    Q.done = true; Q.msg = first ? "Forged! ⭐⭐" : "Got there ⭐";
    Q.msgKind = "good";
    sfx.forged();
    renderQ();
    return;
  }
  if (Q.tries === 1) noteSkill(q.skill, false), saveStore();
  Q.msg = v.msg; Q.msgKind = "bad";
  sfx.miss();
  renderQ();
}
function readResponse(q) {
  switch (q.kind) {
    case "name": return { n: Q.state.n, d: Q.state.d };
    case "shade": return Q.shaded.size;
    case "whole": case "ofnum": case "equiv": case "addsame": return Q.state.v;
    case "order": return Q.orderPick.length === 3 ? Q.orderPick : null;
    case "mixed": return q.toMixed ? { w: Q.state.w, n: Q.state.n } : Q.state.v;
    case "count": return { w: Q.state.w, n: Q.state.n };
    case "decimal": return q.toDec ? Q.state.v : { n: Q.state.n, d: q.d };
    default: return Q.res;
  }
}
// tapping an answer button settles it immediately (equal / compare)
function settle(q, res) {
  const v = L.verify(q, res);
  Q.tries += 1;
  if (v.ok) {
    const first = Q.tries === 1;
    noteSkill(q.skill, first); saveStore();
    G.stars += first ? 2 : 1; if (first) G.firstGo += 1;
    Q.done = true; Q.msg = first ? "Forged! ⭐⭐" : "Got there ⭐"; Q.msgKind = "good";
    sfx.forged();
  } else {
    if (Q.tries === 1) { noteSkill(q.skill, false); saveStore(); }
    Q.msg = v.msg; Q.msgKind = "bad"; sfx.miss();
  }
  renderQ();
}

/* ---------- one builder per skill ---------- */
function buildQuestion(q, stage) {
  const typed = (keys, fixedD) => {
    const setActive = (k) => { Q.active = k; renderQ(); };
    const row = keys.length === 1
      ? slotRow([{ k: keys[0], label: "" }], Q.state, Q.active || keys[0], setActive)
      : slotRow(keys.map((k) => ({ k, label: k === "w" ? "wholes" : k === "n" ? "top" : k === "d" ? "bottom" : "" })), Q.state, Q.active || keys[0], setActive);
    if (!Q.active) Q.active = keys[0];
    stage.appendChild(row);
    stage.appendChild(pad((k) => {
      const key = Q.active || keys[0];
      const cur = Q.state[key];
      if (k === "⌫") { const s = cur === undefined ? "" : String(cur).slice(0, -1); if (s) Q.state[key] = s.includes(".") ? s : +s; else delete Q.state[key]; }
      else if (k === ".") { const s = (cur === undefined ? "0" : String(cur)); if (!s.includes(".")) Q.state[key] = s + "."; }
      else { const s = (cur === undefined ? "" : String(cur)) + k; if (s.replace(".", "").length <= 3) Q.state[key] = s.includes(".") ? s : +s; }
      Q.msg = ""; renderQ();
    }));
  };

  switch (q.kind) {
    case "equal": {
      stage.appendChild(bar(q.d, { parts: q.parts, cls: "big" }));
      const row = el("div", "btn-row");
      const yes = el("button", "btn choice", "Yes — equal parts");
      const no = el("button", "btn choice", "No — not equal");
      yes.addEventListener("click", () => settle(q, true));
      no.addEventListener("click", () => settle(q, false));
      if (Q.done) (q.fair ? yes : no).classList.add("right");
      row.append(yes, no); stage.appendChild(row);
      break;
    }
    case "name": {
      stage.appendChild(bar(q.d, { shaded: new Set(q.shaded), cls: "big" }));
      const setActive = (k) => { Q.active = k; renderQ(); };
      const wrap = el("div", "fr-wrap");
      wrap.appendChild(fracSlots(Q.state, Q.active, setActive));
      stage.appendChild(wrap);
      stage.appendChild(pad((k) => {
        const key = Q.active || "n";
        const cur = Q.state[key];
        if (k === "⌫") { const s = cur === undefined ? "" : String(cur).slice(0, -1); if (s) Q.state[key] = +s; else delete Q.state[key]; }
        else if (k !== ".") { const s = (cur === undefined ? "" : String(cur)) + k; if (s.length <= 2) Q.state[key] = +s; }
        Q.msg = ""; renderQ();
      }));
      break;
    }
    case "shade": {
      stage.appendChild(bar(q.d, {
        shaded: Q.shaded, cls: "big",
        onTap: Q.done ? null : (i) => {
          Q.shaded.has(i) ? Q.shaded.delete(i) : Q.shaded.add(i);
          sfx.cut(); Q.msg = ""; renderQ();
        },
      }));
      stage.appendChild(el("div", "count-note", `${Q.shaded.size} of ${q.d} parts shaded`));
      break;
    }
    case "whole": {
      stage.appendChild(bar(q.d, { shaded: new Set(q.shaded), cls: "big" }));
      stage.appendChild(el("div", "count-note", "Type how many MORE parts are needed"));
      typed(["v"]);
      break;
    }
    case "ofnum": {
      const grid = el("div", "crate");
      for (let i = 0; i < q.N; i++) {
        const done = Q.done && i < q.answer;
        grid.appendChild(el("div", "nugget" + (done ? " on" : "")));
      }
      stage.appendChild(grid);
      typed(["v"]);
      break;
    }
    case "equiv": {
      const wall = el("div", "wall");
      wall.appendChild(wallRow(q.d1, q.n1, `${q.n1}/${q.d1}`));
      wall.appendChild(wallRow(q.d2, Q.done ? q.n2 : 0, Q.done ? `${q.n2}/${q.d2}` : `?/${q.d2}`));
      stage.appendChild(wall);
      typed(["v"]);
      break;
    }
    case "compare": {
      const wall = el("div", "wall");
      [q.a, q.b].forEach((f, i) => {
        const row = el("div", "wall-row choice-row" + (Q.done && q.answer === i ? " right" : ""));
        row.appendChild(el("div", "wall-label", `${f.n}/${f.d}`));
        row.appendChild(bar(f.d, { shaded: new Set(Array.from({ length: f.n }, (_, j) => j)) }));
        if (!Q.done) row.addEventListener("click", () => settle(q, i));
        wall.appendChild(row);
      });
      stage.appendChild(wall);
      stage.appendChild(el("div", "count-note", "Tap the bigger one"));
      break;
    }
    case "order": {
      const pool = el("div", "order-pool");
      q.shown.forEach((f, i) => {
        const picked = Q.orderPick.indexOf(i);
        const tile = el("button", "order-tile" + (picked >= 0 ? " picked" : ""));
        tile.appendChild(html("div", "tile-frac", frac(f.n, f.d)));
        tile.appendChild(bar(f.d, { shaded: new Set(Array.from({ length: f.n }, (_, j) => j)), cls: "mini" }));
        if (picked >= 0) tile.appendChild(el("div", "tile-pos", String(picked + 1)));
        tile.addEventListener("click", () => {
          if (Q.done) return;
          const at = Q.orderPick.indexOf(i);
          if (at >= 0) Q.orderPick.splice(at, 1); else if (Q.orderPick.length < 3) Q.orderPick.push(i);
          sfx.tap(); Q.msg = ""; renderQ();
        });
        pool.appendChild(tile);
      });
      stage.appendChild(pool);
      stage.appendChild(el("div", "count-note", "Tap them in order — smallest first"));
      break;
    }
    case "mixed": {
      stage.appendChild(longBar(q.w + 1, q.d, q.n));
      if (q.toMixed) { stage.appendChild(el("div", "count-note", "whole ingots, and how many parts left")); typed(["w", "n"]); }
      else { stage.appendChild(el("div", "count-note", `How many ${q.d}ths altogether?`)); typed(["v"]); }
      break;
    }
    case "count": {
      const line = el("div", "count-line");
      q.seq.forEach((nn) => line.appendChild(html("div", "count-chip", mixedHTML(nn, q.d))));
      line.appendChild(el("div", "count-chip next", "?"));
      stage.appendChild(line);
      typed(["w", "n"]);
      break;
    }
    case "decimal": {
      if (q.d === 100) stage.appendChild(hundredGrid(q.n));
      else stage.appendChild(bar(q.d, { shaded: new Set(Array.from({ length: q.n }, (_, j) => j)), cls: "big" }));
      const scale = el("div", "scale");
      scale.appendChild(el("div", "scale-label", "FORGE SCALE"));
      scale.appendChild(el("div", "scale-read", q.toDec ? (Q.done ? q.dec.toFixed(2).replace(/0$/, "") : "— . — —") : String(q.dec)));
      stage.appendChild(scale);
      if (q.toDec) typed(["v"]);
      else {
        const setActive = (k) => { Q.active = k; renderQ(); };
        const wrap = el("div", "fr-wrap");
        wrap.appendChild(fracSlots(Q.state, Q.active || "n", setActive, q.d));
        stage.appendChild(wrap);
        stage.appendChild(pad((k) => {
          const cur = Q.state.n;
          if (k === "⌫") { const s = cur === undefined ? "" : String(cur).slice(0, -1); if (s) Q.state.n = +s; else delete Q.state.n; }
          else if (k !== ".") { const s = (cur === undefined ? "" : String(cur)) + k; if (s.length <= 3) Q.state.n = +s; }
          Q.msg = ""; renderQ();
        }));
      }
      break;
    }
    case "addsame": {
      const sum = el("div", "sum-row");
      sum.appendChild(bar(q.d, { shaded: new Set(Array.from({ length: q.a }, (_, j) => j)), cls: "mini" }));
      sum.appendChild(el("div", "sum-op", "+"));
      sum.appendChild(bar(q.d, { shaded: new Set(Array.from({ length: q.b }, (_, j) => j)), cls: "mini" }));
      stage.appendChild(sum);
      if (Q.done) {
        stage.appendChild(el("div", "count-note", `= ${q.a + q.b}/${q.d}`));
        stage.appendChild(bar(q.d, { shaded: new Set(Array.from({ length: q.a + q.b }, (_, j) => j)), cls: "big" }));
      } else {
        const wrap = el("div", "fr-wrap");
        wrap.appendChild(fracSlots({ n: Q.state.v }, "n", () => {}, q.d));
        stage.appendChild(wrap);
      }
      if (!Q.done) typed(["v"]);
      break;
    }
  }
}
function wallRow(d, n, label) {
  const row = el("div", "wall-row");
  row.appendChild(el("div", "wall-label", label));
  row.appendChild(bar(d, { shaded: new Set(Array.from({ length: n }, (_, j) => j)) }));
  return row;
}
function mixedHTML(nn, d) {
  const w = Math.floor(nn / d), r = nn % d;
  if (r === 0) return `<b>${w}</b>`;
  return (w ? `<b>${w}</b> ` : "") + frac(r, d);
}
function hundredGrid(n) {
  const g = el("div", "hundred");
  for (let i = 0; i < 100; i++) g.appendChild(el("div", "hcell" + (i < n ? " on" : "")));
  return g;
}

/* ---------- end of round ---------- */
function endRound() {
  sfx.cheer();
  stopSpeech();
  const level = G.level;
  const best = store.best[level] || 0;
  const isBest = G.stars > best;
  if (isBest) store.best[level] = G.stars;
  store.career.stars += G.stars;
  store.career.rounds += 1;
  saveStore();

  app.innerHTML = "";
  const wrap = el("div", "summary");
  const max = ROUND_LEN * 2;
  wrap.appendChild(el("h2", null, G.stars === max ? "MASTER SMITH! 🏆" : G.stars >= max * 0.8 ? "Good forging ⚒️" : "Forge closed for today 🔥"));
  wrap.appendChild(el("div", "final", `${G.stars} / ${max}`));
  wrap.appendChild(el("div", "sub", `${MODES[level].emoji} ${MODES[level].name} · ${G.firstGo} of ${ROUND_LEN} right first go`));
  if (isBest && G.stars > 0) wrap.appendChild(el("div", "newbest", `⭐ New ${MODES[level].name} record!`));

  wrap.appendChild(skillBoard(level === 5 ? null : level));

  const row = el("div", "btn-row");
  const again = el("button", "btn primary", "Another round");
  again.addEventListener("click", () => { sfx.whoosh(); startRound(level); });
  const home = el("button", "btn secondary", "Home");
  home.addEventListener("click", () => { sfx.tap(); renderHome(); });
  row.append(again, home);
  wrap.appendChild(row);
  app.appendChild(wrap);
}

/* ---------- the readiness board ----------
   The parent-facing answer to "is he ready for Grade 4?": every Level 4 skill
   with how he is actually going on it. Green needs 5 tries and 80%. */
function skillBoard(onlyLevel) {
  const board = el("div", "board");
  [3, 4].forEach((lvl) => {
    if (onlyLevel && lvl !== onlyLevel) return;
    board.appendChild(el("div", "board-head", lvl === 3 ? "Level 3 — the basics" : "Level 4 — ready for Grade 4"));
    Object.keys(L.SKILLS).filter((k) => L.SKILLS[k].level === lvl).forEach((k) => {
      const [right, tries] = store.skills[k] || [0, 0];
      const pct = tries ? Math.round(100 * right / tries) : 0;
      const state = tries < 5 ? "new" : pct >= 80 ? "solid" : pct >= 55 ? "ok" : "work";
      const row = el("div", "board-row " + state);
      row.appendChild(el("span", "dot"));
      row.appendChild(el("span", "bname", L.SKILLS[k].name));
      row.appendChild(el("span", "bnum", tries < 5 ? `${tries}/5 tried` : `${pct}%`));
      board.appendChild(row);
    });
  });
  return board;
}

/* ================= LESSONS ================= */
const LESSONS = {
  fraction: {
    kicker: "First lesson",
    title: "What IS a fraction? 🔥",
    flag: "seenFraction",
    steps: [
      { cap: "Welcome to the forge. This is one whole IRON INGOT. Everything in here is about cutting ingots up — and putting them back together.",
        art: () => bar(1, { cls: "big" }) },
      { cap: "Cut it into 2 pieces that are exactly the SAME size. Each piece is called ONE HALF, written 1/2. The bottom number tells you how many equal pieces the whole thing was cut into.",
        art: () => bar(2, { shaded: new Set([0]), cls: "big", label: (i) => (i === 0 ? "1/2" : "") }) },
      { cap: "Cut the same ingot into 4 equal pieces and each one is a QUARTER, 1/4. More pieces means each piece is SMALLER — that is why 1/4 is less than 1/2, even though 4 is a bigger number than 2.",
        art: () => { const w = el("div", "wall");
          w.appendChild(wallRow(2, 1, "1/2")); w.appendChild(wallRow(4, 1, "1/4")); return w; } },
      { cap: "⚠️ The one rule that matters: the pieces MUST be equal. This ingot is in 4 pieces too — but they are all different sizes, so none of them is a quarter. Uneven pieces do not get fraction names.",
        art: () => bar(4, { parts: [0.5, 0.2, 0.18, 0.12], cls: "big bad-cut" }) },
      { cap: "The TOP number counts how many of those pieces you take. Take 3 of the 4 quarters and you have 3/4 — three quarters of the ingot.",
        art: () => bar(4, { shaded: new Set([0, 1, 2]), cls: "big" }) },
      { cap: "Take ALL of them and you are back where you started: 4/4 = 1 whole ingot. And look — 2/4 reaches exactly as far as 1/2. Same amount, different name. Those are EQUIVALENT fractions, and they are the big Level 4 idea.",
        art: () => { const w = el("div", "wall");
          w.appendChild(wallRow(1, 1, "1")); w.appendChild(wallRow(2, 1, "1/2")); w.appendChild(wallRow(4, 2, "2/4")); return w; } },
      { cap: "So: BOTTOM number = how many equal pieces. TOP number = how many you take. That is every fraction there is. Let's forge.",
        art: () => bar(8, { shaded: new Set([0, 1, 2, 3, 4]), cls: "big" }) },
    ],
  },
  cubes: {
    kicker: "Word problems",
    title: "The CUBES strategy 📋",
    flag: "seenCubes",
    steps: [
      { cap: "Some fraction questions come as a STORY, and a story hides the maths inside words. CUBES is the way your tutor showed you to dig it out. Five letters, five things to do — and you do them with a pencil, right on the page.",
        art: () => cubesCard(0) },
      { cap: "C — CIRCLE THE NUMBERS. All of them, even ones you might not need in the end. You are just catching them so none escapes.",
        art: () => cubesDemo(1) },
      { cap: "U — UNDERLINE THE QUESTION. Which sentence actually ASKS you something? Usually it has a question mark — but not always. Sometimes it says 'Work out…'",
        art: () => cubesDemo(2) },
      { cap: "B — BOX THE KEY WORDS. The words that tell you what to DO. Here, 'a quarter of' means share into 4 equal groups and take one. Key words are instructions, not decoration.",
        art: () => cubesDemo(3) },
      { cap: "E — ELIMINATE the extra information, and EVALUATE what steps to take. The price of the pizza has nothing to do with how many slices he ate — cross it out. Then: I need a quarter of 12, so the sum is 12 ÷ 4.",
        art: () => cubesDemo(4) },
      { cap: "S — SOLVE AND CHECK. 12 ÷ 4 = 3 slices. Then check it backwards: 3 slices × 4 groups = 12. That is the number we started with, so it is right.",
        art: () => cubesDemo(5) },
      { cap: "Every letter, every time — even when the question looks easy. The whole point of CUBES is that it slows you down enough to notice the trap. Now: back to the forge.",
        art: () => cubesCard(0) },
    ],
  },
};
const CUBES_ROWS = [
  ["C", "Circle the numbers"],
  ["U", "Underline the question"],
  ["B", "Box the key words"],
  ["E", "Eliminate extra information · Evaluate: what steps do I take?"],
  ["S", "Solve and check"],
];
function cubesCard(lit) {
  const c = el("div", "cubes-card");
  CUBES_ROWS.forEach(([letter, text], i) => {
    const row = el("div", "cubes-row" + (lit && i === lit - 1 ? " lit" : ""));
    row.appendChild(el("span", "cube " + letter, letter));
    row.appendChild(el("span", "cubes-text", text));
    c.appendChild(row);
  });
  return c;
}
/* the worked example, marked up one letter at a time */
const DEMO = [
  { text: "A pizza is cut into 12 equal slices.", nums: ["12"] },
  { text: "The pizza cost $9.", nums: ["9"], junk: true },
  { text: "Henry eats a quarter of the pizza.", nums: [], key: "a quarter of" },
  { text: "How many slices did he eat?", nums: [], q: true },
];
function cubesDemo(stage) {
  const wrap = el("div", "demo");
  DEMO.forEach((s) => {
    const line = el("div", "demo-line"
      + (stage >= 4 && s.junk ? " struck" : "")
      + (stage >= 2 && s.q ? " underlined" : ""));
    let markup = s.text;
    if (stage >= 1) for (const n of s.nums || []) markup = markup.replace(n, `<span class="circled">${n}</span>`);
    if (stage >= 3 && s.key) markup = markup.replace(s.key, `<span class="boxed">${s.key}</span>`);
    line.innerHTML = markup;
    wrap.appendChild(line);
  });
  if (stage >= 4) wrap.appendChild(html("div", "demo-plan", "A quarter of 12 → <b>12 ÷ 4 = ?</b>"));
  if (stage >= 5) wrap.appendChild(html("div", "demo-plan good", "12 ÷ 4 = <b>3 slices</b> · check: 3 × 4 = 12 ✓"));
  return wrap;
}

function renderLesson(which, then) {
  G = null;
  stopSpeech();
  const def = LESSONS[which];
  app.innerHTML = "";
  let step = 0;

  const back = el("button", "corner-back", "✕");
  back.addEventListener("click", () => { sfx.tap(); stopSpeech(); renderHome(); });
  app.appendChild(back);

  const game = el("div", "game lesson");
  const title = html("div", "card title-card", `<div class="kicker">${def.kicker}</div><div class="h">${def.title}</div>`);
  game.appendChild(title);
  const cap = el("div", "card cap-card"); game.appendChild(cap);
  const art = el("div", "stage lesson-art"); game.appendChild(art);
  const deck = el("div", "deck");
  const row = el("div", "btn-row");
  const sayBtn = el("button", "btn secondary", "🔈 Read it");
  const nextBtn = el("button", "btn primary", "Next ▶");
  row.append(sayBtn, nextBtn); deck.appendChild(row); game.appendChild(deck);
  app.appendChild(game);

  function draw() {
    const s = def.steps[step];
    cap.innerHTML = `<div class="cap-text">${s.cap}</div>`;
    art.innerHTML = ""; art.appendChild(s.art());
    nextBtn.textContent = step === def.steps.length - 1 ? (then ? "Let's forge ▶" : "Done ✔") : "Next ▶";
  }
  sayBtn.addEventListener("click", () => { sfx.tap(); speak(plain(def.steps[step].cap)); });
  nextBtn.addEventListener("click", () => {
    step += 1; sfx.tap();
    if (step >= def.steps.length) {
      stopSpeech();
      store[def.flag] = true; saveStore();
      if (then) then(); else renderHome();
      return;
    }
    draw();
  });
  draw();
}

/* ================= HOME ================= */
function renderHome() {
  G = null; Q = null;
  stopSpeech();
  app.innerHTML = "";
  const home = el("div", "home");
  home.appendChild(el("h1", null, "⚒️ Fraction Forge"));
  home.appendChild(el("div", "tagline", "One whole ingot. Cut it into equal parts and you have fractions."));

  const career = el("div", "career");
  const solid = Object.keys(L.SKILLS).filter((k) => {
    const [r, t] = store.skills[k] || [0, 0];
    return t >= 5 && r / t >= 0.8;
  }).length;
  [["Stars", store.career.stars], ["Rounds", store.career.rounds], ["Skills solid", `${solid}/12`]]
    .forEach(([label, val]) => { const s = el("div", "stat"); s.innerHTML = `<b>${val}</b><br>${label}`; career.appendChild(s); });
  home.appendChild(career);

  const row = el("div", "mode-row");
  [3, 4, 5].forEach((lvl) => {
    const m = MODES[lvl];
    const b = el("button", "mode-btn");
    b.appendChild(el("span", "mode-emoji", m.emoji));
    b.appendChild(el("span", "mode-name", m.name));
    b.appendChild(el("span", "mode-sub", m.sub));
    b.appendChild(el("span", "mode-best", store.best[lvl] ? `Best ${store.best[lvl]}/${ROUND_LEN * 2}` : "Not played yet"));
    b.addEventListener("click", () => { sfx.whoosh(); startRound(lvl); });
    row.appendChild(b);
  });
  home.appendChild(row);

  const pills = el("div", "pill-row");
  const l1 = el("button", "pill", "🔥 Lesson — what IS a fraction?");
  l1.addEventListener("click", () => { sfx.whoosh(); renderLesson("fraction", null); });
  const l2 = el("button", "pill", "📋 Lesson — the CUBES strategy");
  l2.addEventListener("click", () => { sfx.whoosh(); renderLesson("cubes", null); });
  const bd = el("button", "pill", "📊 Readiness board");
  bd.addEventListener("click", () => { sfx.tap(); renderBoard(); });
  const pr = el("a", "pill", "🖨️ Print a worksheet");
  pr.href = "print.html?level=4";
  pills.append(l1, l2, bd, pr);
  home.appendChild(pills);

  home.appendChild(el("div", "credit",
    `A ScupperLab production  ·  v${self.APP_VERSION || "?"}${self.APP_DATE ? " · " + self.APP_DATE : ""}`));
  app.appendChild(home);
}

function renderBoard() {
  stopSpeech();
  app.innerHTML = "";
  const back = el("button", "corner-back", "✕");
  back.addEventListener("click", () => { sfx.tap(); renderHome(); });
  app.appendChild(back);
  const wrap = el("div", "summary board-page");
  wrap.appendChild(el("h2", null, "📊 Readiness board"));
  wrap.appendChild(el("div", "sub", "Green means 5 or more tries with at least 80% right first go."));
  wrap.appendChild(skillBoard(null));
  const reset = el("button", "btn secondary", "Start the board again");
  reset.addEventListener("click", () => {
    if (!reset.dataset.arm) { reset.dataset.arm = "1"; reset.textContent = "Wipe all progress?"; setTimeout(() => { if (reset.isConnected) { delete reset.dataset.arm; reset.textContent = "Start the board again"; } }, 2500); return; }
    store.skills = {}; saveStore(); sfx.tap(); renderBoard();
  });
  wrap.appendChild(reset);
  app.appendChild(wrap);
}

/* ---------- boot ---------- */
const muteBtn = document.getElementById("mute-btn");
function syncMute() { muteBtn.textContent = store.muted ? "🔇" : "🔊"; }
muteBtn.addEventListener("click", () => {
  store.muted = !store.muted; saveStore(); syncMute();
  if (!store.muted) sfx.tap(); else stopSpeech();
});
syncMute();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
renderHome();
