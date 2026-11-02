# Grapheme confusion

Accuracy tells you *that* a spelling went wrong. This tells you *what went in
its place*.

![The grapheme confusion matrix. The green diagonal is correct; red cells off it are specific substitutions](images/grapheme-confusion.webp)

## Reading the grid

It is a grid of needed against written, and the header says which way round:
**Needed ↓ / Wrote →**.

- **Rows** is the spelling the word needed.
- **Columns** is what the student rote. Err, I mean wrote. 

Where the two agree you are on the **shaded green diagonal**: the spelling that
was needed is the spelling that appeared. Everything off the diagonal is a
substitution, shaded **red** and marked with the number of times it happened.

A column marked **∅** means nothing was written for that unit at all. 

So a `7` where the row is `ck` and the column is `k` reads: *seven times, a word
needed `ck` and the student wrote `k`.* 

### Reading passages: the columns become sounds

On a reading passage the grid turns around, and the header says so: **Letters ↓
/ Said →**. The rows are still the spellings, but the columns are the *sounds*
the student made of them, so the sheet asks *what does this child do with `oa`?*
— the exact mirror of the question it asks about spelling.

The columns are sounds rather than your respelling on purpose. When you type
"shun" for one child and "shn" for another, that is one mispronunciation written
down two ways, and counting them as two different answers would split one error
in half across a grid that is already sparse. What the student produced is the
sound, so the sound is what gets counted.

Two things follow:

- The **diagonal** is the sound the letters were supposed to make. A reading
  marked correct lands there whatever you typed to record it.
- A **near miss stays off the diagonal** — a reduced vowel, or a vowel that is
  simply how your students speak. Those are not decoding errors, but they are
  yours to judge, and you can only judge what you can see.

### Two views of the same grid

The tick box under the grid decides how much of it you see.

**Ticked — hide rows and columns with no confusions.** Only the spellings that
were actually mixed up with something are left. A spelling that was always
written correctly has nothing to teach against, so it goes. This is what you
want once a term of tests has made the grid wide: on the demo class it takes a
71-by-83 grid down to 58 by 38.

**Unticked.** Every spelling gets a row *and* a column of its own, in the same
order, so the correct answers run down the green diagonal and you can see what
went right alongside what went wrong.

![The full grid. Every spelling has its own column, so the correct counts run down the green diagonal](images/confusion-diagonal.webp)

The **Showing** dropdown switches between the whole class and any individual.

## Click any cell for the examples

As with other pages, every cell with a number in it is clickable to get the 
specific examples under the number.

You might find drilling into the different examples along a row or column
and comparing the correct and incorrect cases to be useful. 

As everywhere else, the window has its own **Download CSV**.

## Pooling tests

**Evidence from** at the top chooses spelling tests or reading passages — the two are never pooled into one number. The **Student profile** section of this guide explains the choice.

The test picker at the top works as it does everywhere else. Confusions are
exactly the kind of thing that needs pooling: a single test might show one `ck`
→ `k`. 
