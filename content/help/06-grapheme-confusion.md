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

A column marked **∅** means nothing was written for that unit at all — the sound
was dropped rather than misspelled.

So a `7` where the row is `ck` and the column is `k` reads: *seven times, a word
needed `ck` and the student wrote `k`.* That is not a vague weakness in final
consonants. That is one rule, taught in one lesson.

**Hide empty rows and columns** clears out everything that never came up, which
is worth ticking once the grid gets wide.

## Whole class or one student

The **Showing** dropdown switches between the whole class and any individual.

Both views are worth your time, and they answer different questions:

- **Whole class** finds the rules nobody has. If `ck` → `k` is the hottest cell
  in the grid for eleven students, that is a class lesson, not eleven
  intervention plans.
- **One student** finds the personal default. Students who are struggling tend to
  fall back on one spelling and use it everywhere, and it shows up here as a
  single bright column.

## Click any cell for the examples

Every cell with a number in it is clickable — the red substitutions and the green
correct ones alike. Clicking opens the actual answers: the words, the students,
and what was written.

Clicking the green diagonal is not a waste of time either. When a student is
right 4 times out of 5, seeing the four they got right next to the one they
missed often shows you the condition — right at the start of a word, wrong at the
end — that the fraction on its own hides.

As everywhere else, the window has its own **Download CSV**.

## Pooling tests

The test picker at the top works as it does everywhere else. Confusions are
exactly the kind of thing that needs pooling: a single test might show one `ck`
→ `k` and you would never notice. Select a term and the pattern either appears
as a solid block of red or it does not.
