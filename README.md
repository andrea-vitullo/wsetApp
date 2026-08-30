# WSET Bible

A mock exam web app for the **WSET Level 2 Award in Wines** and the **WSET Level 3 Award in
Wines**, built on an original question dataset. The two levels are kept fully separate throughout.

## Running the app

```
open index.html
```

That's it — no server, no build step, no dependencies. The two question pools
(`wset-level-2.json`, `wset-level-3.json`) are embedded as plain JS globals in `js/data/`, so the
whole thing runs from the `file://` URL.

What it does:

- **Level select** — Level 2 (50 MCQ, 60 min) or Level 3 (full Unit 1 mock: 50 MCQ + 4 short
  written answers, 120 min; plus standalone MCQ-only and SWA-only practice modes).
- **Papers drawn at the official weighting** — each paper is sampled fresh from the whole pool at
  the exact per-Learning-Outcome weighting published in that level's `exam.lo_weighting`, with no
  repeated `topic|subtopic` concept in one sitting. See [js/sampler.js](js/sampler.js).
- **Timer** — counts down per mode and auto-submits at zero. The 120-minute "Full Unit 1 mock" is
  the official combined figure straight from the dataset; the standalone MCQ-only (60 min) and
  SWA-only (90 min) practice modes are labelled as pacing estimates, since WSET doesn't publish an
  official sub-split between the two parts.
- **Results** — MCQ is auto-scored against the 55% pass mark, broken down by Learning Outcome,
  with a full question review (each question's explanation, correct answer highlighted, your
  wrong pick struck through) and an "All / Mistakes only" filter. SWA is self-marked: your typed
  answer sits next to the published mark scheme for you to score.

Unlike the Python sampler described below, the app's draw is **not seeded** — every paper is a
fresh random draw, with no replay-by-seed.

## Why the questions are original

WSET does not release past papers, and the third-party mock banks that exist online are
copyrighted. Scraping them would produce a dataset that could not legally ship. Every question
here is written from scratch against the **published Learning Outcomes** in the official
specifications, which are the documents the real exams are set from. Facts about wine are not
copyrightable; someone else's phrasing of a question is.

## Exam shapes being modelled

| | Level 2 | Level 3 |
|---|---|---|
| Theory | 50 MCQ, 60 min | Unit 1 Part 1: 50 MCQ · Part 2: 4 × 25-mark short written answers, 2 hrs total |
| Pass mark | 55% | 55% on each part |
| Tasting | none | Unit 2, blind tasting of two wines (not modelled — needs real glassware) |

## Papers are drawn at runtime

Papers are drawn from the whole pool at the official LO weighting, so **batch files are just
authoring units** — they don't need to be complete papers themselves. What has to hold is that the
*pool* offers enough distinct material per Learning Outcome to fill every quota, every draw.

- **Level 2** — LO1: 5, LO2: 4, LO3: 19, LO4: 12, LO5: 6, LO6: 4
- **Level 3** — LO1: 8, LO2: 28, LO3: 5, LO4: 5, LO5: 4

Weightings and LO titles ship inline in each compiled file, under `exam.lo_weighting` and
`exam.lo_titles` in [wset-level-2.json](wset-level-2.json) / [wset-level-3.json](wset-level-3.json)
— that's what both the app and the Python sampler below read from.

### Two rules the sampler enforces

**No repeated concepts in one paper.** A naive random draw will eventually serve two questions
testing the same fact in a single sitting. Each question's `topic|subtopic` pair is its concept
key, and a paper takes at most one question per key. This is why those two fields must be filled
in consistently on every new question — they are load-bearing, not decoration.

**No unverified questions.** Anything carrying `review_flag: true` is excluded from draws, so a
fact awaiting human confirmation cannot reach a student. Verify and clear the flag to put it in
circulation.

The Python sampler referenced in Commands below draws papers reproducibly from a seed, which
matters for resuming an authoring session and for chasing down a question a user reports. The app's
in-browser sampler (`js/sampler.js`) implements the same weighting and no-repeated-concept rules
but does not take a seed — every mock is a fresh random draw.

## Layout

```
index.html                       mock exam app — open directly, no server needed
styles.css                       app styling
js/app.js                        exam flow: setup, timer, question rendering, results, self-marking
js/sampler.js                    draws a paper at the official LO weighting, no repeated concept per sitting
js/data/level2.js                wset-level-2.json embedded as window.WSET_DATA_2 (generated, see below)
js/data/level3.js                wset-level-3.json embedded as window.WSET_DATA_3 (generated, see below)
wset-level-2.json                compiled Level 2 question pool (505 MCQ)
wset-level-3.json                compiled Level 3 question pool (503 MCQ + 42 SWA)
authoring/swa-batch-003.jsonl    raw SWA authoring batches — already merged into wset-level-3.json,
authoring/swa-batch-004.jsonl    kept here for reference rather than the app
```

`js/data/level{2,3}.js` are generated from the compiled JSON files, not hand-edited — regenerate
them if the JSON changes:

```bash
python3 -c "
import json
for lvl in (2, 3):
    data = json.load(open(f'wset-level-{lvl}.json'))
    with open(f'js/data/level{lvl}.js', 'w') as out:
        out.write(f'window.WSET_DATA_{lvl} = ')
        json.dump(data, out, indent=2)
        out.write(';\n')
"
```

## Dataset authoring toolchain

The commands below describe the `wset_dataset` Python package that produced `wset-level-2.json`
and `wset-level-3.json` — QA, rebalancing, compiling from authoring batches, and drawing seeded
sample papers. **That toolchain is not part of this checkout**; only its compiled output ships
here, alongside the app that consumes it.

```bash
poetry install
poetry run python -m wset_dataset.validate            # QA checks
poetry run python -m wset_dataset.shuffle             # rebalance answer keys
poetry run python -m wset_dataset.build               # compile to build/
poetry run python -m wset_dataset.sample --level 3 --seed 42   # draw a mock paper
poetry run python -m wset_dataset.sample --level 2 --health    # pool depth per LO
poetry run python -m wset_dataset.lint                # authoring flaws, with fix detail
poetry run pytest                                     # 3,178 assertions over the data
```

`--health` is the one to watch while authoring. It reports, per Learning Outcome, how many
distinct concepts exist against the paper quota, and names the bottleneck LO to write next.

## Correctness controls

Hallucination is the main risk in a dataset like this, so accuracy is enforced in three ways.

1. **Scope discipline.** Questions only test material inside the published Learning Outcomes.
   Anything outside that scope is out of scope for the exam anyway.
2. **Per-question confidence.** Every record carries `confidence` and `review_flag`. Anything
   resting on a precise regulatory number (minimum ageing periods, permitted percentages, terms
   that are customary rather than legally defined) is flagged with a `review_note` naming what to
   check. Three records are flagged so far. The build reports the count; a human verifies against
   the current textbook before those go live.
3. **Automated QA.** `validate.py` checks schema conformance, duplicate IDs, duplicate stems,
   distinct options, banned distractors ("all of the above"), answer keys that exist, mark totals
   summing to 25, pool depth per Learning Outcome, and answer-key distribution. It also flags any
   question whose correct option is conspicuously longer than its distractors, since length is a
   tell a test-wise student will exploit.

That last check earned its keep immediately: the first draft put the correct answer at "b" in
41 of 50 Level 3 questions, which would have let a student pass by guessing. `shuffle.py` now
rebalances keys deterministically, and a test enforces that no key exceeds 40% of a batch.

## Status

| | MCQ | SWA | Target | Remaining |
|---|---|---|---|---|
| Level 2 | 505 | — | 500 | **met** |
| Level 3 | 503 | 42 | 500 MCQ + 40 SWA | **both met** |

**Zero questions remain flagged for review.** All 60 were resolved against the published
specifications rather than left pending.

57 questions test material that is factually correct but outside the published syllabus. These
**ship in the pool** and draw normally, tagged `in_scope: false` inline in the compiled JSON, so the
app could badge or filter them if that is ever wanted (it currently doesn't).

### What the verification pass actually found

The flagged set turned out to be the wrong set. Flags had been raised where the *facts* felt
uncertain, but the real defect was **syllabus scope** — and a systematic audit against the spec
found 22 unflagged Level 2 questions outside the published variety lists, against only 8 that
had been flagged there.

Level 2 LO4 names a closed list of 25 regionally important varieties. Questions on Verdejo,
Mencía, Monastrell, Nero d'Avola, Negroamaro, Aglianico, Assyrtiko, Grüner Veltliner,
Blaufränkisch, Touriga Nacional, Baga and Xinomavro were all sound wine knowledge and all
outside it. Level 3 fortified scope is Port, Sherry and fortified Muscats only, so the Madeira
questions went the same way, along with VOS/VORS, puttonyos, Einzellage/Grosslage, Cava tier
names, excise duty and a dozen regions absent from the LO2 range list.

`schema/syllabus_scope.json` (part of the authoring toolchain above, not this checkout) encodes
those closed lists, and three tests guard against out-of-scope material re-entering the pool.

### On what could and could not be verified

Most review notes asked to "check against the current textbook". The textbook is copyrighted and
not publicly available, so that specific check was not possible. Two substitutes did the job
better:

- **The specifications** (L2 Issue 2.1, April 2026; L3 Issue 2, 2022) publish the exact Learning
  Outcome ranges the exams are set from, which settles scope definitively. The L3 spec even
  publishes sample questions — one confirms Grolleau as the principal Rosé d'Anjou variety.
- **Primary regulatory sources** settle the facts. Port's fortifying spirit is legally 77% abv
  under IVDP regulation, confirming that question outright.

Where neither source could settle a claim, the question was rewritten to test something the spec
does cover rather than left in place: Crémant d'Alsace now tests production method rather than
its unlisted variety list, Rutherglen tests oxidative maturation rather than unlisted tier names,
and the Waipara question now uses Canterbury, which the spec names.

## Short written answers

The specification revealed something that changes how these are built: **the four questions on a
paper are not interchangeable.** Each occupies a fixed slot with a defined assessment mix.

| Slot | Assesses | Mark split |
|---|---|---|
| Q1 | LO1 & LO2 | 25 on LO2 |
| Q2 | LO1 & LO2 | 25 on LO2 |
| Q3 | LO1, LO2 & LO5 | 20 LO2 + 5 LO5 |
| Q4 | LO1, LO3, LO4 & LO5 | 20 sparkling/fortified + 5 LO5 |

That totals LO2 70, LO3/LO4 20, LO5 10 — matching the published weighting exactly. LO1 is
assessed inside all four rather than as a question of its own.

**The consequence: a paper needs one question from each slot, so coverage is limited by the
thinnest slot, not the total.** 42 questions now assemble **10 complete papers** — slot 1: 10,
slot 2: 10, slot 3: 11, slot 4: 10.

```bash
poetry run python -m wset_dataset.sample --swa --health    # slot coverage (authoring toolchain, not this checkout)
poetry run python -m wset_dataset.sample --swa --seed 3    # assemble a 100-mark paper
```

The app's "Short written answer practice" and "Full Unit 1 mock" modes assemble a paper the same
way: one random question per slot, via `assembleSwaPaper()` in [js/sampler.js](js/sampler.js).

One question, `L3-SWA-0005`, is marked as revision-only: it puts 25 marks on storage, service
and faults, but LO5 carries just 10 marks per paper and is limited to making recommendations, so
it could never appear on a real paper. It has no `paper_slot`, so both the Python sampler and the
app's `assembleSwaPaper()` naturally exclude it from paper assembly — it's kept for practice.

### Coverage

Every region and style carrying significant weight in the LO2 range now has an SWA question:
Bordeaux, Burgundy (twice, red and white), Rhône, Alsace, Loire, Beaujolais, southern France,
Germany, Austria, Tuscany, Veneto, Piemonte, Rioja, the Duero and north-west Spain, Portugal,
Napa, the Pacific North West, Chile, Argentina, South Africa, Australia (warm and cool) and New
Zealand. Slot 4 covers Champagne, Cava, Crémant, Prosecco, Asti, Cap Classique, Port across its
styles, Sherry biological and oxidative, and both fortified Muscats.

## Next batches

Topic coverage still to be written, tracked so batches don't repeat each other:

With every LO past 4.0, the remaining work is bulk rather than gap-filling. Both levels need
roughly 290 more MCQs to reach the 500 target, which is about six more batches per level.

The MCQ pool is complete. Remaining work, in priority order:

Both targets are met. The dataset assembles 10 full Level 3 short written answer papers and
draws MCQ papers at both levels at the official weighting.

Natural next steps, none of them blocking:
- More SWA depth per slot, if 10 papers proves too few in use.
- A Level 3 tasting component (Unit 2), which this dataset does not attempt — it needs real
  wine in a glass, not question data.

### The recurring authoring trap, now automated

Four batches running, the same flaw appeared: the correct option ended up much longer than its
distractors, letting a test-wise student pick the longest answer and beat the paper without
knowing the material. It happens because the correct answer is the one the author knows most
about and writes first, so it accumulates qualifying detail.

`lint.py` now catches it and prints what `validate` cannot — the target length and every
distractor that needs padding, so the fix is mechanical rather than a hunt. It also catches stems
too terse to stand alone in an app ("Flor is", "Monbazillac produces"). Both rules are locked
into the test suite, so a batch carrying either flaw fails CI rather than shipping.

Run `lint` after writing a batch, before `validate`.

**The cheaper fix is upstream.** Batch 006 was written keeping all four option lengths roughly
even from the start, and produced zero length tells against thirteen in batch 005. Balancing as
you write costs nothing; patching afterwards costs a full inspect-and-rewrite pass per question.
- **L3 SWA** — mark weighting is LO2 70, LO3/LO4 20, LO5 10 per paper. Current three lean on
  LO2 and LO3; the set needs more LO5 service and food-pairing parts.

Priority order is set by variety ratio rather than raw count, which `--health` reports directly.
Writing 30 more LO2 questions when LO1 is the bottleneck does not make papers feel any fresher.
