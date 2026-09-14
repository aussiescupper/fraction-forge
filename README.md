# Fraction Forge ⚒️

Fractions from **Level 3 to Level 4**, so Henry walks into Grade 4 ready.

One idea runs through the whole app: a fraction is an **ingot cut into equal parts**.
Every skill is that same bar seen another way — shading it, matching two of them on
the fraction wall, laying them end to end past one whole, or reading the forge scale
in decimals.

## The ladder

**Level 3** — *what a fraction IS* (VC2M3N01: unit fractions 1/2, 1/3, 1/4, 1/5, 1/10
and their multiples, shown in different ways; combining same-denominator fractions
to complete the whole)

| skill | question |
|---|---|
| Equal parts | is this cut into EQUAL parts? — the rule everything rests on |
| Naming a fraction | what fraction is shaded? |
| Showing a fraction | shade 3/5 of the ingot |
| Making one whole | 2/5 done — how much more makes one whole? |
| Fraction of a number | 1/4 of 12, and multiples like 3/4 of 12 |

**Level 4** — *ready for Grade 4* (VC2M4N02/N03: equivalent fractions with related
denominators, connections to decimal notation, counting by halves/quarters/thirds
including mixed numerals)

| skill | question |
|---|---|
| Equivalent fractions | 1/2 = ?/8, on the fraction wall |
| Comparing fractions | which is bigger, 2/3 or 3/4? |
| Ordering fractions | put three in order, smallest first |
| Mixed numbers | 7/4 = 1 and 3/4, and back again |
| Counting in fractions | carry on: 3/4, 1, 1 and 1/4… |
| Fractions as decimals | 3/4 = 0.75, and hundredths |
| Adding fractions | 1/5 + 3/5, same bottom number |

**Readiness check** interleaves both levels — that is the one to use before a test.

## Lessons
- **What IS a fraction?** — equal parts, the bottom number, the top number, and the
  one rule (unequal pieces do not get fraction names). Gates the first round.
- **The CUBES strategy** — the tutor's routine for word problems, marked up one
  letter at a time on a worked example: Circle the numbers, Underline the question,
  Box the key words, Eliminate extra information / Evaluate what steps to take,
  Solve and check.

Both lessons have a **Read it** button (the iPad's own voice) so reading load never
blocks the maths.

## Readiness board
Every skill tracks first-go accuracy. Green needs at least 5 tries and 80%. This is
the parent-facing answer to "is he ready for Grade 4?" — and it says which skill to
work on next, not just a score.

## Developing
- `node test.js` — generates 12,000 questions, checks the maths on every one, and
  asserts each checker accepts the right answer and rejects a near miss. Run before
  every deploy.
- `../bump.sh fraction-forge` — bumps `version.js`, which the footer and the
  service-worker cache name both read.
- `print.html?level=4` — ten questions as a pencil worksheet. Tests are on paper.

Deployed to <https://trawleylab.github.io/fraction-forge/>.
