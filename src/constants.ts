/**
 * TETRIS CONSTANTS & CONFIGURATION
 */

export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 30;

// Modern Standard Tetromino Colors (Neon Hex)
export const COLORS: Record<number, string> = {
  1: '#00FFFF', // I (Cyan)
  2: '#0000FF', // J (Blue)
  3: '#FFA500', // L (Orange)
  4: '#FFFF00', // O (Yellow)
  5: '#00FF00', // S (Green)
  6: '#800080', // T (Purple)
  7: '#FF0000'  // Z (Red)
};

// Tetromino Shapes (Matrices)
export const SHAPES: Record<number, number[][]> = {
  1: [ // I
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  2: [ // J
    [2, 0, 0],
    [2, 2, 2],
    [0, 0, 0]
  ],
  3: [ // L
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0]
  ],
  4: [ // O
    [4, 4],
    [4, 4]
  ],
  5: [ // S
    [0, 5, 5],
    [5, 5, 0],
    [0, 0, 0]
  ],
  6: [ // T
    [0, 6, 0],
    [6, 6, 6],
    [0, 0, 0]
  ],
  7: [ // Z
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0]
  ]
};

// SRS Wall Kick Data (Common for J, L, S, T, Z)
// Simplified kicks for this version
export const WALL_KICKS = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]
];
