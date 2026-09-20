# Accuracy by phoneme

The three **By sound** tabs ask a different question from the by-spelling ones.
Not *did they pick the right letters?* but *did they hear the right sound?*

## Why sounds and spellings need separate reports

A **grapheme** is the letters that spell a sound. A **phoneme** is the sound
itself. They do not line up one to one — several different spellings make the
same sound:

| Sound | Spelled |
|---|---|
| /f/ | `f` in *fan*, `ph` in *phone*, `ff` in *cliff* |
| /k/ | `c` in *cat*, `k` in *kit*, `ck` in *duck*, `ch` in *school* |
| /ā/ | `a_e` in *cake*, `ai` in *rain*, `ay` in *day*, `ea` in *great* |

That matters because a spelling test failure can come from two completely
different places. A student who writes `fone` has heard every sound in *phone*
correctly and chosen a spelling English does not use for that word. A student who
writes `fun` has not heard the sounds. On the by-spelling reports both are just
wrong. Regroup the same data by sound and they separate.

If a student's errors cluster around a particular sound no matter how it is
spelled, the problem is underneath the spelling — they are not reliably hearing
or producing that sound — and no amount of spelling rules will fix it.

![Accuracy by phoneme, with the whole class column first and the tick box that decides how amber counts](images/phoneme-accuracy.webp)

## The tick box that changes the question

**Count "correct sound, different letters" as correct** is the important control
on this page.

- **Ticked:** `fone` for *phone* counts as correct — the student got the /f/.
  This is the setting that makes the page measure what it is named after: how
  reliably the student hears and encodes each sound.
- **Unticked:** only the exact spelling counts, and the page behaves more like
  the by-spelling report.

Read the same class both ways and the comparison is the diagnosis. If a student
sits at 55% unticked and 90% ticked, their ears are fine and they need
orthography. If both readings are 55%, the sound itself is the problem.

The setting is shared with **Accuracy by grapheme**, so it stays where you put
it.

## Otherwise it works like the grapheme report

Everything else on this page behaves exactly as **Accuracy by grapheme** does:

- Rows are grouped by category, with the **whole class** column first.
- The test picker at the top pools results across any tests you choose — one
  test, the last three, or all of them.
- The **Student** columns let you compare across the class, or read one child.
- **Click any fraction or percentage** to open every example behind it: the
  words, the students, what they wrote for that unit, and whether it counted.
- **Download CSV** and **Print / Save PDF** follow whatever you have on screen.

Some sounds have more than one entry — there are two short *a* rows, for
instance — because the speech engine distinguishes sounds that are written the
same way. That is a feature of the sound inventory, not a bug in your data; both
rows are real and both count.
