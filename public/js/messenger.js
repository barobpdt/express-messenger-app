const userInfo = {
	username: localStorage.getItem('messengerUser') || null,
	avatar: localStorage.getItem('messengerAvatar') || null,
	nickname: localStorage.getItem('messengerNickname') || null,
	profile_check: false
}
// <meta name="viewport" content="width=device-width, initial-scale=1.0">
let backendOrigin = localStorage.getItem('backendOrigin') || '';
let ws;
let currentRoom = '';
let joinedRoomsList = [];

function changeRoom() {
	const selectEl = document.getElementById('room-select');
	currentRoom = selectEl ? selectEl.value : '';
	if (currentRoom) {
		const roomName = selectEl.options[selectEl.selectedIndex].text;
		appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'html', text: `<b>${roomName}</b> 방에 입장했습니다.` });
	} else {
		appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'html', text: `<b>전체 채팅</b>으로 변경되었습니다.` });
	}

	// 방이 변경되면 회원 목록 및 접속자 수를 현재 방 기준으로 다시 필터링하여 렌더링
	renderUserList();
}

// ─── 로그인 로직 ───
const loginOverlay = document.getElementById('login-overlay');
const loginUser = document.getElementById('login-username');
const loginPass = document.getElementById('login-password');
const loginServer = document.getElementById('login-server');
const loginServerContainer = document.getElementById('server-url-container');
const loginError = document.getElementById('login-error');
// 게임버튼은 role=admin인 경우에만 표시
const urlParams = new URLSearchParams(window.location.search);
const roleParam = urlParams.get('role');
const btnGame = document.getElementById('game-dropdown')
btnGame.style.display = roleParam === 'admin' ? 'block' : 'none'

async function fetchUserInfo() {
	try {
		// 사용자 정보조회
		const res = await fetch(backendOrigin + '/api/user/info?username=' + userInfo.username, {
			method: 'get',
			headers: { 'Content-Type': 'application/json' }
		});
		const data = await res.json();
		if (data.success) {
			setUserInfo(data);
			connectWebSocket();
		} else {
			alert("사용자 정보 조회 실패 사용자 아이디 " + userInfo.username + " 이 존재하지 않습니다.");
			showLogin();
		}
	} catch (err) {
		alert("사용자 정보 조회 오류: " + err.message);
		showLogin();
	}
}

function showLogin() {
	loginOverlay.style.display = 'flex';
}

function hideLogin() {
	loginOverlay.style.display = 'none';
}

// 사용자 아이디가 localstorage에 있다면 자동 로그인 처리
if (userInfo.username) {
	hideLogin();
	fetchUserInfo()
} else {
	showLogin()
}

// Capacitor(모바일 앱) 환경일 경우 서버 주소 입력창 표시
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
	loginServerContainer.style.display = 'block';
	if (backendOrigin) loginServer.value = backendOrigin;
}

// ─── 귓속말 대상 관리 ───
let currentTargetUser = null;
let onlineUsers = [];

function toggleUserList() {
	document.getElementById('user-list-overlay').classList.toggle('active');
}

function handleOverlayClick(e) {
	if (e.target.id === 'user-list-overlay') {
		toggleUserList();
	}
}

// ─── 도움말 로직 ───
function openHelp() {
	document.getElementById('help-overlay').style.display = 'flex';
}

function closeHelp(e) {
	if (e && e.target.id !== 'help-overlay' && e.target.className !== 'help-close-btn') return;
	document.getElementById('help-overlay').style.display = 'none';
}

function setTarget(username) {
	if (username === userInfo.username) return; // 본인 클릭 무시
	currentTargetUser = username;
	document.getElementById('target-name').innerText = username;
	document.getElementById('target-indicator').style.display = 'flex';
	document.getElementById('msg-input').placeholder = `(귓속말) ${username}에게 전송...`;
	document.getElementById('user-list-overlay').classList.remove('active');
	renderUserList();
}

function clearTarget() {
	currentTargetUser = null;
	document.getElementById('target-indicator').style.display = 'none';
	document.getElementById('msg-input').placeholder = "메시지 입력... (Enter로 전송)";
	renderUserList();
}

function renderUserList() {
	const listEl = document.getElementById('user-list-dropdown');
	
	// 현재 선택된 방에 따른 필터링 (전체 채팅이 아니면, 해당 방 그룹에 포함된 인원(나 포함)만 표시)
	let filteredUsers = onlineUsers;
	if (currentRoom) {
		filteredUsers = onlineUsers.filter(u => u.username === userInfo.username || (u.joinedRooms && u.joinedRooms.includes(currentRoom)));
	}

	const countBadge = document.getElementById('user-count');
	const onlineCount = filteredUsers.filter(u => u.isOnline).length;
	countBadge.innerText = `${onlineCount}명 접속 중 ▾`;
	countBadge.style.display = 'inline-block';

	listEl.innerHTML = filteredUsers.map(user => {
		const isSelected = user.username === currentTargetUser;
		const isMe = user.username === userInfo.username;
		const isOnline = user.isOnline; // 서버에서 추가된 필드 적용
		const nickName = user.nickname || user.username;

		let avatarHtml;
		if (user.avatar) {
			avatarHtml = `<img src="${user.avatar}" alt="avatar" style="width:32px; height:32px; border-radius:16px; object-fit:cover; flex-shrink:0; ${!isOnline ? 'filter: grayscale(100%) opacity(60%);' : ''}">`;
		} else {
			avatarHtml = `<div style="width:32px; height:32px; border-radius:16px; background:${isOnline ? 'var(--primary)' : '#4b5563'}; color:white; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:bold; flex-shrink:0; ${!isOnline ? 'opacity: 0.6;' : ''}">
				${user.username.charAt(0).toUpperCase()}
			</div>`;
		}

		return `
		<div class="user-item ${isSelected ? 'selected' : ''}" onclick="setTarget('${user.username}')" style="${!isOnline ? 'opacity: 0.6;' : ''}">
			${avatarHtml}
			<div style="flex:1;">
				<span style="font-size:0.8em; margin-right:4px;">${isOnline ? '🟢' : '⚪'}</span>
				${nickName} 
				${isMe ? '<span style="color:#22c55e; font-size:0.8em">(나)</span>' : ''}
			</div>
			${isSelected ? '<div><span style="font-size:0.8em; color:#d8b4fe; margin-right: 6px;">대화 중</span></div>' : ''}
			${isOnline && !isMe ? `<button onclick="inviteGo('${user.username}'); event.stopPropagation();" style="font-size:0.7em; padding:2px 6px; border-radius:4px; background:var(--bg-panel); border:1px solid #c09d59; color:#c09d59; cursor:pointer;" title="바둑 대국 1:1 신청">바둑초대</button>` : ''}
			${isOnline && !isMe ? `<button onclick="startCall('${user.username}'); event.stopPropagation();" class="call-btn" title="음성 통화">📞</button>` : ''}
		</div>
	`}).join('');
	// 카운트는 실제 온라인 접속자 수 (count)만 표시.
	// HTML상의 데이터는 data.count 를 사용하므로 렌더러에서는 건너뛴다.
}

//##> profile
function openProfile() {
	const setAvatarUrl = (url) => {
		document.getElementById('profile-avatar').value = backendOrigin + url;
		userInfo.avatar = backendOrigin + url
	}
	if (!userInfo.profile_check) {
		const label = $('#profile-overlay .profile-box').find('label').eq(-1)
		const btn = $('<button style="margin-left:8px;padding:2px 8px;">업로드</button>').appendTo(label)
		btn.on('click', () => uploadAvatar(userInfo.nickname, data => setAvatarUrl(data.url)))
		userInfo.profile_check = true
	}
	document.getElementById('profile-nickname').value = userInfo.nickname;
	document.getElementById('profile-avatar').value = userInfo.avatar;
	document.getElementById('profile-overlay').style.display = 'flex';
}

function closeProfile(e) {
	if (e && e.target.id !== 'profile-overlay' && e.target.className !== 'help-close-btn') return;
	document.getElementById('profile-overlay').style.display = 'none';
}

function saveProfile() {
	const url = document.getElementById('profile-avatar').value.trim();
	const nickname = document.getElementById('profile-nickname').value.trim();

	// API 전송 코드로 업데이트
	fetch(backendOrigin + '/api/user/avatar', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username: userInfo.username, nickname: nickname, avatar: url || null })
	})
		.then(res => res.json())
		.then(data => {
			if (data.success) {
				appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'text', text: '✅ 프로필 사진이 업데이트 되었습니다.' });
				userInfo.avatar = url;
				userInfo.nickname = nickname;
				closeProfile();
			} else {
				alert("프로필 업데이트 실패: " + data.error);
			}
		}).catch(err => alert("에러: " + err));
}

// ─── 환경설정 관리 ───
const appSettings = {
	downloadPath: localStorage.getItem('setting_downloadPath') || '',
	clipAlarm: localStorage.getItem('setting_clipAlarm') === 'true',
	clipLog: localStorage.getItem('setting_clipLog') === 'true',
	alarmOn: localStorage.getItem('setting_alarmOn') !== 'false' // default true
};

function openSettingsPopup() {
	$('#settings-dropdown .dropdown-content').hide();
	document.getElementById('setting-download-path').value = appSettings.downloadPath;
	document.getElementById('setting-clip-alarm').checked = appSettings.clipAlarm;
	document.getElementById('setting-clip-log').checked = appSettings.clipLog;
	document.getElementById('setting-alarm-on').checked = appSettings.alarmOn;
	document.getElementById('settings-overlay').style.display = 'flex';
}

function closeSettingsPopup(e) {
	if (e && e.target.id !== 'settings-overlay' && !$(e.target).hasClass('help-close-btn')) return;
	document.getElementById('settings-overlay').style.display = 'none';
}

function saveSettings() {
	appSettings.downloadPath = document.getElementById('setting-download-path').value.trim();
	appSettings.clipAlarm = document.getElementById('setting-clip-alarm').checked;
	appSettings.clipLog = document.getElementById('setting-clip-log').checked;
	appSettings.alarmOn = document.getElementById('setting-alarm-on').checked;

	localStorage.setItem('setting_downloadPath', appSettings.downloadPath);
	localStorage.setItem('setting_clipAlarm', appSettings.clipAlarm ? 'true' : 'false');
	localStorage.setItem('setting_clipLog', appSettings.clipLog ? 'true' : 'false');
	localStorage.setItem('setting_alarmOn', appSettings.alarmOn ? 'true' : 'false');

	closeSettingsPopup();
	appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'text', text: '✅ 환경설정이 저장되었습니다.' });
}

function openRoomSettings() {
	$('#settings-dropdown .dropdown-content').hide();
	alert("방나가기/방설정 기능은 준비 중입니다.");
}

function doLogout() {
	$('#settings-dropdown .dropdown-content').hide();
	userInfo.token = null;
	localStorage.removeItem('messengerUser');
	appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: '', output: '✅ 로그아웃 되었습니다.' });
	$('#login-overlay').css('display', 'flex');
	if (ws) ws.close();
}

$(document).on('click', function (e) {
	if (!$(e.target).closest('#settings-dropdown').length) {
		$('#settings-dropdown .dropdown-content').hide();
	}
});

document.getElementById('btn-login').addEventListener('click', () => handleAuth('login'));
document.getElementById('btn-register').addEventListener('click', () => handleAuth('register'));

// 엔터키 지원
loginPass.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') handleAuth('login');
});

// ─── Capacitor 푸시 알림 세팅 (제거됨) ───
// ─── Capacitor 앱 연결 해제 ───
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
	document.getElementById('btn-disconnect-app').style.display = 'flex';
}

function disconnectApp() {
	if (confirm('서버 원격 접속을 종료하고 초기 설정 화면으로 돌아가시겠습니까?')) {
		window.location.href = 'http://localhost/?reset=1';
	}
}
function setUserInfo(data) {
	userInfo.username = data.username;
	userInfo.nickname = data.nickname || userInfo.username;
	userInfo.avatar = data.avatar || null;
	userInfo.token = data.token;
	
	if (data.rooms) {
		joinedRoomsList = data.rooms;
		renderRoomSelect();
	}
}

function renderRoomSelect() {
	const selectEl = document.getElementById('room-select');
	const textEl = document.getElementById('room-name-text');
	if (selectEl && textEl) {
		if (joinedRoomsList.length > 0) {
			selectEl.style.display = 'inline-block';
			textEl.style.display = 'none';
			
			selectEl.innerHTML = '<option value="">전체 채팅</option>';
			joinedRoomsList.forEach(r => {
				const opt = document.createElement('option');
				opt.value = r.roomCode;
				opt.innerText = r.name || r.roomCode;
				selectEl.appendChild(opt);
			});

			if (joinedRoomsList.length === 1) {
				selectEl.value = joinedRoomsList[0].roomCode;
				changeRoom();
			}
		} else {
			selectEl.style.display = 'none';
			textEl.style.display = 'inline';
			selectEl.value = '';
			currentRoom = '';
		}
	}
}
async function handleAuth(action) {
	const username = loginUser.value.trim();
	const password = loginPass.value.trim();
	if (!username || !password) {
		loginError.innerText = "아이디와 비밀번호를 모두 입력하세요.";
		return;
	}

	loginError.style.color = 'var(--text-muted)';
	loginError.innerText = "처리 중...";
	const endpoint = action === 'login' ? '/api/user/login' : '/api/register';

	// 서버 주소 반영
	if (window.Capacitor && window.Capacitor.isNativePlatform()) {
		const serverUrl = loginServer.value.trim();
		if (!serverUrl || !serverUrl.startsWith('http')) {
			loginError.innerText = "올바른 서버 주소를 입력하세요 (http:// 포함).";
			return;
		}
		backendOrigin = serverUrl;
		localStorage.setItem('backendOrigin', backendOrigin);
	}

	try {
		// 로그인/회원가입 요청
		const payload = { username, password };

		const res = await fetch(backendOrigin + endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		const data = await res.json();
		if (data.success) {
			if (action === 'register') {
				loginError.style.color = '#22c55e';
				loginError.innerText = "회원가입 완료! 자동 로그인 중...";
				setTimeout(() => handleAuth('login'), 800);
			} else {
				// 로그인 성공
				setUserInfo(data);
				localStorage.setItem('messengerUser', userInfo.username);
				hideLogin();
				connectWebSocket();
			}
		} else {
			loginError.style.color = '#ef4444';
			loginError.innerText = data.error || "실패했습니다.";
		}
	} catch (err) {
		loginError.style.color = '#ef4444';
		loginError.innerText = "서버 통신 오류: " + err.message;
	}
}


function connectWebSocket() {
	let wsUrl;
	if (backendOrigin) {
		wsUrl = backendOrigin.replace(/^http/, 'ws');
	} else {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		wsUrl = `${protocol}//${window.location.host}`;
	}
	ws = new WebSocket(wsUrl);

	const statusDot = document.getElementById('status-dot');

	ws.onopen = () => {
		statusDot.classList.add('connected');
		// 서버에 내 계정 ID 전송 (접속자 명단 등록을 위함)
		if (userInfo.username) {
			ws.send(JSON.stringify({ type: 'init', username: userInfo.username }));
		}
	};

	ws.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data);
			receiveMessage(data);
		} catch (e) {
			console.error("Failed to parse message", e);
		}
	};

	ws.onclose = () => {
		statusDot.classList.remove('connected');
		setTimeout(connectWebSocket, 3000); // Reconnect after 3s
	};
}

// ─── UI 렌더링 ───
const msgContainer = document.getElementById('messages');
const inputEl = document.getElementById('msg-input');

// CSS 추가 (자바스크립트로 동적 주입 방지 위해 직접 문자열로 반영)
loadStyle(`
	.bubble.whisper {
		background: #fdf4ff !important;
		color: #86198f !important;
		border: 1px solid #e879f9;
	}
	.message.mine .bubble.whisper {
		background: #f3e8ff !important;
		color: #6b21a8 !important;
		border: 1px solid #d8b4fe;
	}
`)
function appendMessageContainer() {
	const div = $('<div/>').appendTo(msgContainer)
	div.css({ width: '100%', minHeight: 40, maxHeight: 400, overflow: 'auto', background: '#eee', padding: '8px', color: '#222' })
	scrollToBottom();
	return div
}
function appendMessageBubble(data) {
	const isMine = data.senderId === userInfo.username;
	const el = document.createElement('div');
	el.className = `message ${isMine ? 'mine' : 'others'}`;

	const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

	let contentHtml = '';

	// 귓속말 뱃지 렌더링
	let whisperHtml = '';
	if (data.targetUser) {
		whisperHtml = `<span class="whisper-badge">[귓속말]</span> `;
	}

	if (data.type === 'text' || data.type === 'command') {
		// 텍스트는 이스케이프 (기본적인 XSS 방지)
		const safeText = data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
		contentHtml = `<div class="bubble ${data.targetUser ? 'whisper' : ''}">${whisperHtml}${safeText.replace(/\n/g, '<br>')}</div>`;
	} else if (data.type === 'html') {
		// 시스템에서 생성한 안전한 HTML 메시지 (XSS 방지 풀기)
		contentHtml = `<div class="bubble">${data.text}</div>`;
	} else if (data.type === 'cmd-result') {
		contentHtml = `<div class="bubble" style="background:#000; color:#0f0; border-radius:8px; font-family:monospace; padding:12px; font-size:0.85rem; width:100%; overflow-x:auto;">
			<div style="color:#888; margin-bottom:8px;">> ${data.cmd}</div>
			<pre style="margin:0; white-space:pre-wrap;">${data.output.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
		</div>`;
	} else if (data.type === 'file-monitor') {
		contentHtml = `<div class="bubble" style="background:#1e1e1e; color:#d4d4d4; border-radius:8px; font-family:monospace; padding:12px; font-size:0.85rem; width:100%; overflow-x:auto; border-left: 4px solid #4ade80;">
			<div style="color:#888; margin-bottom:4px; font-size:0.75rem;">[${data.file}] 파일 업데이트됨</div>
			<pre style="margin:0; white-space:pre-wrap;">${data.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
		</div>`;
	} else if (data.type === 'file') {
		const url = `${backendOrigin}/api/files/${data.file.id}`;
		const ext = data.file.name.split('.').pop().toLowerCase();
		const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);

		if (isImage) {
			contentHtml = `
				<div class="bubble ${data.targetUser ? 'whisper' : ''}" style="display:flex; flex-direction:column; gap:6px;">
					<span style="font-size:0.8rem; color:${isMine ? (data.targetUser ? '#6b21a8' : '#bae6fd') : (data.targetUser ? '#86198f' : '#8b949e')}">${whisperHtml}🖼 이미지가 공유되었습니다</span>
					<a href="${url}" target="_blank">
						<img src="${url}" alt="${data.file.name}" style="max-width: 100%; max-height: 250px; border-radius: 8px; object-fit: contain; background: #000;">
					</a>
					<div style="font-size:0.75rem; text-align:right;">${data.file.name}</div>
				</div>
			`;
		} else {
			contentHtml = `
				<div class="bubble ${data.targetUser ? 'whisper' : ''}" style="display:flex; flex-direction:column; gap:6px;">
					<span style="font-size:0.8rem; color:${isMine ? (data.targetUser ? '#6b21a8' : '#bae6fd') : (data.targetUser ? '#86198f' : '#8b949e')}">${whisperHtml}📁 파일이 공유되었습니다</span>
					<a href="${url}" class="file-link" target="_blank" download="${data.file.name}">
						💾 ${data.file.name}
					</a>
				</div>
			`;
		}
	}

	// 아바타 UI 표시 - 본인이면 내 아바타, 아니면 온라인배열에서 서치, 없으면 이니셜
	let senderAvatarUrl = data.senderAvatar;
	if (!senderAvatarUrl && onlineUsers) {
		const u = onlineUsers.find(x => x.username === data.senderId);
		if (u && u.avatar) senderAvatarUrl = u.avatar;
	}

	let avatarHtml;
	if (senderAvatarUrl) {
		avatarHtml = `<img src="${senderAvatarUrl}" alt="avatar" style="width:28px; height:28px; border-radius:50%; object-fit:cover; flex-shrink:0; border: 1px solid var(--border);">`;
	} else {
		const senderInitial = (data.senderId && data.senderId !== 'system') ? String(data.senderId).charAt(0).toUpperCase() : 'S';
		avatarHtml = `
			<div style="width:28px; height:28px; border-radius:50%; background:var(--primary); color:white; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; flex-shrink:0;">
				${senderInitial}
			</div>
		`;
	}

	const sender = data.senderId !== 'system' ? onlineUsers.find(x => x.username === data.senderId) : null;
	const iconHtml = `<div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px; margin-left:4px; ${isMine ? 'text-align:right; margin-right:4px;' : ''}">
			${isMine ? userInfo.nickname : (sender ? sender.nickname || data.senderId : data.senderId)}
		</div>`;
	el.innerHTML = `
		${isMine ? iconHtml : `<div style="display: flex; align-items: center; margin-bottom: 4px;">${avatarHtml} ${iconHtml}</div>`}
		<div style="display:flex; flex-direction:column; min-width:100px;">			
			${contentHtml}
			<div class="meta" style="justify-content:${isMine ? 'flex-end' : 'flex-start'}; gap:4px; margin-top:2px;">
				<span>${time}</span>
			</div>
		</div>
	`;

	msgContainer.appendChild(el);
	scrollToBottom();
}

function scrollToBottom() {
	msgContainer.scrollTop = msgContainer.scrollHeight;
}

// ─── 명령어 히스토리 관리 ───
const cmdHistory = [];
let historyIndex = -1;

// ─── 메시지 발송 ───
async function uploadAvatar(nickName, callback) {
	const fileInput = document.createElement('input');
	fileInput.type = 'file';
	fileInput.accept = 'image/*';
	fileInput.click();

	fileInput.onchange = async () => {
		const file = fileInput.files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append('file', file);
		formData.append('nickName', nickName);

		try {
			const response = await fetch(`${backendOrigin}/api/upload/avatar`, { method: 'POST', body: formData });
			if (!response.ok) {
				throw new Error('File upload failed');
			}
			const data = await response.json();
			clog("avatar upload result", data, callback)
			if (typeof callback === 'function') callback(data)
		} catch (error) {
			if (typeof callback === 'function') callback({ url: '' });
			console.error('@@ avatar file upload error:', error);
		}
	};
}
function sendMessage() {
	const text = inputEl.value.trim();
	if (!text || ws.readyState !== WebSocket.OPEN) return;

	// 히스토리에 추가
	if (cmdHistory[cmdHistory.length - 1] !== text) {
		cmdHistory.push(text);
	}
	historyIndex = cmdHistory.length;

	const payload = {
		senderId: userInfo.username,
		timestamp: Date.now(),
		type: 'text',
		text: text,
		targetUser: currentTargetUser
	};

	// 명령어 파싱 (/open URL, /alert MSG, /cmd CMD, /avatar URL)
	if (text.startsWith('/')) {
		const parts = text.split(' ');
		const cmd = parts[0];
		const param = parts[1];
		const args = parts.slice(1).join(' ');
		if (cmd === '/avatar') {
			const url = args.trim();
			fetch(backendOrigin + '/api/user/avatar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: userInfo.username, avatar: url || null })
			})
				.then(res => res.json())
				.then(resData => {
					if (resData.success) {
						appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: '✅ 프로필 사진이 업데이트 되었습니다.' });
					} else {
						appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: `❌ 업데이트 실패: ${resData.error}` });
					}
				})
				.catch(err => {
					appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: `[Error] ${err.message}` });
				});
			inputEl.value = '';
			inputEl.style.height = '40px';
			inputEl.focus();
			return;
		}

		if (cmd === '/login') {
			const [username, password] = args.split(' ');
			appendMessageBubble({ senderId: userInfo.username, timestamp: Date.now(), type: 'cmd-result', cmd: args, output: '로그인 확인 중...' });
			fetch(backendOrigin + '/api/cmd/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			})
				.then(res => res.json())
				.then(resData => {
					if (resData.success) {
						userInfo.token = resData.token;
						appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: '✅ 로그인 성공. 이제 /cmd 명령어를 사용할 수 있습니다.' });
					} else {
						appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: `❌ 로그인 실패: ${resData.error}` });
					}
				})
				.catch(err => {
					appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: `[Network Error] ${err.message}` });
				});
			inputEl.value = '';
			inputEl.style.height = '40px';
			inputEl.focus();
			return;
		}

		if (cmd === '/logout') {
			userInfo.token = null;
			appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: '✅ 로그아웃 되었습니다. 토큰이 삭제되었습니다.' });
			inputEl.value = '';
			inputEl.style.height = '40px';
			inputEl.focus();
			$('#login-overlay').show();
			return;
		}

		if (cmd === '/log') {
			if (!args) {
				appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: '❌ 저장할 내용을 입력해주세요. (예: /log 오늘 회의내용)' });
				inputEl.value = '';
				inputEl.style.height = '40px';
				inputEl.focus();
				return;
			}

			appendMessageBubble({ senderId: userInfo.username, timestamp: Date.now(), type: 'cmd-result', cmd: text, output: '로그 저장 중...' });
			fetch(backendOrigin + '/api/log', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: args })
			})
				.then(res => res.json())
				.then(resData => {
					if (resData.success) {
						appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: text, output: `✅ [${resData.file}] 파일에 저장되었습니다.` });
					} else {
						appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: text, output: `❌ 로그 저장 실패: ${resData.error}` });
					}
				})
				.catch(err => {
					appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: text, output: `[Network Error] ${err.message}` });
				});
			inputEl.value = '';
			inputEl.style.height = '40px';
			inputEl.focus();
			return;
		}

		if (cmd === '/monitor' || cmd === '/unmonitor') {
			if (!userInfo.token) {
				appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: '❌ 로그인 먼저 해주세요. (사용법: /login id pw)' });
				inputEl.value = '';
				inputEl.style.height = '40px';
				inputEl.focus();
				return;
			}

			const action = cmd === '/monitor' ? 'start' : 'stop';
			appendMessageBubble({ senderId: userInfo.username, timestamp: Date.now(), type: 'cmd-result', cmd: args || '(오늘 날짜 로그)', output: `${cmd === '/monitor' ? '모니터링 시작 중...' : '모니터링 종료 중...'}` });

			fetch(backendOrigin + '/api/monitor', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${userInfo.token}`
				},
				body: JSON.stringify({ action: action, targetFile: args })
			})
				.then(res => res.json())
				.then(resData => {
					if (resData.success) {
						appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args || '(오늘 날짜 로그)', output: `✅ ${resData.message}` });
					} else {
						appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args || '(오늘 날짜 로그)', output: `❌ ${resData.error}` });
					}
				})
				.catch(err => {
					appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args || '(오늘 날짜 로그)', output: `[Network Error] ${err.message}` });
				});
			inputEl.value = '';
			inputEl.style.height = '40px';
			inputEl.focus();
			return;
		}
		if (cmd === '/go') {
			if (param == 'ai') {
				openSubpage('/go-ai.html?opener=messenger&user=' + userInfo.username)
			}
			if (param == 'baduk') {
				openSubpage('/go-ai.html?opener=messenger&user=' + userInfo.username)
			}
			if (param == 'game') {
				openSubpage('/multiplayer-game/index.html?opener=messenger&user=' + userInfo.username)
			}
		}

		if (cmd === '/cmd') {
			if (!userInfo.token) {
				appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: '❌ 로그인 먼저 해주세요. (사용법: /login id pw)' });
				inputEl.value = '';
				inputEl.style.height = '40px';
				inputEl.focus();
				return;
			}

			// /cmd 는 로컬(백엔드)로 직접 API 호출하고 화면에 결과만 출력, 웹소켓 브로드캐스트 안 함
			appendMessageBubble({ senderId: userInfo.username, timestamp: Date.now(), type: 'cmd-result', cmd: args, output: '실행 중...' });
			fetch(backendOrigin + '/api/cmd', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${userInfo.token}`
				},
				body: JSON.stringify({ command: args })
			})
				.then(res => res.json())
				.then(resData => {
					// 결과 갱신 (마지막 메시지를 덮어쓰거나 새로 추가)
					appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: resData.success ? resData.output : `[Error] ${resData.error}` });
				})
				.catch(err => {
					appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'cmd-result', cmd: args, output: `[Network Error] ${err.message}` });
				});

			inputEl.value = '';
			inputEl.style.height = '40px';
			inputEl.focus();
			return;
		}

		payload.type = 'command';
		payload.cmd = cmd;
		payload.args = args;
	}

	if (currentRoom) {
		payload.room = currentRoom;
	}

	ws.send(JSON.stringify(payload));
	inputEl.value = '';
	inputEl.style.height = '40px'; // Reset height
	inputEl.focus();
}

// Enter 및 방향키 처리
inputEl.addEventListener('keydown', (e) => {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		if (historyIndex > 0) {
			historyIndex--;
			inputEl.value = cmdHistory[historyIndex];
			inputEl.dispatchEvent(new Event('input')); // 리사이즈 트리거
		}
	} else if (e.key === 'ArrowDown') {
		e.preventDefault();
		if (historyIndex < cmdHistory.length - 1) {
			historyIndex++;
			inputEl.value = cmdHistory[historyIndex];
			inputEl.dispatchEvent(new Event('input'));
		} else {
			historyIndex = cmdHistory.length;
			inputEl.value = '';
			inputEl.dispatchEvent(new Event('input'));
		}
	}
});

// 자동 리사이즈
inputEl.addEventListener('input', function () {
	this.style.height = '40px';
	this.style.height = Math.min(this.scrollHeight, 120) + 'px';

	// 최대 높이 도달 시 스크롤 허용, 아닐 땐 숨김
	if (this.scrollHeight > 120) {
		this.style.overflowY = 'auto';
	} else {
		this.style.overflowY = 'hidden';
	}
});

// ─── 메시지 수신 및 명령어 실행 ───
function receiveMessage(data) {
	// PPT 화이트보드 메시지는 채팅창에 표시하지 않음
	if (!data.type) {
		console.log('@@ receiveMessage 타입오류=>', data);
		return;
	}
	if (data.type.startsWith('ppt-')) {
		return;
	}

	// 룸 필터링 (귓속말 제외, 현재 룸코드 불일치 시 메시지 숨김 처리)
	if (!data.targetUser && data.type !== 'onlineUsers' && !data.type.endsWith('-invite')) {
		const targetRoom = data.room || '';
		if (targetRoom !== currentRoom) {
			if (data.type === 'text' || data.type === 'file' || data.type === 'image') {
				return;
			}
		}
	}

	if (data.type === 'onlineUsers') {
		onlineUsers = data.users || [];
		document.getElementById('user-count').style.display = 'inline-block';
		renderUserList();

		// 만약 현재 타겟유저가 나갔거나(또는 현재 방 멤버가 아니라면) 타겟 초기화도 가능.
		// 지금은 온라인 유저 목록 갱신에 집중합니다.
		if (currentTargetUser && !onlineUsers.find(u => u.username === currentTargetUser)) {
			clearTarget();
		}
		return;
	}

	if (data.type.startsWith('webrtc-')) {
		handleWebRTCSignaling(data);
		return;
	}

	// 백그라운드 게임용 소켓 데이터는 채팅창에 렌더링하지 않음
	const ignoredGameTypes = ['ladder-init', 'ladder-start', 'ladder-join', 'roulette-init', 'roulette-spin', 'roulette-join', 'roulette-leave', 'go-init', 'go-move', 'go-ready', 'go-leave'];
	if (ignoredGameTypes.includes(data.type)) {
		return;
	}
	// 사다리 게임 초대(전체)
	if (data.type === 'ladder-invite') {
		const joinUrl = `/ladder-game.html?room=${data.room}&role=player`;
		const htmlMessage = `
			<div style="text-align:center; padding: 5px;">
				<h3 style="margin-top:0; color:var(--primary);">🪜 사다리 게임 방이 열렸습니다!</h3>
				<p style="margin-bottom:15px; font-size:0.9rem;">'${data.senderId}'님이 만든 사다리 방에 참가하세요.</p>
				<a href="${joinUrl}" target="_blank" style="display:inline-block; padding:10px 20px; background:var(--primary); color:white; text-decoration:none; border-radius:6px; font-weight:bold;">사다리방 입장하기</a>
			</div>
		`;
		appendMessageBubble({
			senderId: 'system',
			timestamp: Date.now(),
			type: 'html',
			text: htmlMessage
		});
		return;
	}

	// 룰렛 게임 초대(전체)
	if (data.type === 'roulette-invite') {
		const joinUrl = `/roulette-game.html?room=${data.room}&role=player`;
		const htmlMessage = `
			<div style="text-align:center; padding: 5px;">
				<h3 style="margin-top:0; color:#f59e0b;">🎯 룰렛 게임 방이 열렸습니다!</h3>
				<p style="margin-bottom:15px; font-size:0.9rem;">'${data.senderId}'님이 만든 룰렛 게임에 참가하세요.</p>
				<a href="${joinUrl}" target="_blank" style="display:inline-block; padding:10px 20px; background:#f59e0b; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">게임방 입장하기</a>
			</div>
		`;
		appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'html', text: htmlMessage });
		return;
	}

	// 바둑 게임 초대 관련 로직
	if (data.type === 'go-invite') {
		const isAccept = confirm(`🔔 [바둑 초대]\n'${data.senderId}'님이 온라인 바둑 대국을 요청했습니다.\n수락하시겠습니까?`);
		if (isAccept) {
			ws.send(JSON.stringify({
				type: 'go-accept',
				senderId: userInfo.username,
				targetUser: data.senderId
			}));

			const url = `/go-game.html?room=${data.senderId}-${userInfo.username}&opponent=${encodeURIComponent(data.senderId)}&color=2`;
			appendMessageBubble({
				senderId: 'system',
				timestamp: Date.now(),
				type: 'html',
				text: `✅ 대국을 수락했습니다. 브라우저 팝업이 차단될 수 있으니 아래 버튼을 눌러 입장하세요.<br><br><a href="${url}" target="_blank" style="display:inline-block; padding:8px 16px; background:var(--primary); color:white; text-decoration:none; border-radius:6px; font-weight:bold;">대국장 입장 (백돌)</a>`
			});
		} else {
			ws.send(JSON.stringify({
				type: 'go-decline',
				senderId: userInfo.username,
				targetUser: data.senderId
			}));
		}
		return;
	}

	if (data.type === 'go-accept') {
		// data.senderId is the person who accepted (invitee)
		// myId is the person who invited (inviter)
		// The room should match what the invitee generated: data.senderId-myId
		const url = `/go-game.html?room=${data.senderId}-${userInfo.username}&opponent=${encodeURIComponent(data.senderId)}&color=1`;
		appendMessageBubble({
			senderId: 'system',
			timestamp: Date.now(),
			type: 'html',
			text: `✅ '${data.senderId}'님이 바둑 대국을 수락했습니다! 대국 화면이 차단되었다면 아래 버튼을 누르세요.<br><br><a href="${url}" target="_blank" style="display:inline-block; padding:8px 16px; background:var(--primary); color:white; text-decoration:none; border-radius:6px; font-weight:bold;">대국장 입장 (흑돌)</a>`
		});
		return;
	}

	if (data.type === 'go-decline') {
		appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'text', text: `❌ '${data.senderId}'님이 바둑 대국 초대를 거절했습니다.` });
		return;
	}

	appendMessageBubble(data);

	// 본인 메시지는 명령어를 실행하지 않음 (본인이 보낸 시점에 실행되도록 할 수도 있으나, 여기선 수신 시 일괄 처리로 하되 다른 사람 명령어로 내 브라우저 제어)
	// 재미를 위해 "누가 보냈든" 명령어를 실행하도록 허용 (단, /open 등)
	if (data.type === 'command' && data.senderId !== userInfo.username) {
		executeCommand(data.cmd, data.args);
	}
}

function executeCommand(cmd, args) {
	if (cmd === '/open' && args) {
		// 특정 URL 열기
		let url = args;
		if (!url) return;
		if (url.indexOf('.') == -1) {
			url += '.html'
		}
		openSubpage(url)
	} else if (cmd === '/alert' && args) {
		// 알림 띄우기
		alert(`🚨 알림: ${args}`);
	} else if (cmd === '/screenshot') {
		// 상대방이 /screenshot 커맨드를 보내면 내 화면을 캡처해서 공유
		captureScreen();
	} else if (cmd === '/sharescreen') {
		// 내가 /sharescreen 커맨드 입력 시 실시간 화면 스트리밍 시작
		startScreenShare();
	}
}

// ─── 화면 캡처 (/screenshot 커맨드) ───
async function captureScreen() {
	if (!navigator.mediaDevices?.getDisplayMedia) {
		alert('이 브라우저에서는 화면 캡처를 지원하지 않습니다.');
		return;
	}
	try {
		const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } });
		const video = document.createElement('video');
		video.srcObject = stream;
		video.muted = true;
		await new Promise(resolve => { video.onloadedmetadata = resolve; });
		await video.play();

		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext('2d').drawImage(video, 0, 0);
		stream.getTracks().forEach(t => t.stop());
		video.srcObject = null;

		canvas.toBlob(async (blob) => {
			const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' });
			await uploadAndShare(file);
		}, 'image/png', 0.9);
	} catch (err) {
		console.warn('화면 캡처 취소 또는 실패:', err);
	}
}

// ─── WebRTC 실시간 화면 공유 (/sharescreen 커맨드) ───
const peerConnections = {}; // targetId -> RTCPeerConnection
let localStream = null;

async function startScreenShare() {
	if (!navigator.mediaDevices?.getDisplayMedia) {
		alert('이 브라우저에서는 화면 공유를 지원하지 않습니다.');
		return;
	}
	try {
		localStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });

		// 시스템(브라우저)에서 공유 중지 버튼을 누를 경우 처리
		localStream.getVideoTracks()[0].onended = () => {
			stopScreenShare();
		};

		// 다른 사용자들에게 방송 시작 알림
		ws.send(JSON.stringify({
			type: 'webrtc-start',
			senderId: userInfo.username,
			timestamp: Date.now()
		}));

		appendMessageBubble({ senderId: userInfo.username, timestamp: Date.now(), type: 'text', text: '✅ 실시간 화면 공유를 시작했습니다.' });

	} catch (err) {
		console.warn('화면 공유 취소 또는 실패:', err);
	}
}

function stopScreenShare() {
	if (localStream) {
		localStream.getTracks().forEach(t => t.stop());
		localStream = null;
	}
	Object.values(peerConnections).forEach(pc => pc.close());
	for (let key in peerConnections) delete peerConnections[key];

	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type: 'webrtc-stop', senderId: userInfo.username }));
	}
	appendMessageBubble({ senderId: userInfo.username, timestamp: Date.now(), type: 'text', text: '🛑 실시간 화면 공유가 종료되었습니다.' });
}

function createPeerConnection(peerId) {
	if (peerConnections[peerId]) return peerConnections[peerId];

	const pc = new RTCPeerConnection({
		iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
	});
	peerConnections[peerId] = pc;

	pc.onicecandidate = (e) => {
		if (e.candidate) {
			ws.send(JSON.stringify({
				type: 'webrtc-ice',
				targetId: peerId,
				senderId: userInfo.username,
				candidate: e.candidate
			}));
		}
	};

	pc.ontrack = (e) => {
		let videoEl = document.getElementById(`video-${peerId}`);
		if (!videoEl) {
			const msg = document.createElement('div');
			msg.className = 'message others';
			msg.innerHTML = `
				<div class="bubble">
					<span style="font-size:0.85rem; color:#bae6fd; font-weight:bold;">📺 실시간 화면 공유 (User-${peerId.substring(0, 4)})</span>
					<video id="video-${peerId}" autoplay playsinline controls style="max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;"></video>
				</div>
			`;
			msgContainer.appendChild(msg);
			scrollToBottom();
			videoEl = document.getElementById(`video-${peerId}`);
		}
		videoEl.srcObject = e.streams[0];
	};

	return pc;
}

async function handleWebRTCSignaling(data) {
	if (data.senderId === userInfo.username) return; // ignore my own messages

	try {
		if (data.type === 'webrtc-start') {
			// Someone started broadcast, join automatically
			ws.send(JSON.stringify({ type: 'webrtc-join', targetId: data.senderId, senderId: userInfo.username }));
		}
		else if (data.type === 'webrtc-join' && data.targetId === userInfo.username && localStream) {
			// Someone wants to view my broadcast
			const pc = createPeerConnection(data.senderId);
			localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			ws.send(JSON.stringify({ type: 'webrtc-offer', targetId: data.senderId, senderId: userInfo.username, offer }));
		}
		else if (data.type === 'webrtc-offer' && data.targetId === userInfo.username) {
			// Broadcaster sent me an offer
			const pc = createPeerConnection(data.senderId);
			await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			ws.send(JSON.stringify({ type: 'webrtc-answer', targetId: data.senderId, senderId: userInfo.username, answer }));
		}
		else if (data.type === 'webrtc-answer' && data.targetId === userInfo.username) {
			// Viewer sent answer to my offer
			const pc = peerConnections[data.senderId];
			if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
		}
		else if (data.type === 'webrtc-ice' && data.targetId === userInfo.username) {
			// Received ICE candidate
			const pc = peerConnections[data.senderId];
			if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
		}
		else if (data.type === 'webrtc-stop') {
			// Broadcaster stopped sharing
			const pc = peerConnections[data.senderId];
			if (pc) {
				pc.close();
				delete peerConnections[data.senderId];
			}
			const videoEl = document.getElementById(`video-${data.senderId}`);
			if (videoEl) {
				videoEl.srcObject = null;
				const bubble = videoEl.closest('.bubble');
				if (bubble) {
					bubble.innerHTML += '<div style="font-size:0.75rem; color:#ef4444; margin-top:8px;">❌ 화면 공유가 종료되었습니다.</div>';
				}
				videoEl.remove();
			}
		}
	} catch (err) {
		console.error("WebRTC Signaling Error:", err);
	}
}

// ─── 파일 업로드 (공통) ───
const progOverlay = document.getElementById('progress-overlay');
const progBar = document.getElementById('up-prog');

// 파일 업로드 + WebSocket 공유 공통 함수
async function uploadAndShare(file) {
	const formData = new FormData();
	formData.append('file', file);

	progOverlay.style.display = 'flex';
	progBar.style.width = '0%';

	try {
		const result = await new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.upload.onprogress = e => {
				if (e.lengthComputable) progBar.style.width = (e.loaded / e.total * 100) + '%';
			};
			xhr.onload = () => {
				if (xhr.status < 300) resolve(JSON.parse(xhr.responseText));
				else reject(new Error(xhr.responseText));
			};
			xhr.onerror = () => reject(new Error('네트워크 오류'));
			xhr.open('POST', backendOrigin + '/api/files');
			xhr.send(formData);
		});

		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({
				senderId: userInfo.username,
				timestamp: Date.now(),
				type: 'file',
				file: { id: result.fileId, name: result.name, size: result.size },
				targetUser: currentTargetUser
			}));
		}
	} catch (err) {
		alert('파일 업로드에 실패했습니다. ' + err.message);
	} finally {
		progOverlay.style.display = 'none';
	}
}

// 파일 input (<input type="file">) 핸들러
async function handleFileUpload(event) {
	const file = event.target.files[0];
	if (!file) return;
	await uploadAndShare(file);
	event.target.value = '';
}

// ─── 클립보드 이미지 붙여넣기 (Ctrl+V) ───
inputEl.addEventListener('paste', async (e) => {
	const items = e.clipboardData?.items;
	if (!items) return;
	for (const item of items) {
		if (item.type.startsWith('image/')) {
			e.preventDefault();
			const file = item.getAsFile();
			if (file) await uploadAndShare(file);
			break;
		}
	}
});

// ─── 드래그 & 드롭 파일 업로드 ───
(function initDragDrop() {
	const dropZone = document.getElementById('chat-container');

	// 드래그 오버레이 생성
	const overlay = document.createElement('div');
	overlay.id = 'drag-overlay';
	overlay.innerHTML = `
		<div style="display:flex; flex-direction:column; align-items:center; gap:12px; pointer-events:none;">
			<div style="font-size:3rem;">📂</div>
			<div style="font-size:1.1rem; font-weight:600;">파일을 여기에 놓으세요</div>
			<div style="font-size:0.85rem; color:rgba(255,255,255,0.7);">이미지, 문서, 영상 등 모든 파일 지원</div>
		</div>
	`;
	overlay.style.cssText = `
		display: none;
		position: absolute;
		inset: 0;
		background: rgba(99, 102, 241, 0.18);
		border: 2.5px dashed var(--primary, #6366f1);
		border-radius: 12px;
		z-index: 999;
		align-items: center;
		justify-content: center;
		color: white;
		backdrop-filter: blur(2px);
		transition: opacity 0.15s;
		pointer-events: none;
	`;
	// chat-container가 relative여야 overlay가 정상 동작
	dropZone.style.position = 'relative';
	dropZone.appendChild(overlay);

	let dragCounter = 0; // 자식 요소 진입/이탈 시 중복 이벤트 방지용 카운터

	dropZone.addEventListener('dragenter', (e) => {
		e.preventDefault();
		dragCounter++;
		if (dragCounter === 1) {
			overlay.style.display = 'flex';
		}
	});

	dropZone.addEventListener('dragleave', (e) => {
		dragCounter--;
		if (dragCounter === 0) {
			overlay.style.display = 'none';
		}
	});

	dropZone.addEventListener('dragover', (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	});

	dropZone.addEventListener('drop', async (e) => {
		e.preventDefault();
		dragCounter = 0;
		overlay.style.display = 'none';

		const files = Array.from(e.dataTransfer.files);
		if (files.length === 0) return;

		for (const file of files) {
			await uploadAndShare(file);
		}
	});
})();

// ─── 모바일 가상 키보드 대응 (스크롤 및 레이아웃 조정) ───
if (window.visualViewport) {
	const adjustHeight = () => {
		// 키보드 등장 시 안전하게 viewport 높이만큼 메인 레이아웃 제한
		document.body.style.height = window.visualViewport.height + 'px';
		scrollToBottom();
	};
	window.visualViewport.addEventListener('resize', adjustHeight);

	// 입력창 포커스 시 약간의 딜레이 후 강제 스크롤
	inputEl.addEventListener('focus', () => {
		setTimeout(scrollToBottom, 300);
	});

	// 초기 사이즈 설정
	adjustHeight();
}

// 사용자 정의 알림
function playAlertSound() {
	// (생략)
}

function inviteGo(targetUser) {
	if (!ws || ws.readyState !== 1) {
		alert("서버 연결이 필요합니다.");
		return;
	}
	if (confirm(`'${targetUser}'님에게 바둑 온라인 대국을 요청하시겠습니까?`)) {
		ws.send(JSON.stringify({
			type: 'go-invite',
			senderId: userInfo.username,
			targetUser: targetUser
		}));
		appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'text', text: `📩 '${targetUser}'님에게 바둑 대국을 요청했습니다. 수락을 기다립니다.` });
	}
}

// ─── 사다리 게임 방 생성 (관리자) ───
function openLadderAdmin() {
	if (!ws || ws.readyState !== 1) { alert("서버 연결이 필요합니다."); return; }
	const roomName = `ladder-${userInfo.username}-${Date.now()}`;
	window.open(`/ladder-game.html?room=${roomName}&role=admin`, '_blank');
	ws.send(JSON.stringify({ type: 'ladder-invite', senderId: userInfo.username, room: roomName }));
	appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'text', text: `🪜 '${userInfo.username}'님이 사다리 게임 방을 오픈했습니다!` });
	const dropdown = document.getElementById('game-dropdown');
	if (dropdown) dropdown.classList.remove('active');
}

// ─── 룰렛 게임 방 생성 (관리자) ───
function openRouletteAdmin() {
	if (!ws || ws.readyState !== 1) { alert("서버 연결이 필요합니다."); return; }
	const roomName = `roulette-${userInfo.username}-${Date.now()}`;
	window.open(`/roulette-game.html?room=${roomName}&role=admin`, '_blank');
	ws.send(JSON.stringify({ type: 'roulette-invite', senderId: userInfo.username, room: roomName }));
	appendMessageBubble({ senderId: 'system', timestamp: Date.now(), type: 'text', text: `🎯 '${userInfo.username}'님이 룰렛 게임 방을 오픈했습니다!` });
	const dropdown = document.getElementById('game-dropdown');
	if (dropdown) dropdown.classList.remove('active');
}

// 게임 런처 드롭다운 토글
function toggleGameDropdown(e) {
	e.stopPropagation();
	const dropdown = document.getElementById('game-dropdown');
	if (dropdown) dropdown.classList.toggle('active');
}

// 화면 밖 클릭 시 드롭다운 닫기
document.addEventListener('click', function (event) {
	const dropdown = document.getElementById('game-dropdown');
	if (dropdown && !dropdown.contains(event.target)) {
		dropdown.classList.remove('active');
	}
});

// ─── 카메라 촬영 기능 (Hybrid: Capacitor or WebRTC) ───
let cameraStream = null;

async function openCamera() {
	// 1. 네이티브 앱(Capacitor) 환경인지 확인
	if (window.Capacitor && window.Capacitor.isNativePlatform()) {
		try {
			const image = await Capacitor.Plugins.Camera.getPhoto({
				quality: 85,
				allowEditing: false,
				resultType: 'uri', // CameraResultType.Uri 대신 문자열 사용 (설정값 호환)
				source: 'camera'   // CameraSource.Camera
			});

			// 네이티브에서 받은 URI를 Blob으로 변환하여 File 객체 생성
			const response = await fetch(image.webPath);
			const blob = await response.blob();
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const file = new File([blob], `photo_${timestamp}.jpg`, { type: 'image/jpeg' });

			// 기존 업로드 로직 태우기
			uploadAndShare(file);
		} catch (error) {
			console.error("Capacitor 카메라 실행 실패 취소:", error);
		}
		return;
	}

	// 2. 일반 웹 브라우저 환경 (WebRTC Polyfill)
	const overlay = document.getElementById('camera-overlay');
	const video = document.getElementById('camera-video');

	try {
		cameraStream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: 'environment' }, // 후면 카메라 우선
			audio: false
		});
		video.srcObject = cameraStream;
		overlay.style.display = 'flex';
	} catch (err) {
		console.error("Camera access error:", err);
		alert("카메라 접근 권한이 없거나 지원하지 않는 기기입니다.\n" + err.message);
	}
}

function closeCamera() {
	document.getElementById('camera-overlay').style.display = 'none';
	if (cameraStream) {
		cameraStream.getTracks().forEach(track => track.stop());
		cameraStream = null;
	}
}

function takePhoto() {
	const video = document.getElementById('camera-video');
	const canvas = document.getElementById('camera-canvas');

	if (!cameraStream) return;

	// 비디오 원본 크기에 맞춰 캔버스 설정
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;

	const ctx = canvas.getContext('2d');
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

	// 캔버스 이미지를 Blob으로 변환 후 File 객체 생성
	canvas.toBlob((blob) => {
		if (!blob) {
			alert("사진 캡처에 실패했습니다.");
			return;
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const file = new File([blob], `photo_${timestamp}.jpg`, { type: 'image/jpeg' });

		// 기존 파일 업로드 파이프라인(uploadFile) 재사용
		uploadFile(file);
		closeCamera();
	}) // (canvas.toBlob end)
}

// ══════════════════════════════════════════════════════════
// WebRTC 1:1 음성 통화
// ══════════════════════════════════════════════════════════

let _pc = null;          // RTCPeerConnection
let _localStream = null; // 내 마이크 스트림
let _callPeer = null;    // 현재 통화 상대방 username
let _callState = 'idle'; // idle | ringing | in-call
let _isMuted = false;
let _callTimerInterval = null;
let _callSeconds = 0;
let _pendingOffer = null; // 수신한 offer SDP

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// ── 시그널링 메시지 처리 ──────────────────────────────────
function handleWebRTCSignaling(data) {
	switch (data.type) {
		case 'webrtc-call-request':
			// 수신: 통화 요청
			if (_callState !== 'idle') {
				// 이미 통화 중이면 거절
				_wsSend({ type: 'webrtc-call-decline', targetUser: data.senderId, senderId: userInfo.username, reason: 'busy' });
				return;
			}
			_callState = 'ringing';
			_callPeer = data.senderId;
			_pendingOffer = data.offer;
			document.getElementById('call-from-name').textContent = data.senderNick || data.senderId;
			document.getElementById('call-incoming').style.display = 'block';
			break;

		case 'webrtc-call-decline':
			// 상대가 거절
			if (_callState === 'ringing') {
				_callCleanup();
				appendMessageBubble({
					senderId: 'system', timestamp: Date.now(), type: 'text',
					text: `📵 ${data.senderId}님이 통화를 거절했습니다.`
				});
			}
			break;

		case 'webrtc-answer':
			// 상대가 수락 → SDP answer 수신
			if (_pc) _pc.setRemoteDescription(new RTCSessionDescription(data.answer));
			break;

		case 'webrtc-ice':
			// ICE candidate 수신
			if (_pc && data.candidate) {
				_pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => { });
			}
			break;

		case 'webrtc-hangup':
			// 상대가 통화 종료
			if (_callState !== 'idle') {
				_callCleanup();
				appendMessageBubble({
					senderId: 'system', timestamp: Date.now(), type: 'text',
					text: `📵 ${data.senderId}님이 통화를 종료했습니다.`
				});
			}
			break;
	}
}

// ── 발신 ─────────────────────────────────────────────────
async function checkMicrophoneExists() {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		const microphones = devices.filter(device => device.kind === 'audioinput');
		if (microphones.length > 0) {
			console.log("마이크가 존재합니다.");
			return true;
		} else {
			console.log("마이크가 없습니다.");
			return false;
		}
	} catch (error) {
		console.error("장치를 확인하는 중 오류가 발생했습니다.", error);
		return false;
	}
}

async function startCall(targetUsername) {
	if (_callState !== 'idle') { alert('이미 통화 중입니다.'); return; }
	if (!ws || ws.readyState !== WebSocket.OPEN) { alert('서버에 연결되지 않았습니다.'); return; }

	try {
		_localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch (err) {
		alert('마이크 권한이 필요합니다.\n' + err.message); return;
	}

	_callState = 'ringing';
	_callPeer = targetUsername;
	_pc = _createPC(targetUsername);

	_localStream.getTracks().forEach(track => _pc.addTrack(track, _localStream));

	const offer = await _pc.createOffer();
	await _pc.setLocalDescription(offer);

	const targetNick = onlineUsers.find(u => u.username === targetUsername)?.nickname || targetUsername;
	_wsSend({
		type: 'webrtc-call-request',
		targetUser: targetUsername,
		senderId: userInfo.username,
		senderNick: userInfo.nickname || userInfo.username,
		offer
	});

	appendMessageBubble({
		senderId: 'system', timestamp: Date.now(), type: 'text',
		text: `📞 ${targetNick}님에게 음성 통화를 걸었습니다...`
	});
}

// ── 수신 수락 ─────────────────────────────────────────────
async function acceptCall() {
	document.getElementById('call-incoming').style.display = 'none';
	if (!_pendingOffer) return;

	try {
		_localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch (err) {
		alert('마이크 권한이 필요합니다.\n' + err.message);
		declineCall(); return;
	}

	_pc = _createPC(_callPeer);
	_localStream.getTracks().forEach(track => _pc.addTrack(track, _localStream));

	await _pc.setRemoteDescription(new RTCSessionDescription(_pendingOffer));
	const answer = await _pc.createAnswer();
	await _pc.setLocalDescription(answer);

	_wsSend({ type: 'webrtc-answer', targetUser: _callPeer, senderId: userInfo.username, answer });
	_pendingOffer = null;
	_callState = 'in-call';
	_showCallBar();
}

// ── 수신 거절 ─────────────────────────────────────────────
function declineCall() {
	document.getElementById('call-incoming').style.display = 'none';
	_wsSend({ type: 'webrtc-call-decline', targetUser: _callPeer, senderId: userInfo.username });
	_callCleanup();
}

// ── 통화 종료 ─────────────────────────────────────────────
function hangupCall() {
	_wsSend({ type: 'webrtc-hangup', targetUser: _callPeer, senderId: userInfo.username });
	appendMessageBubble({
		senderId: 'system', timestamp: Date.now(), type: 'text',
		text: `📵 통화가 종료되었습니다. (${_fmtTime(_callSeconds)})`
	});
	_callCleanup();
}

// ── 음소거 토글 ───────────────────────────────────────────
function toggleMute() {
	if (!_localStream) return;
	_isMuted = !_isMuted;
	_localStream.getAudioTracks().forEach(t => t.enabled = !_isMuted);
	document.getElementById('mute-btn').textContent = _isMuted ? '🔇' : '🎤';
	document.getElementById('mute-btn').style.color = _isMuted ? '#ef4444' : '';
}

// ── 내부 헬퍼 ─────────────────────────────────────────────
function _createPC(peer) {
	const pc = new RTCPeerConnection(ICE_SERVERS);

	pc.onicecandidate = e => {
		if (e.candidate) {
			_wsSend({ type: 'webrtc-ice', targetUser: peer, senderId: userInfo.username, candidate: e.candidate });
		}
	};

	pc.ontrack = e => {
		const audio = document.getElementById('remote-audio');
		if (audio) audio.srcObject = e.streams[0];
	};

	pc.onconnectionstatechange = () => {
		if (pc.connectionState === 'connected' && _callState !== 'in-call') {
			_callState = 'in-call';
			_showCallBar();
		} else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
			if (_callState === 'in-call') { hangupCall(); }
		}
	};

	return pc;
}

function _showCallBar() {
	const bar = document.getElementById('call-bar');
	bar.style.display = 'flex';
	document.getElementById('call-peer-name').textContent =
		onlineUsers.find(u => u.username === _callPeer)?.nickname || _callPeer;
	_callSeconds = 0;
	clearInterval(_callTimerInterval);
	_callTimerInterval = setInterval(() => {
		_callSeconds++;
		document.getElementById('call-timer').textContent = _fmtTime(_callSeconds);
	}, 1000);
}

function _callCleanup() {
	clearInterval(_callTimerInterval);
	if (_pc) { _pc.close(); _pc = null; }
	if (_localStream) { _localStream.getTracks().forEach(t => t.stop()); _localStream = null; }
	const audio = document.getElementById('remote-audio');
	if (audio) audio.srcObject = null;
	document.getElementById('call-incoming').style.display = 'none';
	document.getElementById('call-bar').style.display = 'none';
	document.getElementById('mute-btn').textContent = '🎤';
	_isMuted = false;
	_callPeer = null;
	_callState = 'idle';
	_pendingOffer = null;
}

function _wsSend(data) {
	if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function _fmtTime(sec) {
	const m = String(Math.floor(sec / 60)).padStart(2, '0');
	const s = String(sec % 60).padStart(2, '0');
	return `${m}:${s}`;
}

