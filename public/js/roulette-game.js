// Roulette Game Logic (Admin & Player Synchronization)

const canvas = document.getElementById('roulette-canvas');
const ctx = canvas.getContext('2d');
const adminPanel = document.getElementById('admin-panel');
const statusOverlay = document.getElementById('status-overlay');
const btnStart = document.getElementById('btn-start');

// Default canvas size
const SIZE = 600;
const RADIUS = SIZE / 2 - 20;
const CENTER = SIZE / 2;

// State
let isOnline = false;
let socket = null;
let roomId = null;
let myId = localStorage.getItem('messengerUser') || sessionStorage.getItem('messengerUser') || 'Guest_' + Math.floor(Math.random() * 1000);
let myRole = 'player'; // 'admin' or 'player'

let rouletteData = null;
/*
rouletteData structure:
{
    items: ["Coffee", "Nothing", "100 Points"],
    colors: ["#ef4444", "#3b82f6", "#10b981"]
}
*/

let currentRotation = 0; // Current angle in radians
let isSpinning = false;
let animationFrameId = null;

// Built-in vibrant color palette
const palette = ['#ff4757', '#1e90ff', '#2ed573', '#ffa502', '#9c88ff', '#ff6b81', '#7bed9f', '#ff7f50'];

// URL Parsing
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
const roleParam = urlParams.get('role');

if (roomParam) {
    isOnline = true;
    roomId = roomParam;
    if (roleParam === 'admin') {
        myRole = 'admin';
        document.getElementById('room-info').innerText = `방 ID: ${roomId} (관리자)`;
        adminPanel.style.display = 'block';
        statusOverlay.style.display = 'none';

        // 방장 본인도 명단과 룰렛 항목에 기본 포함되도록 설정 (입장하기 버튼클릭시만 참여)
        /*
        document.getElementById('participants-input').value = '';
        document.getElementById('prizes-input').value = '';
        */
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

        if (isOnline) {
            if (myRole !== 'admin') {
                socket.send(JSON.stringify({ type: 'roulette-join', room: roomId, senderId: myId }));
            }
        }
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.room === roomId) {
                if (data.type === 'roulette-init') {
                    receiveRouletteData(data.rouletteData);
                } else if (data.type === 'roulette-spin') {
                    playSpinAnimation(data.targetAngle, data.resultItem);
                }
                else if (data.type === 'roulette-join' && myRole === 'admin') {
                    addParticipantToInput(data.senderId);
                }
                else if (data.type === 'roulette-leave' && myRole === 'admin') {
                    removeParticipantFromInput(data.senderId);
                }
            }
        } catch (e) {
            console.error("WS parse error", e);
        }
    };
}

function addParticipantToInput(newParticipantId) {
    // if (newParticipantId === myId) return; (관리자도 입장가능)
    const pInput = document.getElementById('participants-input');
    let currentList = pInput.value.split(',').map(s => s.trim()).filter(Boolean);

    // 명단에 없으면 추가
    if (!currentList.includes(newParticipantId)) {
        currentList.push(newParticipantId);
        pInput.value = currentList.join(', ');

        // 룰렛 항목(prizes) 에도 참가자 이름을 바로 추가해주어 휠에 나타나도록 편의성 제공
        const prInput = document.getElementById('prizes-input');
        let prizeList = prInput.value.split(',').map(s => s.trim()).filter(Boolean);
        if (!prizeList.includes(newParticipantId)) {
            prizeList.push(newParticipantId);
            prInput.value = prizeList.join(', ');
        }
    }
}

function removeParticipantFromInput(participantId) {
    const pInput = document.getElementById('participants-input');
    let currentList = pInput.value.split(',').map(s => s.trim()).filter(Boolean);

    if (currentList.includes(participantId)) {
        currentList = currentList.filter(id => id !== participantId);
        pInput.value = currentList.join(', ');

        // 룰렛 항목에서도 제거
        const prInput = document.getElementById('prizes-input');
        let prizeList = prInput.value.split(',').map(s => s.trim()).filter(Boolean);
        if (prizeList.includes(participantId)) {
            prizeList = prizeList.filter(id => id !== participantId);
            prInput.value = prizeList.join(', ');
        }
    }
}

// 브라우저 창 닫을 때 나갔음을 알림
window.addEventListener('beforeunload', () => {
    if (isOnline && socket && socket.readyState === 1 && myRole !== 'admin') {
        socket.send(JSON.stringify({ type: 'roulette-leave', room: roomId, senderId: myId }));
    }
});

// ─── Admin logic ───

function generateRoulette() {
    const prInput = document.getElementById('prizes-input').value;
    const items = prInput.split(',').map(s => s.trim()).filter(Boolean);

    if (items.length < 2) {
        alert("룰렛 항목은 최소 2개 이상이어야 합니다.");
        return;
    }

    const colors = items.map((_, i) => palette[i % palette.length]);

    rouletteData = { items, colors };

    currentRotation = 0;
    drawRoulette();
    btnStart.style.display = 'block';

    if (isOnline && socket && socket.readyState === 1) {
        socket.send(JSON.stringify({
            type: 'roulette-init',
            room: roomId,
            senderId: myId,
            rouletteData: rouletteData
        }));
    }
}

function spinRoulette() {
    if (!rouletteData || isSpinning) return;

    // 1. Calculate random result
    const numItems = rouletteData.items.length;
    const sliceAngle = (2 * Math.PI) / numItems;

    // Pick a random slice to win (index)
    const winIndex = Math.floor(Math.random() * numItems);

    // Calculate the target angle the wheel needs to land on
    // The pointer is at TOP (which is -PI/2 or 270 degrees)
    // To make slice `winIndex` land at TOP, we calculate the offset.
    // Also add multiple full spins (e.g. 5 to 10 full spins) for dramatic effect.

    const baseSpins = 5 + Math.random() * 5; // 5~10 full spins
    const totalSpinAngle = (baseSpins * 2 * Math.PI);

    // Random position within the winning slice
    const randomOffsetInsideSlice = (Math.random() * 0.8 + 0.1) * sliceAngle; // Avoid landing exactly on lines

    // Target rotation: Current rotation + extra spins + precise alignment to the winning slice
    // Math logic: landing angle is dependent on where the slice is drawn.
    const targetAngle = currentRotation + totalSpinAngle + ((numItems - winIndex) * sliceAngle) - randomOffsetInsideSlice - (Math.PI / 2);

    const resultItem = rouletteData.items[winIndex];

    // 2. Broadcast
    if (isOnline && socket && socket.readyState === 1) {
        socket.send(JSON.stringify({
            type: 'roulette-spin',
            room: roomId,
            senderId: myId,
            targetAngle: targetAngle,
            resultItem: resultItem
        }));
    }

    // 3. Play local
    playSpinAnimation(targetAngle, resultItem);
}

// ─── Receiver logic ───

function receiveRouletteData(data) {
    rouletteData = data;
    currentRotation = 0;
    statusOverlay.style.display = 'none';
    drawRoulette();
}

// ─── Rendering Engine ───

function drawRoulette() {
    if (!rouletteData) return;

    ctx.clearRect(0, 0, SIZE, SIZE);

    const numItems = rouletteData.items.length;
    const sliceAngle = (2 * Math.PI) / numItems;

    // Outer Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.shadowColor = 'transparent'; // reset

    // Draw Wheel slices
    for (let i = 0; i < numItems; i++) {
        const startAngle = currentRotation + (i * sliceAngle);
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(CENTER, CENTER);
        ctx.arc(CENTER, CENTER, RADIUS, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = rouletteData.colors[i];
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4; // Thicker white borders
        ctx.stroke();

        // Draw Text
        ctx.save();
        ctx.translate(CENTER, CENTER);
        ctx.rotate(startAngle + sliceAngle / 2);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px Pretendard'; // Slightly larger font
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 5;

        // Push text towards the edge
        ctx.fillText(rouletteData.items[i], RADIUS - 25, 8);
        ctx.restore();
    }

    // Gloss Overlay for 3D effect
    const gradient = ctx.createRadialGradient(CENTER, CENTER, RADIUS * 0.3, CENTER, CENTER, RADIUS);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Center Peg (Larger, styled)
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 25, 0, 2 * Math.PI);
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#f8fafc';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    // Draw Pointer at Top Center directly on Canvas
    // (This ensures perfectly consistent scaling across web/app displays)
    ctx.beginPath();
    // Start at Top edge of the wheel (CENTER, 20)
    ctx.moveTo(CENTER, 15);
    ctx.lineTo(CENTER - 18, 50); // Left corner
    ctx.lineTo(CENTER + 18, 50); // Right corner
    ctx.closePath();
    ctx.fillStyle = '#ff4757'; // Brilliant red pointer
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2f3542';
    ctx.stroke();

    ctx.shadowColor = 'transparent'; // reset
}

// Easing Out function (Custom exponential/cubic blend for tension)
function easeOutTension(x) {
    // Starts fast, very slowly creeps to a stop (adds tension!)
    return 1 - Math.pow(1 - x, 5);
}

function playSpinAnimation(targetAngle, resultItem) {
    if (isSpinning) return;
    isSpinning = true;
    if (myRole === 'admin') adminPanel.style.display = 'none';

    // Increase duration for higher tension! 7 seconds!
    const duration = 7000;
    const startAngle = currentRotation;
    const distance = targetAngle - startAngle;
    let startTime = null;

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        let progress = Math.min(elapsed / duration, 1);

        // Apply easing curve
        const easeProgress = easeOutTension(progress);

        // Base rotation mapping
        let nextRotation = startAngle + (distance * easeProgress);

        // Add visual shaky effect based on speed!
        // Speed is high when progress is low.
        const speedFactor = 1 - easeProgress;

        if (speedFactor > 0.05) { // Only shake when it's moving
            // Very subtle fast shaking back and forth (simulating mechanical rattling)
            const shakeFrequency = elapsed * 0.1;
            const shakeAmplitude = speedFactor * 0.03; // Max shake angle ~0.03 rad
            const shakeAngle = Math.sin(shakeFrequency) * shakeAmplitude;
            nextRotation += shakeAngle;
        }

        currentRotation = nextRotation % (2 * Math.PI);

        // Render
        drawRoulette();

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // Finished
            cancelAnimationFrame(animationFrameId);

            // Final exact draw without shake
            currentRotation = targetAngle % (2 * Math.PI);
            drawRoulette();

            setTimeout(() => {
                showResults(resultItem);
                isSpinning = false;
                if (myRole === 'admin') adminPanel.style.display = 'block';
            }, 600); // Wait half a sec before showing popup
        }
    }

    animationFrameId = requestAnimationFrame(animate);
}

function showResults(item) {
    const modal = document.getElementById('result-modal');
    document.getElementById('final-result-text').innerText = item;
    modal.style.display = 'flex';
}

function closeResults() {
    document.getElementById('result-modal').style.display = 'none';
}
