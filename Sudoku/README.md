# Sudoku

An ad-free Sudoku for the browser: three levels, symmetric puzzles generated on
the device, no timer, no score, playable offline. Specification: `design/PRD.md`,
plan: `design/implementation.md`.

## Running

No build step. Serve this folder with any static web server (ES modules and the
service worker do not work from `file://`), e.g. `node tests/e2e/server.js` and
open http://localhost:4174/.

## Tests

```
npm install
npx playwright install     # once
npm test                   # unit tests (node --test)
npm run test:e2e           # headless browser tests (iPhone, iPad, desktop)
npm run test:all
```
