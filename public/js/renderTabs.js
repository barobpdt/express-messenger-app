class RenderTabs {
	constructor(parentEl) {
		this.parentEl = getEl(parentEl)
		this.tabIdCounter = 0;
		this.tabs = [];
		this.activeTabId = null;
		this.dragSrcId = null;
		this.COLORS = [
			{ grad: 'linear-gradient(135deg,#6c63ff,#e040fb)', bg: '#f8f5ff' },
			{ grad: 'linear-gradient(135deg,#00b09b,#96c93d)', bg: '#f0fff7' },
			{ grad: 'linear-gradient(135deg,#f7971e,#ffd200)', bg: '#fffbf0' },
			{ grad: 'linear-gradient(135deg,#ee0979,#ff6a00)', bg: '#fff0f5' },
			{ grad: 'linear-gradient(135deg,#0575e6,#00f260)', bg: '#f0fbff' },
			{ grad: 'linear-gradient(135deg,#c94b4b,#4b134f)', bg: '#fff5f5' },
			{ grad: 'linear-gradient(135deg,#2193b0,#6dd5ed)', bg: '#f0faff' },
		];
	}
	render() {
		this.tabWrap = $(`
			<div class="tabbar-wrapper">
				<div class="tab-list-wrap">
					<div class="tab-list"></div>
				</div>
				<button class="tabbar-action-btn" title="탭 목록 보기">▼
					<div class="tab-dropdown">
						<div class="tab-dropdown-header">열린 탭</div>
						<div class="tab-dropdown-list"></div>
					</div>
				</button>
			</div>			
		`).appendTo(this.parentEl)
		this.contentArea = $("<div class='content-area'></div>").appendTo(this.parentEl)
		this.tabList = this.tabWrap.find('.tab-list')
		this.tabDropdownList = this.tabWrap.find('.tab-dropdown-list')
		this.tabbarActionBtn = this.tabWrap.find('.tabbar-action-btn')
		this.tabDropdown = this.tabWrap.find('.tab-dropdown')
		this.tabbarActionBtn.data('mode', 'list')
		this.tabbarActionBtn.click(e => {
			this.renderDropdown()
			this.tabDropdown.addClass('open')
		})
		$(document).click(e => {
			if (!$(e.target).closest('.tabbar-action-btn').length) this.tabDropdown.removeClass('open')
		})
	}
	createTab(id, title, icon, url) {
		const prev = this.tabs.find(tab => tab.id == id)
		if (prev) {
			prev.title = title;
			prev.icon = icon;
			prev.url = url;
			return prev;
		}
		const tab = { id, title, icon, url, emoji: '', color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)] }
		this.tabs.push(tab);
		this.renderTabs();
		this.setActiveTab(id);
		this.tabIdCounter++;
		return tab;
	}
	buildContent(id) {
		const t = this.tabs.find(t => t.id === id);
		if (!t) return;
		const div = document.createElement('div');
		div.className = 'tab-content';
		div.id = `content-${id}`;
		div.style.background = t.color.bg;
		div.innerHTML = `<iframe src="${t.url}" style="width:100%;height:100%;border:none;"></iframe>`;
		this.contentArea.append(div);
		return div;
	}
	renderTabs() {
		this.tabList.html('');
		this.tabs.forEach(t => {
			const tab = document.createElement('div');
			tab.className = 'tab' + (t.id === this.activeTabId ? ' active' : '');
			tab.id = `tab-${t.id}`;
			tab.draggable = true;
			tab.dataset.id = t.id;

			tab.innerHTML = `
			${t.emoji ?
					`<span class="tab-favicon" style="background:${t.color.grad};border-radius:4px;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;">
				${t.emoji}
			</span>`:
					`<span class="tab-favicon" style="background:${t.color.grad};border-radius:4px;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;">
				${t.icon}
			</span>`}
			<span class="tab-title">${t.title}</span>
			<button class="tab-close" data-id="${t.id}" title="탭 닫기">✕</button>`;

			// 클릭으로 활성화
			tab.addEventListener('click', (e) => {
				if (e.target.classList.contains('tab-close')) return;
				this.setActiveTab(t.id);
			});

			// 닫기 버튼
			tab.querySelector('.tab-close').addEventListener('click', (e) => {
				e.stopPropagation();
				this.closeTab(t.id);
			});

			// ── 드래그 이벤트 ──
			tab.addEventListener('dragstart', (e) => {
				this.dragSrcId = t.id;
				tab.classList.add('dragging');
				e.dataTransfer.effectAllowed = 'move';
			});
			tab.addEventListener('dragend', () => {
				tab.classList.remove('dragging');
				this.dragSrcId = null;
				this.tabList.each(function () {
					$(this).removeClass('drag-over');
				})
			});
			tab.addEventListener('dragover', (e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = 'move';
				this.tabList.each(function () {
					$(this).removeClass('drag-over');
				})
				if (t.id !== this.dragSrcId) tab.classList.add('drag-over');
			});
			tab.addEventListener('drop', (e) => {
				e.preventDefault();
				if (this.dragSrcId === null || this.dragSrcId === t.id) return;
				const srcIdx = this.tabs.findIndex(x => x.id === this.dragSrcId);
				const dstIdx = this.tabs.findIndex(x => x.id === t.id);
				if (srcIdx === -1 || dstIdx === -1) return;
				const [moved] = this.tabs.splice(srcIdx, 1);
				this.tabs.splice(dstIdx, 0, moved);
				this.dragSrcId = null;
				this.renderTabs();
			});

			this.tabList.append(tab);
		});

		this.checkOverflow();
	}
	renderDropdown() {
		this.tabDropdownList.html('');
		this.tabs.forEach(t => {
			const item = document.createElement('div');
			item.className = 'tab-dropdown-item' + (t.id === this.activeTabId ? ' active' : '');
			item.innerHTML = `
			<span class="di-emoji">${t.emoji}</span>
			<span class="di-title">${t.title}</span>
			<button class="di-close" data-id="${t.id}" title="닫기">✕</button>`;
			item.addEventListener('click', (e) => {
				if (e.target.classList.contains('di-close')) return;
				this.setActiveTab(t.id);
				this.tabDropdown.removeClass('open');
			});
			item.querySelector('.di-close').addEventListener('click', (e) => {
				e.stopPropagation();
				this.closeTab(t.id);
			});
			this.tabDropdownList.append(item);
		});
	}
	setActiveTab(id) {
		this.activeTabId = id;
		this.tabList.find('.tab').removeClass('active');
		this.tabList.find(`#tab-${this.activeTabId}`).addClass('active');
		let contentEl = this.contentArea.find(`#content-${id}`)[0];
		if (!contentEl) contentEl = this.buildContent(id);
		this.contentArea.find('.tab-content').removeClass('active');
		$(contentEl).addClass('active');
	}
	closeTab(id) {
		this.tabs = this.tabs.filter(t => t.id !== id);
		if (this.activeTabId === id) {
			this.activeTabId = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null;
		}
		this.renderTabs();
	}
	checkOverflow() {
		const wrap = this.tabWrap;
		const list = this.tabList;
		this.isOverflow = list.prop('scrollWidth') > wrap.width();
	}
}

loadStyle(`
	.content-area {
		flex: 1;
		position: relative;
		overflow: hidden;
	}
	.tab-content {
		display: none;
		width: 100%;
		height: 100%;
		animation: contentFadeIn 0.2s ease;
	}

	.tab-content.active {
		display: flex;
	}

	@keyframes contentFadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}	
	.tabbar-wrapper {
		background: #1e1e3a;
		display: flex;
		align-items: flex-end;
		padding: 8px 8px 0;
		gap: 0;
		min-height: 44px;
		user-select: none;
		overflow: visible;
		/* 드롭다운이 잘리지 않도록 */
		position: relative;
	}

	/* ─── 탭 목록 (내부 스크롤 컨테이너) ─── */
	.tab-list-wrap {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		/* 탭이 넘치면 숨김 (스크롤 없음) */
		position: relative;
	}

	.tab-list {
		display: flex;
		align-items: flex-end;
		gap: 0;
		white-space: nowrap;
	}

	/* ─── 개별 탭 ─── */
	.tab {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 36px 8px 12px;
		min-width: 120px;
		max-width: 220px;
		height: 36px;
		background: #2d2d52;
		border-radius: 8px 8px 0 0;
		cursor: pointer;
		transition: background 0.15s, height 0.1s;
		flex-shrink: 0;
		color: #9e9ecf;
		font-size: 13px;
		white-space: nowrap;
		overflow: hidden;
		border-top: 2px solid transparent;
	}

	/* 탭 사이 곡선 연결 */
	.tab::before,
	.tab::after {
		content: '';
		position: absolute;
		bottom: 0;
		width: 12px;
		height: 12px;
	}

	.tab::before {
		left: -12px;
		border-bottom-right-radius: 8px;
		box-shadow: 4px 0 0 0 #2d2d52;
	}

	.tab::after {
		right: -12px;
		border-bottom-left-radius: 8px;
		box-shadow: -4px 0 0 0 #2d2d52;
	}

	.tab:hover {
		background: #3c3c6a;
		color: #d0d0f0;
	}

	.tab:hover::before {
		box-shadow: 4px 0 0 0 #3c3c6a;
	}

	.tab:hover::after {
		box-shadow: -4px 0 0 0 #3c3c6a;
	}

	/* ── 활성 탭: 흰색 배경으로 콘텐츠 영역과 자연 연결 ── */
	.tab.active {
		background: #0d1117;
		color: #bbbbe3;
		font-size: 1.5rem;
		font-weight: bold;
		height: 40px;
		z-index: 10;
		border-top: 2px solid #6c63ff;
	}

	.tab.active::before {
		box-shadow: 4px 0 0 0 #09121f;
	}

	.tab.active::after {
		box-shadow: -4px 0 0 0 #09121f;
	}

	.tab.active:hover {
		background: #03060a;
		color: #bbbbe3;
	}

	.tab.active .tab-close {
		color: #555;
	}

	.tab.active .tab-close:hover {
		background: rgba(0, 0, 0, 0.1);
		color: #111;
	}

	/* 드래그 중 */
	.tab.dragging {
		opacity: 0.4;
		background: #555580;
	}

	.tab.drag-over {
		background: #4a4a7a;
	}

	/* 탭 파비콘 */
	.tab-favicon {
		width: 16px;
		height: 16px;
		border-radius: 3px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
	}

	/* 탭 제목 */
	.tab-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		font-weight: 500;
	}

	/* 닫기 버튼 */
	.tab-close {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: #9e9ecf;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.15s, background 0.15s;
		z-index: 3;
	}

	.tab:hover .tab-close,
	.tab.active .tab-close {
		opacity: 1;
	}

	.tab-close:hover {
		background: rgba(255, 255, 255, 0.15);
		color: #fff;
	}

	/* ─── 탭 바 우측 버튼 (새탭 / 탭목록) 공통 ─── */
	.tabbar-action-btn {
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: #9e9ecf;
		font-size: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		margin-left: 4px;
		margin-bottom: 4px;
		transition: background 0.15s, color 0.15s;
		position: relative;
	}

	.tabbar-action-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}

	/* ─── 탭 목록 드롭다운 ─── */
	.tab-dropdown {
		display: none;
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		min-width: 220px;
		background: #1e1e3a;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
		z-index: 9999;
		overflow: hidden;
		animation: dropIn 0.15s ease;
	}

	.tab-dropdown.open {
		display: block;
	}

	@keyframes dropIn {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.tab-dropdown-header {
		padding: 10px 14px 6px;
		font-size: 11px;
		font-weight: 700;
		color: #7070a0;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}

	.tab-dropdown-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 14px;
		cursor: pointer;
		color: #c0c0e0;
		font-size: 13px;
		transition: background 0.1s;
		border-left: 3px solid transparent;
	}

	.tab-dropdown-item:hover {
		background: rgba(255, 255, 255, 0.07);
		color: #fff;
	}

	.tab-dropdown-item.active {
		background: rgba(108, 99, 255, 0.15);
		color: #a89cff;
		border-left-color: #6c63ff;
		font-weight: 600;
	}

	.tab-dropdown-item .di-emoji {
		font-size: 14px;
		flex-shrink: 0;
	}

	.tab-dropdown-item .di-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tab-dropdown-item .di-close {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: #7070a0;
		font-size: 13px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.1s, color 0.1s;
	}

	.tab-dropdown-item .di-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}    
`)