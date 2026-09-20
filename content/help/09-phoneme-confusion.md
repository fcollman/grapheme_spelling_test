# Phoneme confusion

The sound-level twin of **Grapheme confusion**, and the last tab in the app.
Grapheme confusion shows which *spelling* was written where another was needed;
this shows which *sound* was.

![The phoneme confusion matrix. The green diagonal is correct; red cells are specific sound substitutions](images/phoneme-confusion.webp)

## Reading the grid

Same shape as the grapheme matrix:

- **Rows** are the sound the word needed.
- **Columns** are the sound the student's letters actually made.
- The **green diagonal** is where the two agree — the sound was encoded
  correctly.
- Every **red** cell off the diagonal is a specific swap, with the number of
  times it happened. Darker red means more often.
- **∅** means the sound was left out altogether rather than replaced.

A cluster on /e/ → /i/ is not "vowel problems". It is one contrast, and one
contrast is something you can put in front of a student on Monday morning with
minimal pairs and a mirror.

Substitutions that are close together in the mouth — /b/ and /p/, /f/ and /v/,
/m/ and /n/ — are the ones worth looking for. Pairs like those differ by a single
feature, so a student confusing them is usually not hearing that feature rather
than forgetting a rule.

## Whole class or one student

The **Showing** dropdown switches between the two, and both are worth a look for
the same reasons as on the grapheme matrix: the class view finds the contrasts
nobody has secured, and the single-student view finds the personal substitution
that is quietly costing them marks across every test.

## Click any cell, and pool your tests

Every cell with a number is clickable, red and green alike, and opens the
individual answers behind it — the words, the students, and what was written —
with its own **Download CSV**.

The test picker at the top pools across whatever tests you select. Confusions
need pooling more than any other report here: a single occurrence is noise, and
the same swap eleven times across a term is a diagnosis.

---

That is the whole tour. If something in the analysis does not look right, the
place to go back to is **Checking the analysis** — every number in every report
on this tour is built from those coloured cells, and you can correct any of them.
