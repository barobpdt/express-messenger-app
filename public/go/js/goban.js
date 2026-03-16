/*****************************************\
  =======================================
 
                 Gobang JS

                    by

             Code Monkey King

  =======================================
\*****************************************/

const Goban = function(params) {
  // CANVAS
  var canvas, ctx, cell;

  // DATA
  const EMPTY = 0
  const BLACK = 1
  const WHITE = 2
  const MARKER = 4
  const OFFBOARD = 7
  const LIBERTY = 8

  var board = [];
  var history = [];
  var komi = 6.5;
  var size;
  var side = BLACK;
  var liberties = [];
  var block = [];
  var ko = EMPTY;
  var bestMove = EMPTY;
  var userMove = 0;
  var moveCount = 0;

  // PRIVATE METHODS

  /* Draw a single stone at (col, row) canvas coordinates */
  function drawStone(col, row, color) {
    const cx = col * cell + cell / 2;
    const cy = row * cell + cell / 2;
    const r  = cell / 2 - 1.5;

    ctx.save();
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur  = cell * 0.18;
    ctx.shadowOffsetX = cell * 0.06;
    ctx.shadowOffsetY = cell * 0.08;

    // Stone body with radial gradient for 3-D look
    const grd = ctx.createRadialGradient(
      cx - r * 0.28, cy - r * 0.28, r * 0.05,
      cx, cy, r
    );
    if (color === 'black') {
      grd.addColorStop(0, '#7a7a7a');
      grd.addColorStop(0.35, '#2a2a2a');
      grd.addColorStop(1, '#000');
    } else {
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.45, '#f0f0f0');
      grd.addColorStop(1, '#c8c8c8');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = grd;
    ctx.fill();

    // Rim
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = color === 'black' ? 'rgba(0,0,0,0.9)' : 'rgba(140,140,140,0.7)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  /* Draw the last-move marker on the stone at (col, row) */
  function drawLastMoveMarker(col, row, stoneColor) {
    const cx = col * cell + cell / 2;
    const cy = row * cell + cell / 2;
    const r  = cell / 2 - 1.5;

    ctx.save();
    // Outer glowing ring
    const markerColor = stoneColor === 'black' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)';
    ctx.strokeStyle = markerColor;
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, 2 * Math.PI);
    ctx.stroke();

    // Inner dot
    ctx.fillStyle = markerColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.15, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  function drawBoard() { /* Render board to screen */
    cell = canvas.width / size;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i < size-1; i++) {
      const x = i * cell + cell / 2;
      const y = i * cell + cell / 2;
      let offset = cell * 2 - cell / 2;
      ctx.moveTo(offset, y);
      ctx.lineTo(canvas.width - offset, y);
      ctx.moveTo(x, offset);
      ctx.lineTo(x, canvas.height - offset);
    }
    ctx.stroke();

    // Star points
    const starPoints = {
       9: [36, 38, 40, 58, 60, 62, 80, 82, 84],
      13: [64, 67, 70, 109, 112, 115, 154, 157, 160],
      19: [88, 94, 100, 214, 220, 226, 340, 346, 352]
    };
    if ([9, 13, 19].includes(size - 2)) {
      ctx.fillStyle = '#000';
      for (const sq of starPoints[size - 2]) {
        const col = sq % size;
        const row = Math.floor(sq / size);
        ctx.beginPath();
        ctx.arc(col * cell + cell / 2, row * cell + cell / 2, cell / 6 - 1, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Stones
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const sq = row * size + col;
        if (board[sq] === 7) continue; // offboard
        if (board[sq] === 1) drawStone(col, row, 'black');
        else if (board[sq] === 2) drawStone(col, row, 'white');
      }
    }

    // Last-move marker
    if (userMove && userMove !== EMPTY) {
      const col = userMove % size;
      const row = Math.floor(userMove / size);
      const stoneVal = board[userMove] & 3;
      if (stoneVal === 1) drawLastMoveMarker(col, row, 'black');
      else if (stoneVal === 2) drawLastMoveMarker(col, row, 'white');
    }
  }

  function userInput(event) { /* Handle user input */
    if (params.sgf) return;
    let rect = canvas.getBoundingClientRect();
    let mouseX = event.clientX - rect.left;
    let mouseY = event.clientY - rect.top;
    let col = Math.floor(mouseX / cell);
    let row = Math.floor(mouseY / cell);
    let sq = row * size + col;
    if (board[sq]) return;
    if (!setStone(sq, side, true)) return;
    drawBoard();
    setTimeout(function() { try { params.response(); } catch (e) { /* Specify custom response function */ } }, 100)
  }

  function clearBoard() { /* Empty board, set offboard squares */
    for (let sq = 0; sq < size ** 2; sq++) {
      switch (true) {
        case (sq < size):
        case (sq >= (size ** 2 - size)):
        case (!(sq % size)):
          board[sq] = OFFBOARD;
          board[sq-1] = OFFBOARD;
          break;
        default: board[sq] = 0;
      }
    }
  }

  function setStone(sq, color, user) { /* Place stone on board */
    if (board[sq] != EMPTY) {
      if (user) alert("Illegal move!");
      return false;
    } else if (sq == ko) {
      if (user) alert("Ko!");
      return false;
    } let old_ko = ko;
    ko = EMPTY;
    board[sq] = color;
    captures(3 - color, sq);
    count(sq, color);
    let suicide = liberties.length ? false : true; 
    restoreBoard();
    if (suicide) {
      board[sq] = EMPTY;
      ko = old_ko;
      moveCount--;
      if (user) alert("Suicide move!");
      return false;
    } 
    side = 3 - side;
    userMove = sq;
    history.push({
      'ply': moveCount+1,
      'side': (3-color),
      'move': sq,
      'board': JSON.stringify(board),
      'ko': ko
    });
    moveCount = history.length-1;
    return true;
  }

  function setHandicap(stones) {
    if (stones < 0 || stones > 9) return;
    let handicap = stones;
    let handicapStones = [88, 100, 340, 352, 214, 226, 94, 346, 220].slice(0, handicap);
    for (let sq of handicapStones) {
      goban.play(sq, goban.BLACK);
      if (sq != handicapStones[handicap-1]) goban.pass();
      goban.refresh();
    }
  }

  function pass() {
    history.push({
      'ply': moveCount+1,
      'side': (3-side),
      'move': EMPTY,
      'board': JSON.stringify(board),
      'ko': ko
    });
    moveCount = history.length-1;
    ko = EMPTY;
    side = 3 - side;
  }

  function count(sq, color) { /* Count group liberties */
    stone = board[sq];
    if (stone == OFFBOARD) return;
    if (stone && (stone & color) && (stone & MARKER) == 0) {
      block.push(sq);
      board[sq] |= MARKER;
      for (let offset of [1, size, -1, -size]) count(sq+offset, color);
    } else if (stone == EMPTY) {
      board[sq] |= LIBERTY;
      liberties.push(sq);
    }
  }

  function restoreBoard() { /* Remove group markers */
    block = []; liberties = []; points_side = [];
    for (let sq = 0; sq < size ** 2; sq++) {
      if (board[sq] != OFFBOARD) board[sq] &= 3;
    }
  }

  function captures(color, move) { /* Handle captured stones */
    for (let sq = 0; sq < size ** 2; sq++) {
      let stone = board[sq];
      if (stone == OFFBOARD) continue;
      if (stone & color) {
        count(sq, color);
        if (liberties.length == 0) clearBlock(move);
        restoreBoard()
      }
    }
  }

  function clearBlock(move) { /* Erase stones when captured */
    if (block.length == 1 && inEye(move, 0) == 3-side) ko = block[0];
    for (let i = 0; i < block.length; i++)
      board[block[i]] = EMPTY;
  }

  function inEye(sq) { /* Check if sqaure is in diamond shape */
    let eyeColor = -1;
    let otherColor = -1;
    for (let offset of [1, size, -1, -size]) {
      if (board[sq+offset] == OFFBOARD) continue;
      if (board[sq+offset] == EMPTY) return 0;
      if (eyeColor == -1) {
        eyeColor = board[sq+offset];
        otherColor = 3-eyeColor;
      } else if (board[sq+offset] == otherColor)
        return 0;
    }
    if (eyeColor > 2) eyeColor -= MARKER;
    return eyeColor;
  }

  function loadHistoryMove() {
    let move = history[moveCount];
    board = JSON.parse(move.board);
    side = move.side;
    ko = move.ko;
    userMove = move.move;
    drawBoard();
  }

  function undoMove() {
    if (moveCount == 0) return;
    moveCount--;
    history.pop();
    loadHistoryMove();
  }

  function firstMove() {
    moveCount = 0;
    loadHistoryMove();
  }

  function prevMove() {
    if (moveCount == 0) return;
    moveCount--;
    loadHistoryMove();
  }

  function prevFewMoves(few) {
    if (moveCount == 0) return;
    if ((moveCount - few) >= 0) moveCount -= few;
    else firstMove();
    loadHistoryMove();
  }

  function nextMove() {
    if (moveCount == history.length-1) return;
    moveCount++;
    loadHistoryMove();
  }

  function nextFewMoves(few) {
    if (moveCount == history.length-1) return;
    if ((moveCount + few) <= history.length-1) moveCount += few;
    else lastMove();
    loadHistoryMove();
  }

  function lastMove() {
    moveCount = history.length-1
    loadHistoryMove();
  }

  function loadSgf(sgf) {
    for (let move of sgf.split(';')) {
      if (move.length) {
        if (move.charCodeAt(2) < 97 || move.charCodeAt(2) > 115) { continue; }
        let player = move[0] == 'B' ? BLACK : WHITE;
        let col = move.charCodeAt(2)-97;
        let row = move.charCodeAt(3)-97;
        let sq = (row+1) * 21 + (col+1);
        setStone(sq, player, false);
      }
    } firstMove();
  }

  function saveSgf() {
    let sgf = '(';
    for (let item of history.slice(1, history.length)) {
      let col = item.move % 21;
      let row = Math.floor(item.move / 21);
      let color = item.side == BLACK ? 'W' : 'B';
      let coords = ' abcdefghijklmnopqrs';
      let move = coords[col] + coords[row];
      if (move == '  ') sgf += ';' + color + '[]'
      else sgf += ';' + color + '[' + move + ']';
    } sgf += ')'
    return sgf;
  }

  function resizeCanvas() {
    let offset = params.offset == undefined ? 0 : params.offset;
    if (window.innerWidth > window.innerHeight) {
      canvas.width = window.innerHeight - offset; // Desktop
      canvas.height = canvas.width;
    } else {
      canvas.width = window.innerWidth - offset;  // Mobile
      canvas.height = canvas.width;
    } drawBoard();
  }

  function init() { /* Init goban module */
    let container = document.getElementById('goban');
    canvas = document.createElement('canvas');
    canvas.style="margin-bottom: -3%;";
    container.appendChild(canvas);
    size = params.size+2;
    canvas.addEventListener('click', userInput);
    ctx = canvas.getContext('2d');
    clearBoard();
    history.push({
      'ply': 0,
      'side': BLACK,
      'move': EMPTY,
      'board': JSON.stringify(board),
      'ko': ko
    });
    moveCount = history.length-1;
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }
  
  // PUBLIC API
  return { board,
    init: init(),
    BLACK: BLACK,
    WHITE: WHITE,
    importSgf: function(sgf) { return loadSgf(sgf); },
    exportSgf: function() { return saveSgf(); },
    position: function() { return board; },
    setKomi: function(komiVal) { komi = komiVal; },
    komi: function() { return komi; },
    history: function() { return history; },
    side: function() { return side; },
    ko: function() { return ko; },
    count: function(sq, color) { return count(sq, color); },
    liberties: function() { return liberties; },
    restore: function() { return restoreBoard(); },
    play: function(sq, color, user) { return setStone(sq, color, user); },
    handicap: function(stones) { return setHandicap(stones); },
    pass: function() { return pass(); },
    refresh: function() { return drawBoard(); },
    undoMove: function() { return undoMove(); },
    firstMove: function() { return firstMove(); },
    prevFewMoves: function(few) { return prevFewMoves(few); },
    prevMove: function() { return prevMove(); },
    nextMove: function() { return nextMove(); },
    nextFewMoves: function(few) { return nextFewMoves(few); },
    lastMove: function() { return lastMove(); }
  }
}
