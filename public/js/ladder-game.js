// Ladder Game Logic (Admin & Player Synchronization)

const canvas = document.getElementById('ladder-canvas');
const ctx = canvas.getContext('2d');
const adminPanel = document.getElementById('admin-panel');
const statusOverlay = document.getElementById('status-overlay');
const statusText = document.getElementById('status-text');
const btnStart = document.getElementById('btn-start');

// State
let isOnline = false;
let socket = null;
let roomId = null;
let myId = localStorage.getItem('messengerUser') || sessionStorage.getItem('messengerUser') || 'Guest_' + Math.floor(Math.random() * 1000);
let myRole = 'player'; // 'admin' or 'player'

let ladderData = null;
/*
ladderData structure:
{
    participants: ["A", "B", "C"],
    prizes: ["100", "50", "0"],
    lines: [ // vertical lines logic
        {
            x: 100, // drawing x coord
            rungs: [ { y: 200, toLine: 1 }, ... ] // connections to other lines
        }
    ],
    results: [ { participant: "A", prize: "50", path: [{x,y}, ...] } ]
}
*/

let isAnimating = false;

// URL Parsing (e.g., ?room=123&role=admin)
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
const roleParam = urlParams.get('role'); // expected 'admin' or 'player'

if (roomParam) {
    isOnline = true;
    roomId = roomParam;
    if (roleParam === 'admin') {
        myRole = 'admin';
        document.getElementById('room-info').innerText = `방 ID: ${roomId} (관리자)`;
        adminPanel.style.display = 'block';
        statusOverlay.style.display = 'none'; // Admin doesn't wait
    } else {
        document.getElementById('room-info').innerText = `방 ID: ${roomId} (참가자: ${myId})`;
    }

    connectWebSocket();
} else {
    // Local debug mode
    myRole = 'admin';
    document.getElementById('room-info').innerText = "로컬 테스트 모드 (관리자)";
    adminPanel.style.display = 'block';
    statusOverlay.style.display = 'none';
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'init', username: myId }));
        // 서버 파트에서 현재 소켓이 이 방(roomId)에 접속했음을 기록 (브로드캐스트 안 됨)
        socket.send(JSON.stringify({ type: 'sys-join', room: roomId }));

        // 방에 들어왔음을 다른 사람들에게 (특히 방장에게) 알림
        if (isOnline) {
            socket.send(JSON.stringify({
                type: 'ladder-join',
                room: roomId,
                senderId: myId
            }));
        }
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // Only process if it's for this ladder room
            if (data.room === roomId) {
                if (data.type === 'ladder-init') {
                    receiveLadderData(data.ladderData);
                } else if (data.type === 'ladder-start') {
                    playAnimation();
                } else if (data.type === 'ladder-join' && myRole === 'admin') {
                    // 방장 화면의 명단에 자동으로 참가자 추가
                    addParticipantToInput(data.senderId);
                }
            }
        } catch (e) {
            console.error("WS parse error", e);
        }
    };
}

function addParticipantToInput(newParticipantId) {
    // if (newParticipantId === myId) return; // 방장 본인은 무시 (필요시 주석 처리)

    const pInput = document.getElementById('participants-input');
    let currentList = pInput.value.split(',').map(s => s.trim()).filter(Boolean);

    // 중복 추가 방지
    if (!currentList.includes(newParticipantId)) {
        currentList.push(newParticipantId);
        pInput.value = currentList.join(', ');

        // 인원수가 늘었으니 기본 획득 점수(꽝)도 하나 추가해주면 편함
        const prInput = document.getElementById('prizes-input');
        let prizeList = prInput.value.split(',').map(s => s.trim()).filter(Boolean);
        prizeList.push('꽝');
        prInput.value = prizeList.join(', ');
    }
}

// ─── Admin Triggers ───

function generateLadder() {
    const pInput = document.getElementById('participants-input').value;
    const prInput = document.getElementById('prizes-input').value;
    const density = parseInt(document.getElementById('density-input').value) || 5;

    const participants = pInput.split(',').map(s => s.trim()).filter(Boolean);
    const prizes = prInput.split(',').map(s => s.trim()).filter(Boolean);

    if (participants.length < 2) {
        alert("참가자는 최소 2명 이상이어야 합니다.");
        return;
    }
    if (participants.length !== prizes.length) {
        alert("참가자 수와 획득 점수(결과)의 개수가 같아야 합니다.");
        return;
    }

    // 1. Generate core logic
    ladderData = createLadderData(participants, prizes, density);

    // 2. Draw locally
    drawLadder();

    // 3. Show Start button
    btnStart.style.display = 'block';

    // 4. Broadcast to peers
    if (isOnline && socket && socket.readyState === 1) {
        socket.send(JSON.stringify({
            type: 'ladder-init',
            room: roomId,
            senderId: myId,
            ladderData: ladderData
        }));
    }
}

function startAnimation() {
    if (!ladderData) return;

    // Broadcast start
    if (isOnline && socket && socket.readyState === 1) {
        socket.send(JSON.stringify({
            type: 'ladder-start',
            room: roomId,
            senderId: myId
        }));
    }

    // Play locally
    playAnimation();
}


// ─── Core Game Logic ───

function createLadderData(participants, prizes, densityScale) {
    const N = participants.length;
    // densityScale is 1 to 10.
    const numRows = 10 + (densityScale * 2);

    const grid = [];
    for (let r = 0; r < numRows; r++) {
        const row = [];
        for (let c = 0; c < N - 1; c++) {
            row.push(false);
        }
        grid.push(row);
    }

    // Populate grid
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < N - 1; c++) {
            // ~45% chance to put a rung
            if (Math.random() < 0.45) {
                grid[r][c] = true;
                c++; // skip next col to avoid overlap ambiguity
            }
        }
    }

    // Calculate paths and results
    // Path for a participant starts at (col, y=0) and goes down.
    const results = [];
    for (let i = 0; i < N; i++) {
        let currentCol = i;
        const path = [{ xIndex: currentCol, yIndex: -1 }]; // Start point

        for (let r = 0; r < numRows; r++) {
            // Move down to the row level
            path.push({ xIndex: currentCol, yIndex: r });

            // Check if there is a rung to the left
            if (currentCol > 0 && grid[r][currentCol - 1]) {
                currentCol--; // move left
                path.push({ xIndex: currentCol, yIndex: r }); // move across rung
            }
            // Check if there is a rung to the right
            else if (currentCol < N - 1 && grid[r][currentCol]) {
                currentCol++; // move right
                path.push({ xIndex: currentCol, yIndex: r }); // move across rung
            }
        }
        path.push({ xIndex: currentCol, yIndex: numRows }); // End point

        results.push({
            participant: participants[i],
            prize: prizes[currentCol],
            path: path,
            endLine: currentCol
        });
    }

    return {
        participants,
        prizes,
        numCols: N,
        numRows: numRows,
        grid: grid,
        results: results
    };
}

function receiveLadderData(data) {
    ladderData = data;
    statusOverlay.style.display = 'none';
    drawLadder();
}

// ─── Rendering Engine ───

const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function getX(colIndex, width, numCols) {
    const margin = width / (numCols + 1);
    return margin + (colIndex * margin);
}

function getY(rowIndex, height, numRows) {
    const topMargin = 60;
    const bottomMargin = 60;
    const step = (height - topMargin - bottomMargin) / numRows;
    return topMargin + (rowIndex * step);
}

function drawLadder() {
    if (!ladderData) return;

    const container = document.getElementById('canvas-container');
    const width = container.clientWidth * 0.95;
    const height = Math.max(container.clientHeight * 0.9, 600);

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { numCols, numRows, grid, participants, prizes } = ladderData;

    // Draw lines and rungs
    ctx.strokeStyle = '#64748b'; // default line color
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Draw Rungs (Horizontal)
    ctx.beginPath();
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols - 1; c++) {
            if (grid[r][c]) {
                const startX = getX(c, canvas.width, numCols);
                const endX = getX(c + 1, canvas.width, numCols);
                const y = getY(r, canvas.height, numRows);
                ctx.moveTo(startX, y);
                ctx.lineTo(endX, y);
            }
        }
    }
    ctx.stroke();

    // 2. Draw Vertical Lines
    ctx.beginPath();
    for (let c = 0; c < numCols; c++) {
        const x = getX(c, canvas.width, numCols);
        const topY = getY(0, canvas.height, numRows) - 20;
        const bottomY = getY(numRows - 1, canvas.height, numRows) + 20;
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
    }
    ctx.stroke();

    // 3. Draw Labels (Participants top, Prizes bottom)
    ctx.font = 'bold 16px Pretendard';
    ctx.textAlign = 'center';

    for (let c = 0; c < numCols; c++) {
        const x = getX(c, canvas.width, numCols);
        const topY = getY(0, canvas.height, numRows) - 35;
        const bottomY = getY(numRows - 1, canvas.height, numRows) + 45;

        // Draw Participant Name
        ctx.fillStyle = colors[c % colors.length];
        ctx.fillText(participants[c], x, topY);

        // Draw Prize Outline Box
        ctx.fillStyle = '#1e293b';
        const txtWidth = Math.max(ctx.measureText(prizes[c]).width + 20, 60);
        ctx.fillRect(x - txtWidth / 2, bottomY - 20, txtWidth, 30);

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - txtWidth / 2, bottomY - 20, txtWidth, 30);

        // Draw Prize Text
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(prizes[c], x, bottomY + 2);
    }
}

function getNodeCoords(node) {
    const { numCols, numRows } = ladderData;
    const x = getX(node.xIndex, canvas.width, numCols);
    let y;
    if (node.yIndex === -1) y = getY(0, canvas.height, numRows) - 20;
    else if (node.yIndex === numRows) y = getY(numRows - 1, canvas.height, numRows) + 20;
    else y = getY(node.yIndex, canvas.height, numRows);
    return { x, y };
}

function drawLineAnim(ctx, startX, startY, endX, endY, color, duration) {
    return new Promise(resolve => {
        let startTime = null;
        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 6; // 원래 두께로 복구
            ctx.lineCap = 'round';
            ctx.moveTo(startX, startY);

            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;

            ctx.lineTo(currentX, currentY);
            ctx.stroke();

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

async function animatePath(path, color) {
    for (let i = 0; i < path.length - 1; i++) {
        const start = getNodeCoords(path[i]);
        const end = getNodeCoords(path[i + 1]);

        // Horizontal moves (same Y index) are faster than vertical moves
        const isHorizontal = Math.abs(start.x - end.x) > 0.1;
        const duration = isHorizontal ? 150 : 250;

        await drawLineAnim(ctx, start.x, start.y, end.x, end.y, color, duration);
    }
}

async function playAnimation() {
    if (isAnimating) return;
    isAnimating = true;
    adminPanel.style.display = 'none'; // hide panel during animation to clean screen

    console.log("Playing animation...");

    // Clear any previous traces by redrawing the base ladder
    drawLadder();

    // Animate each participant one by one
    for (let i = 0; i < ladderData.results.length; i++) {
        const result = ladderData.results[i];
        const color = colors[i % colors.length];

        // Highlight the starting name
        const startNode = getNodeCoords(result.path[0]);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(startNode.x, startNode.y - 15, 8, 0, Math.PI * 2);
        ctx.fill();

        // Trace the path
        await animatePath(result.path, color);

        // Highlight the prize
        const endNode = getNodeCoords(result.path[result.path.length - 1]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(endNode.x, endNode.y + 15, 8, 0, Math.PI * 2);
        ctx.fill();

        // Pause briefly before next participant
        await new Promise(r => setTimeout(r, 600));
    }

    // Show final modal results after all animations complete
    setTimeout(() => {
        showResults();
        isAnimating = false;
        if (myRole === 'admin') adminPanel.style.display = 'block';
    }, 1000);
}

function showResults() {
    const modal = document.getElementById('result-modal');
    const list = document.getElementById('final-results-list');
    list.innerHTML = '';

    // Placeholder results
    if (ladderData && ladderData.participants) {
        ladderData.participants.forEach((p, i) => {
            list.innerHTML += `<li><span class="name">${p}</span> <span>${ladderData.prizes[i]}</span></li>`;
        });
    }

    modal.style.display = 'flex';
}

function closeResults() {
    document.getElementById('result-modal').style.display = 'none';
}

// Handle resize
window.addEventListener('resize', () => {
    if (!isAnimating) drawLadder();
});
