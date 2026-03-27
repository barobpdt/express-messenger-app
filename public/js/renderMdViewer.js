class RenderMdViewer {
	constructor(targetEl, maxHeight, websocket) {
		this.targetEl = getJq(targetEl)
		this.maxHeight = maxHeight
		this.ws = websocket
		this.container = null
		this.content = null
		this.canvas = null
		this.ctx = null
		this.textarea = null
		this.ldot = null
		this.rdot = null
		this.tool = ''
		this.presenter = true
		this.slides = []
		this.strokes = {}
		this.page = 0
		this.room = null
		this.laserTimer = null
		this.remoteLaserTimer = null
		this.drawing = false
		this.curPts = []
		this.penSize = 0
		this.color = '#e74c3c'
		this.COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#000000', '#ffffff']
		this.VW = 1280
		this.VH = 720
		this.init()
	}
	init() {
		loadScriptAll(['/js/marked.min.js', '/js/highlight.min.js', '/js/html2canvas.min.js', '/js/jspdf.js'], () => {
			this.render()
		})
	}
	render() {
		this.container = $(`
			<div class="md-viewer">
				<div class="tool-bar">
					<div class="page-info">
						<button class="btn-page prev" disabled>◀</button>
						<span class="pinfo">0 / 0</span>
						<button class="btn-page next" disabled>▶</button>
					</div>
					<div class="sep"></div>
					<div class="tool-group">
						<button class="btn-tool on" data-tool="pen" title="펜">✏️</button>
						<button class="btn-tool" data-tool="hl" title="형광펜">🧷</button>
						<button class="btn-tool" data-tool="er" title="지우개">🧽</button>
						<button class="btn-tool" data-tool="laser" title="레이저">🔴</button>
						<button class="btn-tool" data-tool="text" title="텍스트">📝</button>
					</div>
					<div class="sep"></div>
					<div class="color-group"></div>
					<div class="sep"></div>
					<div class="sz-group">
						<label>크기</label>
						<input class="input-pensize" type="range" id="sz" min="1" max="30" value="4">
						<div class="szpv"><span id="szpv" style="width:8px;height:8px;"></span></div>
					</div>
					<div class="sep"></div>
					<div class="status" style="flex:1;text-align:left;"></div>
					<div class="act-group">
						<button class="btn clearAll">전체 지우기</button>
						<button class="btn downloadPdf">다운로드</button>
					</div>
				</div>
				<div class="slide-content"></div>
				<canvas class="cvs"></canvas>
				<div class="ldot ld"></div>
				<div class="ldot rd"></div>
				<div class="ti">
					<textarea class="md-editor" spellcheck="false" ></textarea>
				</div>    
			</div>
		`).appendTo(this.targetEl)
		this.content = this.container.find('.slide-content')
		this.canvas = this.container.find('.cvs')[0]
		this.ctx = this.canvas.getContext('2d')
		this.textarea = this.container.find('.md-editor')
		this.ldot = this.container.find('.ld')
		this.rdot = this.container.find('.rd')
		this.toolbar = this.container.find('.tool-bar')
		this.toolbar.find('.btn-page').on('click', (e) => {
			const btn = $(e.currentTarget)
			if (btn.hasClass('prev')) {
				this.prevPage()
			} else {
				this.nextPage()
			}
		})
		this.toolbar.find('.btn-tool').on('click', (e) => {
			const btn = $(e.currentTarget)
			this.toolbar.find('.btn-tool').removeClass('on')
			btn.addClass('on')
			this.tool = btn.data('tool')
		})
		this.toolbar.find('.input-pensize').on('change', (e) => {
			const val = $(e.currentTarget).val()
			this.setSize(val)
		})
		this.toolbar.find('.btn.clearAll').on('click', (e) => {
			this.clearAll()
		})
		this.toolbar.find('.btn.downloadPdf').on('click', (e) => {
			this.exportPDF()
		})
		this.container.find('.ldot').hide()
		this.initColor()
		let w = this.targetEl.width()
		let h = ((w * 9) / 16) + this.toolbar.height()
		if (h > this.maxHeight) {
			h = this.maxHeight
			w = (h - this.toolbar.height()) * 16 / 9
		}
		this.targetEl.css({
			height: h,
			minHeight: h,
			overflow: 'hidden'
		})
		this.canvas.on('pointerdown', this.onDown.bind(this))
		this.canvas.on('pointermove', this.onMove.bind(this))
		this.canvas.on('pointerup', this.onUp.bind(this))
		this.canvas.on('pointerleave', this.onUp.bind(this))
		$(window).on('resize', this.resizeWrap.bind(this))
		this.resizeWrap()
	}
	initColor() {
		const colorGroup = this.toolbar.find('.color-group')
		this.COLORS.forEach(c => {
			const el = document.createElement('div');
			el.className = 'csw' + (c === this.color ? ' on' : '');
			el.style.background = c;
			el.style.border = c === '#ffffff' ? '2px solid #666' : '2px solid transparent';
			el.onclick = () => {
				this.color = c;
				colorGroup.find('.csw').removeClass('on');
				el.classList.add('on');
			};
			colorGroup.append(el);
		});
		// Custom color
		const cc = document.createElement('div');
		cc.className = 'cc';
		cc.title = '직접 선택';
		cc.innerHTML = '<input type="color" value="#e74c3c">';
		cc.querySelector('input').oninput = e => { this.color = e.target.value; };
		colorGroup.append(cc);
	}
	setSize(v) {
		this.penSize = v;
		const s = Math.max(4, Math.min(v * 2.5, 28));
		this.toolbar.find('#szpv').css('width', s + 'px');
		this.toolbar.find('#szpv').css('height', s + 'px');
	}
	joinRoom(room, nickname) {
		this.room = room
		this.nickname = nickname
		// 방 입장 등록 (sys-join은 서버만 등록, 브로드캐스트 안 함)
		this.wsSend({ type: 'sys-join', room });
		// PPT 룸 참가 알림 (room 멤버들에게 브로드캐스트)
		this.wsSend({ type: 'ppt-join', nickname: nickname, role: this.presenter ? 'presenter' : 'viewer' });
	}

	goPage(page) {
		this.page = page
		this.content.html(marked.parse(this.slides[this.page]));
	}
	setStatus(msg) {
		console.log('>> setStatus', msg)
	}
	loadFile(file) {
		const reader = new FileReader()
		reader.onload = ev => {
			const txt = ev.target.result
			this.parseSlides(txt)
		}
		reader.readAsText(file)
	}
	loadText(text) {
		this.parseSlides(text)
		this.wsSend({ type: 'ppt-slides', content: text, page: 0 })
	}
	parseSlides(text) {
		this.textarea.val(text)
		this.slides = this.splitOneSlide(text)
		this.goPage(0)
	}
	resizeWrap() {
		const area = this.container
		const th = this.toolbar.height()
		const aW = area.width() - 28, aH = area.height() - 28 - th
		let w = aW, h = aW / (16 / 9);
		if (h > aH) { h = aH; w = aH * (16 / 9); }
		const wrap = this.content
		wrap.css({ width: w, height: h, top: th })
		// Scale font-size
		this.content.css('font-size', (w / this.VW) + 'rem');
		this.canvas.width = w;
		this.canvas.height = h;
	}
	// Virtual → Screen
	v2s(vx, vy) {
		return { x: vx * this.canvas.width / this.VW, y: vy * this.canvas.height / this.VH };
	}
	// Screen → Virtual
	s2v(x, y) {
		const r = this.canvas.getBoundingClientRect();
		return { vx: (x - r.left) * this.VW / r.width, vy: (y - r.top) * this.VH / r.height };
	}
	wsSend(data) {
		if (this.room && this.ws) {
			data.room = this.room
			this.ws.send(JSON.stringify({ type, data }))
		}
	}
	onDown(e) {
		if (!this.presenter) return;
		e.preventDefault();
		if (this.tool === 'laser') return; // laser handled in move
		if (this.tool === 'text') { placeText(e); return; }
		this.drawing = true;
		this.curPts = [];
		const { vx, vy } = this.s2v(e.clientX, e.clientY);
		this.curPts.push({ vx, vy });
		this.canvas.setPointerCapture(e.pointerId);
	}
	onUp(e) {
		if (!this.drawing || !this.presenter) return;
		this.drawing = false;
		if (this.curPts.length < 1) return;
		const stroke = { tool: this.tool, color: this.color, size: this.penSize, pts: [...this.curPts] };
		if (!this.strokes[this.page]) this.strokes[this.page] = [];
		this.strokes[this.page].push(stroke);
		// Sync stroke
		this.wsSend({ type: 'ppt-stroke', page: this.page, stroke });
		// Redraw this page cleanly
		this.redrawStrokes(this.page);
		this.curPts = [];
	}
	redrawStrokes(page) {
		this.clearCanvas();
		const strokes = this.strokes[page] || [];
		strokes.forEach(this.drawStroke.bind(this));
	}
	onMove(e) {
		if (!this.presenter) return;
		// Laser
		if (this.tool === 'laser') {
			const { vx, vy } = this.s2v(e.clientX, e.clientY);
			this.showLaser(vx, vy);
			this.wsSend({ type: 'ppt-laser', vx, vy });
			return;
		}
		if (!this.drawing) return;
		const { vx, vy } = this.s2v(e.clientX, e.clientY);
		this.curPts.push({ vx, vy });
		// Live draw incremental
		if (this.curPts.length >= 2) {
			const st = { tool: this.tool, color: this.color, size: this.penSize, pts: this.curPts.slice(-2) };
			this.drawStroke(st);
		}
	}
	drawStroke(st) {
		if (!st.pts || st.pts.length < 1) return;
		this.ctx.save();
		if (st.tool === 'er') {
			this.ctx.globalCompositeOperation = 'destination-out';
			this.ctx.strokeStyle = 'rgba(0,0,0,1)';
			this.ctx.lineWidth = this.v2s(st.size, 0).x * 5;
			this.ctx.globalAlpha = 1;
		} else if (st.tool === 'hl') {
			this.ctx.globalCompositeOperation = 'source-over';
			this.ctx.strokeStyle = st.color;
			this.ctx.lineWidth = this.v2s(st.size, 0).x;
			this.ctx.globalAlpha = 0.35;
		} else {
			this.ctx.globalCompositeOperation = 'source-over';
			this.ctx.strokeStyle = st.color;
			this.ctx.lineWidth = this.v2s(st.size, 0).x;
			this.ctx.globalAlpha = 1;
		}
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';

		if (st.tool === 'text') {
			const p0 = this.v2s(st.pts[0].vx, st.pts[0].vy);
			this.ctx.globalAlpha = 1;
			this.ctx.globalCompositeOperation = 'source-over';
			this.ctx.fillStyle = st.color;
			this.ctx.font = `${this.v2s(st.size * 5, 0).x}px 'Segoe UI', sans-serif`;
			this.ctx.fillText(st.text, p0.x, p0.y);
			this.ctx.restore();
			return;
		}

		this.ctx.beginPath();
		const p0 = this.v2s(st.pts[0].vx, st.pts[0].vy);
		this.ctx.moveTo(p0.x, p0.y);
		for (let i = 1; i < st.pts.length; i++) {
			const p = this.v2s(st.pts[i].vx, st.pts[i].vy);
			this.ctx.lineTo(p.x, p.y);
		}
		this.ctx.stroke();
		this.ctx.restore();
	}
	showLaser(vx, vy) {
		const p = this.v2s(vx, vy)
		this.ldot.css('display', 'block');
		this.ldot.css('left', (p.x - 7) + 'px');
		this.ldot.css('top', (p.y - 7) + 'px');
		clearTimeout(this.laserTimer);
		this.laserTimer = setTimeout(() => this.ldot.css('display', 'none'), 200);
	}
	showRemoteLaser(vx, vy) {
		const p = this.v2s(vx, vy);
		this.rdot.css('display', 'block');
		this.rdot.css('left', (p.x - 7) + 'px');
		this.rdot.css('top', (p.y - 7) + 'px');
		clearTimeout(this.remoteLaserTimer);
		this.remoteLaserTimer = setTimeout(() => this.rdot.css('display', 'none'), 500);
	}
	clearCanvas() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
		this.wsSend({ type: 'ppt-clear-all' })
	}

	splitBlocks(md) {
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
	splitOneSlide(md) {
		const sc = getComputedStyle(this.content);
		const maxH = this.content.height();
		if (maxH <= 0) return [md];

		// 측정용 히든 div 생성 (슬라이드와 동일한 비율 패딩)
		const meas = document.createElement('div');
		meas.style.cssText = [
			'position:fixed', 'left:-9999px', 'top:0',
			'visibility:hidden', 'pointer-events:none',
			`width:${this.content.width()}px`,
			`padding:${sc.paddingTop} ${sc.paddingRight} ${sc.paddingBottom} ${sc.paddingLeft}`,
			`font-size:${sc.fontSize}`,
			`line-height:${sc.lineHeight}`,
			`font-family:${sc.fontFamily}`,
			'box-sizing:border-box',
			'overflow:visible',
		].join(';');
		document.body.appendChild(meas);

		const blocks = this.splitBlocks(md);
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

	async exportPDF() {
		if (!this.slides || this.slides.length === 0) {
			alert('슬라이드가 없습니다. 먼저 마크다운 파일을 불러오세요.');
			return;
		}
		if (!window.jspdf || !window.html2canvas) {
			alert('PDF 라이브러리가 아직 로드되지 않았습니다. 잠시 후 다시 시도하세요.');
			return;
		}

		const btn = document.querySelector('[onclick="wb.exportPDF()"]');
		const origText = btn ? btn.textContent : '';
		const totalSlides = this.slides.length;
		const origPage = this.page;
		const wrap = this.container;

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
				this.goPage(i);
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
	handleWebsocket(d) {
		if (d.room != this.room) return
		if (d.type === 'ppt-page' && !this.presenter) {
			this.goPage(d.page, true);
		} else if (d.type === 'ppt-stroke') {
			if (!this.strokes[d.page]) this.strokes[d.page] = [];
			this.strokes[d.page].push(d.stroke);
			if (d.page === this.page) this.drawStroke(d.stroke);
		} else if (d.type === 'ppt-clear-page') {
			this.strokes[d.page] = [];
			if (d.page === this.page) this.clearCanvas();
		} else if (d.type === 'ppt-clear-all') {
			this.strokes = {};
			this.clearCanvas();
		} else if (d.type === 'ppt-laser') {
			this.showRemoteLaser(d.vx, d.vy);
		} else if (d.type === 'ppt-slides') {
			if (!this.presenter) {
				this.parseSlides(d.content);
				this.goPage(d.page, true);
			}
		} else if (d.type === 'ppt-join') {
			// 새 참가자 등록 + 내 존재를 알려줌

		} else if (d.type === 'ppt-present') {
			// 기존 참가자 응답 수신			
		} else if (d.type === 'ppt-lave') {
		} else if (d.type === 'ppt-chat') {
			// 채팅 메시지 수신
			console.log('💬 채팅 수신:', d);
			const isMe = d.nickname === S.nickname;
			appendChatMsg({ nickname: d.nickname, role: d.role, text: d.text, time: d.time, isMe });
		}
	}
}

loadStyle(`
	.md-viewer {
		position: relative;
		width: 100%;
		height: 100%;
	}
	.md-viewer .tool-bar {
		display:flex;
		flex-direction:row;
		flex-wrap:wrap;
		align-items:center;
		background-color:var(--bg1);
		padding: 8px;
	}
	.md-viewer .status {
		padding: 8px;
	}
	.md-viewer .sep {
		width: 1px;
		height: 30px;
		background: var(--border);
		flex-shrink: 0;
		margin: 0 8px;
	}
	.md-viewer .tool-group {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.md-viewer .act-group {
		display: flex;
		align-items: center;
	}
	.md-viewer .page-info {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.md-viewer .btn-page {
		width: 34px;
		height: 34px;
		border-radius: 7px;
		border: 1px solid var(--border);
		background: var(--bg3);
		color: var(--text);
		cursor: pointer;
		font-size: .95rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: .15s;
	}
	.md-viewer .btn-page:hover {
		background: var(--border);
	}
	.md-viewer .btn-page:disabled {
		opacity: .3;
		cursor: default;
	}
	.md-viewer .pinfo {
		font-size: .82rem;
		color: var(--muted);
		white-space: nowrap;
		min-width: 60px;
		text-align: center;
	}
	.md-viewer .btn-tool {
		width: 36px;
		height: 36px;
		border-radius: 7px;
		border: 1px solid var(--border);
		background: var(--bg3);
		color: var(--muted);
		cursor: pointer;
		font-size: .95rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: .15s;
		position: relative;
	}
	.md-viewer .btn-tool.on {
		background: var(--primary);
		border-color: var(--primary);
		color: #fff;
	}
	.tool-bar .btn {
		padding: 5px 10px;
		border-radius: 7px;
		border: 1px solid var(--border);
		background: var(--bg3);
		color: var(--text);
		cursor: pointer;
		font-size: .8rem;
		white-space: nowrap;
		transition: .15s;
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.tool-bar .btn:hover {
		background: var(--border);
	}
	.tool-bar .btn.red:hover {
		background: rgba(218, 54, 51, .2);
		border-color: #da3633;
		color: #f87171;
	}	
	.slide-content {
		position: absolute;
		inset: 0;
		padding: 6% 8%;
		font-size: 1rem;
		line-height: 1.65;
		color: #1a1a2e;
		overflow: hidden;
		pointer-events: none;
	}

	.slide-content h1 {
		font-size: 2.35em;
		margin-bottom: .4em;
		color: #1e293b;
		font-weight: 800;
		line-height: 1.2;
	}

	.slide-content h2 {
		font-size: 1.65em;
		margin-bottom: .35em;
		color: #334155;
		font-weight: 700;
	}

	.slide-content h3 {
		font-size: 1.25em;
		margin-bottom: .3em;
		color: #475569;
	}

	.slide-content p {
		margin-bottom: .65em;
		font-size: 1.05em;
	}

	.slide-content ul,
	.slide-content ol {
		margin: 0 0 .65em 1.6em;
	}

	.slide-content li {
		margin-bottom: .25em;
		font-size: 1.05em;
	}

	.slide-content ul li::marker {
		color: #6366f1;
	}

	.slide-content strong {
		color: #1e293b;
	}

	.slide-content em {
		color: #4f46e5;
	}

	.slide-content code {
		background: #f1f5f9;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		padding: .15em .4em;
		font-size: .88em;
		font-family: Consolas, monospace;
		color: #e74c3c;
	}

	.slide-content pre {
		background: #1e1e2e;
		border-radius: 8px;
		padding: .9em;
		margin: .65em 0;
		overflow-x: auto;
	}

	.slide-content pre code {
		background: none;
		border: none;
		color: #cdd6f4;
		font-size: .83em;
		padding: 0;
	}

	.slide-content blockquote {
		border-left: 4px solid #6366f1;
		padding: .45em 1em;
		margin: .65em 0;
		background: #f3f4ff;
		border-radius: 0 8px 8px 0;
		color: #4b5563;
	}

	.slide-content table {
		width: 100%;
		border-collapse: collapse;
		margin: .65em 0;
		font-size: .93em;
	}

	.slide-content th {
		background: #6366f1;
		color: #fff;
		padding: 7px 11px;
		text-align: left;
	}

	.slide-content td {
		border: 1px solid #e2e8f0;
		padding: 7px 11px;
	}

	.slide-content tr:nth-child(even) td {
		background: #f8fafc;
	}

	.slide-content img {
		max-width: 100%;
		max-height: 45%;
		border-radius: 8px;
		object-fit: contain;
	}

	.slide-content hr {
		border: none;
		border-top: 2px solid #e2e8f0;
		margin: 1em 0;
	}
	.md-viewer .ldot {
		position: absolute;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #6366f1;
		z-index: 10;
		pointer-events: none;
	}
	.md-viewer .ld {
		width: 14px;
		height: 14px;
		background: radial-gradient(circle, #ff3333, #ff000088);
		box-shadow: 0 0 10px #f00, 0 0 20px #f00;
	}
	.md-viewer .rld {
		width: 14px;
		height: 14px;
		background: radial-gradient(circle, #ff9900, #ff990088);
		box-shadow: 0 0 10px #f90;
	}
	.md-viewer .cvs {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 2;
		touch-action: none;
	}

	.md-viewer .cvs.nc {
		cursor: default;
		pointer-events: none;
	}
	.md-viewer .ti {
		position: absolute;
		z-index: 5;
		display: none;
	} 
`)

