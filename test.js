/* Fraction Forge generator test — run `node test.js` before every deploy.
   Generates thousands of questions across every skill and asserts that the
   maths is right, the answer is reachable, and a wrong response is rejected. */
"use strict";
require("./logic.js");
const F = globalThis.ForgeLogic;

const fails = [];
const seen = {};
let total = 0;

function check(cond, why, q) {
  if (!cond) fails.push(`${why}  <-  ${q.kind}: ${JSON.stringify(q).slice(0, 180)}`);
}

// the right answer for a question, in the shape verify() expects
function rightAnswer(q) {
  switch (q.kind) {
    case "equal": return q.answer;
    case "name": return { n: q.n, d: q.d };
    case "shade": return q.n;
    case "whole": return q.d - q.n;
    case "ofnum": return q.m * q.q;
    case "equiv": return q.askDen ? q.d2 : q.n2;
    case "compare": return q.answer;
    case "order": return q.answer;
    case "mixed": return q.toMixed ? { w: q.w, n: q.r } : q.n;
    case "count": return q.answer;
    case "decimal": return q.toDec ? q.dec : { n: q.n, d: q.d };
    case "addsame": return q.a + q.b;
    case "propimp": return q.isProper ? "proper" : "improper";
  }
}
// a plausible wrong answer, to prove the checker actually rejects
function wrongAnswer(q) {
  switch (q.kind) {
    case "equal": return !q.answer;
    case "name": return { n: q.n + 1, d: q.d };
    case "shade": return q.n === 1 ? 2 : q.n - 1;
    case "whole": return q.d - q.n + 1;
    case "ofnum": return q.m * q.q + 1;
    case "equiv": return (q.askDen ? q.d2 : q.n2) + 1;
    case "compare": return 1 - q.answer;
    case "order": return [q.answer[1], q.answer[0], q.answer[2]];
    case "mixed": return q.toMixed ? { w: q.w + 1, n: q.r } : q.n + 1;
    case "count": return { w: q.answer.w, n: q.answer.n + 1 };
    case "decimal": return q.toDec ? q.dec + 0.1 : { n: q.n + 1, d: q.d };
    case "addsame": return q.a + q.b + 1;
    case "propimp": return q.isProper ? "improper" : "proper";
  }
}

for (let seed = 1; seed <= 500; seed++) {
  for (const level of [3, 4, 5, 6]) {
    for (const q of F.makeRound(level, seed * 7919 + level)) {
      total++;
      seen[q.skill] = (seen[q.skill] || 0) + 1;
      // the checker accepts the right answer and rejects a near miss
      const good = F.verify(q, rightAnswer(q));
      check(good.ok, "checker rejects the correct answer", q);
      const wrongRes = wrongAnswer(q);
      if (!(q.kind === "order" && sameValue(q, wrongRes))) {
        const bad = F.verify(q, wrongRes);
        check(!bad.ok, "checker accepts a wrong answer", q);
        check(!!bad.msg && bad.msg.length > 10, "no helpful message on a wrong answer", q);
      }
      // per-skill maths
      switch (q.kind) {
        case "equal": {
          const sum = q.parts.reduce((a, b) => a + b, 0);
          check(Math.abs(sum - 1) < 1e-9, "parts do not fill the ingot", q);
          const mn = Math.min(...q.parts), mx = Math.max(...q.parts);
          if (q.fair) check(mx - mn < 1e-9, "'equal' bar is not equal", q);
          else check(mx / mn > 1.8, "'unequal' bar is too close to call", q);
          break;
        }
        case "name": case "whole":
          check(q.n >= 1 && q.n < q.d, "numerator out of range", q); break;
        case "shade": {
          const wholes = q.wholes || 1;
          check(q.n >= 1 && q.n <= q.d * wholes, "shade numerator out of range", q);
          check(["bar", "grid"].includes(q.shape || "bar"), "unknown shade shape", q);
          if (q.improper) {
            check(q.n > q.d, "improper shade is not actually improper", q);
            check(wholes === 2, "improper shade needs a second ingot", q);
          } else {
            check(q.n < q.d, "proper shade should fit one whole", q);
            check(wholes === 1, "proper shade should need one ingot", q);
          }
          break;
        }
        case "propimp":
          check(q.n >= 1 && q.n <= 2 * q.d - 1, "propimp numerator out of range", q);
          check(q.isProper === (q.n < q.d), "proper/improper label disagrees with the numbers", q);
          break;
        case "ofnum":
          check(q.N % q.d === 0, "crate does not share evenly", q);
          check(q.m >= 1 && q.m < q.d, "multiple out of range", q);
          check(Number.isInteger(q.m * q.q) && q.m * q.q <= q.N, "bad answer", q); break;
        case "equiv":
          check(q.d2 % q.d1 === 0, "denominators are not related", q);
          check(q.n1 * q.d2 === q.n2 * q.d1, "equivalence is wrong", q);
          check(q.n1 < q.d1 && q.n2 <= q.d2, "not a proper fraction", q); break;
        case "compare": {
          const av = q.a.n / q.a.d, bv = q.b.n / q.b.d;
          check(Math.abs(av - bv) > 1e-9, "comparing two equal fractions", q);
          check((av > bv) === (q.answer === 0), "compare answer is wrong", q); break;
        }
        case "order": {
          check(q.shown.length === 3 && q.answer.length === 3, "order needs three", q);
          const vals = q.answer.map((i) => q.shown[i].n / q.shown[i].d);
          check(vals[0] <= vals[1] && vals[1] <= vals[2], "order answer is not sorted", q);
          check(new Set(q.shown.map((f) => f.n / f.d)).size === 3, "duplicate values to order", q); break;
        }
        case "mixed":
          check(q.n === q.w * q.d + q.r, "mixed number does not match", q);
          check(q.r >= 1 && q.r < q.d, "remainder out of range", q);
          check(q.n > q.d, "not an improper fraction", q); break;
        case "count": {
          check(q.seq.length === 4, "count needs four shown", q);
          check(q.nextN === q.seq[3] + 1, "next term is wrong", q);
          check(q.answer.w === Math.floor(q.nextN / q.d) && q.answer.n === q.nextN % q.d, "count answer is wrong", q);
          check(q.seq[0] <= q.d && q.nextN > q.d, "count does not cross one whole", q); break;
        }
        case "decimal":
          check(Math.abs(q.n / q.d - q.dec) < 1e-9, "decimal does not match the fraction", q); break;
        case "addsame":
          check(q.a + q.b <= q.d, "sum goes past one whole", q);
          check(q.a >= 1 && q.b >= 1, "adding a zero", q); break;
      }
      // prompts are rendered as HTML and read aloud: no unfilled slots, sensible length
      check(!!q.prompt && !/\{|\bundefined\b|NaN/.test(q.prompt), "bad prompt", q);
      check(q.prompt.replace(/<[^>]+>/g, "").length < 120, "prompt too long", q);
    }
  }
}
function sameValue(q, res) {
  return res.every((v, i) => {
    const a = q.shown[v], b = q.shown[q.answer[i]];
    return a.n * b.d === b.n * a.d;
  });
}

// every skill must actually appear, and each level's round must be on-level
const lvl6 = F.MIXES[6].every((k) => k === "shade");
if (!lvl6) fails.push("the shading drill contains something other than shading");
let sawImproper = false, sawGrid = false, sawBar = false;
for (let seed = 1; seed <= 200; seed++) {
  for (const q of F.makeRound(6, seed * 31)) {
    if (q.improper) sawImproper = true;
    if (q.shape === "grid") sawGrid = true;
    if (q.shape === "bar") sawBar = true;
  }
}
if (!sawImproper) fails.push("the shading drill never goes past one whole");
if (!sawGrid) fails.push("the shading drill never draws a grid");
if (!sawBar) fails.push("the shading drill never draws a bar");
const lvl3 = F.MIXES[3].every((k) => F.SKILLS[k].level === 3);
const lvl4 = F.MIXES[4].every((k) => F.SKILLS[k].level === 4);
if (!lvl3) fails.push("a Level 3 round contains a Level 4 skill");
if (!lvl4) fails.push("a Level 4 round contains a Level 3 skill");
for (const k of Object.keys(F.SKILLS)) if (!seen[k]) fails.push(`skill never generated: ${k}`);

console.log(`generated ${total} questions`);
console.log("per skill:", JSON.stringify(seen));
if (fails.length) {
  const uniq = [...new Set(fails.map((f) => f.split("  <-  ")[0]))];
  console.log(`\nFAILURES: ${fails.length} (${uniq.length} kinds)`);
  for (const k of uniq) {
    const eg = fails.find((f) => f.startsWith(k)).split("  <-  ")[1];
    console.log(" -", k, eg ? "\n     e.g. " + eg : "");
  }
  process.exit(1);
}
console.log("all fraction invariants hold");
