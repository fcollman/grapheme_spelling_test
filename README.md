# Phoneme Analyzer

Turns a spelling test into a sound-by-sound picture of what each student can and
cannot encode — including nonsense words.

You type in the words you dictated and what each student actually wrote. The app
works out the sounds in each target word, works out what the student's letters
would sound like read aloud, lines the two up, and tells you which *sounds* went
wrong rather than only which words did.

**It runs as a single file with no installation, no server, and no internet
connection.** Student names and spellings never leave the computer.

---

## For teachers: using it

1. Open `index.html` by double-clicking it. That is the whole setup.
2. **Spelling test** tab — add your words and your students, then type what each
   student wrote. Tick "nonsense" for made-up words. Cells turn green when the
   spelling matches exactly.
3. **Grapheme analysis** tab — the marking grid. Each column is one spelling unit
   of the target word, with the sound or sounds it makes underneath:

   | Word | Columns |
   |---|---|
   | ship | `sh` `i` `p` |
   | box | `b` `o` `x` — one column making /k/ + /s/ |
   | bank | `b` `ank` — the velar nasal unit is taught whole, so it is one column |
   | little | `l` `i` `ttle` — consonant-le is one column |
   | splash | `s` `p` `l` `a` `sh` — a blend stays separate, tagged across the columns, so you can see *which* sound was missed |

   Each cell is coloured:

   | Colour | Meaning |
   |---|---|
   | Green | Right sound, spelled the way the word spells it |
   | Amber | Right sound, spelled a different legal way (`kat` for `cat`) |
   | Red | Wrong sound |
   | Grey | Left out |

   Every column is tagged with what kind of unit it is (consonant digraph, short
   vowel, r-controlled…). Use the **Pattern** menu to show only the words
   containing one kind, and **Order → Grouped by kind** to bring them together.
   Click any cell to correct it; **Edit breakdown** fixes a word's sounds once for
   the whole class.

   The full list of what counts as what is in
   [PHONEME-CATEGORIES.md](PHONEME-CATEGORIES.md).

### Reports

**By spelling** — what the student actually wrote:

4. **Accuracy by grapheme** — how often each unit was spelled right, grouped
   under the phonics categories so a whole category reads at a glance. Patterns
   that span several columns, like the `dw` in *dwell*, get their own row too and
   count as right only when every column they cover is right.
5. **Grapheme confusion** — which spelling was written where another was needed:
   `k` for `ck`, `kw` for `qu`, `tle` for `ttle`. This is where orthographic error
   patterns show up most directly.

**By sound** — what the student heard and encoded, independent of spelling choice:

6. **Accuracy by phoneme** — how many times each student got each sound right,
   with a whole-class column to show what needs reteaching to everybody.
7. **Phoneme misuse** — how often a student reached for a sound that was not the
   one needed. A big number usually means a default they fall back on.
8. **Phoneme confusion** — which sound got written for which. The green diagonal
   is correct; everything off it is a specific swap to teach against.

Every tab has **Download CSV** and **Print / Save PDF**.

### Saving your work

Your data saves automatically in the browser you opened the file in. That is
convenient but not durable — clearing browsing data will erase it. Use **Save
file** to keep a `.json` copy, and **Open file** to load it back or move it to
another computer.

### Things worth knowing

- **Amber is not failure.** A student who writes `fone` for `phone` has the
  sounds right and the spelling convention wrong. Those need different teaching,
  which is why they are coloured differently. The accuracy report has a setting
  for whether amber should count as correct.
- **Check the breakdown on unusual words.** The engine is good but not perfect,
  especially on names and rare words. Fixing a word once applies to every student.
- **Schwa.** Unstressed vowels get reduced to /ə/ in ordinary speech, so `tablet`
  ends in a schwa, not a short /e/. By default any unstressed vowel is accepted
  for a schwa. Turn that off on the analysis tab if you want stricter marking.
- **Browser support.** Tested in Chrome. It should also work in Edge, Safari
  16.4+ and Firefox 113+, which are the versions that support the decompression
  the embedded engine needs, but those have not been tested.

---

## For developers

```bash
npm install
npm run dev      # development server
npm test         # engine test suite
npm run build    # produces dist/index.html — the single deliverable
```

### How it works

`dist/index.html` is one self-contained file, because Chrome blocks `fetch`, ES
modules and JSON loading over `file://` — anything split across files would
silently force the teacher to run a web server. `vite-plugin-singlefile` inlines
all JS, CSS and the engine, and no runtime code fetches anything.

The grapheme-to-phoneme engine is **eSpeak NG compiled to run in the browser**,
via the [`phonemizer`](https://github.com/xenova/phonemizer.js) package: one
1.3MB dependency-free bundle whose voice data is embedded as a gzip string, so
there is no separate `.wasm` request. It handles nonsense words through
letter-to-sound rules and irregular real words (`said`, `one`, `though`) through
its own dictionary.

| Module | Responsibility |
|---|---|
| `engine/phonemize.ts` | eSpeak wrapper, batching, memoisation |
| `engine/normalize.ts` | eSpeak's run-together IPA → the 45-phoneme display inventory |
| `engine/fallback.ts` | Detects and repairs eSpeak reading letters aloud |
| `engine/segment.ts` | Splits a spelling into one letter-chunk per phoneme |
| `engine/syllabify.ts` | Maximal onset, with short vowels forced closed |
| `engine/align.ts` | Feature-weighted alignment of attempt to target |
| `engine/patterns.ts` | Finds phonics patterns (blends, velar nasal units, consonant-le) |
| `engine/units.ts` | Groups sounds into the grapheme units the teacher marks |
| `reports/aggregate.ts` | Rolls cells up into the five report shapes |

**Note:** eSpeak returns a flat phoneme string with no letter offsets, and
phonemizing prefixes does not help (`cake` → /kāk/ but `cak` → /kak/, because the
silent `e` retroactively changes the vowel). `segment.ts` recovers the alignment
instead, which is tractable because it already knows both the spelling and the
pronunciation — segmentation rather than prediction.

### The phonics taxonomy

`src/data/categories.ts` and `src/data/patterns.ts` hold the editable record of
every digraph spelling, multi-sound grapheme and multi-sound pattern, and which
category each falls in. `npm run reference` regenerates
[PHONEME-CATEGORIES.md](PHONEME-CATEGORIES.md) from them, and the test suite
checks every example word in those tables against the real engine — so a wrong
entry fails the tests rather than quietly mis-tagging student work.

Three eSpeak behaviours needed explicit handling, each found by testing the
engine rather than reading docs:

- **American flapping** — `water` → `wˈɔːɾɚ`. The flap is folded to /t/. It also
  flaps intervocalic /d/, so a `ladder`/`latter` contrast is invisible there.
- **Split r-controlled vowels** — `car` → `kˈɑːɹ`, merged to /ar/ only when the
  /r/ closes the syllable, so `spirit` keeps its /r/.
- **Letter-name spell-out** — eSpeak reads unpronounceable strings as letter
  names, so `splsh` came back as "ess-pee-ell-ess-aitch". Since dropping vowels
  is a common spelling error, this is detected exactly (by predicting the
  letter-name reading and comparing) and replaced with a grapheme reading.

### Licence

GPLv3, because the embedded eSpeak NG engine is GPLv3. See `LICENSE` and
`NOTICE`.
