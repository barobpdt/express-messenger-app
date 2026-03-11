// Go Game Logic (Client-Side for Solo, Syncs with Server for Online)

const canvas = document.getElementById('go-board');
const ctx = canvas.getContext('2d');
const turnText = document.getElementById('turn-text');
const turnCircle = document.getElementById('turn-circle');
const capWhiteEl = document.getElementById('captured-white');
const capBlackEl = document.getElementById('captured-black');
const roomInfo = document.getElementById('room-info');

// Constants
const BOARD_SIZE = 19;
let TILE_SIZE = 0;
let MARGIN = 0;

// State
let board = [];
let currentPlayer = 1; // 1: Black, 2: White
let capturedByBlack = 0; // white stones captured by black
let capturedByWhite = 0; // black stones captured by white
let isOnline = false;
let socket = null;
let roomId = null;
let opponentUser = null;
let myColor = 1; // 1 or 2, relevant for online

// Get my actual username from the URL or fallback to localStorage
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
let myId = localStorage.getItem('chatUsername') || sessionStorage.getItem('chatUsername');

// Determine real names from room parameter (format: "userA-userB")
// Opponent is whoever is NOT me in the room string.
const opponentParam = urlParams.get('opponent');
if (roomParam && opponentParam) {
    if (roomParam.startsWith(opponentParam + '-')) {
        myId = roomParam.substring(opponentParam.length + 1);
    } else if (roomParam.endsWith('-' + opponentParam)) {
        myId = roomParam.substring(0, roomParam.length - opponentParam.length - 1);
    }
}
if (!myId) myId = 'Guest_' + Math.floor(Math.random() * 1000);

// Online Params
const colorParam = urlParams.get('color');

if (roomParam && opponentParam && colorParam) {
    isOnline = true;
    roomId = roomParam;
    opponentUser = opponentParam;
    myColor = parseInt(colorParam);

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onopen = () => {
        // Send init so server maps our `myId` to this socket.
        socket.send(JSON.stringify({ type: 'init', username: myId }));
        // 서버 파트에서 현재 소켓이 이 방(roomId)에 접속했음을 기록 (브로드캐스트 안 됨)
        socket.send(JSON.stringify({ type: 'sys-join', room: roomId }));
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // Only process moves sent by our opponent for this room
            if (data.senderId === opponentUser && data.room === roomId) {
                if (data.type === 'go-move') {
                    // It's the opponent's move, so we apply it locally without re-emitting
                    playMove(data.row, data.col, data.playerColor, false);
                } else if (data.type === 'go-pass') {
                    passTurn(false);
                } else if (data.type === 'go-resign') {
                    alert(`${opponentUser} (상대방) 님이 기권하셨습니다! 🎉 승리!`);
                    startGame('solo');
                }
            }
        } catch (e) { console.error("WS parsing error", e); }
    };
}

// Initialize the board array
function initBoard() {
    board = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        let row = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            row.push(0); // 0: empty
        }
        board.push(row);
    }
}

// Draw the board grid
function drawBoard() {
    // Fill background
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--board-color');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const lineColor = getComputedStyle(document.documentElement).getPropertyValue('--board-line').trim();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    // Calculate dimensions
    MARGIN = canvas.width / (BOARD_SIZE + 1);
    TILE_SIZE = (canvas.width - MARGIN * 2) / (BOARD_SIZE - 1);

    // Draw lines
    ctx.beginPath();
    for (let i = 0; i < BOARD_SIZE; i++) {
        const x = MARGIN + i * TILE_SIZE;
        const y = MARGIN + i * TILE_SIZE;

        // Vertical lines
        ctx.moveTo(x, MARGIN);
        ctx.lineTo(x, canvas.height - MARGIN);

        // Horizontal lines
        ctx.moveTo(MARGIN, y);
        ctx.lineTo(canvas.width - MARGIN, y);
    }
    ctx.stroke();

    // Draw Hoshi (Star points) for 19x19
    if (BOARD_SIZE === 19) {
        const starPoints = [3, 9, 15];
        ctx.fillStyle = lineColor;
        for (let r of starPoints) {
            for (let c of starPoints) {
                const cx = MARGIN + c * TILE_SIZE;
                const cy = MARGIN + r * TILE_SIZE;
                ctx.beginPath();
                ctx.arc(cx, cy, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Draw stones
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) {
                drawStone(r, c, board[r][c]);
            }
        }
    }
}

function drawStone(row, col, player) {
    const cx = MARGIN + col * TILE_SIZE;
    const cy = MARGIN + row * TILE_SIZE;
    const radius = TILE_SIZE * 0.45;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);

    if (player === 1) {
        // Black stone with subtle gradient
        const grd = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
        grd.addColorStop(0, '#555');
        grd.addColorStop(1, '#111');
        ctx.fillStyle = grd;
    } else {
        // White stone with subtle gradient
        const grd = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
        grd.addColorStop(0, '#fff');
        grd.addColorStop(1, '#ddd');
        ctx.fillStyle = grd;

        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.fill();
}

// Handle Canvas Clicks
canvas.addEventListener('click', (e) => {
    // If online, only allow clicking if it's my turn
    if (isOnline && currentPlayer !== myColor) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert pixel to grid coordinates
    const col = Math.round((x - MARGIN) / TILE_SIZE);
    const row = Math.round((y - MARGIN) / TILE_SIZE);

    if (col >= 0 && col < BOARD_SIZE && row >= 0 && row < BOARD_SIZE) {
        if (isOnline) {
            // Send to server
            if (currentPlayer === myColor) {
                playMove(row, col, currentPlayer, true);
            }
        } else {
            // Local solo play
            playMove(row, col, currentPlayer, true);
        }
    }
});

function playMove(row, col, player, emit = true) {
    if (board[row][col] !== 0) return; // Already occupied

    const opponent = player === 1 ? 2 : 1;

    // Backup board to check validity/suicide (Deep copy)
    const backupBoard = board.map(r => [...r]);

    board[row][col] = player;

    // 1. Check if this move captures any opponent groups
    let capturedStones = 0;
    const neighbors = getNeighbors(row, col);
    let capturedCoords = [];

    for (let n of neighbors) {
        if (board[n.r][n.c] === opponent) {
            const group = getGroup(n.r, n.c);
            if (countLiberties(group) === 0) {
                // Capture group
                for (let stone of group) {
                    board[stone.r][stone.c] = 0;
                    capturedCoords.push(stone);
                    capturedStones++;
                }
            }
        }
    }

    // 2. Check Suicide (if no captures were made, does our new group have liberties?)
    if (capturedStones === 0) {
        const myGroup = getGroup(row, col);
        if (countLiberties(myGroup) === 0) {
            // Invalid move: Suicide
            board = backupBoard;
            alert("착수 금지구역입니다. (자충수)");
            return;
        }
    }

    // 3. Ko Rule (Simplified: prevents recreating exact previous board state)
    // For a robust implementation, keep history of board states. Skipping for instant MVP.

    // 4. Update Stats & Turn
    if (player === 1) capturedByBlack += capturedStones;
    else capturedByWhite += capturedStones;

    currentPlayer = opponent;
    updateUI();
    drawBoard();

    // 5. Emit if online
    if (isOnline && emit && socket && socket.readyState === 1) {
        socket.send(JSON.stringify({
            type: 'go-move',
            room: roomId,
            senderId: myId,
            targetUser: opponentUser,
            row: row,
            col: col,
            playerColor: player
        }));
    }
}

// Game Rules Helpers
function getNeighbors(row, col) {
    const coords = [];
    if (row > 0) coords.push({ r: row - 1, c: col });
    if (row < BOARD_SIZE - 1) coords.push({ r: row + 1, c: col });
    if (col > 0) coords.push({ r: row, c: col - 1 });
    if (col < BOARD_SIZE - 1) coords.push({ r: row, c: col + 1 });
    return coords;
}

function getGroup(row, col) {
    const color = board[row][col];
    if (color === 0) return [];

    const group = [];
    const visited = new Set();
    const queue = [{ r: row, c: col }];

    while (queue.length > 0) {
        const curr = queue.shift();
        const key = `${curr.r},${curr.c}`;

        if (!visited.has(key)) {
            visited.add(key);
            group.push(curr);

            const neighbors = getNeighbors(curr.r, curr.c);
            for (let n of neighbors) {
                if (board[n.r][n.c] === color && !visited.has(`${n.r},${n.c}`)) {
                    queue.push(n);
                }
            }
        }
    }
    return group;
}

function countLiberties(group) {
    const liberties = new Set();
    for (let stone of group) {
        const neighbors = getNeighbors(stone.r, stone.c);
        for (let n of neighbors) {
            if (board[n.r][n.c] === 0) {
                liberties.add(`${n.r},${n.c}`);
            }
        }
    }
    return liberties.size;
}

// UI Controls
function startGame(mode) {
    initBoard();
    currentPlayer = 1;
    capturedByBlack = 0;
    capturedByWhite = 0;

    if (mode === 'solo' || !isOnline) {
        isOnline = false;
        roomInfo.innerHTML = "혼자두기 (Solo Mode)";
    } else {
        roomInfo.innerHTML = `온라인 접속 중: VS ${opponentUser} (나의 돌: ${myColor === 1 ? '⚫ 흑' : '⚪ 백'})`;
    }

    updateUI();
    drawBoard();
}

function passTurn(emit = true) {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateUI();

    if (isOnline && emit && socket && socket.readyState === 1) {
        socket.send(JSON.stringify({
            type: 'go-pass',
            room: roomId,
            senderId: myId,
            targetUser: opponentUser
        }));
    }
}

function resignGame(emit = true) {
    const winner = currentPlayer === 1 ? '백(White)' : '흑(Black)';
    alert(`${winner} 승리! (기권)`);

    if (isOnline && emit && socket && socket.readyState === 1) {
        socket.send(JSON.stringify({
            type: 'go-resign',
            room: roomId,
            senderId: myId,
            targetUser: opponentUser
        }));
    }
    startGame('solo');
}

function updateUI() {
    if (currentPlayer === 1) {
        turnText.innerText = "흑 차례";
        turnCircle.className = "turn-circle black";
    } else {
        turnText.innerText = "백 차례";
        turnCircle.className = "turn-circle white";
    }
    capWhiteEl.innerText = capturedByBlack;
    capBlackEl.innerText = capturedByWhite;
}

// Resize Canvas responsively
function resizeCanvas() {
    const container = document.querySelector('.board-container');
    const size = Math.min(container.clientWidth - 48, container.clientHeight - 48);
    // restrict max size
    canvas.width = size > 800 ? 800 : size;
    canvas.height = size > 800 ? 800 : size;
    drawBoard();
}

window.addEventListener('resize', resizeCanvas);

// Init
startGame(isOnline ? 'online' : 'solo');
resizeCanvas();
