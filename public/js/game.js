/* ============================================
   TETRIS NES — game.js
   ============================================ */

const API = '';  // same origin

// ── STATE ──────────────────────────────────
let currentPlayer = null;  // { id, name }
let playerStats   = null;  // { best_score, total_games, total_lines }

// ── TETROMINOES ────────────────────────────
const TETROMINOES = {
  I: {
    color: 't-I',
    shapes: [
      [0,1,2,3],
      [0,4,8,12],
      [0,1,2,3],
      [0,4,8,12]
    ],
    offsets: [[0,0],[3,0],[0,-1],[3,-1]]  // not used directly, kept for ref
  },
  O: {
    color: 't-O',
    shapes: [
      [0,1,4,5],
      [0,1,4,5],
      [0,1,4,5],
      [0,1,4,5]
    ]
  },
  T: {
    color: 't-T',
    shapes: [
      [1,4,5,6],
      [1,4,5,9],
      [4,5,6,9],
      [1,5,6,9]
    ]
  },
  S: {
    color: 't-S',
    shapes: [
      [1,2,4,5],
      [0,4,5,9],
      [1,2,4,5],
      [0,4,5,9]
    ]
  },
  Z: {
    color: 't-Z',
    shapes: [
      [0,1,5,6],
      [2,4,5,9],
      [0,1,5,6],
      [2,4,5,9]
    ]
  },
  L: {
    color: 't-L',
    shapes: [
      [2,4,5,6],
      [0,4,8,9],
      [0,1,2,6],
      [0,1,5,9]
    ]
  },
  J: {
    color: 't-J',
    shapes: [
      [0,4,5,6],
      [0,1,4,8],
      [0,1,2,8],
      [1,5,8,9]
    ]
  }
};

const TETROMINO_KEYS = Object.keys(TETROMINOES);

const COLS = 10;
const ROWS = 20;
const NEXT_SIZE = 4;

// Score per lines (NES-style)
const LINE_SCORES = [0, 40, 100, 300, 1200];
// Speed per level (ms interval)
function getSpeed(level) {
  const speeds = [800, 717, 633, 550, 467, 383, 300, 217, 133, 100, 83, 83, 83, 67, 67, 67, 50, 50, 50, 33];
  return speeds[Math.min(level - 1, speeds.length - 1)];
}

// ── DOM REFS ───────────────────────────────
const screenLogin   = document.getElementById('screen-login');
const screenGame    = document.getElementById('screen-game');
const screenRanking = document.getElementById('screen-ranking');

const playerNameInput   = document.getElementById('player-name-input');
const btnStartLogin     = document.getElementById('btn-start-login');
const btnViewRanking    = document.getElementById('btn-view-ranking');
const loginError        = document.getElementById('login-error');

const gameGrid          = document.getElementById('game-grid');
const nextGrid          = document.getElementById('next-grid');
const scoreDisplay      = document.getElementById('score-display');
const bestScoreDisplay  = document.getElementById('best-score-display');
const linesDisplay      = document.getElementById('lines-display');
const levelDisplay      = document.getElementById('level-display');
const displayPlayerName = document.getElementById('display-player-name');

const overlayMessage    = document.getElementById('overlay-message');
const overlayText       = document.getElementById('overlay-text');
const btnOverlayAction  = document.getElementById('btn-overlay-action');
const btnOverlayRanking = document.getElementById('btn-overlay-ranking');
const btnOverlayHome    = document.getElementById('btn-overlay-home');

const btnPause          = document.getElementById('btn-pause');
const btnQuit           = document.getElementById('btn-quit');
const rankingList       = document.getElementById('ranking-list');
const btnRankingBack    = document.getElementById('btn-ranking-back');

// ── GRID ───────────────────────────────────
let board = [];       // 2D: board[row][col] = '' | colorClass
let cells = [];       // flat DOM refs
let nextCells = [];

function buildGridDOM() {
  gameGrid.innerHTML = '';
  nextGrid.innerHTML = '';
  cells = [];
  nextCells = [];
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(''));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      gameGrid.appendChild(div);
      cells.push(div);
    }
  }

  for (let i = 0; i < NEXT_SIZE * NEXT_SIZE; i++) {
    const div = document.createElement('div');
    div.className = 'cell';
    nextGrid.appendChild(div);
    nextCells.push(div);
  }
}

function idx(r, c) { return r * COLS + c; }

// ── GAME STATE ─────────────────────────────
let currentPiece   = null;
let currentPos     = { r: 0, c: 0 };
let currentRot     = 0;
let currentKey     = '';
let nextKey        = '';
let score          = 0;
let lines          = 0;
let level          = 1;
let gameRunning    = false;
let paused         = false;
let timerId        = null;
let lockTimer      = null;
let lastSavedScore = 0;

// ── PIECE LOGIC ────────────────────────────
function randomKey() {
  return TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];
}

function getShape(key, rot) {
  return TETROMINOES[key].shapes[rot % TETROMINOES[key].shapes.length];
}

// Convert flat 4x4 shape indices to {r, c} relative coords
function shapeToCells(shape) {
  return shape.map(i => ({ r: Math.floor(i / NEXT_SIZE), c: i % NEXT_SIZE }));
}

function isValid(key, rot, pr, pc) {
  const cells = shapeToCells(getShape(key, rot));
  return cells.every(({ r, c }) => {
    const nr = pr + r;
    const nc = pc + c;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
    if (board[nr][nc]) return false;
    return true;
  });
}

function spawnPiece() {
  currentKey = nextKey || randomKey();
  nextKey    = randomKey();
  currentRot = 0;
  currentPos = { r: 0, c: 3 };

  // Try row -1 spawn to avoid instant-block on visible row
  if (!isValid(currentKey, currentRot, currentPos.r, currentPos.c)) {
    if (!isValid(currentKey, currentRot, currentPos.r - 1, currentPos.c)) {
      endGame();
      return false;
    }
    currentPos.r = -1;
  }
  drawNext();
  return true;
}

// ── RENDER ─────────────────────────────────
function render() {
  // Clear all live/ghost cells
  cells.forEach(c => {
    c.className = 'cell';
    if (c._color) {
      c.classList.add('filled', c._color);
    }
  });

  // Draw ghost
  let ghostR = currentPos.r;
  while (isValid(currentKey, currentRot, ghostR + 1, currentPos.c)) ghostR++;
  if (ghostR !== currentPos.r) {
    shapeToCells(getShape(currentKey, currentRot)).forEach(({ r, c }) => {
      const nr = ghostR + r;
      const nc = currentPos.c + c;
      if (nr >= 0 && nr < ROWS) {
        const cell = cells[idx(nr, nc)];
        if (!cell._color) cell.classList.add('ghost');
      }
    });
  }

  // Draw current piece
  shapeToCells(getShape(currentKey, currentRot)).forEach(({ r, c }) => {
    const nr = currentPos.r + r;
    const nc = currentPos.c + c;
    if (nr >= 0 && nr < ROWS) {
      const cell = cells[idx(nr, nc)];
      cell.classList.remove('ghost');
      cell.classList.add('filled', TETROMINOES[currentKey].color);
    }
  });
}

function renderBoard() {
  cells.forEach((cell, i) => {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    cell._color = board[r][c] || null;
    cell.className = 'cell';
    if (cell._color) cell.classList.add('filled', cell._color);
  });
}

function drawNext() {
  nextCells.forEach(c => { c.className = 'cell'; c._color = null; });
  shapeToCells(getShape(nextKey, 0)).forEach(({ r, c }) => {
    const cell = nextCells[r * NEXT_SIZE + c];
    if (cell) {
      cell.classList.add('filled', TETROMINOES[nextKey].color);
      cell._color = TETROMINOES[nextKey].color;
    }
  });
}

// ── MOVEMENT ───────────────────────────────
function moveLeft() {
  if (!gameRunning || paused) return;
  if (isValid(currentKey, currentRot, currentPos.r, currentPos.c - 1)) {
    currentPos.c--;
    render();
  }
}

function moveRight() {
  if (!gameRunning || paused) return;
  if (isValid(currentKey, currentRot, currentPos.r, currentPos.c + 1)) {
    currentPos.c++;
    render();
  }
}

function rotate() {
  if (!gameRunning || paused) return;
  const newRot = (currentRot + 1) % TETROMINOES[currentKey].shapes.length;
  // Wall kick: try 0, -1, +1, -2, +2
  for (const kick of [0, -1, 1, -2, 2]) {
    if (isValid(currentKey, newRot, currentPos.r, currentPos.c + kick)) {
      currentRot = newRot;
      currentPos.c += kick;
      render();
      return;
    }
  }
}

function softDrop() {
  if (!gameRunning || paused) return;
  if (isValid(currentKey, currentRot, currentPos.r + 1, currentPos.c)) {
    currentPos.r++;
    render();
    score += 1;
    updateScoreDisplay();
  } else {
    lock();
  }
}

function hardDrop() {
  if (!gameRunning || paused) return;
  let dropped = 0;
  while (isValid(currentKey, currentRot, currentPos.r + 1, currentPos.c)) {
    currentPos.r++;
    dropped++;
  }
  score += dropped * 2;
  updateScoreDisplay();
  lock();
}

function tick() {
  if (!gameRunning || paused) return;
  if (isValid(currentKey, currentRot, currentPos.r + 1, currentPos.c)) {
    currentPos.r++;
    render();
  } else {
    lock();
  }
}

// ── LOCK & LINE CLEAR ──────────────────────
function lock() {
  // Stamp piece onto board
  shapeToCells(getShape(currentKey, currentRot)).forEach(({ r, c }) => {
    const nr = currentPos.r + r;
    const nc = currentPos.c + c;
    if (nr >= 0 && nr < ROWS) {
      board[nr][nc] = TETROMINOES[currentKey].color;
    }
  });

  // Find full rows
  const fullRows = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(cell => cell !== '')) fullRows.push(r);
  }

  if (fullRows.length > 0) {
    // Flash animation
    fullRows.forEach(r => {
      for (let c = 0; c < COLS; c++) {
        cells[idx(r, c)].classList.add('clearing');
      }
    });
    setTimeout(() => {
      // Remove rows
      fullRows.forEach(r => {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(''));
      });
      // Update score
      const cleared = fullRows.length;
      lines += cleared;
      score += LINE_SCORES[cleared] * level;
      level = Math.floor(lines / 10) + 1;
      updateScoreDisplay();
      renderBoard();
      spawnPiece() && render();
    }, 300);
  } else {
    renderBoard();
    spawnPiece() && render();
  }
}

// ── SCORE DISPLAY ──────────────────────────
function pad(n, len) { return String(n).padStart(len, '0'); }

function updateScoreDisplay() {
  scoreDisplay.textContent     = pad(score, 6);
  linesDisplay.textContent     = pad(lines, 2);
  levelDisplay.textContent     = pad(level, 2);
  const best = Math.max(score, parseInt(playerStats?.best_score || 0));
  bestScoreDisplay.textContent = pad(best, 6);
}

// ── GAME FLOW ──────────────────────────────
function startGame() {
  score = 0; lines = 0; level = 1;
  gameRunning = true; paused = false;
  overlayMessage.classList.add('hidden');
  screenGame.classList.remove('paused');
  buildGridDOM();
  updateScoreDisplay();
  nextKey = randomKey();
  spawnPiece();
  render();
  clearInterval(timerId);
  timerId = setInterval(tick, getSpeed(level));
}

function togglePause() {
  if (!gameRunning) return;
  paused = !paused;
  if (paused) {
    clearInterval(timerId);
    screenGame.classList.add('paused');
    btnPause.textContent = '▶ REANUDAR';
  } else {
    timerId = setInterval(tick, getSpeed(level));
    screenGame.classList.remove('paused');
    btnPause.textContent = '⏸ PAUSA';
  }
}

// Adjust speed as level increases
let prevLevel = 1;
setInterval(() => {
  if (gameRunning && !paused && level !== prevLevel) {
    prevLevel = level;
    clearInterval(timerId);
    timerId = setInterval(tick, getSpeed(level));
  }
}, 500);

async function endGame() {
  gameRunning = false;
  paused = false;
  clearInterval(timerId);

  overlayText.textContent = 'GAME OVER';
  overlayMessage.classList.remove('hidden');
  btnOverlayAction.textContent = 'JUGAR DE NUEVO';

  // Save to server
  if (currentPlayer) {
    try {
      await fetch(`${API}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: currentPlayer.id, score, lines })
      });
      // Refresh best score
      const res = await fetch(`${API}/api/players/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: currentPlayer.name })
      });
      const data = await res.json();
      if (data.stats) {
        playerStats = data.stats;
        updateScoreDisplay();
      }
    } catch (e) {
      console.error('Error guardando partida:', e);
    }
  }
}

// ── KEYBOARD ───────────────────────────────
let dasTimer  = null;
let dasActive = false;
const DAS_DELAY = 150;
const DAS_RATE  = 50;

document.addEventListener('keydown', e => {
  if (!gameRunning) return;
  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      moveLeft();
      if (!dasActive) {
        dasActive = true;
        dasTimer = setTimeout(() => {
          dasTimer = setInterval(moveLeft, DAS_RATE);
        }, DAS_DELAY);
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      moveRight();
      if (!dasActive) {
        dasActive = true;
        dasTimer = setTimeout(() => {
          dasTimer = setInterval(moveRight, DAS_RATE);
        }, DAS_DELAY);
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      rotate();
      break;
    case 'ArrowDown':
      e.preventDefault();
      softDrop();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyP':
      togglePause();
      break;
  }
});

document.addEventListener('keyup', e => {
  if (['ArrowLeft','ArrowRight'].includes(e.code)) {
    clearTimeout(dasTimer);
    clearInterval(dasTimer);
    dasActive = false;
  }
});

// ── LOGIN ───────────────────────────────────
btnStartLogin.addEventListener('click', handleLogin);
playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});
playerNameInput.addEventListener('input', () => {
  playerNameInput.value = playerNameInput.value.toUpperCase();
});

async function handleLogin() {
  const name = playerNameInput.value.trim();
  if (name.length < 2) {
    showLoginError('MINIMO 2 CARACTERES');
    return;
  }
  btnStartLogin.textContent = '...';
  btnStartLogin.disabled = true;
  try {
    const res = await fetch(`${API}/api/players/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.error) { showLoginError(data.error); return; }

    currentPlayer = data.player;
    playerStats   = data.stats;
    displayPlayerName.textContent = currentPlayer.name;
    showScreen('game');
    startGame();
  } catch (e) {
    showLoginError('ERROR DE CONEXION');
  } finally {
    btnStartLogin.textContent = 'JUGAR';
    btnStartLogin.disabled = false;
  }
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
  setTimeout(() => loginError.classList.add('hidden'), 3000);
}

// ── RANKING ────────────────────────────────
btnViewRanking.addEventListener('click', () => showRanking('login'));

async function showRanking(from) {
  showScreen('ranking');
  rankingList.innerHTML = '<p class="loading-text blink">CARGANDO...</p>';
  try {
    const res = await fetch(`${API}/api/ranking`);
    const data = await res.json();
    if (!data.length) {
      rankingList.innerHTML = '<p class="loading-text">AUN NO HAY PARTIDAS</p>';
      return;
    }
    rankingList.innerHTML = `
      <div class="ranking-header">
        <span>#</span>
        <span>NOMBRE</span>
        <span style="text-align:right">MEJOR</span>
        <span style="text-align:right">LINEAS</span>
      </div>
      ${data.map((p, i) => `
        <div class="ranking-row">
          <span class="rank-pos">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
          <span class="rank-name">${p.name}</span>
          <span class="rank-score">${pad(p.best_score, 6)}</span>
          <span class="rank-lines">${p.total_lines}L</span>
        </div>
      `).join('')}
    `;
  } catch (e) {
    rankingList.innerHTML = '<p class="loading-text">ERROR CARGANDO</p>';
  }

  btnRankingBack.onclick = () => showScreen(from === 'game' ? 'game' : 'login');
}

// ── OVERLAY BUTTONS ────────────────────────
btnOverlayAction.addEventListener('click', () => startGame());
btnOverlayRanking.addEventListener('click', () => showRanking('game'));
btnOverlayHome.addEventListener('click', () => {
  clearInterval(timerId);
  gameRunning = false;
  showScreen('login');
});

// ── PAUSE / QUIT ───────────────────────────
btnPause.addEventListener('click', togglePause);
btnQuit.addEventListener('click', () => {
  if (gameRunning) endGame();
  else {
    clearInterval(timerId);
    showScreen('login');
  }
});

// ── SCREEN SWITCHER ────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}
