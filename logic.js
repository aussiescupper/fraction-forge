/* Fraction Forge — question generator and checkers.
   Pure logic, no DOM: loaded by the app AND by `node test.js`.

   Covers the Victorian Curriculum fraction ladder from Level 3 to Level 4:

   LEVEL 3  (VC2M3N01 — unit fractions 1/2 1/3 1/4 1/5 1/10 and their multiples,
             shown in different ways; combining same-denominator fractions to a whole)
     equal   is this cut into EQUAL parts?      (the rule everything else rests on)
     name    what fraction is shaded?
     shade   show me 3/5 of the ingot
     whole   2/5 done — how much more makes one whole?
     ofnum   1/4 of 12, and multiples like 3/4 of 12

   LEVEL 4  (VC2M4N02/N03 — equivalence with related denominators, connections to
             decimals, counting by halves/quarters/thirds including mixed numerals)
     equiv   1/2 = ?/8                          (related denominators only)
     compare which is bigger, 2/3 or 3/4?
     order   put three fractions in order
     mixed   7/4 = 1 and 3/4, and back again
     count   carry on: 3/4, 1, 1 1/4, ...
     decimal 3/4 = 0.75, 0.6 = 6/10
     addsame 1/5 + 3/5
     propimp is this proper (fits in one whole) or improper (needs more)?

   Every question carries everything needed to draw it and to mark it, so the
   app never decides what is right and the test can check the generator alone. */
(function (root) {
  "use strict";

  /* ---------- seeded rng ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const shuffled = (rng, arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  /* ---------- the skills, in teaching order ---------- */
  const SKILLS = {
    equal:   { level: 3, name: "Equal parts",         blurb: "A fraction only works if the parts are the SAME size." },
    name:    { level: 3, name: "Naming a fraction",   blurb: "Bottom number = how many equal parts. Top = how many you take." },
    shade:   { level: 3, name: "Showing a fraction",  blurb: "Make 3/5 yourself." },
    whole:   { level: 3, name: "Making one whole",    blurb: "Same-denominator pieces that add up to 1." },
    ofnum:   { level: 3, name: "Fraction of a number", blurb: "1/4 of 12 — share it into 4 and take 1." },
    equiv:   { level: 4, name: "Equivalent fractions", blurb: "1/2 = 2/4 = 5/10. Same amount, different name." },
    compare: { level: 4, name: "Comparing fractions", blurb: "Which is bigger — and why." },
    order:   { level: 4, name: "Ordering fractions",  blurb: "Smallest to biggest." },
    mixed:   { level: 4, name: "Mixed numbers",       blurb: "7/4 is 1 whole and 3/4." },
    count:   { level: 4, name: "Counting in fractions", blurb: "Carry on past 1: 3/4, 1, 1 and 1/4…" },
    decimal: { level: 4, name: "Fractions as decimals", blurb: "3/4 is 0.75 on the scale." },
    addsame: { level: 4, name: "Adding fractions",    blurb: "Same bottom number: just add the tops." },
    propimp: { level: 4, name: "Proper or improper",   blurb: "Proper fits inside one whole. Improper needs one whole or more." },
  };

  const D3 = [2, 3, 4, 5, 10];        // the Level 3 unit fractions, straight from the curriculum
  const D3_PLUS = [2, 3, 4, 5, 6, 8, 10];
  // related-denominator families: everything Level 4 equivalence is allowed to use
  const FAMILIES = [
    [2, 4, 6, 8, 10, 12],
    [3, 6, 9, 12],
    [4, 8, 12],
    [5, 10],
  ];

  /* ================= LEVEL 3 ================= */

  // is this cut into equal parts? unequal bars get deliberately uneven widths
  function makeEqual(rng) {
    const d = pick(rng, D3_PLUS);
    const fair = rng() < 0.5;
    let parts;
    if (fair) {
      parts = Array.from({ length: d }, () => 1 / d);
    } else {
      // one piece clearly bigger, the rest share the remainder — never a near-miss
      parts = Array.from({ length: d }, () => 1);
      const big = R(rng, 0, d - 1);
      parts[big] = d < 4 ? 2.2 : 2.6;
      const tot = parts.reduce((a, b) => a + b, 0);
      parts = parts.map((x) => x / tot);
    }
    return { kind: "equal", d, parts, fair, answer: fair,
      prompt: "Is this ingot cut into EQUAL parts?" };
  }

  // what fraction is shaded?
  function makeName(rng, level) {
    const d = pick(rng, level >= 4 ? D3_PLUS : D3);
    const n = R(rng, 1, d - 1);
    return { kind: "name", d, n, shaded: Array.from({ length: n }, (_, i) => i), answer: { n, d },
      prompt: "What fraction of the ingot is shaded?" };
  }

  // show me 3/5 — he taps the parts.
  // `wholes` is how many ingots are on the bench: an improper fraction needs
  // more than one, which is the clearest way to SEE what improper means.
  // `shape` swaps the bar for a grid, because the curriculum asks for fractions
  // shown in different ways, not just one picture.
  function makeShade(rng, level, opts) {
    opts = opts || {};
    const d = pick(rng, level >= 4 || opts.shapes ? D3_PLUS : D3);
    const improper = opts.forceImproper || (opts.allowImproper && rng() < 0.35);
    const n = improper ? R(rng, d + 1, 2 * d - 1) : R(rng, 1, d - 1);
    const wholes = improper ? 2 : 1;
    const shape = opts.shapes && rng() < 0.45 ? "grid" : "bar";
    return { kind: "shade", d, n, wholes, shape, improper, answer: n,
      prompt: improper
        ? `Shade <b>${n}/${d}</b> — that is more than one whole, so you will need both.`
        : `Shade <b>${n}/${d}</b> of the ingot.` };
  }

  // 2/5 done — how much more makes one whole?
  function makeWhole(rng) {
    const d = pick(rng, D3_PLUS);
    const n = R(rng, 1, d - 1);
    return { kind: "whole", d, n, shaded: Array.from({ length: n }, (_, i) => i), answer: d - n,
      prompt: `<b>${n}/${d}</b> of the order is done. How much MORE makes one whole ingot?` };
  }

  // 1/4 of 12, and multiples of unit fractions like 3/4 of 12
  function makeOfNum(rng, level) {
    const d = pick(rng, D3);
    const q = R(rng, 2, Math.min(10, Math.floor(40 / d)));
    const N = d * q;
    const m = level >= 4 && d >= 3 && rng() < 0.45 ? R(rng, 2, d - 1) : 1;   // halves have no multiple below the whole
    return { kind: "ofnum", d, m, N, q, answer: m * q,
      prompt: `The crate holds <b>${N}</b> ingots. How many is <b>${m}/${d}</b> of them?` };
  }

  /* ================= LEVEL 4 ================= */

  // 1/2 = ?/8 — related denominators only, and the missing slot varies
  function makeEquiv(rng) {
    const fam = pick(rng, FAMILIES);
    let d1 = pick(rng, fam), d2 = pick(rng, fam);
    let guard = 0;
    while ((d1 === d2 || d2 % d1 !== 0) && guard++ < 40) { d1 = pick(rng, fam); d2 = pick(rng, fam); }
    if (d2 % d1 !== 0) { d1 = fam[0]; d2 = fam[1]; }
    const n1 = R(rng, 1, d1 - 1);
    const k = d2 / d1;
    const n2 = n1 * k;
    const askDen = rng() < 0.3;
    return { kind: "equiv", d1, n1, d2, n2, askDen,
      answer: askDen ? d2 : n2,
      prompt: askDen
        ? `<b>${n1}/${d1}</b> = <b>${n2}/?</b> — what is the bottom number?`
        : `<b>${n1}/${d1}</b> = <b>?/${d2}</b> — what is the top number?` };
  }

  // which is bigger? related denominators, or the same top number
  function makeCompare(rng) {
    let a, b, guard = 0;
    do {
      if (rng() < 0.45) {
        // same numerator, different denominator: more pieces means smaller pieces
        const n = R(rng, 1, 3);
        const ds = shuffled(rng, D3_PLUS.filter((d) => d > n));
        a = { n, d: ds[0] }; b = { n, d: ds[1] };
      } else {
        const fam = pick(rng, FAMILIES);
        const d1 = pick(rng, fam); let d2 = pick(rng, fam);
        let g2 = 0; while (d2 === d1 && g2++ < 20) d2 = pick(rng, fam);
        a = { n: R(rng, 1, d1 - 1), d: d1 };
        b = { n: R(rng, 1, d2 - 1), d: d2 };
      }
      guard++;
    } while (a.n * b.d === b.n * a.d && guard < 60);
    if (a.n * b.d === b.n * a.d) { a = { n: 1, d: 2 }; b = { n: 3, d: 4 }; }
    const aBigger = a.n * b.d > b.n * a.d;
    return { kind: "compare", a, b, answer: aBigger ? 0 : 1,
      prompt: "Which piece is BIGGER?" };
  }

  // put three in order, smallest first
  function makeOrder(rng) {
    const fam = pick(rng, FAMILIES);
    const seen = new Set(); const fr = [];
    let guard = 0;
    while (fr.length < 3 && guard++ < 200) {
      const d = pick(rng, fam), n = R(rng, 1, d - 1);
      const v = n / d;
      if ([...seen].some((x) => Math.abs(x - v) < 1e-9)) continue;
      seen.add(v); fr.push({ n, d, v });
    }
    while (fr.length < 3) { const d = fam[fr.length + 1] || 4; fr.push({ n: 1, d, v: 1 / d }); }
    const shown = shuffled(rng, fr);
    const answer = shown.map((f, i) => i).sort((x, y) => shown[x].v - shown[y].v);
    return { kind: "order", shown: shown.map((f) => ({ n: f.n, d: f.d })), answer,
      prompt: "Tap them in order — SMALLEST first." };
  }

  // 7/4 = 1 and 3/4, and back again
  function makeMixed(rng) {
    const d = pick(rng, [2, 3, 4, 5, 8, 10]);
    const w = R(rng, 1, 3);
    const r = R(rng, 1, d - 1);
    const n = w * d + r;
    const toMixed = rng() < 0.6;
    return { kind: "mixed", d, w, r, n, toMixed,
      answer: toMixed ? { w, n: r } : n,
      prompt: toMixed
        ? `<b>${n}/${d}</b> ingots — write that as a whole number and a fraction.`
        : `<b>${w} and ${r}/${d}</b> ingots — how many ${d === 2 ? "halves" : d === 3 ? "thirds" : d === 4 ? "quarters" : d === 5 ? "fifths" : d === 8 ? "eighths" : "tenths"} is that altogether?` };
  }

  // carry on the count, crossing 1
  function makeCount(rng) {
    const d = pick(rng, [2, 3, 4]);
    const start = R(rng, 1, d);                    // start below 1 so the run crosses it
    const seq = [];
    for (let i = 0; i < 4; i++) seq.push(start + i);
    const nextN = start + 4;
    return { kind: "count", d, seq, nextN,
      answer: { w: Math.floor(nextN / d), n: nextN % d },
      prompt: "Carry on the count — what comes next?" };
  }

  // the forge scale: fraction to decimal and back
  const DECIMALS = [
    { n: 1, d: 2, dec: 0.5 }, { n: 1, d: 4, dec: 0.25 }, { n: 3, d: 4, dec: 0.75 },
    { n: 1, d: 5, dec: 0.2 }, { n: 2, d: 5, dec: 0.4 }, { n: 3, d: 5, dec: 0.6 }, { n: 4, d: 5, dec: 0.8 },
    { n: 1, d: 10, dec: 0.1 }, { n: 3, d: 10, dec: 0.3 }, { n: 7, d: 10, dec: 0.7 }, { n: 9, d: 10, dec: 0.9 },
    { n: 25, d: 100, dec: 0.25 }, { n: 50, d: 100, dec: 0.5 }, { n: 75, d: 100, dec: 0.75 },
  ];
  function makeDecimal(rng) {
    const f = pick(rng, DECIMALS);
    const toDec = rng() < 0.6;
    return { kind: "decimal", n: f.n, d: f.d, dec: f.dec, toDec,
      answer: toDec ? f.dec : { n: f.n, d: f.d },
      prompt: toDec
        ? `The scale shows <b>${f.n}/${f.d}</b> of an ingot. What does it read as a decimal?`
        : `The scale reads <b>${f.dec}</b>. Write that as a fraction out of <b>${f.d}</b>.` };
  }

  // same bottom number: just add the tops. `past` lets the total go over one
  // whole, so the answer comes out improper — that is the step up.
  function makeAddSame(rng, level, opts) {
    opts = opts || {};
    const d = pick(rng, D3_PLUS.filter((x) => x >= 3));
    let a, b;
    if (opts.past) {
      a = R(rng, 2, d - 1);
      b = R(rng, d - a + 1, d - 1);            // forces a + b past d
    } else {
      a = R(rng, 1, d - 2);
      b = R(rng, 1, d - a);
    }
    return { kind: "addsame", d, a, b, past: a + b > d, answer: a + b,
      prompt: `<b>${a}/${d}</b> + <b>${b}/${d}</b> = ?` };
  }

  // proper fits inside one whole; improper needs a whole or more
  function makePropImp(rng) {
    const d = pick(rng, D3_PLUS);
    const isProper = rng() < 0.5;
    const n = isProper ? R(rng, 1, d - 1) : R(rng, d, 2 * d - 1);
    return { kind: "propimp", d, n, isProper, answer: isProper ? "proper" : "improper",
      prompt: `Is <b>${n}/${d}</b> a PROPER fraction or an IMPROPER one?` };
  }

  /* ---------- the factory ---------- */
  const MAKERS = {
    equal: makeEqual, name: makeName, shade: makeShade, whole: makeWhole, ofnum: makeOfNum,
    equiv: makeEquiv, compare: makeCompare, order: makeOrder, mixed: makeMixed,
    count: makeCount, decimal: makeDecimal, addsame: makeAddSame, propimp: makePropImp,
  };
  function makeQuestion(kind, rng, level, opts) {
    const q = MAKERS[kind](rng, level || SKILLS[kind].level, opts);
    q.skill = kind;
    q.level = SKILLS[kind].level;
    return q;
  }

  /* ---------- marking ----------
     `res` shapes, by kind:
       equal   boolean            name    {n, d}          shade   number of parts shaded
       whole   number             ofnum   number          equiv   number
       compare 0 | 1              order   [i, i, i]       mixed   {w, n} | number
       count   {w, n}             decimal number | {n, d} addsame number                */
  function verify(q, res) {
    const bad = (msg) => ({ ok: false, msg });
    switch (q.kind) {
      case "equal":
        if (res === q.answer) return { ok: true };
        return bad(q.fair
          ? "Look again — every piece here IS the same size, so it can have a fraction name."
          : "Look at the sizes. One piece is bigger than the others, so these are not fractions of the ingot.");
      case "name": {
        if (!res || res.n === undefined || res.d === undefined) return bad("Fill in both numbers.");
        if (res.n === q.n && res.d === q.d) return { ok: true };
        if (res.d !== q.d) return bad(`Count ALL the equal parts for the bottom number — there are ${q.d}.`);
        return bad(`The top number counts the shaded parts. Count them again.`);
      }
      case "shade":
        if (res === q.answer) return { ok: true };
        if (q.improper && res === q.d) return bad(`That is one whole — ${q.n}/${q.d} is MORE than one whole. Keep going onto the second ingot.`);
        return bad(res > q.answer
          ? `That's ${res} parts — ${q.n}/${q.d} means ${q.n}.`
          : `That's only ${res} — you need ${q.n} parts, each one ${q.d === 2 ? "a half" : "a 1/" + q.d}.`);
      case "whole":
        if (res === q.answer) return { ok: true };
        return bad(`${q.n}/${q.d} is done, and it takes ${q.d}/${q.d} to finish. How many more pieces?`);
      case "ofnum":
        if (res === q.answer) return { ok: true };
        return bad(q.m === 1
          ? `Share all ${q.N} into ${q.d} equal groups, then take ONE group.`
          : `Share all ${q.N} into ${q.d} equal groups, then take ${q.m} of them.`);
      case "equiv":
        if (res === q.answer) return { ok: true };
        return bad(q.askDen
          ? `The top went from ${q.n1} to ${q.n2}, so it was multiplied by ${q.n2 / q.n1}. Do the same to the bottom.`
          : `${q.d1} became ${q.d2}, so it was multiplied by ${q.d2 / q.d1}. Do the same to the top.`);
      case "compare": {
        if (res === q.answer) return { ok: true };
        const A = q.a, B = q.b;
        if (A.n === B.n) return bad(`Both take ${A.n} piece${A.n === 1 ? "" : "s"} — but cutting into more pieces makes each one SMALLER.`);
        return bad("Compare them on the bars — line them up and see which reaches further.");
      }
      case "order": {
        if (!Array.isArray(res) || res.length !== q.answer.length) return bad("Put all three in order.");
        const ok = res.every((v, i) => {
          const a = q.shown[v], b = q.shown[q.answer[i]];
          return a.n * b.d === b.n * a.d;               // equal values may swap
        });
        return ok ? { ok: true } : bad("Not quite — check them against the bars, smallest first.");
      }
      case "mixed":
        if (q.toMixed) {
          if (!res || res.w === undefined || res.n === undefined) return bad("Fill in both boxes.");
          if (res.w === q.w && res.n === q.r) return { ok: true };
          return bad(`How many whole ingots fit inside ${q.n}/${q.d}? It takes ${q.d} pieces to make each one.`);
        }
        if (res === q.answer) return { ok: true };
        return bad(`Each whole ingot is ${q.d}/${q.d}. That's ${q.w} × ${q.d}, then add the extra ${q.r}.`);
      case "count":
        if (!res || res.w === undefined || res.n === undefined) return bad("Fill in both boxes.");
        if (res.w === q.answer.w && res.n === q.answer.n) return { ok: true };
        return bad(`Keep adding one more ${q.d === 2 ? "half" : q.d === 3 ? "third" : "quarter"} each time.`);
      case "decimal":
        if (q.toDec) {
          if (Math.abs(res - q.dec) < 1e-9) return { ok: true };
          return bad(`Think of the ingot split into ${q.d === 100 ? "a hundred" : q.d === 10 ? "ten" : q.d} — ${q.n}/${q.d} of it.`);
        }
        if (res && res.n === q.n) return { ok: true };
        return bad(`${q.dec} means ${q.dec * q.d} out of ${q.d}.`);
      case "addsame":
        if (res === q.answer) return { ok: true };
        if (q.past && res === q.d) return bad(`${q.a} + ${q.b} is more than ${q.d}, so the answer goes PAST one whole. The top number can be bigger than the bottom.`);
        return bad(`Same bottom number, so just add the top numbers: ${q.a} + ${q.b}.`);
      case "propimp":
        if (res === q.answer) return { ok: true };
        return q.isProper
          ? bad(`${q.n} is less than ${q.d}, so ${q.n}/${q.d} fits inside one whole — that makes it PROPER.`)
          : bad(`${q.n} is ${q.n === q.d ? "the same as" : "bigger than"} ${q.d}, so ${q.n}/${q.d} fills a whole ingot${q.n === q.d ? "" : " and more"} — that makes it IMPROPER.`);
      default:
        return bad("?");
    }
  }

  /* ---------- rounds ---------- */
  const ROUND_LEN = 8;
  const MIXES = {
    3: ["equal", "name", "name", "shade", "shade", "whole", "ofnum", "ofnum"],
    4: ["equiv", "equiv", "compare", "order", "mixed", "propimp", "decimal", "addsame"],
    // the readiness check: the Level 4 skills that matter most, with Level 3 underneath
    5: ["name", "ofnum", "equiv", "compare", "mixed", "propimp", "decimal", "count"],
    // the shading drill: nothing but making the fraction yourself, in both
    // shapes, and from halfway through it goes past one whole
    6: ["shade", "shade", "shade", "shade", "shade", "shade", "shade", "shade"],
    // the improper drill, behind its own home-screen icon: tell them apart,
    // make one, rename it as a mixed number, and count through one whole
    7: ["propimp", "propimp", "shade", "shade", "mixed", "mixed", "count", "count"],
    // adding: same bottom number throughout, and the last few spill past one whole
    8: ["addsame", "addsame", "whole", "addsame", "addsame", "whole", "addsame", "addsame"],
    // which is bigger: two at a time, then three to put in order
    9: ["compare", "compare", "compare", "order", "compare", "compare", "order", "order"],
  };
  function makeRound(level, seed) {
    const rng = mulberry32(seed | 0);
    const kinds = shuffled(rng, MIXES[level] || MIXES[3]);
    const out = [];
    const seen = new Set();
    kinds.forEach((kind, i) => {
      // shading mode: shapes throughout, improper only once the first few are done.
      // improper mode: every shade goes past one whole, no exceptions.
      const opts = level === 6 ? { shapes: true, allowImproper: i >= 3 }
        : level === 7 ? { shapes: true, forceImproper: true }
        // the adding drill saves the over-one-whole sums for the back half
        : level === 8 ? { past: i >= 4 } : undefined;
      let q, tries = 0;
      do { q = makeQuestion(kind, rng, level >= 6 ? 4 : level, opts); tries++; }
      while (seen.has(sig(q)) && tries < 30);
      seen.add(sig(q));
      out.push(q);
    });
    return out;
  }
  function sig(q) {
    return [q.kind, q.n, q.d, q.d1, q.d2, q.n1, q.N, q.m, q.w, q.r, q.a, q.b && q.b.n, q.shape, q.isProper,
      q.shown && q.shown.map((f) => f.n + "/" + f.d).join(",")].join("|");
  }

  root.ForgeLogic = { SKILLS, makeQuestion, makeRound, verify, mulberry32, ROUND_LEN, MIXES, gcd };
})(typeof self !== "undefined" ? self : globalThis);
