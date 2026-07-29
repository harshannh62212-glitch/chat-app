import React, { useState, useEffect, useRef } from 'react';
import '../styles/Games.css';

// 10 games with description, icon, difficulty, theme color
const GAMES_LIST = [
  { id: 'snake', name: 'Neon Snake', desc: 'Slither around the neon grid. Eat glowing energy spheres to grow without hitting the borders or yourself.', icon: '🐍', diff: 'easy', color: '#2ecc71' },
  { id: 'tetris', name: 'Retro Tetris', desc: 'Stack the falling geometric shapes. Clear full rows to boost your score and speed up levels.', icon: '🧱', diff: 'hard', color: '#a55eea' },
  { id: 'memory', name: 'Memory Match', desc: 'Flip and match pairs of colorful emojis in as few moves as possible. Test your brain speed.', icon: '🧠', diff: 'easy', color: '#ff4757' },
  { id: 'g2048', name: '2048 Puzzle', desc: 'Slide adjacent tiles of the same value to combine them. Work your way up to the ultimate 2048 tile.', icon: '🔢', diff: 'medium', color: '#ffd32a' },
  { id: 'mines', name: 'Minesweeper', desc: 'Clear the board without detonating hidden explosives. Use logic and numerical clues.', icon: '💣', diff: 'medium', color: '#ff5e57' },
  { id: 'ttt', name: 'Tic-Tac-Toe AI', desc: 'Engage in a battle of wits against a smart virtual AI player. Play X and get three in a row.', icon: '❌', diff: 'easy', color: '#45aaf2' },
  { id: 'breakout', name: 'Brick Breaker', desc: 'Control the bottom paddle and bounce the ball to shatter the wall of colored bricks overhead.', icon: '⚪', diff: 'medium', color: '#fffa65' },
  { id: 'mole', name: 'Whack-a-Mole', desc: 'Whack the moles as they pop out of the ground. Speed increases as time ticks down!', icon: '🐹', diff: 'easy', color: '#ff9f43' },
  { id: 'wordle', name: 'Word Guesser', desc: 'Guess the secret 5-letter word in 6 tries. Color-coded feedback guides your next steps.', icon: '📝', diff: 'medium', color: '#0be881' },
  { id: 'invaders', name: 'Space Invaders', desc: 'Defend Earth from columns of descending alien invaders. Fire lasers and dodge incoming plasma.', icon: '👾', diff: 'hard', color: '#3818e8' }
];

export default function GamesDashboard({ user, onLogout, onToggleToChat, onToggleToSpotify }) {
  const [activeGameId, setActiveGameId] = useState(null);

  // Play beep sound using Web Audio API
  const playBeep = (freq = 440, type = 'sine', duration = 0.08) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context block/unsupported
    }
  };

  return (
    <div className="games-dashboard-container">
      {/* HEADER */}
      <header className="games-header">
        <div className="games-header-title">
          <span className="arcade-badge">ARCADE</span>
          <h1>Gamer Hub</h1>
        </div>

        <div className="games-header-actions">
          <button className="portal-nav-btn chat-btn" onClick={onToggleToChat}>
            💬 Open Chat Portal
          </button>
          <button className="portal-nav-btn music-btn" onClick={onToggleToSpotify}>
            🎵 Open Spotify Portal
          </button>
          {user && (
            <div className="user-profile-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.85rem' }}>{user.username}</span>
            </div>
          )}
          <button className="portal-nav-btn" onClick={onLogout} style={{ color: '#ff4757', border: '1px solid rgba(255, 71, 87, 0.2)' }}>
            Logout
          </button>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <div className="games-content">
        {!activeGameId ? (
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '0.5px' }}>Explore Games</h2>
            <p style={{ color: '#a4b0be', marginBottom: '32px' }}>Choose a retro arcade game or strategic puzzle to play directly inside your dashboard portal.</p>
            <div className="games-grid">
              {GAMES_LIST.map(game => (
                <div 
                  key={game.id} 
                  className="game-card"
                  onClick={() => {
                    playBeep(520, 'square', 0.12);
                    setActiveGameId(game.id);
                  }}
                  style={{ '--game-theme': game.color }}
                >
                  <div className="game-card-icon">
                    {game.icon}
                  </div>
                  <div className="game-card-info">
                    <h3>{game.name}</h3>
                    <p>{game.desc}</p>
                    <div className="game-card-meta">
                      <span className={`game-difficulty diff-${game.diff}`}>{game.diff}</span>
                      <span className="play-action">PLAY NOW →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="active-game-container">
            <div className="game-back-bar">
              <button 
                className="portal-nav-btn" 
                onClick={() => {
                  playBeep(330, 'sawtooth', 0.1);
                  setActiveGameId(null);
                }}
              >
                ← Back to Game List
              </button>
              <div className="game-title-row">
                <span style={{ fontSize: '1.8rem' }}>
                  {GAMES_LIST.find(g => g.id === activeGameId)?.icon}
                </span>
                <h2>{GAMES_LIST.find(g => g.id === activeGameId)?.name}</h2>
              </div>
            </div>

            {/* Render selected game */}
            <GameRenderer gameId={activeGameId} playBeep={playBeep} />
          </div>
        )}
      </div>
    </div>
  );
}

// RENDER CORRESPONDING GAME COMPONENT
function GameRenderer({ gameId, playBeep }) {
  switch (gameId) {
    case 'snake':
      return <SnakeGame playBeep={playBeep} />;
    case 'tetris':
      return <TetrisGame playBeep={playBeep} />;
    case 'memory':
      return <MemoryGame playBeep={playBeep} />;
    case 'g2048':
      return <Game2048 playBeep={playBeep} />;
    case 'mines':
      return <MinesweeperGame playBeep={playBeep} />;
    case 'ttt':
      return <TicTacToeGame playBeep={playBeep} />;
    case 'breakout':
      return <BreakoutGame playBeep={playBeep} />;
    case 'mole':
      return <WhackAMoleGame playBeep={playBeep} />;
    case 'wordle':
      return <WordleGame playBeep={playBeep} />;
    case 'invaders':
      return <SpaceInvadersGame playBeep={playBeep} />;
    default:
      return <div>Game not found.</div>;
  }
}

/* ==========================================================================
   1. NEON SNAKE
   ========================================================================== */
function SnakeGame({ playBeep }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const directionRef = useRef({ x: 1, y: 0 });
  const snakeRef = useRef([{ x: 10, y: 10 }]);
  const foodRef = useRef({ x: 5, y: 5 });

  useEffect(() => {
    const saved = localStorage.getItem('snake_high');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const resetGame = () => {
    snakeRef.current = [{ x: 10, y: 10 }];
    directionRef.current = { x: 1, y: 0 };
    setScore(0);
    setGameOver(false);
    placeFood();
    playBeep(440, 'triangle', 0.15);
  };

  const placeFood = () => {
    foodRef.current = {
      x: Math.floor(Math.random() * 20),
      y: Math.floor(Math.random() * 20)
    };
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const curDir = directionRef.current;
      if (e.key === 'ArrowUp' && curDir.y === 0) directionRef.current = { x: 0, y: -1 };
      if (e.key === 'ArrowDown' && curDir.y === 0) directionRef.current = { x: 0, y: 1 };
      if (e.key === 'ArrowLeft' && curDir.x === 0) directionRef.current = { x: -1, y: 0 };
      if (e.key === 'ArrowRight' && curDir.x === 0) directionRef.current = { x: 1, y: 0 };
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (gameOver) return;

    const gameLoop = setInterval(() => {
      const snake = [...snakeRef.current];
      const head = {
        x: snake[0].x + directionRef.current.x,
        y: snake[0].y + directionRef.current.y
      };

      // Border check
      if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20) {
        handleLoss();
        clearInterval(gameLoop);
        return;
      }

      // Self hit check
      for (let segment of snake) {
        if (segment.x === head.x && segment.y === head.y) {
          handleLoss();
          clearInterval(gameLoop);
          return;
        }
      }

      // Move forward
      snake.unshift(head);

      // Food check
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        playBeep(880, 'sine', 0.08);
        const newScore = score + 10;
        setScore(newScore);
        if (newScore > highScore) {
          setHighScore(newScore);
          localStorage.setItem('snake_high', newScore.toString());
        }
        placeFood();
      } else {
        snake.pop();
      }

      snakeRef.current = snake;
      draw();
    }, 110);

    return () => clearInterval(gameLoop);
  }, [score, highScore, gameOver]);

  const handleLoss = () => {
    playBeep(180, 'sawtooth', 0.4);
    setGameOver(true);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 400, 400);

    // Draw Grid lines slightly
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 20, 0);
      ctx.lineTo(i * 20, 400);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * 20);
      ctx.lineTo(400, i * 20);
      ctx.stroke();
    }

    // Food
    ctx.fillStyle = '#ff4757';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff4757';
    ctx.fillRect(foodRef.current.x * 20 + 2, foodRef.current.y * 20 + 2, 16, 16);

    // Snake
    ctx.fillStyle = '#2ecc71';
    ctx.shadowColor = '#2ecc71';
    snakeRef.current.forEach((seg, i) => {
      ctx.shadowBlur = i === 0 ? 12 : 5;
      ctx.fillRect(seg.x * 20 + 1, seg.y * 20 + 1, 18, 18);
    });
    ctx.shadowBlur = 0;
  };

  useEffect(() => {
    draw();
  }, [gameOver]);

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#2ecc71' }}>
      <div className="game-stats">
        <div className="stat-item">Score: <span>{score}</span></div>
        <div className="stat-item">High Score: <span>{highScore}</span></div>
      </div>

      <canvas ref={canvasRef} width={400} height={400} className="snake-canvas" />

      {gameOver && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <p style={{ color: '#ff4757', fontWeight: 'bold' }}>GAME OVER</p>
          <button className="btn-arcade" onClick={resetGame} style={{ marginTop: '8px' }}>Play Again</button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   2. RETRO TETRIS
   ========================================================================== */
function TetrisGame({ playBeep }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gridWidth = 10;
  const gridHeight = 20;
  const blockWidth = 20;

  const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1, 1], [0, 1, 0]], // T
    [[1, 1], [1, 1]], // O
    [[1, 1, 0], [0, 1, 1]], // Z
    [[0, 1, 1], [1, 1, 0]], // S
    [[1, 1, 1], [1, 0, 0]], // L
    [[1, 1, 1], [0, 0, 1]]  // J
  ];
  const COLORS = ['#00ffff', '#a55eea', '#ffd32a', '#ff4757', '#2ecc71', '#ff9f43', '#45aaf2'];

  const gridRef = useRef(Array(gridHeight).fill().map(() => Array(gridWidth).fill(0)));
  const currentPieceRef = useRef({ shape: SHAPES[0], color: COLORS[0], x: 3, y: 0 });

  const spawnPiece = () => {
    const idx = Math.floor(Math.random() * SHAPES.length);
    currentPieceRef.current = {
      shape: SHAPES[idx],
      color: COLORS[idx],
      x: Math.floor((gridWidth - SHAPES[idx][0].length) / 2),
      y: 0
    };

    // Check instant game over
    if (checkCollision(0, 0, currentPieceRef.current.shape)) {
      setGameOver(true);
      playBeep(200, 'sawtooth', 0.5);
    }
  };

  const checkCollision = (dx, dy, shape = currentPieceRef.current.shape) => {
    const piece = currentPieceRef.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const nextX = piece.x + c + dx;
          const nextY = piece.y + r + dy;
          if (nextX < 0 || nextX >= gridWidth || nextY >= gridHeight) return true;
          if (nextY >= 0 && gridRef.current[nextY][nextX]) return true;
        }
      }
    }
    return false;
  };

  const rotatePiece = () => {
    const shape = currentPieceRef.current.shape;
    const rotated = Array(shape[0].length).fill().map((_, c) =>
      shape.map(row => row[c]).reverse()
    );
    if (!checkCollision(0, 0, rotated)) {
      currentPieceRef.current.shape = rotated;
      playBeep(400, 'triangle', 0.05);
      draw();
    }
  };

  const mergePiece = () => {
    const piece = currentPieceRef.current;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const y = piece.y + r;
          const x = piece.x + c;
          if (y >= 0) gridRef.current[y][x] = piece.color;
        }
      }
    }

    // Line clearing
    let cleared = 0;
    for (let r = gridHeight - 1; r >= 0; r--) {
      if (gridRef.current[r].every(cell => cell !== 0)) {
        gridRef.current.splice(r, 1);
        gridRef.current.unshift(Array(gridWidth).fill(0));
        cleared++;
        r++; // Check same row index again
      }
    }

    if (cleared > 0) {
      setScore(prev => prev + cleared * 100);
      playBeep(700, 'sine', 0.15);
    } else {
      playBeep(300, 'sine', 0.05);
    }

    spawnPiece();
  };

  const dropPiece = () => {
    if (gameOver) return;
    if (!checkCollision(0, 1)) {
      currentPieceRef.current.y += 1;
    } else {
      mergePiece();
    }
    draw();
  };

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(dropPiece, 800);
    return () => clearInterval(interval);
  }, [gameOver]);

  useEffect(() => {
    const handleKeys = (e) => {
      if (gameOver) return;
      if (e.key === 'ArrowLeft' && !checkCollision(-1, 0)) { currentPieceRef.current.x -= 1; draw(); }
      if (e.key === 'ArrowRight' && !checkCollision(1, 0)) { currentPieceRef.current.x += 1; draw(); }
      if (e.key === 'ArrowDown') { dropPiece(); }
      if (e.key === 'ArrowUp') { rotatePiece(); }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [gameOver]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 200, 400);

    // Static grid
    for (let r = 0; r < gridHeight; r++) {
      for (let c = 0; c < gridWidth; c++) {
        if (gridRef.current[r][c]) {
          ctx.fillStyle = gridRef.current[r][c];
          ctx.fillRect(c * blockWidth, r * blockWidth, blockWidth - 1, blockWidth - 1);
        }
      }
    }

    // Active piece
    const piece = currentPieceRef.current;
    ctx.fillStyle = piece.color;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          ctx.fillRect((piece.x + c) * blockWidth, (piece.y + r) * blockWidth, blockWidth - 1, blockWidth - 1);
        }
      }
    }
  };

  useEffect(() => {
    draw();
  }, [gameOver]);

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#a55eea' }}>
      <div className="game-stats">
        <div className="stat-item">Score: <span>{score}</span></div>
      </div>
      <canvas ref={canvasRef} width={200} height={400} className="tetris-canvas" />
      {gameOver && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <p style={{ color: '#ff4757', fontWeight: 'bold' }}>GAME OVER</p>
          <button className="btn-arcade" onClick={() => { gridRef.current = Array(gridHeight).fill().map(() => Array(gridWidth).fill(0)); setScore(0); setGameOver(false); spawnPiece(); }}>Restart</button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   3. MEMORY MATCH
   ========================================================================== */
function MemoryGame({ playBeep }) {
  const emojis = ['🎮', '👾', '🚀', '🔮', '👽', '🪐', '🍕', '🐱'];
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);

  const initGame = () => {
    const cardSet = [...emojis, ...emojis]
      .map((emoji, idx) => ({ id: idx, val: emoji }))
      .sort(() => Math.random() - 0.5);
    setCards(cardSet);
    setSelected([]);
    setMatched([]);
    setMoves(0);
    playBeep(600, 'sine', 0.1);
  };

  useEffect(() => {
    initGame();
  }, []);

  const handleCardClick = (card) => {
    if (selected.length === 2 || selected.some(c => c.id === card.id) || matched.includes(card.val)) return;

    const nextSelected = [...selected, card];
    setSelected(nextSelected);
    playBeep(480, 'sine', 0.05);

    if (nextSelected.length === 2) {
      setMoves(prev => prev + 1);
      if (nextSelected[0].val === nextSelected[1].val) {
        setMatched(prev => [...prev, card.val]);
        setSelected([]);
        playBeep(880, 'triangle', 0.15);
      } else {
        setTimeout(() => {
          setSelected([]);
        }, 800);
      }
    }
  };

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#ff4757' }}>
      <div className="game-stats">
        <div className="stat-item">Moves: <span>{moves}</span></div>
        <div className="stat-item">Matches: <span>{matched.length} / 8</span></div>
      </div>
      <div className="memory-grid">
        {cards.map(card => {
          const isFlipped = selected.some(c => c.id === card.id) || matched.includes(card.val);
          return (
            <div 
              key={card.id} 
              className={`memory-card ${isFlipped ? 'flipped' : ''} ${matched.includes(card.val) ? 'matched' : ''}`}
              onClick={() => handleCardClick(card)}
            >
              {isFlipped ? card.val : '❓'}
            </div>
          );
        })}
      </div>
      {matched.length === 8 && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#2ecc71', fontWeight: 'bold' }}>Success! Brain speed matches complete.</p>
          <button className="btn-arcade" onClick={initGame} style={{ marginTop: '8px' }}>Play Again</button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   4. 2048 PUZZLE
   ========================================================================== */
function Game2048({ playBeep }) {
  const [board, setBoard] = useState(Array(16).fill(0));
  const [score, setScore] = useState(0);

  const initGame = () => {
    let newBoard = Array(16).fill(0);
    newBoard = addRandomTile(newBoard);
    newBoard = addRandomTile(newBoard);
    setBoard(newBoard);
    setScore(0);
  };

  const addRandomTile = (curBoard) => {
    const emptyIndices = curBoard.map((val, idx) => val === 0 ? idx : null).filter(val => val !== null);
    if (emptyIndices.length === 0) return curBoard;
    const randIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    const copy = [...curBoard];
    copy[randIdx] = Math.random() < 0.9 ? 2 : 4;
    return copy;
  };

  useEffect(() => {
    initGame();
  }, []);

  const slide = (row) => {
    let filtered = row.filter(val => val !== 0);
    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i] === filtered[i + 1]) {
        filtered[i] *= 2;
        setScore(prev => prev + filtered[i]);
        filtered[i + 1] = 0;
      }
    }
    filtered = filtered.filter(val => val !== 0);
    while (filtered.length < 4) {
      filtered.push(0);
    }
    return filtered;
  };

  const handleMove = (dir) => {
    let nextBoard = [...board];
    let changed = false;

    // Up/Down/Left/Right matrices conversion
    for (let i = 0; i < 4; i++) {
      let line = [];
      let indices = [];

      // map indices depending on direction
      for (let j = 0; j < 4; j++) {
        let idx;
        if (dir === 'left') idx = i * 4 + j;
        else if (dir === 'right') idx = i * 4 + (3 - j);
        else if (dir === 'up') idx = j * 4 + i;
        else idx = (3 - j) * 4 + i;
        line.push(board[idx]);
        indices.push(idx);
      }

      const slided = slide(line);
      for (let j = 0; j < 4; j++) {
        if (nextBoard[indices[j]] !== slided[j]) {
          changed = true;
          nextBoard[indices[j]] = slided[j];
        }
      }
    }

    if (changed) {
      nextBoard = addRandomTile(nextBoard);
      setBoard(nextBoard);
      playBeep(450, 'triangle', 0.05);
    }
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') handleMove('left');
      if (e.key === 'ArrowRight') handleMove('right');
      if (e.key === 'ArrowUp') handleMove('up');
      if (e.key === 'ArrowDown') handleMove('down');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [board]);

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#ffd32a' }}>
      <div className="game-stats">
        <div className="stat-item">Score: <span>{score}</span></div>
      </div>
      <div className="grid-2048">
        {board.map((cell, idx) => (
          <div key={idx} className="cell-2048" style={{ background: cell > 0 ? `hsl(${45 + Math.log2(cell) * 20}, 80%, 40%)` : '' }}>
            {cell > 0 ? cell : ''}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button className="btn-arcade" onClick={initGame}>Reset</button>
      </div>
    </div>
  );
}

/* ==========================================================================
   5. MINESWEEPER
   ========================================================================== */
function MinesweeperGame({ playBeep }) {
  const rows = 8;
  const cols = 8;
  const mineCount = 10;

  const [grid, setGrid] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameWin, setGameWin] = useState(false);

  const initGame = () => {
    setGameOver(false);
    setGameWin(false);

    let emptyGrid = Array(rows * cols).fill().map((_, idx) => ({
      id: idx,
      r: Math.floor(idx / cols),
      c: idx % cols,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      neighborMines: 0
    }));

    // Place mines
    let placed = 0;
    while (placed < mineCount) {
      const idx = Math.floor(Math.random() * (rows * cols));
      if (!emptyGrid[idx].isMine) {
        emptyGrid[idx].isMine = true;
        placed++;
      }
    }

    // Count neighbors
    for (let cell of emptyGrid) {
      if (cell.isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = cell.r + dr;
          const nc = cell.c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighbor = emptyGrid[nr * cols + nc];
            if (neighbor.isMine) count++;
          }
        }
      }
      cell.neighborMines = count;
    }

    setGrid(emptyGrid);
    playBeep(400, 'triangle', 0.1);
  };

  useEffect(() => {
    initGame();
  }, []);

  const revealCell = (cell) => {
    if (gameOver || gameWin || cell.isRevealed || cell.isFlagged) return;

    let copy = [...grid];
    if (cell.isMine) {
      setGameOver(true);
      playBeep(150, 'sawtooth', 0.5);
      // reveal all mines
      copy.forEach(c => { if (c.isMine) c.isRevealed = true; });
      setGrid(copy);
      return;
    }

    // Flood fill
    const queue = [cell.id];
    const visited = new Set();
    while (queue.length > 0) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);

      const cur = copy[id];
      cur.isRevealed = true;

      if (cur.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = cur.r + dr;
            const nc = cur.c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              const neighbor = copy[nr * cols + nc];
              if (!neighbor.isMine && !neighbor.isRevealed) {
                queue.push(neighbor.id);
              }
            }
          }
        }
      }
    }

    // Check Win
    const safeCells = copy.filter(c => !c.isMine);
    if (safeCells.every(c => c.isRevealed)) {
      setGameWin(true);
      playBeep(800, 'sine', 0.3);
    }

    setGrid(copy);
    playBeep(600, 'sine', 0.05);
  };

  const flagCell = (e, cell) => {
    e.preventDefault();
    if (gameOver || gameWin || cell.isRevealed) return;
    let copy = [...grid];
    copy[cell.id].isFlagged = !copy[cell.id].isFlagged;
    setGrid(copy);
    playBeep(450, 'sine', 0.05);
  };

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#ff5e57' }}>
      <div className="game-stats">
        <div className="stat-item">Mines: <span>{mineCount}</span></div>
      </div>
      <div className="minesweeper-grid" style={{ gridTemplateColumns: `repeat(${cols}, 32px)` }}>
        {grid.map(cell => (
          <div 
            key={cell.id} 
            className={`mine-cell ${cell.isRevealed ? 'revealed' : ''} ${cell.isRevealed && cell.isMine ? 'mine' : ''}`}
            onClick={() => revealCell(cell)}
            onContextMenu={(e) => flagCell(e, cell)}
          >
            {cell.isRevealed 
              ? (cell.isMine ? '💥' : (cell.neighborMines || '')) 
              : (cell.isFlagged ? '🚩' : '')}
          </div>
        ))}
      </div>
      {(gameOver || gameWin) && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <p style={{ color: gameOver ? '#ff4757' : '#2ecc71', fontWeight: 'bold' }}>
            {gameOver ? 'KABOOM! Game Over.' : 'Swept Clean! You Win.'}
          </p>
          <button className="btn-arcade" onClick={initGame} style={{ marginTop: '8px' }}>Restart</button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   6. TIC-TAC-TOE VS AI
   ========================================================================== */
function TicTacToeGame({ playBeep }) {
  const [board, setBoard] = useState(Array(9).fill(''));
  const [winner, setWinner] = useState(null);

  const checkWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let line of lines) {
      const [a, b, c] = line;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (squares.every(s => s !== '')) return 'Draw';
    return null;
  };

  const makeAIMove = (currentSquares) => {
    const emptyIndices = currentSquares.map((val, idx) => val === '' ? idx : null).filter(val => val !== null);
    if (emptyIndices.length === 0) return;

    // AI chooses smart center or random corner if available
    let chosenIdx = emptyIndices[0];
    if (emptyIndices.includes(4)) {
      chosenIdx = 4;
    } else {
      chosenIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    const nextSquares = [...currentSquares];
    nextSquares[chosenIdx] = 'O';
    setBoard(nextSquares);
    const win = checkWinner(nextSquares);
    if (win) {
      setWinner(win);
      playBeep(win === 'O' ? 200 : 700, 'sine', 0.2);
    } else {
      playBeep(450, 'sine', 0.05);
    }
  };

  const handleCellClick = (idx) => {
    if (board[idx] !== '' || winner) return;

    const nextSquares = [...board];
    nextSquares[idx] = 'X';
    setBoard(nextSquares);
    playBeep(600, 'sine', 0.05);

    const win = checkWinner(nextSquares);
    if (win) {
      setWinner(win);
      playBeep(win === 'X' ? 880 : 330, 'sine', 0.25);
    } else {
      setTimeout(() => {
        makeAIMove(nextSquares);
      }, 500);
    }
  };

  const initGame = () => {
    setBoard(Array(9).fill(''));
    setWinner(null);
    playBeep(520, 'sine', 0.08);
  };

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#45aaf2' }}>
      <div className="ttt-grid">
        {board.map((cell, idx) => (
          <div key={idx} className="ttt-cell" onClick={() => handleCellClick(idx)}>
            <span style={{ color: cell === 'X' ? '#45aaf2' : '#ff4757' }}>{cell}</span>
          </div>
        ))}
      </div>
      {winner && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <p style={{ fontWeight: 'bold' }}>
            {winner === 'Draw' ? 'It is a Draw!' : `Winner: Player ${winner}`}
          </p>
          <button className="btn-arcade" onClick={initGame} style={{ marginTop: '8px' }}>Restart</button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   7. BRICK BREAKER
   ========================================================================== */
function BreakoutGame({ playBeep }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWin, setGameWin] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let paddleWidth = 70;
    let paddleHeight = 10;
    let paddleX = (canvas.width - paddleWidth) / 2;

    let ballRadius = 8;
    let x = canvas.width / 2;
    let y = canvas.height - 30;
    let dx = 2.5;
    let dy = -2.5;

    let brickRowCount = 3;
    let brickColumnCount = 5;
    let brickWidth = 60;
    let brickHeight = 18;
    let brickPadding = 10;
    let brickOffsetTop = 30;
    let brickOffsetLeft = 30;

    let rightPressed = false;
    let leftPressed = false;

    let bricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
      bricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        bricks[c][r] = { x: 0, y: 0, status: 1 };
      }
    }

    const keyDownHandler = (e) => {
      if (e.key === 'Right' || e.key === 'ArrowRight') rightPressed = true;
      else if (e.key === 'Left' || e.key === 'ArrowLeft') leftPressed = true;
    };

    const keyUpHandler = (e) => {
      if (e.key === 'Right' || e.key === 'ArrowRight') rightPressed = false;
      else if (e.key === 'Left' || e.key === 'ArrowLeft') leftPressed = false;
    };

    document.addEventListener('keydown', keyDownHandler);
    document.addEventListener('keyup', keyUpHandler);

    const collisionDetection = () => {
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          let b = bricks[c][r];
          if (b.status === 1) {
            if (x > b.x && x < b.x + brickWidth && y > b.y && y < b.y + brickHeight) {
              dy = -dy;
              b.status = 0;
              setScore(prev => {
                const ns = prev + 10;
                if (ns === brickRowCount * brickColumnCount * 10) {
                  setGameWin(true);
                  playBeep(880, 'sine', 0.2);
                }
                return ns;
              });
              playBeep(600, 'sine', 0.05);
            }
          }
        }
      }
    };

    const drawBall = () => {
      ctx.beginPath();
      ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#fffa65';
      ctx.fill();
      ctx.closePath();
    };

    const drawPaddle = () => {
      ctx.beginPath();
      ctx.rect(paddleX, canvas.height - paddleHeight, paddleWidth, paddleHeight);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.closePath();
    };

    const drawBricks = () => {
      const colors = ['#ff4757', '#ff9f43', '#2ecc71'];
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          if (bricks[c][r].status === 1) {
            let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
            let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
            bricks[c][r].x = brickX;
            bricks[c][r].y = brickY;
            ctx.beginPath();
            ctx.rect(brickX, brickY, brickWidth, brickHeight);
            ctx.fillStyle = colors[r] || '#ff4757';
            ctx.fill();
            ctx.closePath();
          }
        }
      }
    };

    const drawLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBricks();
      drawBall();
      drawPaddle();
      collisionDetection();

      // Wall reflection
      if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) {
        dx = -dx;
        playBeep(400, 'triangle', 0.03);
      }
      if (y + dy < ballRadius) {
        dy = -dy;
        playBeep(400, 'triangle', 0.03);
      } else if (y + dy > canvas.height - ballRadius) {
        // Paddle collision
        if (x > paddleX && x < paddleX + paddleWidth) {
          dy = -dy;
          playBeep(520, 'sine', 0.05);
        } else {
          setGameOver(true);
          playBeep(180, 'sawtooth', 0.4);
          return;
        }
      }

      // Move paddle
      if (rightPressed && paddleX < canvas.width - paddleWidth) paddleX += 4;
      else if (leftPressed && paddleX > 0) paddleX -= 4;

      x += dx;
      y += dy;

      animationFrameId = requestAnimationFrame(drawLoop);
    };

    drawLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('keydown', keyDownHandler);
      document.removeEventListener('keyup', keyUpHandler);
    };
  }, [gameOver, gameWin]);

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#fffa65' }}>
      <div className="game-stats">
        <div className="stat-item">Score: <span>{score}</span></div>
      </div>
      <canvas ref={canvasRef} width={380} height={280} style={{ border: '2px solid #fffa65', background: '#090a0f', borderRadius: '8px' }} />
      {(gameOver || gameWin) && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <p style={{ color: gameOver ? '#ff4757' : '#2ecc71', fontWeight: 'bold' }}>
            {gameOver ? 'Game Over!' : 'Victory! Wall Smashed.'}
          </p>
          <button className="btn-arcade" onClick={() => { setScore(0); setGameOver(false); setGameWin(false); }}>Restart</button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   8. WHACK-A-MOLE
   ========================================================================== */
function WhackAMoleGame({ playBeep }) {
  const [score, setScore] = useState(0);
  const [activeIdx, setActiveIdx] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [gameStarted, setGameStarted] = useState(false);

  const startGame = () => {
    setScore(0);
    setTimeLeft(20);
    setGameStarted(true);
    playBeep(520, 'triangle', 0.1);
  };

  useEffect(() => {
    if (!gameStarted || timeLeft <= 0) {
      if (timeLeft === 0) {
        setGameStarted(false);
        playBeep(330, 'sawtooth', 0.3);
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    const moleTimer = setInterval(() => {
      const randIdx = Math.floor(Math.random() * 9);
      setActiveIdx(randIdx);
    }, 850);

    return () => {
      clearInterval(timer);
      clearInterval(moleTimer);
    };
  }, [gameStarted, timeLeft]);

  const handleWhack = (idx) => {
    if (idx === activeIdx && timeLeft > 0) {
      setScore(prev => prev + 1);
      setActiveIdx(null); // immediately hide
      playBeep(880, 'sine', 0.05);
    }
  };

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#ff9f43' }}>
      <div className="game-stats">
        <div className="stat-item">Score: <span>{score}</span></div>
        <div className="stat-item">Time Left: <span>{timeLeft}s</span></div>
      </div>
      <div className="wam-grid">
        {Array(9).fill().map((_, idx) => (
          <div key={idx} className="wam-hole" onClick={() => handleWhack(idx)}>
            <div className={`wam-mole ${idx === activeIdx ? 'up' : ''}`}>🐹</div>
          </div>
        ))}
      </div>
      {!gameStarted && (
        <button className="btn-arcade" onClick={startGame} style={{ marginTop: '16px' }}>
          {timeLeft === 20 ? 'Start Game' : 'Play Again'}
        </button>
      )}
    </div>
  );
}

/* ==========================================================================
   9. WORD GUESSER (WORDLE)
   ========================================================================== */
function WordleGame({ playBeep }) {
  const SECRET = 'REACT';
  const [guesses, setGuesses] = useState(Array(6).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [guessIndex, setGuessIndex] = useState(0);
  const [status, setStatus] = useState(''); // 'playing', 'won', 'lost'

  const handleKeyPress = (char) => {
    if (status && status !== 'playing') return;
    if (char === 'ENTER') {
      if (currentGuess.length !== 5) return;
      const nextGuesses = [...guesses];
      nextGuesses[guessIndex] = currentGuess;
      setGuesses(nextGuesses);
      setCurrentGuess('');
      setGuessIndex(prev => prev + 1);

      if (currentGuess === SECRET) {
        setStatus('won');
        playBeep(880, 'sine', 0.3);
      } else if (guessIndex === 5) {
        setStatus('lost');
        playBeep(200, 'sawtooth', 0.4);
      } else {
        playBeep(600, 'triangle', 0.05);
      }
    } else if (char === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < 5) {
      setCurrentGuess(prev => prev + char.toUpperCase());
    }
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Enter') handleKeyPress('ENTER');
      else if (e.key === 'Backspace') handleKeyPress('BACKSPACE');
      else if (/^[a-zA-Z]$/.test(e.key)) handleKeyPress(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentGuess, status, guessIndex]);

  const getLetterColor = (guess, letterIdx) => {
    const char = guess[letterIdx];
    if (SECRET[letterIdx] === char) return '#2ecc71'; // Exact match
    if (SECRET.includes(char)) return '#f1c40f'; // Partial match
    return '#57606f'; // Wrong
  };

  const resetGame = () => {
    setGuesses(Array(6).fill(''));
    setCurrentGuess('');
    setGuessIndex(0);
    setStatus('playing');
  };

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#0be881' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {guesses.map((g, rowIdx) => {
          const word = rowIdx === guessIndex ? currentGuess.padEnd(5, ' ') : g.padEnd(5, ' ');
          return (
            <div key={rowIdx} style={{ display: 'flex', gap: '8px' }}>
              {Array(5).fill().map((_, colIdx) => {
                const char = word[colIdx]?.trim();
                const bg = (rowIdx < guessIndex && char) ? getLetterColor(g, colIdx) : '#2f3542';
                return (
                  <div key={colIdx} style={{ width: '40px', height: '40px', background: bg, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', borderRadius: '4px' }}>
                    {char}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {status && status !== 'playing' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: status === 'won' ? '#2ecc71' : '#ff4757', fontWeight: 'bold' }}>
            {status === 'won' ? 'Amazing! You solved it.' : `Failed. Secret was ${SECRET}`}
          </p>
          <button className="btn-arcade" onClick={resetGame} style={{ marginTop: '8px' }}>Play Again</button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   10. SPACE INVADERS
   ========================================================================== */
function SpaceInvadersGame({ playBeep }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let playerX = canvas.width / 2;
    let playerWidth = 30;
    let playerHeight = 15;
    let laser = null; // { x, y }

    let invaders = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        invaders.push({
          x: c * 45 + 30,
          y: r * 30 + 30,
          w: 24,
          h: 16,
          alive: true
        });
      }
    }

    let direction = 1;
    let leftPressed = false;
    let rightPressed = false;

    const keyDown = (e) => {
      if (e.key === 'ArrowLeft') leftPressed = true;
      if (e.key === 'ArrowRight') rightPressed = true;
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (!laser) {
          laser = { x: playerX + playerWidth / 2, y: canvas.height - 20 };
          playBeep(700, 'sine', 0.05);
        }
      }
    };

    const keyUp = (e) => {
      if (e.key === 'ArrowLeft') leftPressed = false;
      if (e.key === 'ArrowRight') rightPressed = false;
    };

    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    const update = () => {
      // Move Player
      if (leftPressed && playerX > 0) playerX -= 3;
      if (rightPressed && playerX < canvas.width - playerWidth) playerX += 3;

      // Laser Update
      if (laser) {
        laser.y -= 5;
        if (laser.y < 0) laser = null;
      }

      // Invaders Update
      let shiftDown = false;
      invaders.forEach(inv => {
        if (!inv.alive) return;
        inv.x += direction * 0.8;
        if (inv.x + inv.w > canvas.width || inv.x < 0) {
          shiftDown = true;
        }

        // Collision Check with Laser
        if (laser && inv.alive) {
          if (laser.x > inv.x && laser.x < inv.x + inv.w && laser.y > inv.y && laser.y < inv.y + inv.h) {
            inv.alive = false;
            laser = null;
            setScore(s => s + 20);
            playBeep(330, 'square', 0.08);
          }
        }
      });

      if (shiftDown) {
        direction = -direction;
        invaders.forEach(inv => {
          inv.y += 10;
          if (inv.y > canvas.height - 40 && inv.alive) {
            setGameOver(true);
            playBeep(180, 'sawtooth', 0.4);
          }
        });
      }

      // Draw Everything
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Player
      ctx.fillStyle = '#3818e8';
      ctx.fillRect(playerX, canvas.height - 20, playerWidth, playerHeight);

      // Laser
      if (laser) {
        ctx.fillStyle = '#ff4757';
        ctx.fillRect(laser.x - 2, laser.y, 4, 10);
      }

      // Invaders
      invaders.forEach(inv => {
        if (!inv.alive) return;
        ctx.fillStyle = '#3818e8';
        ctx.fillRect(inv.x, inv.y, inv.w, inv.h);
      });

      if (!gameOver) {
        animationFrameId = requestAnimationFrame(update);
      }
    };

    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [gameOver]);

  return (
    <div className="game-board-wrapper" style={{ '--game-theme': '#3818e8' }}>
      <div className="game-stats">
        <div className="stat-item">Score: <span>{score}</span></div>
      </div>
      <canvas ref={canvasRef} width={340} height={260} style={{ border: '2px solid #3818e8', background: '#020205', borderRadius: '8px' }} />
      {gameOver && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <p style={{ color: '#ff4757', fontWeight: 'bold' }}>GAME OVER</p>
          <button className="btn-arcade" onClick={() => setGameOver(false)}>Restart</button>
        </div>
      )}
    </div>
  );
}
