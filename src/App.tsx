/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, Space, Keyboard } from 'lucide-react';
import { COLS, ROWS, BLOCK_SIZE, COLORS, SHAPES, WALL_KICKS } from './constants';

type Piece = {
  typeId: number;
  shape: number[][];
  x: number;
  y: number;
  color: string;
};

export default function App() {
  const [board, setBoard] = useState<number[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [activePiece, setActivePiece] = useState<Piece | null>(null);
  const [nextQueue, setNextQueue] = useState<number[]>([]);
  const [holdPieceId, setHoldPieceId] = useState<number | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE');
  const [isPaused, setIsPaused] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdCanvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const bagRef = useRef<number[]>([]);

  // --- Logic Helpers ---

  const initBag = useCallback(() => {
    const newBag = [1, 2, 3, 4, 5, 6, 7];
    for (let i = newBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
    }
    bagRef.current = newBag;
  }, []);

  const getNextFromBag = useCallback(() => {
    if (bagRef.current.length === 0) initBag();
    return bagRef.current.pop()!;
  }, [initBag]);

  const checkCollision = useCallback((x: number, y: number, shape: number[][], currentBoard: number[][]) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const newX = x + c;
          const newY = y + r;
          if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && currentBoard[newY][newX] !== 0)) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const getGhostY = useCallback((piece: Piece, currentBoard: number[][]) => {
    let ghostY = piece.y;
    while (!checkCollision(piece.x, ghostY + 1, piece.shape, currentBoard)) {
      ghostY++;
    }
    return ghostY;
  }, [checkCollision]);

  const rotateMatrix = (matrix: number[][]) => {
    const N = matrix.length;
    return matrix.map((row, i) => row.map((_, j) => matrix[N - 1 - j][i]));
  };

  const spawnPiece = useCallback((currentBoard: number[][], queue: number[]) => {
    const typeId = queue[0];
    const newQueue = [...queue.slice(1), getNextFromBag()];
    setNextQueue(newQueue);

    const shape = SHAPES[typeId];
    const newPiece: Piece = {
      typeId,
      shape: JSON.parse(JSON.stringify(shape)),
      color: COLORS[typeId],
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };

    if (checkCollision(newPiece.x, newPiece.y, newPiece.shape, currentBoard)) {
      setGameState('GAMEOVER');
      return null;
    }

    setCanHold(true);
    return newPiece;
  }, [getNextFromBag, checkCollision]);

  // --- Actions ---

  const lockPiece = useCallback((piece: Piece) => {
    setBoard(prev => {
      const newBoard = prev.map(row => [...row]);
      piece.shape.forEach((row, r) => {
        row.forEach((value, c) => {
          if (value !== 0) {
            const y = piece.y + r;
            const x = piece.x + c;
            if (y >= 0) newBoard[y][x] = piece.typeId;
          }
        });
      });

      // Clear Lines
      let linesCleared = 0;
      const filteredBoard = newBoard.filter(row => {
        const isFull = row.every(cell => cell !== 0);
        if (isFull) linesCleared++;
        return !isFull;
      });

      while (filteredBoard.length < ROWS) {
        filteredBoard.unshift(Array(COLS).fill(0));
      }

      if (linesCleared > 0) {
        setLines(l => {
          const total = l + linesCleared;
          setLevel(Math.floor(total / 10) + 1);
          return total;
        });
        setScore(s => s + [0, 100, 300, 500, 800][linesCleared] * level);
        
        if (linesCleared === 4) {
          setIsShaking(true);
          setIsFlashing(true);
          setTimeout(() => { setIsShaking(false); setIsFlashing(false); }, 500);
        } else {
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 200);
        }
      }

      const nextPiece = spawnPiece(filteredBoard, nextQueue);
      if (nextPiece) setActivePiece(nextPiece);
      
      return filteredBoard;
    });
  }, [level, nextQueue, spawnPiece]);

  const movePiece = useCallback((dx: number, dy: number) => {
    setActivePiece(prev => {
      if (!prev || gameState !== 'PLAYING') return prev;
      if (!checkCollision(prev.x + dx, prev.y + dy, prev.shape, board)) {
        return { ...prev, x: prev.x + dx, y: prev.y + dy };
      }
      if (dy > 0) {
        lockPiece(prev);
        return null;
      }
      return prev;
    });
  }, [board, checkCollision, gameState, lockPiece]);

  const hardDrop = useCallback(() => {
    setActivePiece(prev => {
      if (!prev || gameState !== 'PLAYING') return prev;
      const ghostY = getGhostY(prev, board);
      const droppedPiece = { ...prev, y: ghostY };
      setScore(s => s + (ghostY - prev.y) * 2);
      lockPiece(droppedPiece);
      return null;
    });
  }, [board, gameState, getGhostY, lockPiece]);

  const rotatePiece = useCallback(() => {
    setActivePiece(prev => {
      if (!prev || gameState !== 'PLAYING') return prev;
      const newShape = rotateMatrix(prev.shape);
      
      // SRS Basic Wall Kick
      for (const [dx, dy] of WALL_KICKS) {
        if (!checkCollision(prev.x + dx, prev.y + dy, newShape, board)) {
          return { ...prev, x: prev.x + dx, y: prev.y + dy, shape: newShape };
        }
      }
      return prev;
    });
  }, [board, checkCollision, gameState]);

  const holdPiece = useCallback(() => {
    if (!canHold || gameState !== 'PLAYING') return;
    
    setHoldPieceId(prevHoldId => {
      setActivePiece(prevActive => {
        if (!prevActive) return null;
        
        let newPiece: Piece | null = null;
        if (prevHoldId === null) {
          newPiece = spawnPiece(board, nextQueue);
        } else {
          const shape = SHAPES[prevHoldId];
          newPiece = {
            typeId: prevHoldId,
            shape: JSON.parse(JSON.stringify(shape)),
            color: COLORS[prevHoldId],
            x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
            y: 0,
          };
        }
        setCanHold(false);
        return newPiece;
      });
      return activePiece?.typeId || null;
    });
  }, [canHold, gameState, activePiece?.typeId, spawnPiece, board, nextQueue]);

  // --- Rendering ---

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isGhost = false) => {
    ctx.shadowBlur = isGhost ? 0 : 15;
    ctx.shadowColor = color;
    ctx.fillStyle = isGhost ? `rgba(255, 255, 255, 0.0)` : color;
    
    if (isGhost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      ctx.strokeRect(x * BLOCK_SIZE + 2, y * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
      ctx.globalAlpha = 1.0;
    } else {
      ctx.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      ctx.shadowBlur = 0;
      // Border overlay for block definition
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Board Blocks
    board.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value !== 0) drawBlock(ctx, c, r, COLORS[value]);
      });
    });

    // Draw Active Piece and Ghost
    if (activePiece) {
      const ghostY = getGhostY(activePiece, board);
      activePiece.shape.forEach((row, r) => {
        row.forEach((value, c) => {
          if (value !== 0) {
            drawBlock(ctx, activePiece.x + c, ghostY + r, activePiece.color, true);
            drawBlock(ctx, activePiece.x + c, activePiece.y + r, activePiece.color);
          }
        });
      });
    }
  }, [board, activePiece, getGhostY]);

  // Mini queues rendering
  const renderMini = (canvas: HTMLCanvasElement | null, typeIds: number[]) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const miniSize = 25;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    typeIds.forEach((id, idx) => {
      const shape = SHAPES[id];
      const color = COLORS[id];
      const offsetX = (canvas.width - shape[0].length * miniSize) / 2;
      const offsetY = idx * 90 + 20;

      shape.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val !== 0) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = color;
            ctx.fillStyle = color;
            ctx.fillRect(offsetX + c * miniSize, offsetY + r * miniSize, miniSize - 2, miniSize - 2);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(offsetX + c * miniSize, offsetY + r * miniSize, miniSize - 2, miniSize - 2);
          }
        });
      });
    });
  };

  useEffect(() => {
    renderMini(holdCanvasRef.current, holdPieceId ? [holdPieceId] : []);
    renderMini(nextCanvasRef.current, nextQueue);
  }, [nextQueue, holdPieceId]);

  // --- Game Loop ---

  const gameLoop = useCallback((time: number) => {
    if (isPaused || gameState !== 'PLAYING') {
      lastTimeRef.current = time;
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    dropCounterRef.current += deltaTime;

    const interval = Math.max(100, 1000 - (level - 1) * 100);
    if (dropCounterRef.current > interval) {
      movePiece(0, 1);
      dropCounterRef.current = 0;
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, isPaused, level, movePiece]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      lastTimeRef.current = performance.now();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, gameLoop]);

  // --- Inputs ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING' || isPaused) return;

      switch (e.code) {
        case 'ArrowLeft': movePiece(-1, 0); break;
        case 'ArrowRight': movePiece(1, 0); break;
        case 'ArrowDown': movePiece(0, 1); setScore(s => s + 1); break;
        case 'ArrowUp': rotatePiece(); break;
        case 'Space': hardDrop(); break;
        case 'KeyC': case 'ShiftLeft': case 'ShiftRight': holdPiece(); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isPaused, movePiece, rotatePiece, hardDrop, holdPiece]);

  const startGame = () => {
    initBag();
    const initialQueue = [getNextFromBag(), getNextFromBag(), getNextFromBag()];
    setNextQueue(initialQueue);
    setBoard(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
    setScore(0);
    setLines(0);
    setLevel(1);
    setHoldPieceId(null);
    setCanHold(true);
    setGameState('PLAYING');
    
    // Spawn first piece
    const first = spawnPiece(Array.from({ length: ROWS }, () => Array(COLS).fill(0)), initialQueue);
    if (first) setActivePiece(first);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-sans p-8 overflow-hidden">
      <div className="scanline-overlay" />
      
      <AnimatePresence>
        {isFlashing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-50 pointer-events-none blur-md"
          />
        )}
      </AnimatePresence>

      <motion.div 
        animate={isShaking ? { x: [-10, 10, -5, 5, 0], y: [-5, 5, -2, 2, 0] } : {}}
        className="flex gap-10 items-start max-w-6xl relative z-10"
      >
        {/* LEFT SIDEBAR: HOLD & STATS */}
        <div className="flex flex-col gap-6 w-40">
          <div className="bg-[#0d0d0d] border-2 border-[#1a1a1a] rounded-lg p-4 shadow-[0_0_15px_rgba(0,255,255,0.05)]">
            <h2 className="text-[10px] tracking-[0.2em] text-[#666] uppercase mb-4 font-bold">Hold Piece</h2>
            <div className="aspect-square bg-black/40 rounded flex items-center justify-center relative">
               <canvas ref={holdCanvasRef} width={100} height={100} className="w-full h-auto" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-[#0d0d0d] border-l-4 border-cyan-500 p-4 transition-all hover:bg-[#111]">
              <h3 className="text-[10px] tracking-[0.2em] text-[#666] uppercase font-bold">Score</h3>
              <p className="text-2xl font-mono font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                {score.toLocaleString(undefined, { minimumIntegerDigits: 7, useGrouping: true })}
              </p>
            </div>
            <div className="bg-[#0d0d0d] border-l-4 border-purple-500 p-4 transition-all hover:bg-[#111]">
              <h3 className="text-[10px] tracking-[0.2em] text-[#666] uppercase font-bold">Level</h3>
              <p className="text-2xl font-mono font-black text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.3)]">
                {level}
              </p>
            </div>
            <div className="bg-[#0d0d0d] border-l-4 border-orange-500 p-4 transition-all hover:bg-[#111]">
              <h3 className="text-[10px] tracking-[0.2em] text-[#666] uppercase font-bold">Lines</h3>
              <p className="text-2xl font-mono font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]">
                {lines}
              </p>
            </div>
          </div>
        </div>

        {/* MAIN GAME BOARD */}
        <div className="relative bg-[#0d0d0d] border-[3px] border-[#1a1a1a] p-1 shadow-[0_0_40px_rgba(0,0,0,1)] rounded-sm group overflow-hidden">
          {/* Grid Overlay */}
          <div className="absolute inset-0 z-10 pointer-events-none board-grid-overlay"></div>
          
          <div className="relative w-[300px] h-[600px] overflow-hidden">
            <canvas 
              ref={canvasRef} 
              width={COLS * BLOCK_SIZE} 
              height={ROWS * BLOCK_SIZE}
              className="bg-[#050505] relative z-0"
            />

            {gameState !== 'PLAYING' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                <motion.h1 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-black italic tracking-tighter bg-gradient-to-b from-white to-[#00ffff] bg-clip-text text-transparent mb-8 drop-shadow-[0_0_15px_rgba(0,255,255,0.4)]"
                >
                  {gameState === 'IDLE' ? 'NEON TETRIS' : 'GAME OVER'}
                </motion.h1>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="flex items-center gap-3 bg-[#00ffff] text-black font-black py-3 px-8 rounded-sm text-sm shadow-[0_0_30px_rgba(0,255,255,0.4)] hover:shadow-[0_0_50px_rgba(0,255,255,0.7)] transition-all uppercase italic tracking-widest"
                >
                  {gameState === 'IDLE' ? <Play size={16} fill="black" /> : <RotateCcw size={16} />}
                  {gameState === 'IDLE' ? 'Start Program' : 'Restart'}
                </motion.button>
              </div>
            )}

            {isPaused && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
                <h2 className="text-4xl font-bold italic text-white tracking-[0.3em] uppercase">Paused</h2>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR: NEXT QUEUE */}
        <div className="flex flex-col gap-6 w-40 h-[612px]">
          <div className="bg-[#0d0d0d] border-2 border-[#1a1a1a] rounded-lg p-4 flex-1 shadow-[0_0_15px_rgba(0,255,255,0.05)]">
            <h2 className="text-[10px] tracking-[0.2em] text-[#666] uppercase mb-4 font-bold text-center">Next Pieces</h2>
            <canvas ref={nextCanvasRef} width={100} height={300} className="w-full" />
          </div>

          <div className="mt-auto">
            <div className="text-[9px] uppercase tracking-[0.2em] text-[#444] leading-loose font-bold">
              <span className="text-cyan-600 font-black">←/→</span> Move<br/>
              <span className="text-cyan-600 font-black">↑</span> Rotate<br/>
              <span className="text-cyan-600 font-black">↓</span> Soft Drop<br/>
              <span className="text-cyan-600 font-black">SPACE</span> Hard Drop<br/>
              <span className="text-cyan-600 font-black">C</span> Hold Piece
            </div>
          </div>
        </div>
      </motion.div>

      {/* Subtle Bottom Metadata */}
      <div className="fixed bottom-4 right-8 text-[#1a1a1a] text-[10px] font-mono tracking-[0.5em] uppercase pointer-events-none">
        Terminal Core // Subsystem.001
      </div>
    </div>
  );
}
