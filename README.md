# Grapheme Spelling Test

Turns a spelling test into a sound-by-sound picture of what each student can and
cannot encode — including nonsense words.

You type in the words you dictated and what each student actually wrote. The app
works out the sounds in each target word, works out what the student's letters
would sound like read aloud, lines the two up, and tells you which *sounds* went
wrong rather than only which words did.

**It runs as a single file with no installation, no server, and no internet
connection.** Student names and spellings never leave the computer.  You can save and load students and tests via a json file that contains all the information you entered.

A version of this is deployed to github pages at
<https://fcollman.github.io/grapheme_spelling_test/> with the latest compiled version of the code.

---

## For teachers: using it

1. Open `index.html` by double-clicking it. That is the whole setup. The
   **Help** button in the toolbar has a walk-through of every tab with
   screenshots, which is a gentler start than the rest of this file.

   **Just want a look first?** Press **Load demo class** at the top. It fills the
   app with a made-up class of eight tested every two weeks for six months, so
   every report has something in it. The students are written to show different
   things: one at ceiling, one improving fast, one working steadily with no
   movement, one who can hear vowels but not consonant teams, and one who misses
   sessions. **Clear data** empties everything again. Both ask first if you have
   real data, because nothing is stored anywhere but this browser.

2. **Spelling test** tab — add your words and your students, then type what each
   student wrote. Tick "nonsense" for made-up words. Cells turn green when the
   spelling matches exactly. With a full class the grid scrolls sideways, but the
   word and nonsense columns stay pinned so you can always see what was dictated.

   Your class is shared across tests, so a new test already starts with everyone
   on it. Removing a student or a word asks first if there are spellings behind
   it, and says how many. A removed student's answers are kept, so **Add from an
   earlier test** puts them back with their old work and its analysis intact —
   the button only appears when there is someone to restore.

   **Delete test** in the toolbar removes the test on screen. It confirms first
   when there is anything on it, and deletes outright — a test has nowhere else
   for its data to live, so nothing is kept back the way a student's answers are.
   Deleting the only test leaves a fresh empty one behind.
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

**Per student** — for IEP meetings and parent conferences:

4. **Student profile** — one page about one student instead of the whole class:
   what is secure, what needs work, and the errors quoted with the word they came
   from (*wrote “s” for `sh` in **ship***). Sound errors and spelling-only errors
   are listed separately, because they need different teaching. Choosing "All
   students" prints one page per student. A category counts as secure at **80%**,
   the threshold usually used to decide something still needs teaching.

   **Pick which tests it covers.** Click test chips to add or remove them, or use
   **Select all**, **Last 3**, **First 3** and **Most recent**. Everything on the
   page pools across whatever is selected, so the same page serves a single
   lesson's test, a "how is it going now" conversation, or a whole term for an
   annual review. With one test selected you get the full word list; with several
   you get a test-by-test score table instead, since a term's worth of words would
   run to a hundred rows and bury the analysis.
5. **Progress over time** — accuracy on each test, oldest first, so growth on an
   IEP goal can be shown rather than a single snapshot. By category by default
   (a category recurs across tests; an individual spelling may not), with a
   breakdown by spelling available. A **dash means that category was not on that
   test** — it is not a zero and does not count against anyone.

**By spelling** — what the student actually wrote:

6. **Accuracy by grapheme** — how often each unit was spelled right, grouped
   under the phonics categories so a whole category reads at a glance. Patterns
   that span several columns, like the `dw` in *dwell*, get their own row too and
   count as right only when every column they cover is right.
7. **Grapheme confusion** — which spelling was written where another was needed:
   `k` for `ck`, `kw` for `qu`, `tle` for `ttle`. This is where orthographic error
   patterns show up most directly.

**By sound** — what the student heard and encoded, independent of spelling choice:

8. **Accuracy by phoneme** — how many times each student got each sound right,
   with a whole-class column to show what needs reteaching to everybody.
9. **Phoneme misuse** — how often a student reached for a sound that was not the
   one needed. A big number usually means a default they fall back on.
10. **Phoneme confusion** — which sound got written for which. The green diagonal
    is correct; everything off it is a specific swap to teach against.

**Every report tab has the test picker.** Reports start on the test chosen in the
toolbar and follow it when you switch, so they behave as before until you widen
them — then **Select all**, **Last 3** or individual chips pool the results across
whatever you pick. Print titles, CSV names and the drill-downs all follow the
selection. The student profile is the one exception: it starts from every test,
since a profile is meant to be the whole picture.

**Click any accuracy figure** to open the answers behind it — which words, which
students, what they wrote for that one unit, and whether each counted. The list is
produced by walking the same answers the report counted, so it always adds up to
the number you clicked. Escape or **Close** dismisses it, and it exports to CSV too.

Every tab has **Download CSV** and **Print / Save PDF**.

**Hide student names** at the top swaps every name for "Student 1", "Student 2" …
everywhere at once, including printouts and CSVs, so you can show one family where
their child sits relative to the class without showing them the rest of the class.
It is display only — the real names come straight back when you switch it off.

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
npm run dev            # development server
npm test               # engine test suite
npm run build          # produces dist/index.html — the single deliverable
npm run check:single   # asserts the build is one self-contained file
npm run reference      # regenerates PHONEME-CATEGORIES.md from the data files
```

### Editing the Help section

The **Help** button in the toolbar opens a how-to guide followed by the About
page. All of it is Markdown under [`content/`](content/), so it can be edited and
committed without touching any code; pushing to `main` rebuilds and republishes
it.

| File | Becomes |
|---|---|
| `content/help/NN-name.md` | One numbered section of the guide |
| `content/help/images/*.webp` | The screenshots those sections show |
| `content/about.md` | The **About this tool** entry at the end |

Each file's first `# heading` is its label in the sidebar, and the numeric
filename prefix sets the reading order — adding `10-something.md` adds a section,
with no code change. Headings, lists, tables, block quotes, links, `code` and
emphasis all render; HTML comments stay hidden.

Screenshots are written as `![caption](images/name.webp)`. The alt text becomes
the visible caption. A reference with no matching file is dropped rather than
left in place: leaving it would emit a real `<img src="images/…">`, which cannot
load from `file://` and would fail the single-file check.

Everything is inlined into the bundle at build time — the Markdown through Vite's
`?raw` import, the screenshots as `data:` URIs — rather than fetched at runtime,
because a runtime fetch would break the double-click-the-file guarantee. The
pictures are why `dist/index.html` is around 2.3MB rather than 1.6MB.

### Deployment

Pushing to `main` builds and publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

**https://fcollman.github.io/grapheme_spelling_test/**

Pull requests run the same build and tests but do not deploy; they attach the
built `index.html` as a downloadable artifact instead.

Before publishing, the workflow gates on four things:

| Gate | Why |
|---|---|
| `tsc --noEmit` | Type errors |
| `npm test` | The engine suite, including every example word in the phonics tables |
| Reference is current | Fails if `PHONEME-CATEGORIES.md` drifts from the data files |
| `npm run check:single` | **The important one.** Fails if `dist/` is more than one file or `index.html` references anything external |

That last check guards the property the project rests on. If a future change emits
a separate asset, the hosted site would still work while the double-click-the-file
use case silently broke — and it would only break for the teacher, never on a dev
server. This turns that into a build failure.

Hosting the app publicly does not expose any student data: everything stays in the
browser's local storage on the teacher's own machine, and the page makes no network
requests at all after loading. The Pages site is just a convenient way to get the
file — "Save Page As" gives the same standalone `index.html` that works offline.

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
| `state/useAnalysis.ts` | `analyzeTest` for one test; `useAllTests` for the progress report |
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
