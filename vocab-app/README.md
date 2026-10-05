# SAT Vocabulary

A phone-friendly study app for the word list in `resources/SAT_Reading_and_Writing_Vocabulary.md`. Students recall words before the answer is shown, and a tested spaced-repetition scheduler decides when each word returns.

Progress stays in the browser. There is no account. A free GitHub account can host the built site with GitHub Pages if the repository is **public**. GitHub’s free plan does not serve Pages from a private repository, and Pages cannot run a database, logins, or live class dashboards.

## Run it locally

Install Node.js 22 or newer, then from this folder:

```bash
npm install
npm run dev
```

Open the local address Vite prints. The first screen asks for study time and a short placement check. Use **Skip placement and start** if you want to begin immediately.

Other commands:

```bash
npm test
npm run build
npm run preview
```

`npm test` rebuilds the word list, then checks scheduling, answer checking, duplicate detection, and progress math.

## Host it on GitHub Pages

1. Push this repository to a **public** GitHub repository.
2. In the repository settings, open **Pages** and set the source to **GitHub Actions**.
3. The workflow `.github/workflows/vocab-pages.yml` builds `vocab-app` and publishes it.

The site address is `https://<username>.github.io/<repository>/`. On a phone, use the browser’s **Add to Home Screen** / **Install app** command. After the first visit, reviews work offline.

If the repository is named `<username>.github.io`, change the workflow base path to `/`. The workflow already does that when the repository name matches the owner’s Pages site.

## Import the full word list

The app already includes every row from the study list. Definitions come from that file and are marked approved. Example sentences written by hand for a starter set are approved. The other example sentences are drafts until you approve them in the editor.

To replace or extend the list:

1. Open **Editor** in the app.
2. Import `data/vocabulary.template.csv` or `data/vocabulary.template.json` as a shape reference, or import a full CSV/JSON file.
3. Export JSON when you want every field, including usage choices. CSV covers the main columns.

You can also edit `resources/SAT_Reading_and_Writing_Vocabulary.md` and run:

```bash
npm run vocab
```

That rewrites `data/vocabulary.json` and `data/vocabulary.csv`. Hand-written notes live in `scripts/enrichment.mjs` and are kept across rebuilds.

The editor checks for missing definitions, missing examples, duplicate headwords, and a part of speech that claims two conflicting categories without a `multi-pos` tag.

## Daily limits

**Settings** stores minutes (5, 10, 15, or 25), pace (gentle, standard, intensive), and the mix of question types. Due reviews are scheduled before new words. If reviews fill the sitting, new words wait.

Approximate new-word caps before the pace adjustment:

- 5 minutes: 3
- 10 minutes: 5
- 15 minutes: 8
- 25 minutes: 12

Gentle lowers the cap by 2. Intensive raises it by 3. A cap of 12 or more shows a warning because the later review load gets heavy.

## Review algorithm

Scheduling is in `src/srs/scheduler.ts`. It uses [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs), an implementation of the FSRS algorithm. The app does not invent intervals. After each real recall, the student chooses Again, Hard, Good, or Easy, and FSRS stores stability, difficulty, lapses, and the next due time on this device.

A word counts as mastered when it is in the review state, the scheduled interval is at least 21 days, and it has been recalled successfully at least three times since it was last missed.

To change the algorithm, replace `applyRating` in that file and keep the same card fields. The session builder in `src/srs/session.ts` only asks which cards are due.

## Backup

**Settings → Export progress** downloads the review history. **Export anonymized progress** removes the optional education level. Import that file on another browser if you want the same schedule. The app cannot sync by itself.

## Why the study session is shaped this way

See [LEARNING.md](LEARNING.md).
