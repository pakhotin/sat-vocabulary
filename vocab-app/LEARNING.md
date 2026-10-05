# How the study session teaches

The app is built around remembering a word later, not around collecting points.

## Active recall

The main session asks for an answer before it reveals one. A new word is shown once, then the definition is hidden and the student has to recall the meaning and, after that, produce the word. Reviews ask for the word from a definition, a blanked sentence, a meaning, or a correct sentence. Typing ignores capitalization and treats a small typo as “almost,” not as a total miss. Multiple choice is used for placement, first exposure, and variety. It is not the main path to mastery.

## Spaced repetition

Each word has its own schedule, stored on the device. The schedule comes from FSRS through the `ts-fsrs` library. Again brings the word back soon. Easy waits longer. Due reviews are placed before new words. If the chosen minutes are already full of reviews, new words wait. Missing a word does not delete it.

## Context

Every word has a short definition from the study list and at least one example sentence. The starter set also has a second sense, a confusion note, or a memory hook where that helps, including abide / abide by, accrete / accrue, appraise / apprise, adverse / averse, and allude / elude. Extra notes stay behind “More about this word” so the review itself stays short.

## Feedback

After an answer, the screen says whether it was retrieved, almost right, or missed, then shows the word, the meaning, and an example. The next review time appears only after the student rates the recall. A word that has already been missed offers a simpler reminder and two short practice questions. The practice questions do not schedule the word a second time in the same sitting. The copy does not scold.

## Interleaving

New words are taken from across the alphabet instead of a long run of similar entries. Reviews stay in due order so an overdue word is not buried. Comparison notes appear when a word is easy to mix up with another one in the list. Question types change within a sitting: meaning, typed recall, cloze, usage, and an occasional sentence.

## What is intentionally limited

There is no public leaderboard and no timer in the normal session. A 60-second drill uses words already studied and does not move their due dates. Streaks can survive one missed day. Points favor a correct typed recall over a correct guess. The optional sentence prompt asks for one sentence and lets the student judge the meaning when an automatic check would be guessing.
