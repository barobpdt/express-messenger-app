'use strict';

// ═══════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════
const MODEL_PATH = '/go/model/b10c128-s1141046784-d204142634/model.json';
const IN_CH = 22;   // inputBufferChannels
const GL_CH = 19;   // inputGlobalBufferChannels
const BATCHES = 1;

// Handicap positions per board size (internal goban flat-index coords)
const HANDICAP_POS = {
  19: [88, 100, 340, 352, 220, 94, 346, 214, 226], // 21×21
  13: [64, 160, 154, 70, 112, 67, 157, 109, 115], // 15×15
  9: [36, 84, 40, 80, 60, 38, 82, 58, 62]  // 11×11
};

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
var goban = null;
var tfModel = null;
var settings = { mode: 'go', size: 19, handicap: 0, level: 'kyu', byoyomi: 30, komi: 6.5 };
var gameActive = false;
var consecutivePasses = 0;
var timerInterval = null;
var timeLeft = 0;
var isAiThinking = false;
var themeIsDark = false;
// Capture counts tracked manually (goban.js doesn't expose them)
var capByBlack = 0;  // white stones taken by black
var capByWhite = 0;  // black stones taken by white

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  openSettingsModal(true);
  preloadModel();
});

// ═══════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════
function initTheme() {
  themeIsDark = localStorage.getItem('goTheme') === 'dark';
  applyTheme();
}
function toggleTheme() {
  themeIsDark = !themeIsDark;
  applyTheme();
  localStorage.setItem('goTheme', themeIsDark ? 'dark' : 'light');
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', themeIsDark ? 'dark' : '');
  document.getElementById('theme-icon').className = themeIsDark ? 'bx bx-sun' : 'bx bx-moon';
}

// ═══════════════════════════════════════════════
//  MODEL PRELOAD (19×19 only)
// ═══════════════════════════════════════════════
async function preloadModel() {
  try {
    tf.setBackend('cpu');
    tfModel = await tf.loadGraphModel(MODEL_PATH);
    console.log('[KataNet] model cached');
  } catch (e) {
    console.warn('[KataNet] preload failed:', e.message);
  }
}

// ═══════════════════════════════════════════════
//  SETTINGS MODAL
// ═══════════════════════════════════════════════
function openSettingsModal(initial) {
  if (!initial && gameActive) {
    if (!confirm('현재 게임을 종료하고 새 게임을 시작하시겠습니까?')) return;
    stopTimer();
    gameActive = false;
  }
  if (initial) {
    checkMessenger()
  }
  document.getElementById('settings-modal').classList.add('active');
}
function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('active');
}
function applySettingsAndStart() {
  // const mode = document.querySelector('input[name="mode"]:checked').value;
  const sz = parseInt(document.querySelector('input[name="sz"]:checked').value);
  const hc = parseInt(document.getElementById('setting-handicap').value);
  const lv = document.querySelector('input[name="lv"]:checked').value;
  const by = parseInt(document.getElementById('setting-byoyomi').value) || 0;
  settings = { size: sz, handicap: hc, level: lv, byoyomi: by, komi: hc > 0 ? 0.5 : 6.5, byoyomiCount: 5 };
  closeSettingsModal();
  startNewGame();
}

/** UI Helper for Modal */
function updateSizeOptions(mode) {
  const hGroup = document.getElementById('handicap-group');
  const labelSize = document.getElementById('label-size');
  const labelSz15 = document.getElementById('label-sz15');
  const sz19 = document.getElementById('sz19');
  const sz15 = document.getElementById('sz15');

  /* omok
    hGroup.style.display = 'none';
    labelSize.textContent = '오목판 크기 (권장 15×15)';
    labelSz15.style.display = 'flex';
    if (sz19.checked) { sz15.checked = true; }
  */
  hGroup.style.display = 'block';
  labelSize.textContent = '바둑판 크기';
  labelSz15.style.display = 'none';
  if (sz15.checked) { sz19.checked = true; }
}

function checkMessenger() {
  const urlParams = new URLSearchParams(window.location.search);
  const target = urlParams.get('opener');
  if (target == 'messenger') {
    const div = $('<div style="display:flex;position:absolute;right:8px;bottom:8px;width:80px;background:#aaa;"/>').appendTo(document.body)
    const btn = $('<button style="width:80px;height:24px;">메신저</button>').appendTo(div)
    btn.on('click', () => parent.closeSubpage())
  }
}
// ═══════════════════════════════════════════════
//  GAME START
// ═══════════════════════════════════════════════
function startNewGame() {
  stopTimer();
  document.getElementById('goban').innerHTML = '';
  gameActive = true;
  consecutivePasses = 0;
  isAiThinking = false;
  capByBlack = 0; capByWhite = 0;
  showThinking(false);

  // Size canvas: desktop uses innerHeight‑based, mobile innerWidth‑based (goban.js logic)
  const hPad = document.querySelector('header').offsetHeight + 60;
  const wPad = document.querySelector('.sidebar').offsetWidth + 60;
  const offset = window.innerWidth > window.innerHeight ? hPad : wPad;

  goban = new Goban({ size: settings.size, offset: offset, response: onUserMove });
  setCtrlsEnabled(true);
  updateStatusBar();
  updateInfoBar();
  $('#byoyomi-count').html(' (' + settings.byoyomiCount + '번 남음)')
  if (settings.handicap > 0) {
    placeHandicap();
  } else {
    updateStatusBar();
    startTimer();
  }
}


function setCtrlsEnabled(on) {
  ['btn-pass', 'btn-undo', 'btn-resign', 'btn-score', 'btn-sgf'].forEach(id => {
    document.getElementById(id).disabled = !on;
  });
}

// ═══════════════════════════════════════════════
//  HANDICAP
// ═══════════════════════════════════════════════
function placeHandicap() {
  const pos = (HANDICAP_POS[settings.size] || HANDICAP_POS[19]).slice(0, settings.handicap);
  for (let i = 0; i < pos.length; i++) {
    goban.play(pos[i], goban.BLACK, false);
    if (i < pos.length - 1) goban.pass();
    goban.refresh();
  }
  // After handicap stones → WHITE (AI) plays first
  updateStatusBar();
  showThinking(true);
  setTimeout(() => aiPlay(), 600);
}

// ═══════════════════════════════════════════════
//  TIMER
// ═══════════════════════════════════════════════
function startTimer() {
  stopTimer();
  if (!settings.byoyomi || settings.byoyomi <= 0) {
    document.getElementById('timer-display').textContent = '∞';
    document.getElementById('timer-display').className = 'timer-display';
    return;
  }
  timeLeft = settings.byoyomi;
  renderTimer();
  timerInterval = setInterval(() => {
    timeLeft--;
    renderTimer();
    if (timeLeft <= 0) {
      // Auto-pass on timeout
      if (settings.byoyomiCount == 0) {
        stopTimer();
        playerPass(true);
        $('#byoyomi-count').html(' (마지막 초읽기)')
      } else {
        settings.byoyomiCount--
        startTimer()
        $('#byoyomi-count').html(settings.byoyomiCount == 1 ? ' (마지막 초읽기)' : ' (' + settings.byoyomiCount + '번 남음)')
      }
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function renderTimer() {
  const el = document.getElementById('timer-display');
  el.textContent = timeLeft + 's';
  el.className = 'timer-display' +
    (timeLeft <= 5 ? ' urgent' :
      timeLeft <= 10 ? ' warning' : '');
}

// ═══════════════════════════════════════════════
//  USER → AI RESPONSE
// ═══════════════════════════════════════════════
function onUserMove() {
  if (!gameActive || isAiThinking) return;
  stopTimer();
  consecutivePasses = 0;
  syncCaptured();
  updateStatusBar();
  showThinking(true);
  setTimeout(() => aiPlay(), 200);
}

// ═══════════════════════════════════════════════
//  PLAYER CONTROLS
// ═══════════════════════════════════════════════
function playerPass(auto) {
  if (!gameActive || isAiThinking) return;
  stopTimer();
  goban.pass();
  goban.refresh();
  consecutivePasses++;
  updateStatusBar();
  if (consecutivePasses >= 2) { requestScore(); return; }
  showThinking(true);
  setTimeout(() => aiPlay(), 200);
}

function playerUndo() {
  if (!gameActive || isAiThinking) return;
  stopTimer();
  goban.undoMove(); // undo AI
  goban.undoMove(); // undo player
  consecutivePasses = 0;
  syncCaptured();
  updateStatusBar();
  startTimer();
}

function playerResign() {
  if (!gameActive) return;
  if (!confirm('정말 기권하시겠습니까?')) return;
  stopTimer(); gameActive = false;
  setCtrlsEnabled(false);
  showThinking(false);
  alert('기권으로 백(AI) 승리입니다.');
}

function requestScore() {
  stopTimer();
  gameActive = false;
  setCtrlsEnabled(false);
  showThinking(false);
  showScoringModal();
}

// ═══════════════════════════════════════════════
//  AI PLAY
// ═══════════════════════════════════════════════
async function aiPlay() {
  if (!gameActive) { showThinking(false); return; }
  isAiThinking = true;
  setCtrlsEnabled(false);
  try {
    if (settings.size === 19 && tfModel) {
      await aiPlayKataGo();
    } else {
      aiPlaySimple();
    }
  } catch (e) {
    console.error('[AI] error, fallback:', e);
    aiPlaySimple();
  }
  syncCaptured();
  updateStatusBar();
  isAiThinking = false;
  showThinking(false);
  setCtrlsEnabled(true);
  if (gameActive) startTimer();
}


// ── KataGo (19×19) ──────────────────────────
async function aiPlayKataGo() {
  const IS = 21; // internal size for 19×19 goban
  const BS = 19;
  const computerSide = goban.side();
  let katago = computerSide;
  let player = 3 - computerSide;
  if (settings.level === 'kyu') { katago = 3 - computerSide; player = computerSide; }

  const bin_inputs = new Float32Array(BATCHES * BS * BS * IN_CH);
  const global_inputs = new Float32Array(BATCHES * GL_CH);

  for (let y = 0; y < BS; y++) {
    for (let x = 0; x < BS; x++) {
      const sq19 = BS * y + x;
      const sq21 = IS * (y + 1) + (x + 1);
      const pos = goban.position();
      bin_inputs[IN_CH * sq19 + 0] = 1.0;
      if (pos[sq21] === katago) bin_inputs[IN_CH * sq19 + 1] = 1.0;
      if (pos[sq21] === player) bin_inputs[IN_CH * sq19 + 2] = 1.0;
      if (pos[sq21] === katago || pos[sq21] === player) {
        goban.count(sq21, goban.BLACK); const lb = goban.liberties().length; goban.restore();
        goban.count(sq21, goban.WHITE); const lw = goban.liberties().length; goban.restore();
        if (lb === 1 || lw === 1) bin_inputs[IN_CH * sq19 + 3] = 1.0;
        if (lb === 2 || lw === 2) bin_inputs[IN_CH * sq19 + 4] = 1.0;
        if (lb === 3 || lw === 3) bin_inputs[IN_CH * sq19 + 5] = 1.0;
      }
    }
  }

  // Previous move history channels
  const hist = goban.history();
  const mi = hist.length - 1;
  const fillHistCh = (move, ch) => {
    if (!move) { global_inputs[ch] = 1.0; return; }
    const x = move % IS, y = Math.floor(move / IS) - 1, xb = x - 1;
    if (y >= 0 && y < BS && xb >= 0 && xb < BS)
      bin_inputs[IN_CH * (BS * y + xb) + 9 + ch] = 1.0;
  };
  if (mi >= 1 && hist[mi - 1].side === player) fillHistCh(hist[mi - 1].move, 0);
  if (mi >= 2 && hist[mi - 2].side === katago) fillHistCh(hist[mi - 2].move, 1);
  if (mi >= 3 && hist[mi - 3].side === player) fillHistCh(hist[mi - 3].move, 2);
  if (mi >= 4 && hist[mi - 4].side === katago) fillHistCh(hist[mi - 4].move, 3);
  if (mi >= 5 && hist[mi - 5].side === player) fillHistCh(hist[mi - 5].move, 4);

  const komi = settings.komi;
  global_inputs[5] = (computerSide === goban.WHITE ? komi + 1 : -komi) / 20.0;

  tf.setBackend('cpu');

  let policyArr, scoresArr;
  let binTensor, globalTensor, results;

  try {
    binTensor = tf.tensor(bin_inputs, [BATCHES, BS * BS, IN_CH], 'float32');
    globalTensor = tf.tensor(global_inputs, [BATCHES, GL_CH], 'float32');

    // Explicitly specify output nodes to avoid "undefined shape" errors 
    // and rely on consistent result array ordering.
    results = await tfModel.executeAsync(
      {
        'swa_model/bin_inputs': binTensor,
        'swa_model/global_inputs': globalTensor
      },
      ['swa_model/policy_output', 'swa_model/miscvalues_output']
    );

    if (results && results.length >= 2) {
      policyArr = await results[0].reshape([-1]).array();
      scoresArr = results[1].dataSync();
    } else {
      throw new Error('Model execution returned invalid results');
    }
  } finally {
    // Explicitly dispose of tensors to prevent memory leaks
    if (binTensor) binTensor.dispose();
    if (globalTensor) globalTensor.dispose();
    if (results) {
      results.forEach(t => t.dispose());
    }
  }

  if (policyArr && scoresArr) {
    const scoreLead = (scoresArr[2] * 20).toFixed(1);
    const leadColor = (settings.level === 'kyu') ? (scoreLead > 0 ? 'White' : 'Black') : (scoreLead > 0 ? 'Black' : 'White');
    document.getElementById('ai-score-bar').textContent =
      `${leadColor === 'Black' ? '⚫ 흑' : '⚪ 백'} ${Math.abs(scoreLead)}점 우세`;

    // Pick best legal move
    const sorted = [...policyArr].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    let placed = false;
    for (let k = 0; k < Math.min(sorted.length, 20); k++) {
      const idx = sorted[k].i;
      if (idx === BS * BS) continue; // skip pass move in sorted list for now if we want to try placing first
      const row = Math.floor(idx / BS);
      const col = idx % BS;
      const sq21 = IS * (row + 1) + (col + 1);
      if (goban.play(sq21, computerSide, false)) {
        goban.refresh(); placed = true; break;
      }
    }
    if (!placed) { goban.pass(); goban.refresh(); consecutivePasses++; }
    else consecutivePasses = 0;
  } else {
    // Fallback to simple AI if model fails
    aiPlaySimple();
  }
}

// ── Heuristic AI (9×9 / 13×13) ──────────────
function aiPlaySimple() {
  const s = settings.size;
  const IS = s + 2;
  const side = goban.side();
  const opp = 3 - side;
  const pos = goban.position();

  // Collect all empty intersections
  const empties = [];
  for (let r = 1; r <= s; r++) {
    for (let c = 1; c <= s; c++) {
      if (pos[r * IS + c] === 0) empties.push(r * IS + c);
    }
  }

  // Score each empty point: higher = better for AI
  const scored = empties.map(sq => {
    let score = Math.random(); // base randomness
    // Prefer captures: check if placing here captures opponent
    const neighbors = [sq - 1, sq + 1, sq - IS, sq + IS];
    for (const nb of neighbors) {
      if (pos[nb] === opp) {
        goban.count(nb, opp);
        if (goban.liberties().length === 1) score += 100; // atari -> capture opportunity
        goban.restore();
      }
    }
    return { sq, score };
  }).sort((a, b) => b.score - a.score);

  let placed = false;
  for (const { sq } of scored) {
    if (goban.play(sq, side, false)) {
      goban.refresh(); placed = true; break;
    }
  }
  if (!placed) { goban.pass(); goban.refresh(); consecutivePasses++; }
  else consecutivePasses = 0;
}

// ═══════════════════════════════════════════════
//  CAPTURE COUNT SYNC  (read from goban history)
// ═══════════════════════════════════════════════
function syncCaptured() {
  // Re-count from history: for each move, compare board before/after
  // Simpler: track via board diff each time (approximation via goban history)
  // Exact method: replay all history boards and count differences
  const hist = goban.history();
  capByBlack = 0;
  capByWhite = 0;
  for (let i = 1; i < hist.length; i++) {
    const prev = JSON.parse(hist[i - 1].board);
    const curr = JSON.parse(hist[i].board);
    const placer = hist[i - 1].side === 1 ? 1 : 2; // the side that placed: prev.side is side-to-move AFTER that move
    // placer: hist[i].side is side-to-move AFTER move i, so placer = 3-hist[i].side at step i
    const moverColor = 3 - hist[i].side; // who moved at step i
    for (let sq = 0; sq < prev.length; sq++) {
      if ((prev[sq] & 3) !== 0 && (curr[sq] & 3) === 0) {
        // a stone was removed
        const removedColor = prev[sq] & 3;
        if (removedColor === 2 && moverColor === 1) capByBlack++;
        if (removedColor === 1 && moverColor === 2) capByWhite++;
      }
    }
  }
}

// ═══════════════════════════════════════════════
//  SCORING (Chinese rules)
// ═══════════════════════════════════════════════
function computeScore() {
  const s = settings.size;
  const IS = s + 2;
  const pos = goban.position();

  let bStones = 0, wStones = 0;
  for (let r = 1; r <= s; r++) {
    for (let c = 1; c <= s; c++) {
      const v = pos[r * IS + c] & 3;
      if (v === 1) bStones++;
      if (v === 2) wStones++;
    }
  }

  // BFS territory
  const visited = new Uint8Array(IS * IS);
  let bTerr = 0, wTerr = 0;
  for (let r = 1; r <= s; r++) {
    for (let c = 1; c <= s; c++) {
      const start = r * IS + c;
      if ((pos[start] & 3) !== 0 || visited[start]) continue;
      const region = [];
      const queue = [start];
      const adj = new Set();
      while (queue.length) {
        const sq = queue.pop();
        if (visited[sq]) continue;
        visited[sq] = 1;
        region.push(sq);
        for (const off of [-1, 1, -IS, IS]) {
          const nb = sq + off;
          const nbv = pos[nb] & 3;
          if (nbv === 7) continue; // offboard
          if (nbv === 0 && !visited[nb]) queue.push(nb);
          else if (nbv === 1 || nbv === 2) adj.add(nbv);
        }
      }
      if (adj.size === 1) {
        const owner = [...adj][0];
        if (owner === 1) bTerr += region.length;
        else wTerr += region.length;
      }
    }
  }

  const bScore = bStones + bTerr;
  const wScore = wStones + wTerr + settings.komi;
  return { bScore, wScore, bStones, wStones, bTerr, wTerr };
}

function showScoringModal() {
  const { bScore, wScore, bStones, wStones, bTerr, wTerr } = computeScore();
  const bWins = bScore > wScore;

  const grid = document.getElementById('score-grid');
  grid.innerHTML = `
    <div class="score-card ${bWins ? 'winner' : ''}">
      <div class="stone black"></div>
      <div class="score-num">${bScore.toFixed(1)}</div>
      <div class="score-detail">돌 ${bStones} + 집 ${bTerr}</div>
      ${bWins ? '<span class="winner-badge">🏆 승리</span>' : ''}
    </div>
    <div class="score-card ${!bWins ? 'winner' : ''}">
      <div class="stone white"></div>
      <div class="score-num">${wScore.toFixed(1)}</div>
      <div class="score-detail">돌 ${wStones} + 집 ${wTerr} + 코미 ${settings.komi}</div>
      ${!bWins ? '<span class="winner-badge">🏆 승리</span>' : ''}
    </div>`;
  document.getElementById('score-msg').textContent =
    bWins ? `⚫ 흑 ${(bScore - wScore).toFixed(1)}점 승` : `⚪ 백 ${(wScore - bScore).toFixed(1)}점 승`;
  document.getElementById('score-modal').classList.add('active');
}

// ═══════════════════════════════════════════════
//  SGF DOWNLOAD
// ═══════════════════════════════════════════════
function downloadSgf() {
  if (!goban) return;
  const sgf = goban.exportSgf();
  const header = `(;GM[1]FF[4]SZ[${settings.size}]KM[${settings.komi}]RU[Chinese]PB[Player]PW[KataNet]` +
    `HA[${settings.handicap}]`;
  const full = header + sgf.slice(1); // replace leading '(' with header
  const blob = new Blob([full], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `KataNet_${settings.size}x${settings.size}_${new Date().toISOString().slice(0, 10)}.sgf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════
//  UI UPDATES
// ═══════════════════════════════════════════════
function updateStatusBar() {
  if (!goban) return;
  const side = goban.side();     // who plays NEXT
  const isPlayer = side === 1;       // BLACK = player
  document.getElementById('turn-text').textContent = isPlayer ? '흑 차례 (당신)' : '백 차례 (AI)';
  document.getElementById('turn-circle').className = 'turn-circle ' + (isPlayer ? 'black' : 'white');
  document.getElementById('cap-white').textContent = capByBlack;
  document.getElementById('cap-black').textContent = capByWhite;
}

function updateInfoBar() {
  const lvLabel = settings.level === 'dan' ? '단(강)' : '급(약)';
  const byLabel = settings.byoyomi > 0 ? `${settings.byoyomi}초` : '무제한';
  document.getElementById('info-bar').textContent =
    `${settings.size}×${settings.size} | 핸디캡 ${settings.handicap}수 | AI ${lvLabel} | 초읽기 ${byLabel}`;
}

function showThinking(on) {
  const wrap = document.getElementById('ai-thinking-wrap');
  if (wrap) wrap.classList.toggle('active', on);
}

// ═══════════════════════════════════════════════
//  WINDOW RESIZE — recreate canvas offset
// ═══════════════════════════════════════════════
window.addEventListener('resize', () => {
  if (goban && typeof goban.refresh === 'function') goban.refresh();
});
