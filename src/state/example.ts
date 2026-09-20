import type { Project } from './types'

/**
 * A small worked example so the app is not a blank page on first open.
 * The responses are chosen to show each kind of error the reports surface:
 * a digraph substitution, an omitted sound, a dropped silent e, a doubled
 * consonant, a dropped vowel, and two phonetically plausible spellings.
 */
export function exampleProject(): Project {
  return {
    version: 1,
    students: [
      { id: 'ex_stu_1', name: 'Ava' },
      { id: 'ex_stu_2', name: 'Ben' },
      { id: 'ex_stu_3', name: 'Cruz' },
    ],
    tests: [
      {
        id: 'ex_test_1',
        name: 'Example: Unit 4 Check',
        date: new Date().toISOString().slice(0, 10),
        words: [
          { id: 'ex_w1', text: 'ship', nonsense: false },
          { id: 'ex_w2', text: 'stop', nonsense: false },
          { id: 'ex_w3', text: 'cake', nonsense: false },
          { id: 'ex_w4', text: 'rabbit', nonsense: false },
          { id: 'ex_w5', text: 'splash', nonsense: false },
          { id: 'ex_w6', text: 'said', nonsense: false },
          { id: 'ex_w7', text: 'blorf', nonsense: true },
          { id: 'ex_w8', text: 'thrunk', nonsense: true },
        ],
        responses: {
          ex_w1: { ex_stu_1: 'ship', ex_stu_2: 'sip', ex_stu_3: 'chip' },
          ex_w2: { ex_stu_1: 'stop', ex_stu_2: 'sop', ex_stu_3: 'stop' },
          ex_w3: { ex_stu_1: 'cak', ex_stu_2: 'cake', ex_stu_3: 'kake' },
          ex_w4: { ex_stu_1: 'rabit', ex_stu_2: 'rabbit', ex_stu_3: 'rabbit' },
          ex_w5: { ex_stu_1: 'splash', ex_stu_2: 'splsh', ex_stu_3: 'splash' },
          ex_w6: { ex_stu_1: 'sed', ex_stu_2: 'said', ex_stu_3: 'sed' },
          ex_w7: { ex_stu_1: 'blorf', ex_stu_2: 'blof', ex_stu_3: 'blurf' },
          ex_w8: { ex_stu_1: 'thrunk', ex_stu_2: 'frunk', ex_stu_3: 'thrunk' },
        },
        overrides: {},
        wordPhonemes: {},
      },
    ],
    activeTestId: 'ex_test_1',
    settings: { notation: 'sound', lenientSchwa: true, amberCountsCorrect: false, anonymize: false },
  }
}
