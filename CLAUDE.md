# niceties

A collection of small browser games and toys (see [README.md](README.md) for the list). Every
project is a folder with static HTML/CSS/ES modules: **no framework, no build step**. Hosted on
GitHub Pages. UI language is English. No ads, no tracking, no network requests after the first load.

Projects with their own `CLAUDE.md`: [Sudoku](Sudoku/CLAUDE.md). Read it when working in that folder.
`Sudoku` and `untangleMe` have automated tests; the others are single pages.

## Working rules

Larger work is planned in a `design/PRD.md` (what) and `design/implementation.md` (how, in phases)
of the project. Section numbers like "PRD 3.4" refer to the PRD. The rules below apply to every
project that has such a plan.

1. **Phases are done in order.** Each phase ends with a green test run and a commit.
2. **Every phase has checkboxed work items** (and tests) in `implementation.md`. Tick a box only
   when the item is delivered *and* its tests pass. An item that was not delivered stays unticked
   with a note why, or moves to a later phase. The updated file is part of the phase commit, so the
   plan always shows the true state.
3. **Phase gate** (all must be true before the next phase starts):
   - the project's unit tests pass: **all** of them (`npm test`);
   - the project's e2e tests pass: **all** of them, in every project of the Playwright config
     (`npm run test:e2e`);
   - no skipped, `.only` or quarantined tests, and no retries to hide flakiness (`retries: 0`);
     a flaky test is fixed, not rerun;
   - tests written in the phase cover every work item of the phase; earlier tests still pass;
   - `implementation.md` is updated (rule 2);
   - all files of the phase are committed (`git add -A` in the project folder, `git status` clean
     afterwards), message `<Project>: phase N – <title>`.
   If a test fails, fix the cause in the same phase. **Never commit red.**
4. **Commit after green tests** also outside phases: run unit and e2e tests first, then commit,
   then push. Commit and push only when asked or when the plan says so. Use a short imperative
   message prefixed with the project name (`Sudoku: ...`).
5. **Change requests** after a release go into an "After the release" section of
   `implementation.md` (checked off when done) and into the PRD where the specified behaviour
   changed. Update the README if the way to play changes.
6. **Test setup:** unit tests with Node's test runner (`tests/unit/*.test.js`), e2e with
   Playwright (`tests/e2e/`, `playwright.config.js`) on four projects: iPhone, iPad portrait and
   iPad landscape (WebKit, the stand-in for Safari) and desktop (Chromium). Static dev server on
   `localhost` because ES modules and service workers need http. Same layout in every tested project.
7. **Pure logic first, DOM later:** logic modules run under node without a DOM; only the view,
   input and storage modules touch the DOM. All randomness goes through a seeded RNG so tests are
   reproducible; e2e tests open the page with a fixed `?seed=`.
8. **Keep it simple:** no new dependencies without a reason (dev dependency: `@playwright/test`,
   `@axe-core/playwright`). Match the style of the surrounding code.

## Things that bite

- The full Playwright suite is slow (about 10 minutes for 4 projects, ~100 tests each). While
  iterating, run one project (`--project=desktop`) or one file; run the whole suite before the commit.
  Run long test commands in the background and redirect the output to a file.
- A failing e2e test waits for its timeout (60 s): do not mistake that for a hang.
- Pages with a service worker are cached by the browser: **bump `VERSION` in `sw.js`** whenever
  shipped files change, otherwise installed copies (iOS Home Screen) keep the old version.
- Screenshot baselines (`*-snapshots`) are per platform; regenerate with `--update-snapshots`
  only after the layout change is intended, and look at the new images.
- Playwright: elements with `aria-disabled` count as not enabled for `click()` (use
  `{ force: true }` to test that a tap is ignored); WebKit goes *back in history* on Backspace
  when nothing is focused.
- Windows: Git Bash and PowerShell are both available; paths with `/c/Users/...` work in bash.
