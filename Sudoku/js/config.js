// Constants shared by the game, the generator and the tests.
export const MAX_MISTAKES = 3;
export const MAX_HINTS = 4;

// Press length that turns a tap on a number into a note (PRD 3.2.1), in ms.
export const LONG_PRESS_MS = 350;

export const LEVELS = ["beginner", "expert", "master"];
export const DEFAULT_LEVEL = "beginner";
export const DEFAULT_SCHEME = "bw";

// Clue (given) ranges per level, PRD 4. Technique requirements are added with the grader.
export const LEVEL_CONFIG = {
  beginner: { minClues: 38, maxClues: 42 },
  expert: { minClues: 30, maxClues: 34 },
  master: { minClues: 24, maxClues: 28 }
};

// Symmetry types for the givens (PRD 5.3). Maps live in symmetry.js.
export const SYMMETRY_TYPES = [
  "rot180", "rot90", "mirrorH", "mirrorV", "diagonal", "antiDiagonal", "bothDiagonals", "bothAxes"
];

export const CELLS_PER_BOARD = 81;

// Hint animation (PRD 3.4): slow fade of the wrong digit / of the revealed digit.
export const HINT_ANIM_MS = 1200;
export const HINT_ANIM_REDUCED_MS = 150;

export const TIP_KEY = "sudoku.tipShown";

// Losing the game: the board shakes, then slowly fades to grey.
export const LOSS_SHAKE_MS = 600;
export const LOSS_DIM_MS = 1800;
export const LOSS_REDUCED_MS = 150;
