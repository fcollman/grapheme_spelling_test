# Both ways: combined accuracy and spelling vs reading

Every other report in this guide answers one question at a time — spelling or
reading, never both, because averaging them gives a number that means nothing.

These two are the exception, and they earn it by *never* averaging the raw
counts. Each direction keeps its own score, and the sheet reports what the pair
of them says.

There is no **Evidence from** toggle here. Both sheets use both, so they give
you a picker for each: one for the spelling tests, one for the reading passages.
Those are the same selections the rest of the app uses, so a span you choose
here follows you to the other tabs and back.

## Combined accuracy

*How well is this known at all?*

Each row shows the spelling score, the reading score, and the two averaged — **one
weight each**, not one pooled count.

That distinction is the whole point. A passage can offer `oa` thirty times where
a spelling list offers it twice. Pooled, the passage would decide the number
almost on its own and the spelling evidence would vanish into it. Averaging the
two percentages gives each direction an equal say, however many chances it
happened to provide.

A row only one side reached keeps the score it has and is labelled **spelling
only** or **reading only**. That is still something the child knows; it is only
the comparison that cannot be made.

## Spelling vs reading

*Which way round is it known?*

The last column is the spelling percentage minus the reading one.

![Spelling against reading, sorted by the difference. The class spells `er` far better than it reads it](images/spelling-vs-reading.webp)

- **Purple, positive** — they spell it but cannot read it.
- **Teal, negative** — they read it but cannot spell it.
- **Grey, zero** — equally strong both ways.

The colours are deliberately not the red-to-green used elsewhere. Neither end of
this scale is the bad one: both are a child who is stuck, and they need opposite
lessons. Purple against teal also stays two distinguishable colours for a
red–green colour-blind reader.

### Why some rows refuse to show a difference

**spelling only / reading only.** Only one direction covered the row. A missing
side is not a score of zero, and treating it as one would invent a 100-point
gap out of nothing.

**too few.** Both sides covered it, but one of them too thinly. One chance each
way reads as ±100% whenever the child happened to get one right and one wrong,
which is a coin toss rather than a finding.

**Needs at least** sets where that line falls — three of each by default. Lowering
it to 1 shows every comparison the data can make; raising it to 10 keeps only
the ones you could defend in a meeting. Nothing is ever hidden: the row stays,
with both its counts visible, and only the difference is withheld.

## Click any score for the examples behind it

As everywhere else in the app, every figure on these two sheets is clickable,
and clicking one opens the individual answers that produced it — with its own
CSV download.

The two score columns open their own side: the spelling tests, or the reading
passages. The last column is made of both, so it opens **both at once**, with
each answer saying which test it came from and whether it was written or read
aloud. That is the quickest way to see what a difference is actually made of.

## Reading the sheet

**Showing** switches between the whole class and one child. A whole class pools
plenty of evidence, so the threshold rarely bites there; for one child it often
will, which is the honest answer.

**Detail** switches between spellings and sounds — grapheme rows ask *what does
this child do with `oa`*, sound rows ask *what do they do with /ō/ however it is
written*.

Any of the score columns sorts the sheet. On the difference column the two
directions are **reading ahead first** and **spelling ahead first** rather than
worst and best, because neither end is the worse one. Rows with no difference to
show always sink to the bottom, whichever way the sort runs.

As everywhere else, both sheets have **Download CSV** and **Print / Save PDF**,
and both follow whatever order is on screen.
