# Phoneme and pattern categories

<!-- GENERATED FILE — do not edit by hand. -->
<!-- Source: src/data/categories.ts and src/data/patterns.ts. Regenerate with: npm run reference -->

This is the complete record of how Grapheme Spelling Test classifies every sound and
every multi-sound pattern. It is generated from the data the app actually uses,
so what you read here is what the app does.

**To change something:** edit `src/data/categories.ts` (which category each vowel
belongs to) or `src/data/patterns.ts` (digraph spellings and multi-sound
patterns), then run `npm run reference`. The test suite checks every example word
below against the real pronunciation engine, so a wrong entry fails the tests
rather than quietly mis-tagging student work.

Jump to: [Categories](#categories) · [Every sound](#every-sound-and-its-category) ·
[Consonant digraphs](#consonant-digraphs) · [Multi-sound patterns](#multi-sound-patterns) ·
[Red words](#red-words) ·
[Needs your review](#needs-your-review)

## Categories

Two different things get categorised, and the distinction matters:

- **Per sound** — applies to one sound in a word. Some depend on spelling: /sh/
  in *ship* is a digraph; /k/ is a plain consonant in *cat* but a digraph in *duck*.
- **Per run of sounds** — a separate layer, covering several sounds that are
  taught as one unit. "-ank" in *bank* is /a/ + /ng/ + /k/: three sounds, one unit.

Tags overlap on purpose. In *thrunk*, the /ng/ and /k/ belong to both the "-unk"
velar nasal unit and the "-nk" ending blend.

| Category | Applies to | One column? | What it covers |
| --- | --- | --- | --- |
| **Consonant** | one sound | — | A single consonant sound spelled with one letter, or a doubled letter (bb, ll, ss). |
| **Consonant digraph** | one sound | — | Two or more letters making ONE consonant sound: sh, ch, th, wh, ph, ck, ng, plus trigraphs (tch, dge) and silent-letter teams (kn, wr, gn, mb). |
| **Short vowel** | one sound | — | The five short vowel sounds: /a/ cat, /e/ bed, /i/ sit, /o/ hot, /u/ cup. |
| **Long vowel** | one sound | — | The vowel says its name: /ā/ cake, /ē/ feet, /ī/ bike, /ō/ boat. |
| **Other vowel** | one sound | — | Vowel sounds that are neither short nor long nor diphthongs: /oo/ moon, /ŏŏ/ book, /aw/ saw. |
| **Diphthong** | one sound | — | The mouth glides from one vowel to another: /ow/ cow, /oy/ boy. |
| **R-controlled (bossy R)** | one sound | — | The /r/ takes over the vowel: /ar/ car, /or/ for, /er/ her, /air/ chair, /eer/ deer, /oor/ cure. |
| **Schwa** | one sound | — | The lazy unstressed vowel /ə/ in about, tablet, pencil. Any vowel letter can spell it. |
| **Beginning blend** | a run of sounds | no — tag across columns | Two or three consonant sounds together at the start of a syllable, each one still heard: bl, str, thr. |
| **Ending blend** | a run of sounds | no — tag across columns | Two or more consonant sounds together at the end of a syllable: -nd, -mp, -st, -xt. |
| **Velar nasal unit** | a run of sounds | yes — marked as a chunk | The vowel changes before /ng/, so these are taught whole rather than sounded out: -ang, -ing, -ong, -ung, -ank, -ink, -onk, -unk. |
| **Kind / old word** | a run of sounds | no — tag across columns | The vowel goes long even though the syllable looks closed: -ind, -ild, -old, -olt, -ost, -oll. |
| **Consonant-le** | a run of sounds | yes — marked as a chunk | A final stable syllable of consonant + le: -ble, -cle, -dle, -fle, -gle, -kle, -ple, -tle, -zle. |
| **Red word (irregular)** | one sound | — | Letters making a sound they do not usually make, so the word has to be remembered rather than sounded out: the ai in said, the eir in their, the o in come. |

### What becomes one column in the marking grid

The grid is marked per **spelling unit**, not per sound. A unit is normally one
grapheme, but two things change that:

- A category marked "yes" above collapses into a single column, because it is
  taught as a chunk rather than sounded out. Currently that is:
  **Velar nasal unit** and **Consonant-le**.
- A single grapheme that makes more than one sound is one column carrying both
  (see the next section).

Blends stay as separate columns with a tag across them, so you can still see
which sound of a blend a student missed. To change what collapses, edit
`COLLAPSING_CATEGORIES` in `src/data/categories.ts`.

**Not having a column does not mean not being reported.** A pattern that spans
several columns still gets its own row in *Accuracy by grapheme* and *Grapheme
confusion*, counted right only when every column it covers is right. So "dw" in
*dwell* is marked as `d` and `w` separately in the grid, and also reported as one
`dw` row under Beginning blend.

## One grapheme, several sounds

These letter teams make two sounds, so they appear as one column carrying both.
Without them the grid would show a blank column for the first sound.

| Spelling | Sounds | Example | Note |
| --- | --- | --- | --- |
| `x` | /k/ + /s/ | box |  |
| `x` | /g/ + /z/ | exam | The voiced reading of x, as in exam and exact. |
| `qu` | /k/ + /w/ | quick |  |
| `u` | /y/ + /oo/ | music | The "long u" that really says /y/ + /oo/. |
| `u_e` | /y/ + /oo/ | cube |  |
| `ew` | /y/ + /oo/ | few |  |
| `ue` | /y/ + /oo/ | cue |  |
| `eu` | /y/ + /oo/ | feud |  |

## Every sound and its category

All 45 sounds the app recognises. Consonants are listed as plain consonants here;
any of them becomes a **consonant digraph** when spelled with a letter team, which
is decided per word from the spelling (see the next section).

### Consonants

| Sound | IPA | As in |
| --- | --- | --- |
| /p/ | /p/ | pig |
| /b/ | /b/ | bat |
| /t/ | /t/ | top |
| /d/ | /d/ | dog |
| /k/ | /k/ | cat |
| /g/ | /ɡ/ | go |
| /f/ | /f/ | fan |
| /v/ | /v/ | van |
| /th/ | /θ/ | thin |
| /th/ | /ð/ | this |
| /s/ | /s/ | sun |
| /z/ | /z/ | zip |
| /sh/ | /ʃ/ | ship |
| /zh/ | /ʒ/ | measure |
| /h/ | /h/ | hat |
| /ch/ | /tʃ/ | chip |
| /j/ | /dʒ/ | jam |
| /m/ | /m/ | man |
| /n/ | /n/ | net |
| /ng/ | /ŋ/ | ring |
| /l/ | /l/ | lip |
| /r/ | /ɹ/ | run |
| /w/ | /w/ | win |
| /y/ | /j/ | yes |

> Two consonants share the label /th/: the one in **thin** (unvoiced) and the one
> in **this** (voiced). The app keeps them apart internally and always shows the
> key word when you have to choose between them.

### Short vowel

The five short vowel sounds: /a/ cat, /e/ bed, /i/ sit, /o/ hot, /u/ cup.

| Sound | IPA | As in |
| --- | --- | --- |
| /a/ | /æ/ | cat |
| /e/ | /ɛ/ | bed |
| /i/ | /ɪ/ | sit |
| /o/ | /ɑ/ | hot |
| /u/ | /ʌ/ | cup |

### Long vowel

The vowel says its name: /ā/ cake, /ē/ feet, /ī/ bike, /ō/ boat.

| Sound | IPA | As in |
| --- | --- | --- |
| /ā/ | /eɪ/ | cake |
| /ē/ | /i/ | feet |
| /ī/ | /aɪ/ | bike |
| /ō/ | /oʊ/ | boat |

### Other vowel

Vowel sounds that are neither short nor long nor diphthongs: /oo/ moon, /ŏŏ/ book, /aw/ saw.

| Sound | IPA | As in |
| --- | --- | --- |
| /oo/ | /u/ | moon |
| /ŏŏ/ | /ʊ/ | book |
| /aw/ | /ɔ/ | saw |

### Diphthong

The mouth glides from one vowel to another: /ow/ cow, /oy/ boy.

| Sound | IPA | As in |
| --- | --- | --- |
| /ow/ | /aʊ/ | cow |
| /oy/ | /ɔɪ/ | boy |

### R-controlled (bossy R)

The /r/ takes over the vowel: /ar/ car, /or/ for, /er/ her, /air/ chair, /eer/ deer, /oor/ cure.

| Sound | IPA | As in |
| --- | --- | --- |
| /ar/ | /ɑɹ/ | car |
| /or/ | /ɔɹ/ | for |
| /er/ | /ɜɹ/ | her |
| /air/ | /ɛɹ/ | chair |
| /eer/ | /ɪɹ/ | deer |
| /oor/ | /ʊɹ/ | cure |

### Schwa

The lazy unstressed vowel /ə/ in about, tablet, pencil. Any vowel letter can spell it.

| Sound | IPA | As in |
| --- | --- | --- |
| /ə/ | /ə/ | about |

## Consonant digraphs

All of these are tagged **Consonant digraph**. They are grouped by kind below so
you can split them into separate categories if your scope and sequence does.

### Digraph — two letters, one sound

| Spelling | Sound | Example | Note |
| --- | --- | --- | --- |
| `sh` | /sh/ · /ʃ/ | ship |  |
| `ch` | /ch/ · /tʃ/ | chip |  |
| `ch` | /k/ · /k/ | school |  |
| `ch` | /sh/ · /ʃ/ | chef |  |
| `th` | /th/ · /θ/ | thin |  |
| `th` | /th/ · /ð/ | this |  |
| `wh` | /w/ · /w/ | when |  |
| `wh` | /h/ · /h/ | who |  |
| `ph` | /f/ · /f/ | phone |  |
| `ck` | /k/ · /k/ | duck |  |
| `ng` | /ng/ · /ŋ/ | ring |  |
| `gh` | /f/ · /f/ | laugh |  |

### Trigraph — three letters, one sound

| Spelling | Sound | Example | Note |
| --- | --- | --- | --- |
| `tch` | /ch/ · /tʃ/ | catch |  |
| `dge` | /j/ · /dʒ/ | bridge |  |

### Silent-letter team — one letter is silent

| Spelling | Sound | Example | Note |
| --- | --- | --- | --- |
| `kn` | /n/ · /n/ | knee |  |
| `gn` | /n/ · /n/ | gnat |  |
| `wr` | /r/ · /ɹ/ | wrist |  |
| `mb` | /m/ · /m/ | thumb |  |
| `mn` | /m/ · /m/ | column |  |
| `lk` | /k/ · /k/ | walk |  |
| `lf` | /f/ · /f/ | half |  |
| `lm` | /m/ · /m/ | calm |  |
| `ps` | /s/ · /s/ | psalm |  |
| `bt` | /t/ · /t/ | debt |  |
| `st` | /s/ · /s/ | listen |  |

### Advanced /sh/ and /zh/ spelling

| Spelling | Sound | Example | Note |
| --- | --- | --- | --- |
| `ti` | /sh/ · /ʃ/ | nation | Usually taught as a suffix spelling (-tion), not as a consonant digraph. |
| `ci` | /sh/ · /ʃ/ | special | Usually taught as a suffix spelling (-cial), not as a consonant digraph. |
| `si` | /zh/ · /ʒ/ | vision | Usually taught as a suffix spelling (-sion), not as a consonant digraph. |
| `ssi` | /sh/ · /ʃ/ | mission | Usually taught as a suffix spelling (-ssion), not as a consonant digraph. |

> A doubled letter (`bb`, `ll`, `ss`) is **not** treated as a digraph — it is a
> plain consonant. Say if you want those tagged separately as a floss-rule group.

## Multi-sound patterns

Each of these spans more than one sound. The **Sounds** column is what the app
matches on; the **Spellings** column is what it looks like on paper.

### Beginning blend

Two or three consonant sounds together at the start of a syllable, each one still heard: bl, str, thr.

| Pattern | Sounds | Spellings | Where | Example | Note |
| --- | --- | --- | --- | --- | --- |
| **bl** | /b/ + /l/ | `bl` | start of a syllable | black |  |
| **cl / kl** | /k/ + /l/ | `cl`, `kl` | start of a syllable | clap |  |
| **fl** | /f/ + /l/ | `fl` | start of a syllable | flag |  |
| **gl** | /g/ + /l/ | `gl` | start of a syllable | glad |  |
| **pl** | /p/ + /l/ | `pl` | start of a syllable | plan |  |
| **sl** | /s/ + /l/ | `sl` | start of a syllable | slip |  |
| **br** | /b/ + /r/ | `br` | start of a syllable | brag |  |
| **cr / kr** | /k/ + /r/ | `cr`, `kr` | start of a syllable | crab |  |
| **dr** | /d/ + /r/ | `dr` | start of a syllable | drum |  |
| **fr** | /f/ + /r/ | `fr` | start of a syllable | frog |  |
| **gr** | /g/ + /r/ | `gr` | start of a syllable | grab |  |
| **pr** | /p/ + /r/ | `pr` | start of a syllable | prop |  |
| **tr** | /t/ + /r/ | `tr` | start of a syllable | trip |  |
| **sc / sk** | /s/ + /k/ | `sc`, `sk` | start of a syllable | skip |  |
| **sm** | /s/ + /m/ | `sm` | start of a syllable | smell |  |
| **sn** | /s/ + /n/ | `sn` | start of a syllable | snap |  |
| **sp** | /s/ + /p/ | `sp` | start of a syllable | spin |  |
| **st** | /s/ + /t/ | `st` | start of a syllable | stop |  |
| **sw** | /s/ + /w/ | `sw` | start of a syllable | swim |  |
| **tw** | /t/ + /w/ | `tw` | start of a syllable | twin |  |
| **dw** | /d/ + /w/ | `dw` | start of a syllable | dwell |  |
| **qu** | /k/ + /w/ | `qu` | start of a syllable | quick |  |
| **shr** | /sh/ + /r/ | `shr` | start of a syllable | shrub |  |
| **thr** | /th/ + /r/ | `thr` | start of a syllable | three |  |
| **scr** | /s/ + /k/ + /r/ | `scr` | start of a syllable | scrap |  |
| **spl** | /s/ + /p/ + /l/ | `spl` | start of a syllable | splash |  |
| **spr** | /s/ + /p/ + /r/ | `spr` | start of a syllable | spring |  |
| **str** | /s/ + /t/ + /r/ | `str` | start of a syllable | strap |  |
| **squ** | /s/ + /k/ + /w/ | `squ` | start of a syllable | squish |  |

### Ending blend

Two or more consonant sounds together at the end of a syllable: -nd, -mp, -st, -xt.

| Pattern | Sounds | Spellings | Where | Example | Note |
| --- | --- | --- | --- | --- | --- |
| **-ct** | /k/ + /t/ | `ct` | end of a syllable | act |  |
| **-ft** | /f/ + /t/ | `ft` | end of a syllable | left |  |
| **-ld** | /l/ + /d/ | `ld` | end of a syllable | held |  |
| **-lf** | /l/ + /f/ | `lf` | end of a syllable | elf |  |
| **-lk** | /l/ + /k/ | `lk` | end of a syllable | milk |  |
| **-lp** | /l/ + /p/ | `lp` | end of a syllable | help |  |
| **-lt** | /l/ + /t/ | `lt` | end of a syllable | belt |  |
| **-mp** | /m/ + /p/ | `mp` | end of a syllable | jump |  |
| **-nd** | /n/ + /d/ | `nd` | end of a syllable | hand |  |
| **-nk** | /ng/ + /k/ | `nk` | end of a syllable | pink | Also covered by the velar nasal units; both tags apply. |
| **-nt** | /n/ + /t/ | `nt` | end of a syllable | tent |  |
| **-pt** | /p/ + /t/ | `pt` | end of a syllable | kept |  |
| **-sk** | /s/ + /k/ | `sk` | end of a syllable | desk |  |
| **-sp** | /s/ + /p/ | `sp` | end of a syllable | wasp |  |
| **-st** | /s/ + /t/ | `st` | end of a syllable | best |  |
| **-nch** | /n/ + /ch/ | `nch` | end of a syllable | lunch |  |
| **-lch** | /l/ + /ch/ | `lch` | end of a syllable | belch |  |
| **-xt** | /k/ + /s/ + /t/ | `xt` | end of a syllable | next |  |

### Velar nasal unit

The vowel changes before /ng/, so these are taught whole rather than sounded out: -ang, -ing, -ong, -ung, -ank, -ink, -onk, -unk.

| Pattern | Sounds | Spellings | Where | Example | Note |
| --- | --- | --- | --- | --- | --- |
| **-ang** | /a/ + /ng/ | `ang` | end of a syllable | bang |  |
| **-ing** | /i/ + /ng/ | `ing` | end of a syllable | sing |  |
| **-ong** | /aw/ + /ng/ or /o/ + /ng/ | `ong` | end of a syllable | song |  |
| **-ung** | /u/ + /ng/ | `ung` | end of a syllable | sung |  |
| **-ank** | /a/ + /ng/ + /k/ | `ank` | end of a syllable | bank |  |
| **-ink** | /i/ + /ng/ + /k/ | `ink` | end of a syllable | pink |  |
| **-onk** | /aw/ + /ng/ + /k/ or /o/ + /ng/ + /k/ | `onk` | end of a syllable | honk |  |
| **-unk** | /u/ + /ng/ + /k/ | `unk` | end of a syllable | junk |  |

### Kind / old word

The vowel goes long even though the syllable looks closed: -ind, -ild, -old, -olt, -ost, -oll.

| Pattern | Sounds | Spellings | Where | Example | Note |
| --- | --- | --- | --- | --- | --- |
| **-ind** | /ī/ + /n/ + /d/ | `ind` (spelling must match) | end of a syllable | kind |  |
| **-ild** | /ī/ + /l/ + /d/ | `ild` (spelling must match) | end of a syllable | wild |  |
| **-old** | /ō/ + /l/ + /d/ | `old` (spelling must match) | end of a syllable | cold |  |
| **-olt** | /ō/ + /l/ + /t/ | `olt` (spelling must match) | end of a syllable | colt |  |
| **-ost** | /ō/ + /s/ + /t/ | `ost` (spelling must match) | end of a syllable | most |  |
| **-oll** | /ō/ + /l/ | `oll` (spelling must match) | end of a syllable | roll | Some programs teach -oll with the kind/old family, others with the floss rule. Included here. |

### Consonant-le

A final stable syllable of consonant + le: -ble, -cle, -dle, -fle, -gle, -kle, -ple, -tle, -zle.

This one is matched by shape rather than from a list: any word whose spelling ends
in `le`, where the final sounds are a consonant (optionally plus a schwa) then /l/.
That covers the whole family without enumerating it:

- -ble (table)
- -cle (uncle)
- -dle (candle)
- -fle (waffle)
- -gle (bugle)
- -kle (pickle)
- -ple (apple)
- -sle (measles)
- -tle (little)
- -zle (puzzle)

> The tag shows the letters actually used, so *little* is labelled `-ttle` rather
> than `-tle`. Say if you would rather see the collapsed form.

> Phonics splits *lit-tle* so that `-tle` is the final syllable, but the
> pronunciation-based syllable splitter puts the /t/ with the first syllable. The
> consonant-le tag is found from the end of the spelling for exactly this reason,
> so it does not depend on where the syllable break lands.

### Clusters not in the list

Any consonant cluster of two or more sounds that no listed blend covers is still
tagged as a blend, marked **unlisted** in the app. Those are the ones worth adding
to the table if they keep turning up in your word lists.

## Red words

Letters that make a sound they do not usually make, so the word has to be
remembered rather than sounded out. These are tagged **Red word (irregular)**
instead of the phonics category they would otherwise fall in, so a student who
misses one does not lose credit for a skill they may well have: in *their*, a
miss on the `eir` no longer counts against r-controlled vowels, and the `th`
beside it still counts as a consonant digraph.

What is listed is a **grapheme, not a word**, which is why `ai` appears here for
*said* while the `ai` in *rain* is an ordinary long vowel — they make different
sounds, so they were already different entries.

The list does not have to be complete. A pair that is missing simply behaves as
it did before, so add to it as words come up in real tests.

| Letters | Sound(s) | As in | Also |
| --- | --- | --- | --- |
| `ai` | /e/ | *said* | *again* |
| `ie` | /e/ | *friend* |  |
| `a` | /e/ | *any* | *many* |
| `ea` | /e/ | *head* | *bread*, *dead*, *breath*, *weather* |
| `o` | /u/ | *come* | *some*, *done*, *love*, *front*, *month* |
| `a` | /u/ | *was* | *what* |
| `oe` | /u/ | *does* |  |
| `ou` | /u/ | *enough* | *country*, *young*, *touch* |
| `ee` | /i/ | *been* |  |
| `u` | /i/ | *busy* | *build* |
| `eo` | /ē/ | *people* |  |
| `ey` | /ā/ | *they* | *grey*, *obey* |
| `ough` | /ō/ | *though* |  |
| `ough` | /oo/ | *through* |  |
| `eye` | /ī/ | *eye* |  |
| `wo` | /oo/ | *two* |  |
| `o` | /oo/ | *who* | *do*, *to* |
| `ou` | /ŏŏ/ | *could* | *would*, *should* |
| `au` | /a/ | *laugh* |  |
| `eir` | /air/ | *their* |  |
| `ere` | /air/ | *there* | *where* |
| `our` | /or/ | *four* | *pour*, *court* |
| `f` | /v/ | *of* |  |
| `o` | /w/ | *one* |  |
| `o` | /w/ + /u/ | *once* |  |

## Needs your review

Judgement calls made while building this. Each one is a one-line change to fix.

| Item | Why it is a judgement call |
| --- | --- |
| /oo/ moon, /ŏŏ/ book, /aw/ saw | These three were not in the category list you gave, and they are neither short nor long nor diphthongs. They are parked under **Other vowel**. Tell me where they belong. |
| /ā/ /ī/ /ō/ are phonetically diphthongs | They glide, but they are tagged **Long vowel** because that is how they are taught. Only /ow/ cow and /oy/ boy are tagged **Diphthong**. |
| -ong and -onk use /aw/, not short /o/ | The vowel genuinely shifts before /ng/ — *song* is /sawng/, not /song/ — which is the whole reason these are taught as units. Short /o/ is accepted as an alternative for merged dialects. |
| No -rd, -rk, -rm, -rn, -rt ending blends | In American English the /r/ merges into the vowel, so *card* is /k/ + /ar/ + /d/ and no /r/ sound is left to blend. Those words tag as **R-controlled** instead. |
| Doubled letters are not digraphs | `bb`, `ll`, `ss` tag as plain consonants. They could become their own floss-rule category if you want. |
| Kind/old words do NOT collapse into one column | Velar nasal units and consonant-le are marked as single chunks, but "kind" still shows as k-i-n-d with an -ind tag over it. Add `kind-old` to COLLAPSING_CATEGORIES to make it one column. |
| Consonant-le shows the doubled letters | *little* is labelled `-ttle` rather than `-tle`, because the tag shows the letters actually used. Say if you want the collapsed form instead. |
| `ti` → /sh/ (nation) | Usually taught as a suffix spelling (-tion), not as a consonant digraph. |
| `ci` → /sh/ (special) | Usually taught as a suffix spelling (-cial), not as a consonant digraph. |
| `si` → /zh/ (vision) | Usually taught as a suffix spelling (-sion), not as a consonant digraph. |
| `ssi` → /sh/ (mission) | Usually taught as a suffix spelling (-ssion), not as a consonant digraph. |
| -oll (roll) | Some programs teach -oll with the kind/old family, others with the floss rule. Included here. |
| -nk (pink) | Also covered by the velar nasal units; both tags apply. |
| `ea` → /e/ (head) as a red word | Some programs teach ea/e as a second sound of the ea team rather than as a red word. There are enough of these words that tagging them all red may overstate it — say the word and this line comes out. |
| `ey` → /ā/ (they) as a red word | ey/ā is regular enough in they, grey and obey that some programs teach it as a vowel team. Kept because "they" is on every red-word list. |
| `our` → /or/ (four) as a red word | our/or turns up in a whole family (four, pour, court, your), so it could reasonably be taught as an r-controlled team instead of word by word. |

---

_45 sounds · 29 digraph spellings · 61 listed multi-sound patterns · 25 red-word spellings · 14 categories._
