/**
 * karaoke-streamer.js
 * 노래방 웹캠 스트리밍 (송출 측 / music_select.html 에서 사용)
 * MediaRecorder → WebSocket binary 전송 → 서버 중계 + 녹화
 */

const KaraokeStreamer = (() => {
	let ws = null;
	let mediaStream = null;
	let mediaRecorder = null;
	let sessionId = null;
	let currentSong = null;
	let isStreaming = false;
	let wsUrl = null;

	// ── UI 요소 참조 ──────────────────────────────────────────────
	function getEl(id) { return document.getElementById(id); }

	// ── WebSocket 연결 ────────────────────────────────────────────
	function connectWS() {
		return new Promise((resolve, reject) => {
			if (ws && ws.readyState === WebSocket.OPEN) { resolve(); return; }
			const proto = location.protocol === 'https:' ? 'wss' : 'ws';
			wsUrl = `${proto}://${location.host}`;
			ws = new WebSocket(wsUrl);
			ws.binaryType = 'arraybuffer';
			ws.onopen = () => {
				// karaoke-viewer 방에 합류 (스트리머는 자기 방에 등록 안 함 - binary 수신 방지)
				resolve();
			};
			ws.onerror = (e) => reject(e);
			ws.onmessage = (event) => {
				if (typeof event.data === 'string') {
					try {
						const msg = JSON.parse(event.data);
						if (msg.type === 'karaoke-start-ack') {
							sessionId = msg.sessionId;
							_log(`스트리밍 시작됨 | 세션: ${sessionId} | 파일: ${msg.filename}`);
							_updateUI(true);
						}
					} catch (e) { /* ignore */ }
				}
			};
			ws.onclose = () => {
				if (isStreaming) _stopStreaming();
				_log('WebSocket 연결 끊김');
			};
		});
	}

	// ── 웹캠 시작 ────────────────────────────────────────────────
	async function startStreaming(song) {
		if (isStreaming) {
			_log('이미 스트리밍 중입니다');
			return;
		}
		currentSong = song;

		try {
			// 웹캠 + 마이크 권한 요청
			mediaStream = await navigator.mediaDevices.getUserMedia({
				video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
				audio: true
			});

			// 미리보기 비디오에 연결
			const preview = getEl('karaoke-preview');
			if (preview) {
				preview.srcObject = mediaStream;
				preview.muted = true; // 에코 방지
				preview.play();
			}

			// WebSocket 연결
			await connectWS();

			// 지원 코덱 확인 (Chrome: vp8/vp9/h264, Firefox: vp8)
			const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
				.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

			_log(`사용 코덱: ${mimeType}`);

			mediaRecorder = new MediaRecorder(mediaStream, { mimeType, videoBitsPerSecond: 1_500_000 });

			mediaRecorder.ondataavailable = (e) => {
				if (e.data && e.data.size > 0 && ws?.readyState === WebSocket.OPEN) {
					// Binary blob → ArrayBuffer → 서버로 전송
					e.data.arrayBuffer().then(buf => ws.send(buf));
				}
			};

			mediaRecorder.onstart = () => {
				isStreaming = true;
				// 서버에 세션 시작 알림 (JSON)
				ws.send(JSON.stringify({ type: 'karaoke-start', song: currentSong }));
				_log(`녹화 시작 | 곡: ${song?.title || '알 수 없음'}`);
			};

			mediaRecorder.onerror = (e) => _log(`MediaRecorder 오류: ${e.error}`);

			// 500ms 마다 청크 생성
			mediaRecorder.start(500);

		} catch (err) {
			_log(`스트리밍 시작 실패: ${err.message}`);
			_stopMediaStream();
		}
	}

	// ── 스트리밍 중지 ────────────────────────────────────────────
	function stopStreaming() {
		if (!isStreaming) return;
		_stopStreaming();
	}

	function _stopStreaming() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}
		// 서버에 종료 알림
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'karaoke-stop' }));
		}
		_stopMediaStream();
		isStreaming = false;
		sessionId = null;
		_updateUI(false);
		_log('스트리밍 종료');
	}

	function _stopMediaStream() {
		if (mediaStream) {
			mediaStream.getTracks().forEach(t => t.stop());
			mediaStream = null;
		}
		const preview = getEl('karaoke-preview');
		if (preview) preview.srcObject = null;
	}

	// ── UI 업데이트 ──────────────────────────────────────────────
	function _updateUI(streaming) {
		const startBtn = getEl('karaoke-stream-start-btn');
		const stopBtn = getEl('karaoke-stream-stop-btn');
		const statusDot = getEl('karaoke-status-dot');
		const statusText = getEl('karaoke-status-text');

		if (startBtn) startBtn.disabled = streaming;
		if (stopBtn) stopBtn.disabled = !streaming;
		if (statusDot) statusDot.className = `status-dot ${streaming ? 'live' : 'offline'}`;
		if (statusText) statusText.textContent = streaming ? '🔴 LIVE 스트리밍 중' : '⚫ 대기 중';
	}

	function _log(msg) {
		console.log(`[KaraokeStreamer] ${msg}`);
		const logEl = getEl('karaoke-log');
		if (logEl) {
			const line = document.createElement('div');
			line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
			logEl.prepend(line);
			// 최대 20줄 유지
			while (logEl.children.length > 20) logEl.lastChild.remove();
		}
	}

	// ── Public API ───────────────────────────────────────────────
	return { startStreaming, stopStreaming, isStreaming: () => isStreaming };
})();

window.KaraokeStreamer = KaraokeStreamer;
