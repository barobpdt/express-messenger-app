const wb = (function () {
	loadStyle(`
.ed-slide table {border:1px solid #aaa} .ed-slide table td {border:1px solid #aaa}
#chat-panel {
	position: fixed;
	bottom: calc(var(--th) + 12px);
	right: 18px;
	width: 320px;
	height: 420px;
	background: var(--bg2);
	border: 1px solid var(--border);
	border-radius: 14px;
	display: flex;
	flex-direction: column;
	box-shadow: 0 12px 40px rgba(0,0,0,.55);
	z-index: 500;
	overflow: hidden;
	transform-origin: bottom right;
	transition: transform .2s cubic-bezier(.34,1.56,.64,1), opacity .15s;
}
#chat-panel.hidden {
	transform: scale(.85) translateY(10px);
	opacity: 0;
	pointer-events: none;
}
#chat-hdr {
	padding: 10px 14px;
	background: var(--bg3);
	border-bottom: 1px solid var(--border);
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}
#chat-hdr .chat-title {
	font-size: .85rem;
	font-weight: 600;
	flex: 1;
}
#chat-hdr .chat-room {
	font-size: .73rem;
	color: var(--muted);
	background: var(--bg);
	border: 1px solid var(--border);
	border-radius: 10px;
	padding: 1px 8px;
}
#chat-close {
	background: none;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-size: .9rem;
	padding: 2px 5px;
	border-radius: 4px;
	transition: .15s;
}
#chat-close:hover { color: var(--text); background: var(--border); }

#chat-msgs {
	flex: 1;
	overflow-y: auto;
	padding: 10px 12px;
	display: flex;
	flex-direction: column;
	gap: 6px;
}
#chat-msgs::-webkit-scrollbar { width: 3px; }
#chat-msgs::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.cmsg {
	display: flex;
	flex-direction: column;
	max-width: 80%;
}
.cmsg.me { align-self: flex-end; align-items: flex-end; }
.cmsg.other { align-self: flex-start; align-items: flex-start; }
.cmsg.sys { align-self: center; align-items: center; max-width: 100%; }

.cmsg-meta {
	font-size: .68rem;
	color: var(--muted);
	margin-bottom: 2px;
	display: flex;
	gap: 5px;
	align-items: center;
}
.cmsg-role {
	font-size: .65rem;
	padding: 0 5px;
	border-radius: 8px;
	font-weight: 600;
}
.cmsg-role.pres { background: rgba(99,102,241,.25); color: #818cf8; }
.cmsg-role.view { background: rgba(34,197,94,.2); color: #4ade80; }

.cmsg-bubble {
	padding: 7px 11px;
	border-radius: 12px;
	font-size: .83rem;
	line-height: 1.45;
	word-break: break-word;
}
.cmsg.me .cmsg-bubble {
	background: var(--primary);
	color: #fff;
	border-bottom-right-radius: 4px;
}
.cmsg.other .cmsg-bubble {
	background: var(--bg3);
	color: var(--text);
	border: 1px solid var(--border);
	border-bottom-left-radius: 4px;
}
.cmsg.sys .cmsg-bubble {
	background: rgba(99,102,241,.08);
	color: var(--muted);
	font-size: .75rem;
	padding: 4px 12px;
	border-radius: 20px;
}
.cmsg-time { font-size: .65rem; color: var(--muted); margin-top: 2px; }

#chat-input-row {
	padding: 8px 10px;
	border-top: 1px solid var(--border);
	display: flex;
	gap: 6px;
	flex-shrink: 0;
	background: var(--bg2);
}
#chat-in {
	flex: 1;
	background: var(--bg3);
	border: 1px solid var(--border);
	border-radius: 8px;
	padding: 6px 10px;
	color: var(--text);
	font-size: .83rem;
	outline: none;
	resize: none;
	max-height: 80px;
	font-family: inherit;
	line-height: 1.4;
}
#chat-in:focus { border-color: var(--primary); }
#chat-in::placeholder { color: var(--muted); }
#chat-send {
	width: 36px;
	height: 36px;
	border-radius: 8px;
	border: none;
	background: var(--primary);
	color: #fff;
	cursor: pointer;
	font-size: 1rem;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	align-self: flex-end;
	transition: .15s;
}
#chat-send:hover { filter: brightness(1.15); }

/* 채팅 버튼 읽지않음 뱃지 */
.hbtn.chat-btn { position: relative; }
.chat-unread {
	position: absolute;
	top: -5px;
	right: -5px;
	background: #ef4444;
	color: #fff;
	border-radius: 10px;
	font-size: .65rem;
	font-weight: 700;
	padding: 1px 5px;
	min-width: 16px;
	text-align: center;
	display: none;
	line-height: 1.3;
}
.chat-unread.show { display: block; }	
	`)
	// ══════════════════════════════════════════
	// STATE
	// ══════════════════════════════════════════
	const S = {
		slides: [], page: 0,
		strokes: {},
		curPts: [],
		tool: 'pen', color: '#e74c3c', size: 4,
		drawing: false, presenter: true,
		room: '', ws: null, wsOk: false,
		laserTimer: null, rlaserTimer: null,
		whiteboard: false,
		nickname: '',
		participants: {},  // { nickname: { nickname, role, joinedAt } }
		VW: 1280, VH: 720,
	};

	const COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#000000', '#ffffff'];
	const byId = id => document.getElementById(id);

	// ══════════════════════════════════════════
	// SETUP MODAL
	// ══════════════════════════════════════════
	let _role = 'presenter';

	function setRole(r) {
		_role = r;
		byId('r-pres').classList.toggle('on', r === 'presenter');
		byId('r-view').classList.toggle('on', r === 'viewer');
	}
	function startMdViewer() {
		$('#app').addClass('show');
		$('#mbadge').addClass('mbadge pres')
		initCanvas();
		initColors();
		initDrag();
		resizeWrap();
		_initChat(S.room);
	}

	function startApp(offline) {
		S.room = byId('room-in').value.trim() || 'ROOM01';
		S.presenter = _role === 'presenter';
		S.nickname = byId('nick-in').value.trim() || (S.presenter ? '발표자' : '참가자') + Math.floor(Math.random() * 900 + 100);
		byId('modal').style.display = 'none';
		byId('app').classList.add('show');
		byId('mbadge').textContent = S.presenter ? '📢 발표자' : '👁 참가자';
		byId('mbadge').className = 'mbadge ' + (S.presenter ? 'pres' : 'view');
		byId('rlabel').textContent = S.room;
		initCanvas();
		initColors();
		initDrag();
		resizeWrap();
		_initChat(S.room);
		if (!offline) {
			connectWS(byId('srv-in').value.trim());
		} else {
			// 오프라인: 본인만 로컬 등록
			addParticipant(S.nickname, S.presenter ? 'presenter' : 'viewer');
		}
		if (!S.presenter) {
			byId('cvs').classList.add('nc');
			document.querySelectorAll('.tbtn,.abtn.red').forEach(b => b.disabled = true);
			document.querySelectorAll('.tbtn,.abtn.red').forEach(b => b.style.opacity = '0.4');
		}
	}

	// ══════════════════════════════════════════
	// WEBSOCKET
	// ══════════════════════════════════════════
	function connectWS(url) {
		if (!url) {
			const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
			url = `${proto}//${location.host}`;
		}
		try {
			S.ws = new WebSocket(url);
		} catch (e) { return; }

		S.ws.onopen = () => {
			S.wsOk = true;
			byId('wdot').classList.add('on');
			S.participants = {};  // 재접속 시 초기화
			// 방 입장 등록 (sys-join은 서버만 등록, 브로드캐스트 안 함)
			wsSend({ type: 'sys-join', room: S.room });
			// PPT 룸 참가 알림 (room 멤버들에게 브로드캐스트)
			wsSend({ type: 'ppt-join', nickname: S.nickname, role: S.presenter ? 'presenter' : 'viewer' });
		};
		S.ws.onclose = () => {
			S.wsOk = false;
			byId('wdot').classList.remove('on');
			setTimeout(() => connectWS(url), 3000);
		};
		S.ws.onmessage = e => {
			try {
				const d = JSON.parse(e.data);
				// PPT 룸 메시지만 처리 (onlineUsers 등 전역 메시지 무시)
				if (!d.room || d.room !== S.room) return;
				handleWS(d);
			} catch (_) { }
		};
		// 탭 닫을 때 퇴장 알림
		window.addEventListener('beforeunload', () => {
			wsSend({ type: 'ppt-leave', nickname: S.nickname });
		}, { once: true });
	}

	function wsSend(data) {
		if (S.ws && S.wsOk) {
			data.room = S.room;
			try { S.ws.send(JSON.stringify(data)); } catch (_) { }
		}
	}

	function handleWS(d) {
		if (d.type === 'ppt-page' && !S.presenter) {
			goPage(d.page, true);
		} else if (d.type === 'ppt-stroke') {
			if (!S.strokes[d.page]) S.strokes[d.page] = [];
			S.strokes[d.page].push(d.stroke);
			if (d.page === S.page) drawStroke(d.stroke);
		} else if (d.type === 'ppt-clear-page') {
			S.strokes[d.page] = [];
			if (d.page === S.page) clearCanvas();
		} else if (d.type === 'ppt-clear-all') {
			S.strokes = {};
			clearCanvas();
		} else if (d.type === 'ppt-laser') {
			showRemoteLaser(d.vx, d.vy);
		} else if (d.type === 'ppt-slides') {
			if (!S.presenter) { parseSlides(d.content); goPage(d.page, true); }
		} else if (d.type === 'ppt-join') {
			// 새 참가자 등록 + 내 존재를 알려줌
			addParticipant(d.nickname, d.role);
			// 본인 메시지가 아닐 때만 응답 (에코 방지)
			if (d.nickname !== S.nickname) {
				wsSend({ type: 'ppt-present', nickname: S.nickname, role: S.presenter ? 'presenter' : 'viewer' });
			}
		} else if (d.type === 'ppt-present') {
			// 기존 참가자 응답 수신
			addParticipant(d.nickname, d.role);
		} else if (d.type === 'ppt-leave') {
			removeParticipant(d.nickname);
		} else if (d.type === 'ppt-chat') {
			// 채팅 메시지 수신
			console.log('💬 채팅 수신:', d);
			const isMe = d.nickname === S.nickname;
			appendChatMsg({ nickname: d.nickname, role: d.role, text: d.text, time: d.time, isMe });
		}
	}

	// ══════════════════════════════════════════
	// CHAT
	// ══════════════════════════════════════════
	let _chatOpen = false;
	let _unreadCount = 0;

	function toggleChat() {
		_chatOpen = !_chatOpen;
		byId('chat-panel').classList.toggle('hidden', !_chatOpen);
		if (_chatOpen) {
			_unreadCount = 0;
			_updateUnread();
			const input = byId('chat-in');
			if (input) { setTimeout(() => input.focus(), 80); }
			// 스크롤 최하단
			const msgs = byId('chat-msgs');
			if (msgs) msgs.scrollTop = msgs.scrollHeight;
		}
	}

	function sendChat() {
		const input = byId('chat-in');
		const text = (input?.value || '').trim();
		if (!text) return;
		const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
		const role = S.presenter ? 'presenter' : 'viewer';
		wsSend({ type: 'ppt-chat', nickname: S.nickname, role, text, time });
		// appendChatMsg({ nickname: S.nickname, role, text, time, isMe: true });
		input.value = '';
		// textarea 높이 리셋
		input.style.height = 'auto';
	}

	function onChatKey(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendChat();
		}
		// textarea 자동 높이 조절
		const ta = e.target;
		ta.style.height = 'auto';
		ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
	}

	function appendChatMsg({ nickname, role, text, time, isMe, sys = false }) {
		const msgs = byId('chat-msgs');
		if (!msgs) return;

		const wrap = document.createElement('div');
		if (sys) {
			wrap.className = 'cmsg sys';
			wrap.innerHTML = `<div class="cmsg-bubble">${_esc(text)}</div>`;
		} else {
			wrap.className = `cmsg ${isMe ? 'me' : 'other'}`;
			const roleLabel = role === 'presenter' ? '발표자' : '참가자';
			const roleCls = role === 'presenter' ? 'pres' : 'view';
			const metaHtml = isMe ? '' : `<div class="cmsg-meta">
				<span class="cmsg-role ${roleCls}">${roleLabel}</span>
				<span>${_esc(nickname)}</span>
			</div>`;
			wrap.innerHTML = `${metaHtml}
				<div class="cmsg-bubble">${_esc(text).replace(/\n/g, '<br>')}</div>
				<div class="cmsg-time">${time || ''}</div>`;
		}
		msgs.appendChild(wrap);
		// 스크롤 최하단
		msgs.scrollTop = msgs.scrollHeight;

		// 채팅창이 닫혀있으면 읽지 않음 증가
		if (!_chatOpen && !isMe) {
			_unreadCount++;
			_updateUnread();
		}
	}

	function _updateUnread() {
		const badge = byId('chat-unread');
		if (!badge) return;
		badge.textContent = _unreadCount;
		badge.classList.toggle('show', _unreadCount > 0);
	}

	function _esc(str) {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	// startApp 이후 채팅 룸 라벨 설정은 startApp 시 별도로 처리
	// (startApp 함수 내에 삽입 대신 _afterChatInit 사용)
	function _initChat(room) {
		const lbl = byId('chat-room-label');
		if (lbl) lbl.textContent = room;
		// 입장 안내
		appendChatMsg({ text: `${S.nickname}님이 입장했습니다.`, sys: true });
	}


	// ══════════════════════════════════════════
	// MARKED SETUP
	// ══════════════════════════════════════════
	const renderer = new marked.Renderer();
	renderer.code = (code, lang) => {
		const l = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
		return `<pre><code class="hljs language-${l}">${hljs.highlight(code, { language: l }).value}</code></pre>`;
	};
	marked.use({ renderer, breaks: true, gfm: true });

	// ══════════════════════════════════════════
	// SLIDES
	// ══════════════════════════════════════════
	function loadFile(e) {
		const f = e.target.files[0];
		if (!f) return;
		const reader = new FileReader();
		reader.onload = ev => {
			const txt = ev.target.result;
			parseSlides(txt);
			goPage(0);
			// Share slides with viewers
			wsSend({ type: 'ppt-slides', content: txt, page: 0 });
		};
		reader.readAsText(f);
	}


	function parseSlides(text) {
		// Split by --- at line start
		const parts = text.split(/\n---+\n/);
		S.slides = parts.map(s => s.trim()).filter(s => s.length > 0);
		updateNav();
		byId('placeholder').style.display = 'none';
	}

	// ══════════════════════════════════════════
	// AUTO SPLIT (overflow detection)
	// ══════════════════════════════════════════

	/** 마크다운을 빈줄 기준으로 논리적 블록 배열로 분리 */
	function _splitBlocks(md) {
		const lines = md.split('\n');
		const blocks = [];
		let cur = [];
		let inFence = false;
		for (const line of lines) {
			if (/^```/.test(line)) inFence = !inFence;
			if (!inFence && line.trim() === '' && cur.length) {
				blocks.push(cur.join('\n'));
				cur = [];
			} else {
				cur.push(line);
			}
		}
		if (cur.length) blocks.push(cur.join('\n'));
		return blocks.filter(b => b.trim());
	}

	/** 하나의 슬라이드 콘텐츠를 오버플로우 기준으로 분할 */
	function _splitOneSlide(md) {
		const slideEl = byId('slide-content');
		if (!slideEl) return [md];
		const sc = getComputedStyle(slideEl);
		const maxH = slideEl.offsetHeight;
		if (maxH <= 0) return [md];

		// 측정용 히든 div 생성 (슬라이드와 동일한 비율 패딩)
		const meas = document.createElement('div');
		meas.style.cssText = [
			'position:fixed', 'left:-9999px', 'top:0',
			'visibility:hidden', 'pointer-events:none',
			`width:${slideEl.offsetWidth}px`,
			`padding:${sc.paddingTop} ${sc.paddingRight} ${sc.paddingBottom} ${sc.paddingLeft}`,
			`font-size:${sc.fontSize}`,
			`line-height:${sc.lineHeight}`,
			`font-family:${sc.fontFamily}`,
			'box-sizing:border-box',
			'overflow:visible',
		].join(';');
		document.body.appendChild(meas);

		const blocks = _splitBlocks(md);
		const result = [];
		let curBlocks = [];

		for (const block of blocks) {
			const test = [...curBlocks, block];
			meas.innerHTML = marked.parse(test.join('\n\n'));
			if (meas.scrollHeight > maxH && curBlocks.length > 0) {
				// 오버플로우 말생 → 이전까지 저장, 현 블록으로 새 슬라이드 시작
				result.push(curBlocks.join('\n\n'));
				curBlocks = [block];
			} else {
				curBlocks = test;
			}
		}
		if (curBlocks.length) result.push(curBlocks.join('\n\n'));

		document.body.removeChild(meas);
		return result.length ? result : [md];
	}

	/** 전체 슬라이드 오버플로우 자동 분할 */
	function autoSplit() {
		if (!S.slides || S.slides.length === 0) {
			alert('슬라이드가 없습니다. 먼저 파일을 불러오세요.'); return;
		}
		const btn = document.getElementById('auto-split-btn');
		const origText = btn ? btn.textContent : '';
		if (btn) { btn.disabled = true; btn.textContent = '⏳ 분석 중...'; }

		// requestAnimationFrame으로 화면 업데이트 후 측정
		requestAnimationFrame(() => {
			const before = S.slides.length;
			const newSlides = [];
			for (const slide of S.slides) {
				newSlides.push(..._splitOneSlide(slide));
			}
			const added = newSlides.length - before;
			S.slides = newSlides;
			if (added > 0) {
				wsSend({ type: 'ppt-slides', content: newSlides.join('\n\n---\n\n'), page: 0 });
				alert(`✅ 자동 분할 완료! ${before}점 → ${newSlides.length}점 (${added}개 추가)`);
			} else {
				alert('ℹ️ 모든 슬라이드가 적절한 크기입니다.');
			}
			goPage(0);
			if (btn) { btn.disabled = false; btn.textContent = origText; }
		});
	}

	function renderSlide(idx) {
		if (!S.slides.length) { byId('slide-content').innerHTML = ''; return; }
		const md = S.slides[idx] || '';
		byId('slide-content').innerHTML = marked.parse(md);
	}

	function goPage(idx, fromRemote = false) {
		if (S.slides.length === 0) return;
		idx = Math.max(0, Math.min(idx, S.slides.length - 1));
		S.page = idx;
		console.log('@@ goPage=>', S);
		renderSlide(idx);
		clearCanvas();
		redrawStrokes(idx);
		updateNav();
		if (!fromRemote && S.presenter) wsSend({ type: 'ppt-page', page: idx });
	}

	function updateNav() {
		const n = S.slides.length;
		byId('pinfo').textContent = n > 0 ? `${S.page + 1} / ${n}` : '0 / 0';
		byId('btn-prev').disabled = S.page <= 0;
		byId('btn-next').disabled = S.page >= n - 1;
	}

	// ══════════════════════════════════════════
	// CANVAS
	// ══════════════════════════════════════════
	const cvs = byId('cvs');
	const ctx = cvs.getContext('2d');

	function initCanvas() {
		cvs.addEventListener('pointerdown', onDown);
		cvs.addEventListener('pointermove', onMove);
		cvs.addEventListener('pointerup', onUp);
		cvs.addEventListener('pointerleave', onUp);
		window.addEventListener('resize', resizeWrap);
	}

	function resizeWrap() {
		const area = byId('slide-area');
		const aW = area.clientWidth - 28, aH = area.clientHeight - 28;
		let w = aW, h = aW / (16 / 9);
		if (h > aH) { h = aH; w = aH * (16 / 9); }
		const wrap = byId('wrap');
		wrap.style.width = w + 'px';
		wrap.style.height = h + 'px';
		// Scale font-size
		byId('slide-content').style.fontSize = (w / 1280) + 'rem';
		cvs.width = w;
		cvs.height = h;
		redrawStrokes(S.page);
	}

	// Virtual → Screen
	function v2s(vx, vy) {
		return { x: vx * cvs.width / S.VW, y: vy * cvs.height / S.VH };
	}
	// Screen → Virtual
	function s2v(x, y) {
		const r = cvs.getBoundingClientRect();
		return { vx: (x - r.left) * S.VW / r.width, vy: (y - r.top) * S.VH / r.height };
	}

	function clearCanvas() { ctx.clearRect(0, 0, cvs.width, cvs.height); }

	function redrawStrokes(pg) {
		clearCanvas();
		const ss = S.strokes[pg] || [];
		ss.forEach(drawStroke);
	}

	function drawStroke(st) {
		if (!st.pts || st.pts.length < 1) return;
		ctx.save();
		if (st.tool === 'er') {
			ctx.globalCompositeOperation = 'destination-out';
			ctx.strokeStyle = 'rgba(0,0,0,1)';
			ctx.lineWidth = v2s(st.size, 0).x * 5;
			ctx.globalAlpha = 1;
		} else if (st.tool === 'hl') {
			ctx.globalCompositeOperation = 'source-over';
			ctx.strokeStyle = st.color;
			ctx.lineWidth = v2s(st.size, 0).x;
			ctx.globalAlpha = 0.35;
		} else {
			ctx.globalCompositeOperation = 'source-over';
			ctx.strokeStyle = st.color;
			ctx.lineWidth = v2s(st.size, 0).x;
			ctx.globalAlpha = 1;
		}
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		if (st.tool === 'text') {
			const p0 = v2s(st.pts[0].vx, st.pts[0].vy);
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
			ctx.fillStyle = st.color;
			ctx.font = `${v2s(st.size * 5, 0).x}px 'Segoe UI', sans-serif`;
			ctx.fillText(st.text, p0.x, p0.y);
			ctx.restore();
			return;
		}

		ctx.beginPath();
		const p0 = v2s(st.pts[0].vx, st.pts[0].vy);
		ctx.moveTo(p0.x, p0.y);
		for (let i = 1; i < st.pts.length; i++) {
			const p = v2s(st.pts[i].vx, st.pts[i].vy);
			ctx.lineTo(p.x, p.y);
		}
		ctx.stroke();
		ctx.restore();
	}

	// ── Events ──
	function onDown(e) {
		if (!S.presenter) return;
		e.preventDefault();
		if (S.tool === 'laser') return; // laser handled in move
		if (S.tool === 'text') { placeText(e); return; }
		S.drawing = true;
		S.curPts = [];
		const { vx, vy } = s2v(e.clientX, e.clientY);
		S.curPts.push({ vx, vy });
		cvs.setPointerCapture(e.pointerId);
	}

	function onMove(e) {
		if (!S.presenter) return;
		// Laser
		if (S.tool === 'laser') {
			const { vx, vy } = s2v(e.clientX, e.clientY);
			showLaser(vx, vy);
			wsSend({ type: 'ppt-laser', vx, vy });
			return;
		}
		if (!S.drawing) return;
		const { vx, vy } = s2v(e.clientX, e.clientY);
		S.curPts.push({ vx, vy });
		// Live draw incremental
		if (S.curPts.length >= 2) {
			const st = { tool: S.tool, color: S.color, size: S.size, pts: S.curPts.slice(-2) };
			drawStroke(st);
		}
	}

	function onUp(e) {
		if (!S.drawing || !S.presenter) return;
		S.drawing = false;
		if (S.curPts.length < 1) return;
		const stroke = { tool: S.tool, color: S.color, size: S.size, pts: [...S.curPts] };
		if (!S.strokes[S.page]) S.strokes[S.page] = [];
		S.strokes[S.page].push(stroke);
		// Sync stroke
		wsSend({ type: 'ppt-stroke', page: S.page, stroke });
		// Redraw this page cleanly
		redrawStrokes(S.page);
		S.curPts = [];
	}

	// ── Text tool ──
	function placeText(e) {
		const r = cvs.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		const ti = byId('ti'), ta = byId('ta');
		ti.style.display = 'block';
		ti.style.left = x + 'px';
		ti.style.top = y + 'px';
		ta.style.fontSize = (S.size * 4) + 'px';
		ta.style.color = S.color;
		ta.value = '';
		ta.focus();

		const commit = () => {
			const txt = ta.value.trim();
			if (txt) {
				const { vx, vy } = s2v(e.clientX, e.clientY);
				const stroke = { tool: 'text', color: S.color, size: S.size, pts: [{ vx, vy }], text: txt };
				if (!S.strokes[S.page]) S.strokes[S.page] = [];
				S.strokes[S.page].push(stroke);
				drawStroke(stroke);
				wsSend({ type: 'ppt-stroke', page: S.page, stroke });
			}
			ti.style.display = 'none';
			ta.onblur = null;
			ta.onkeydown = null;
		};
		ta.onblur = commit;
		ta.onkeydown = ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(); } };
	}

	// ── Laser ──
	function showLaser(vx, vy) {
		const p = v2s(vx, vy);
		const ld = byId('ld');
		ld.style.display = 'block';
		ld.style.left = (p.x - 7) + 'px';
		ld.style.top = (p.y - 7) + 'px';
		clearTimeout(S.laserTimer);
		S.laserTimer = setTimeout(() => byId('ld').style.display = 'none', 200);
	}
	function showRemoteLaser(vx, vy) {
		const p = v2s(vx, vy);
		const rld = byId('rld');
		rld.style.display = 'block';
		rld.style.left = (p.x - 7) + 'px';
		rld.style.top = (p.y - 7) + 'px';
		clearTimeout(S.rlaserTimer);
		S.rlaserTimer = setTimeout(() => byId('rld').style.display = 'none', 500);
	}

	// ══════════════════════════════════════════
	// TOOLBAR
	// ══════════════════════════════════════════
	function setTool(t) {
		S.tool = t;
		['pen', 'hl', 'er', 'laser', 'text'].forEach(x => byId('t-' + x).classList.toggle('on', x === t));
		cvs.style.cursor = t === 'laser' ? 'none' : (t === 'er' ? 'cell' : 'crosshair');
	}

	function initColors() {
		const g = byId('col-g');
		COLORS.forEach(c => {
			const el = document.createElement('div');
			el.className = 'csw' + (c === S.color ? ' on' : '');
			el.style.background = c;
			el.style.border = c === '#ffffff' ? '2px solid #666' : '2px solid transparent';
			el.onclick = () => {
				S.color = c;
				document.querySelectorAll('.csw').forEach(e => e.classList.remove('on'));
				el.classList.add('on');
			};
			g.appendChild(el);
		});
		// Custom color
		const cc = document.createElement('div');
		cc.className = 'cc';
		cc.title = '직접 선택';
		cc.innerHTML = '<input type="color" value="#e74c3c">';
		cc.querySelector('input').oninput = e => { S.color = e.target.value; };
		g.appendChild(cc);
	}

	function setSize(v) {
		S.size = v;
		const s = Math.max(4, Math.min(v * 2.5, 28));
		byId('szpv').style.width = s + 'px';
		byId('szpv').style.height = s + 'px';
	}

	function clearPage() {
		if (!confirm('현재 페이지 필기를 지울까요?')) return;
		S.strokes[S.page] = [];
		clearCanvas();
		wsSend({ type: 'ppt-clear-page', page: S.page });
	}

	function clearAll() {
		if (!confirm('모든 페이지 필기를 지울까요?')) return;
		S.strokes = {};
		clearCanvas();
		wsSend({ type: 'ppt-clear-all' });
	}

	function toggleWhiteboard() {
		S.whiteboard = !S.whiteboard;
		byId('slide-content').style.display = S.whiteboard ? 'none' : '';
		byId('placeholder').style.display = S.whiteboard ? 'none' : (S.slides.length ? 'none' : '');
		byId('wb-btn').classList.toggle('on', S.whiteboard);
		byId('wb-btn').textContent = S.whiteboard ? '🖼 슬라이드' : '⬜ 칠판';
	}

	function copyRoom() {
		navigator.clipboard?.writeText(S.room).then(() => alert('방 코드 복사: ' + S.room));
	}

	// ══════════════════════════════════════════
	// USER LIST SIDEBAR
	// ══════════════════════════════════════════
	function addParticipant(nickname, role) {
		S.participants[nickname] = { nickname, role, joinedAt: Date.now() };
		renderUserList();
	}

	function removeParticipant(nickname) {
		delete S.participants[nickname];
		renderUserList();
	}

	function renderUserList() {
		const users = Object.values(S.participants);
		byId('user-cnt').textContent = users.length;

		// 발표자 먼저, 그 다음 참가 순서
		const sorted = [...users].sort((a, b) => {
			if (a.role === 'presenter' && b.role !== 'presenter') return -1;
			if (b.role === 'presenter' && a.role !== 'presenter') return 1;
			return a.joinedAt - b.joinedAt;
		});

		const list = byId('user-list');
		list.innerHTML = sorted.map(u => {
			const isMe = u.nickname === S.nickname;
			const isPres = u.role === 'presenter';
			const initials = u.nickname.charAt(0).toUpperCase();
			const roleIcon = isPres ? '📢' : '👁';
			const roleLabel = isPres ? '발표자' : '참가자';
			const meTag = isMe ? '<span style="font-size:.65rem;color:#818cf8;"> (나)</span>' : '';
			const bg = isPres ? '#7c3aed' : 'var(--primary)';

			return `<div class="uitem">
			<div class="uavatar" style="background:${bg};font-size:.85rem;">${initials}</div>
			<div class="uinfo">
				<div class="uname">${u.nickname}${meTag}</div>
				<div class="ustatus"><span class="udot"></span>${roleIcon} ${roleLabel}</div>
			</div>
			</div>`;
		}).join('');
	}

	function toggleSidebar() {
		const app = byId('app');
		const hidden = app.classList.toggle('sb-hidden');
		byId('sb-btn').classList.toggle('on', !hidden);
		// 슬라이드 재계산 (사이드바 너비 변경으로 슬라이드 영역 크기 변동)
		setTimeout(resizeWrap, 280);
	}

	// ══════════════════════════════════════════
	// DRAG & DROP md file
	// ══════════════════════════════════════════
	function initDrag() {
		const wrap = byId('wrap');
		let cnt = 0;
		wrap.addEventListener('dragenter', e => { e.preventDefault(); cnt++; wrap.classList.add('drop-over'); });
		wrap.addEventListener('dragleave', () => { cnt--; if (!cnt) wrap.classList.remove('drop-over'); });
		wrap.addEventListener('dragover', e => e.preventDefault());
		wrap.addEventListener('drop', e => {
			e.preventDefault(); cnt = 0; wrap.classList.remove('drop-over');
			const file = e.dataTransfer.files[0];
			if (file) {
				const r = new FileReader();
				r.onload = ev => { parseSlides(ev.target.result); goPage(0); wsSend({ type: 'ppt-slides', content: ev.target.result, page: 0 }); };
				r.readAsText(file);
			}
		});
	}

	// ══════════════════════════════════════════
	// KEYBOARD SHORTCUTS
	// ══════════════════════════════════════════
	document.addEventListener('keydown', e => {
		const tag = document.activeElement?.tagName;
		console.log('@@ keydown =>', tag, e.key);
		if (tag === 'INPUT') return;
		// 에디터 오픈 중: Escape로 닫기
		const editorCheck = byId('editor-modal').style.display;
		if (editorCheck === 'none' || editorCheck === '') {
			if (tag === 'TEXTAREA') return;
			if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goPage(S.page + 1); }
			else if (e.key === 'ArrowLeft') { e.preventDefault(); goPage(S.page - 1); }
			else if (e.key === 'Escape') setTool('pen');
			else if (e.key === 'p') setTool('pen');
			else if (e.key === 'h') setTool('hl');
			else if (e.key === 'e') setTool('er');
			else if (e.key === 'l') setTool('laser');
			else if (e.key === 't') setTool('text');
			else if (e.key === 'Delete') clearPage();
		}
	});

	// Init size preview
	setSize(4);

	// ══════════════════════════════════════════
	// MARKDOWN EDITOR
	// ══════════════════════════════════════════
	function openEditor() {
		const modal = byId('editor-modal');
		modal.style.display = 'flex';
		// 현재 슬라이드들을 '하나의 문서'로 열기
		const raw = S.slides.length ? S.slides.join('\n\n---\n\n') : '';
		byId('md-editor').value = raw;
		updateEditorPreview();
		updateSlideCounter();
		byId('md-editor').focus();
	}

	function closeEditor() {
		byId('editor-modal').style.display = 'none';
	}

	function applyEditor() {
		const text = byId('md-editor').value.trim();
		if (!text) return;
		parseSlides(text);
		goPage(0);
		wsSend({ type: 'ppt-slides', content: text, page: 0 });
		closeEditor();
	}

	function onEditorInput() {
		updateEditorPreview();
		updateSlideCounter();
	}

	function updateEditorPreview() {
		const text = byId('md-editor').value;
		// 슬라이드 구분선을 시각적으로 구분되게 렌더링
		const parts = text.split(/\n---+\n/);
		byId('md-preview').innerHTML = parts.map((part, i) => {
			const num = `<div class="ed-pg-num">슬라이드 ${i + 1}</div>`;
			const content = marked.parse(part.trim());
			return `<div class="ed-slide">${num}${content}</div>`;
		}).join('<div class="ed-divider">--- 다음 슬라이드 ---</div>');
	}

	function updateSlideCounter() {
		const text = byId('md-editor').value;
		const cnt = (text.match(/\n---+\n/g) || []).length + (text.trim() ? 1 : 0);
		byId('ed-slide-cnt').textContent = `슬라이드 ${cnt}장`;
	}

	function insertFmt(before, after = '') {
		const ta = byId('md-editor');
		const start = ta.selectionStart, end = ta.selectionEnd;
		const sel = ta.value.substring(start, end);
		const insertion = before + sel + after;
		ta.setRangeText(insertion, start, end, 'end');
		// 커서를 입력 공간 후에 위치
		if (!sel && after) {
			ta.selectionStart = ta.selectionEnd = start + before.length;
		}
		ta.focus();
		onEditorInput();
	}

	function onEditorKeyDown(e) {
		// Tab = 들여쓰기
		if (e.key === 'Tab') {
			e.preventDefault();
			if (e.shiftKey) {
				// Shift+Tab = 내어쓰기
				const ta = byId('md-editor');
				const start = ta.selectionStart;
				const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
				const lineText = ta.value.substring(lineStart);
				if (lineText.startsWith('  ')) {
					ta.setRangeText('', lineStart, lineStart + 2, 'end');
					ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - 2);
				}
			} else {
				insertFmt('  ');
			}
		}
		// Enter = 이전 줄 indent 유지 + 목록 자동 연속
		if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
			const ta = byId('md-editor');
			const pos = ta.selectionStart;
			const text = ta.value;
			// 현재 줄 시작 위치
			const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
			const currentLine = text.substring(lineStart, pos);
			// 앞쪽 공백(indent) 추출
			const indentMatch = currentLine.match(/^(\s+)/);
			const indent = indentMatch ? indentMatch[1] : '';
			// 목록 패턴 감지: "  - ", "  * ", "  1. " 등
			const listMatch = currentLine.match(/^(\s*)([-*]|\d+\.)\s/);
			if (listMatch) {
				e.preventDefault();
				const listIndent = listMatch[1];
				const marker = listMatch[2];
				// 현재 줄이 마커만 있고 내용이 없으면 → 목록 종료
				const afterMarker = currentLine.replace(/^\s*([-*]|\d+\.)\s*/, '');
				if (!afterMarker.trim()) {
					// 빈 목록 항목 → 목록 종료, indent만 남기기
					ta.setRangeText('', lineStart, pos, 'end');
					ta.selectionStart = ta.selectionEnd = lineStart;
					ta.setRangeText('\n', pos - currentLine.length, pos - currentLine.length + currentLine.length, 'end');
					// 단순히 줄만 지우고 새줄 추가
					const before = text.substring(0, lineStart);
					const after = text.substring(pos);
					ta.value = before + '\n' + after;
					ta.selectionStart = ta.selectionEnd = lineStart + 1;
				} else {
					// 숫자 목록이면 번호 증가
					let nextMarker;
					if (/^\d+$/.test(marker)) {
						nextMarker = (parseInt(marker) + 1) + '.';
					} else {
						nextMarker = marker;
					}
					const insert = '\n' + listIndent + nextMarker + ' ';
					ta.setRangeText(insert, pos, pos, 'end');
					ta.selectionStart = ta.selectionEnd = pos + insert.length;
				}
				onEditorInput();
				return;
			}
			// 일반 indent 유지
			if (indent) {
				e.preventDefault();
				const insert = '\n' + indent;
				ta.setRangeText(insert, pos, ta.selectionEnd, 'end');
				ta.selectionStart = ta.selectionEnd = pos + insert.length;
				onEditorInput();
			}
			// indent 없으면 브라우저 기본 동작
		}
		// Ctrl+Enter = 적용
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			applyEditor();
		}
	}

	function prevPage() { goPage(S.page - 1); }
	function nextPage() { goPage(S.page + 1); }

	// ══════════════════════════════════════════
	// EDITOR IMAGE UPLOAD
	// ══════════════════════════════════════════
	function uploadImageToEditor(file) {
		console.log('@@ uploadImageToEditor =>', file);
		if (!file || !file.type.startsWith('image/')) return;
		const ta = byId('md-editor');
		const placeholder = `![업로드 중...기다려 주세요]`;
		insertFmt(placeholder);
		const formData = new FormData();
		formData.append('file', file);
		fetch('/api/upload/file', { method: 'POST', body: formData })
			.then(r => r.json())
			.then(data => {
				if (data.url) {
					const alt = file.name.replace(/\.[^.]+$/, '') || 'image';
					const md = `![${alt}](${data.url})`;
					console.log('@@ md =>', md);
					// placeholder 대체
					ta.value = ta.value.replace(placeholder, md);
					onEditorInput();
				}
			})
			.catch(() => {
				ta.value = ta.value.replace(placeholder, '');
				alert('이미지 업로드 실패');
			});
	}

	function uploadImageFromInput(e) {
		uploadImageToEditor(e.target.files[0]);
		e.target.value = ''; // 동일 파일 재선택 허용
	}

	function openImagePicker() {
		byId('img-upload-input').click();
	}

	function onEditorPaste(e) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				uploadImageToEditor(item.getAsFile());
				return;
			}
		}
	}

	function onEditorDrop(e) {
		const files = e.dataTransfer?.files;
		if (!files?.length) return;
		if (files[0].type.startsWith('image/')) {
			e.preventDefault();
			uploadImageToEditor(files[0]);
		}
	}

	// ══════════════════════════════════════════
	// PDF EXPORT
	// ══════════════════════════════════════════
	async function exportPDF() {
		if (!S.slides || S.slides.length === 0) {
			alert('슬라이드가 없습니다. 먼저 마크다운 파일을 불러오세요.');
			return;
		}
		if (!window.jspdf || !window.html2canvas) {
			alert('PDF 라이브러리가 아직 로드되지 않았습니다. 잠시 후 다시 시도하세요.');
			return;
		}

		const btn = document.querySelector('[onclick="wb.exportPDF()"]');
		const origText = btn ? btn.textContent : '';
		const totalSlides = S.slides.length;
		const origPage = S.page;
		const wrap = byId('wrap');

		// PDF 설정 (슬라이드 크기를 기준으로)
		const rect = wrap.getBoundingClientRect();
		const isLandscape = rect.width >= rect.height;
		const { jsPDF } = window.jspdf;
		const pdf = new jsPDF({
			orientation: isLandscape ? 'landscape' : 'portrait',
			unit: 'px',
			format: [rect.width, rect.height],
			hotfixes: ['px_scaling']
		});

		try {
			for (let i = 1; i <= totalSlides; i++) {
				// 진행 상황 표시
				if (btn) btn.textContent = `⏳ ${i}/${totalSlides}`;

				// 해당 슬라이드로 이동
				goPage(i);
				// 렌더링 대기 (markdown → HTML 파싱 시간 포함)
				await new Promise(r => setTimeout(r, 120));

				// html2canvas로 슬라이드 캡처 (#wrap = 슬라이드 + 필기 canvas 합성)
				const captured = await html2canvas(wrap, {
					scale: 2,
					useCORS: true,
					allowTaint: true,
					logging: false,
					backgroundColor: '#ffffff'
				});

				const imgData = captured.toDataURL('image/jpeg', 0.92);

				if (i > 1) pdf.addPage([rect.width, rect.height], isLandscape ? 'landscape' : 'portrait');
				pdf.addImage(imgData, 'JPEG', 0, 0, rect.width, rect.height);
			}

			// 파일명: 날짜 포함
			const now = new Date();
			const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
			pdf.save(`presentation_${ts}.pdf`);

		} catch (err) {
			alert('PDF 생성 실패: ' + err.message);
		} finally {
			// 원래 페이지로 복귀
			goPage(origPage);
			if (btn) btn.textContent = origText;
		}
	}

	return { S, setRole, startMdViewer, startApp, loadFile, goPage, prevPage, nextPage, toggleWhiteboard, copyRoom, clearAll, toggleSidebar, setTool, setSize, clearPage, openEditor, closeEditor, applyEditor, onEditorInput, onEditorKeyDown, insertFmt, uploadImageFromInput, openImagePicker, onEditorPaste, onEditorDrop, exportPDF, autoSplit, toggleChat, sendChat, onChatKey }
})()
