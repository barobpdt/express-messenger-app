class RenderZipFile {
	constructor(parentEl) {
		this.parentEl = getEl(parentEl)
		this.tree = null
		this.table = null
		this.tbody = null
		this.toolbar = null
		this.progress = null
		this.sortKey = 'name'
		this.sortAsc = true
		this.filter = ''
		this.state = ''
		this.stateMessage = ''
		this.currentZipfile = ''
		this.showChk = true
		this.showToolbar = true
		this.fileEntries = []
		this.collapsed = {}
	}
	setState(state, message) {
		this.state = state
		this.stateMessage = message
		clog('@@ state', state, message)
	}
	async loadData(zipPath, mode) {
		if (!zipPath) return this.setState('error', 'ZIP 경로를 입력하세요')
		this.currentZipfile = zipPath
		this.collapsed = {};
		this.setState('loading');
		showSpinner()
		fetch(`/api/zip/list?path=${encodeURIComponent(zipPath)}`).then(res => {
			if (!res.ok) throw new Error(res.error || '서버 오류');
			return res.json()
		}).then(data => {
			clog('>> data=> ', data)
			this.fileEntries = data.entries
			if (mode == 'tree') {
				this.zipfileTree(data)
			} else {
				this.zipfileSearch(data)
			}
			this.setState('loaded')
			hideSpinner()
		}).catch(err => {
			this.setState('error', err.message)
			hideSpinner()
		})
	}
	appendProgress(target) {
		this.progress = $(`
		<div style="display:none;position:absolute; bottom:15px; right:15px; width: 300px; background:var(--bg2); padding:15px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1); border:1px solid var(--border, #ccc); z-index:9999;">
			<div style="font-size:0.85rem; margin-bottom:8px; display:flex; justify-content:space-between;">
				<span class="dl-filename">파일명.zip</span>
				<span class="dl-percent">0%</span>
			</div>
			<div style="width:100%; height:10px; background:#e5e7eb; border-radius:5px; overflow:hidden;">
				<div class="dl-bar" style="width:0%; height:100%; background:var(--primary, #3b82f6); transition:width 0.1s;"></div>
			</div>
		</div>`).appendTo(target)
	}
	downloadStart(row) {
		if (this.state == 'download') return;
		const entry = row.data('entry')
		const fileName = entry.split('/').pop()
		const url = `/api/zip/download-entry?path=${encodeURIComponent(this.currentZipfile)}&entry=${encodeURIComponent(entry)}`
		this.progress.show()
		this.progress.find('.dl-filename').text(fileName)
		this.updateProgress(0)
		this.setState('download', '다운로드 시작')
		fetch(url).then(async res => {
			clog('>> res=> ', res, this)
			if (!res.ok) throw new Error(res.error || '서버 오류');
			const contentLength = res.headers.get('content-length');
			if (!contentLength) {
				console.warn('Content-Length 헤더가 없어서 진행률을 계산할 수 없습니다.');
			}
			const total = parseInt(contentLength, 10);
			clog('>> total=> ', total, contentLength)
			let loaded = 0;
			const reader = res.body.getReader();
			const chunks = [];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
				loaded += value.length;
				// 진행률 콜백 호출
				const percent = Math.round((loaded / total) * 100);
				this.updateProgress(percent);
			}

			// 1. 청크(조각)들을 모아서 Blob 생성
			const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' });

			// 2. 가상의 다운로드 링크 생성 및 클릭
			const blobUrl = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = blobUrl;
			a.download = fileName || 'download';
			document.body.appendChild(a);
			a.click();

			// 3. 뒷정리
			a.remove();
			window.URL.revokeObjectURL(blobUrl);
			this.progress.hide();
			this.setState('loaded', '다운로드 완료')
		}).catch(err => {
			this.setState('error', err.message)
			this.progress.hide()
		})
	}
	updateProgress(percent) {
		this.progress.find('.dl-bar').css('width', percent + '%')
		this.progress.find('.dl-percent').text(percent + '%')
	}
	zipInfo(data) {
		getJq(el).html(`
			<div class="stat-card"><div class="label">파일 수</div><div class="value primary">${data.fileCount.toLocaleString()}개</div></div>
			<div class="stat-card"><div class="label">원본 크기</div><div class="value">${fmtSize(data.totalSize)}</div></div>
			<div class="stat-card"><div class="label">압축 크기</div><div class="value yellow">${fmtSize(data.totalCompressed)}</div></div>
			<div class="stat-card"><div class="label">절감률</div><div class="value green">${data.savedRatio}%</div></div>
		`)
	}
	zipList() {
		this.tbody.empty()
		this.table.parent().children().each((n, el) => {
			if ($(el).hasClass('empty-state')) {
				$(el).show()
			} else {
				$(el).hide()
			}
		})
		this.table.find('.chk-all').prop('checked', false)
		this.table.find('.chk-all').prop('indeterminate', false)
		const filterText = this.filter ? this.filter.toLocaleString() : ''
		let rows = this.fileEntries.filter(e => !e.isDirectory)
		if (filterText) {
			rows = rows.filter(e => e.name.toLocaleString().includes(filterText))
		}
		rows.sort((a, b) => {
			const va = this.sortKey === 'size' ? a.size : this.sortKey === 'ratio' ? parseFloat(a.ratio) : a.name;
			const vb = this.sortKey === 'size' ? b.size : this.sortKey === 'ratio' ? parseFloat(b.ratio) : b.name;
			return va < vb ? (this.sortAsc ? -1 : 1) : va > vb ? (this.sortAsc ? 1 : -1) : 0;
		})
		const html = rows.map((e, i) => {
			const parts = e.name.split('/'), fname = parts.pop();
			const dir = parts.length ? parts.join('/') + '/' : '';
			const r = parseFloat(e.ratio);
			const esc = e.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
			return `<tr id="lr-${i}" data-entry="${esc}">
				${this.showChk ?
					`<td class="chk">
						<input type="checkbox" class="row-chk">
					</td>` : ''
				}
				<td class="name" title="${e.name}">
					${dir ? `<span style="color:var(--muted);font-size:.76rem">${dir}</span>` : ''}<span>${extIcon(fname)}</span> ${fname}
				</td>
				<td class="num">${fmtSize(e.size)}</td>
				<td class="num">${fmtSize(e.compressedSize)}</td>
				<td><div class="ratio-bar-wrap">
					<div class="ratio-bar"><div class="ratio-fill" style="width:${Math.min(r, 100)}%;background:${barColor(r)}"></div></div>
					<span class="ratio-text">${r}%</span>
				</div></td>
				<td class="date">${fmtDate(e.date)}</td>
				<td style="text-align:center"><button class="dl-btn">⬇ 다운</button></td>
			</tr>`;
		}).join('')
		this.tbody.html(html)
		if (this.showChk) {
			chk.on('change', e => {
				const chk = this.table.find('.chk')
				const allChecked = chk.filter(':checked').length === chk.length
				this.table.find('.chk-all').prop('checked', allChecked)
				this.table.find('.chk-all').prop('indeterminate', !allChecked)
			})
		}
		this.table.find('.name').on('click', e => {
			const chk = $(e.target).closest('tr').find('.row-chk')
			chk.prop('checked', !chk.prop('checked'))
		})
		this.table.find('.dl-btn').on('click', e => {
			const entry = $(e.target).closest('tr').data('entry')
			const fileName = entryPath.split('/').pop();
			const url = `/api/zip/download-entry?path=${encodeURIComponent(this.currentZipfile)}&entry=${encodeURIComponent(entry)}`
			showDownloadProgress()
			updateDownloadProgress(fileName, 0)

		})
	}

	zipfileTree(data) {
		this.fileEntries = data.entries
		if (this.tree) {
			return this.zipTree()
		}
		if (!isEl(this.parentEl)) {
			clog('@@ zipfileSearch parentEl is not element')
			return
		}
		const toolbar = $(`<div class="table-grid toolbar" style="display:none">
			<input class="filter-in" type="text" placeholder="🔍 파일명 필터...">
			<div class="vsep"></div>
			<div class="toolbar-right">
			<span class="row-count" style="font-size:.8rem;color:var(--muted);line-height:2.2;"></span>
			<button class="bbtn selected-btn" disabled 
				style="padding:6px 14px;font-size:.82rem;background:var(--green);border-color:var(--green);">
				⬇ 선택 다운로드<span class="sel-badge" id="sel-badge">0</span>
			</button>
			</div>
		</div>`).appendTo(this.parentEl)
		toolbar.find('.selected-btn').on('click', () => this.downloadSelected())
		const tree = $(`<div id="tree-view">
			<div class="tree-inner" id="tree-inner"></div>
		</div>`).appendTo(this.parentEl)


		toolbar.find('.filter-in').on('input', e => {
			this.filter = e.target.value
			this.zipTree()
		})
		if (this.showToolbar) toolbar.show()
		this.appendProgress(tree)
		this.tree = tree
		this.toolbar = toolbar
		this.zipTree()
	}

	zipfileSearch(data) {
		this.fileEntries = data.entries
		if (this.table) {
			return this.zipList()
		}
		if (!isEl(this.parentEl)) {
			clog('@@ zipfileSearch parentEl is not element')
			return
		}
		const toolbar = $(`<div class="table-grid toolbar" style="display:none">
			<input class="filter-in" type="text" placeholder="🔍 파일명 필터...">
			<div class="vsep"></div>
			<button class="sort-btn sort-name">이름 ↕</button>
			<button class="sort-btn sort-size">크기 ↕</button>
			<button class="sort-btn sort-ratio">압축률 ↕</button>
			<div class="vsep"></div>
			<div class="status"></div>
			<div class="toolbar-right">
			<span id="row-count" style="font-size:.8rem;color:var(--muted);line-height:2.2;"></span>
			<button class="bbtn selected-btn" disabled
				style="padding:6px 14px;font-size:.82rem;background:var(--green);border-color:var(--green);">
				⬇ 선택 다운로드<span class="sel-badge" id="sel-badge">0</span>
			</button>
			</div>
		</div>`).appendTo(this.parentEl)
		toolbar.find('.filter-in').on('input', e => {
			this.filter = e.target.value
			this.zipList()
		})
		toolbar.find('.sort-name').on('click', () => this.sortBy('name'))
		toolbar.find('.sort-size').on('click', () => this.sortBy('size'))
		toolbar.find('.sort-ratio').on('click', () => this.sortBy('ratio'))
		toolbar.find('.selected-btn').on('click', () => this.downloadSelected())
		const wrap = $(`<div class="table-wrap"/>`).appendTo(this.parentEl)
		$(wrap).append(`
		<div class="empty-state">
			<div class="ico">📦</div>
			<div>ZIP 파일 경로를 입력하고 조회하세요</div>
		</div>
		<div class="loading-state" style="display:none">
			<div class="spinner"></div>
			<div>불러오는 중...</div>
		</div>
		<div class="error-state" style="display:none">
			<div class="ico">⚠️</div>
			<div>오류가 발생했습니다</div>
			<div class="msg" id="error-msg"></div>
		</div>	
		`)

		const table = $(`<table class="table-file-search">
		<thead>
			<tr>
				${this.showChk ? `
					<th class="chk">
						<input type="checkbox" class="chk-all" title="전체 선택">
					</th>` : ''
			}
				<th>파일 경로</th>
				<th class="num">원본 크기</th>
				<th class="num">압축 크기</th>
				<th style="width:130px">압축률</th>
				<th class="num">날짜</th>
				<th style="width:76px"></th>
			</tr>
		</thead>
		<tbody></tbody>
		</table>`).appendTo(wrap)
		if (this.showToolbar) toolbar.show()
		this.appendProgress(wrap)
		this.table = table
		this.tbody = table.find('tbody')
		this.toolbar = toolbar
		this.zipList(data)
	}
	sortBy(key) {
		this.sortKey = key
		this.sortAsc = !this.sortAsc
		this.zipList()
	}
	downloadSelected() {
		const checked = this.table.find('.row-chk:checked')
		if (checked.length === 0) {
			alert('선택된 파일이 없습니다.')
			return
		}
		const entries = []
		checked.each((i, el) => {
			entries.push($(el).data('entry'))
		})
	}

	buildTree() {
		const root = { files: [], dirs: {} };
		const q = this.toolbar.find('.filter-in').val().toLowerCase()
		for (const e of this.fileEntries) {
			if (e.isDirectory) continue;
			const pos = e.name.lastIndexOf('/')
			const name = pos === -1 ? e.name : e.name.substring(pos + 1)
			if (q.length > 1 && !name.toLowerCase().includes(q)) {
				continue;
			}
			const parts = e.name.split('/');
			let node = root;
			for (let i = 0; i < parts.length - 1; i++) {
				const d = parts[i];
				if (!node.dirs[d]) node.dirs[d] = { files: [], dirs: {} };
				node = node.dirs[d];
			}
			node.files.push(e);
		}
		this.treeRootNode = root
		return this.zipTreeHtml(root, '', 0);
	}
	zipTree() {
		const treeContainer = this.tree.find('.tree-inner')
		clog('>> ziptree Container', treeContainer)
		treeContainer.html(this.buildTree())

		treeContainer.find('.tree-row').off('click').on('click', function (e) {
			e.stopPropagation()
			if (e.target.type === 'checkbox') return
			const row = $(this)
			const isFolder = row.find('.tree-name').hasClass('folder')
			clog('>> zip tree', row, isFolder)
			if (isFolder) {
				const parent = row.parent()
				const children = parent.find('>.tree-children')
				if (children.hasClass('open')) {
					children.removeClass('open')
					row.find('.tree-toggler').removeClass('open')
				} else {
					children.addClass('open')
					row.find('.tree-toggler').addClass('open')
				}
			}
		})
		const me = this
		const parentCheck = parentNode => {
			if (!parentNode.hasClass('tree-children')) return
			let chk = 0, all = 0
			const pp = parentNode.parent()
			parentNode.children().each((n, el) => {
				all++
				if ($(el).hasClass('tree-node')) {
					if ($(el).find('.tree-row .row-chk').is(':checked')) chk++
				} else {
					if ($(el).find('.row-chk').is(':checked')) chk++
				}
			})
			const row = pp.find('>.tree-row')
			const parentChk = row.find('.folder-chk')
			const allChecked = chk === all
			parentChk.prop('checked', allChecked)
			parentChk.prop('indeterminate', chk == 0 ? false : !allChecked)
			const parent = parentNode.parent()
			if (parent.hasClass('tree-node')) {
				parentCheck(parent.parent())
			} else {
				parentCheck(parent)
			}
		}
		treeContainer.find('.row-chk').off('change').on('change', function (e) {
			const chk = $(this)
			const row = chk.closest('.tree-row')
			const parent = row.parent()
			e.stopPropagation()
			if (parent.hasClass('tree-node')) {
				const tc = parent.find('>.tree-children')
				clog('tree-node children', tc.length)
				if (tc.length == 1) {
					tc.children().each(function () {
						$(this).find('.row-chk').prop('checked', chk.is(':checked'))
					})
				}
				parentCheck(parent.parent())
			} else {
				parentCheck(parent)
			}
		})
		treeContainer.find('.tree-dl').on('click', function (e) {
			e.stopPropagation()
			me.downloadStart($(this).closest('.tree-row'))
		})
	}
	zipTreeHtml(node, pathPrefix, depth) {
		const indent = depth * 20;
		let html = '';
		// 폴더 먼저 (알파벳 정렬)
		const dirs = Object.keys(node.dirs).sort()
		const countFiles = (node) => {
			let c = node.files.length;
			for (const d of Object.values(node.dirs)) c += countFiles(d);
			return c;
		}
		const sumSize = (node) => {
			let s = node.files.reduce((a, f) => a + f.size, 0);
			for (const d of Object.values(node.dirs)) s += sumSize(d);
			return s;
		}
		for (const dname of dirs) {
			const child = node.dirs[dname];
			const fullPath = pathPrefix + dname;
			const isOpen = !this.collapsed[fullPath];
			const fileCount = countFiles(child);
			const totalSize = sumSize(child);
			const esc = fullPath.replace(/'/g, "\\'").replace(/"/g, '&quot;');
			html += `
				<div class="tree-node" data-folder="${esc}">
					<div class="tree-row">
						<span style="width:${indent}px;flex-shrink:0"></span>
						${this.showChk ? `<span class="tree-chk"><input type="checkbox" class="row-chk folder-chk"></span>` : ''}
						<span class="tree-toggler${isOpen ? ' open' : ''}"></span>
						<span class="tree-icon">📁</span>
						<span class="tree-name folder">${dname}</span>
						<span class="tree-meta" style="font-size:.72rem;gap:8px;display:flex">
							<span style="color:var(--muted)">${fileCount}개</span>
							<span style="color:var(--yellow)">${fmtSize(totalSize)}</span>
						</span>
					</div>
					<div class="tree-children${isOpen ? ' open' : ''}">
						${this.zipTreeHtml(child, fullPath + '/', depth + 1)}
					</div>
				</div>`;
		}

		// 파일
		const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
		for (const e of files) {
			const parts = e.name.split('/'), fname = parts[parts.length - 1];
			const r = parseFloat(e.ratio);
			const esc = e.name.replace(/'/g, "\'").replace(/"/g, '&quot;');
			html += `
			<div class="tree-row" data-entry="${esc}">
				<span style="width:${indent}px;flex-shrink:0"></span>
				${this.showChk ? `<span class="tree-chk"><input type="checkbox" class="row-chk"></span>` : ''}
				<span class="tree-icon">${extIcon(fname)}</span>
				<span class="tree-name" title="${e.name}">${fname}</span>
				<span class="tree-meta" style="display:flex;gap:10px">
					<span>${fmtSize(e.size)}</span>
					<span style="color:${barColor(r)}">${r}%</span>
				</span>
				<button class="tree-dl">⬇</button>
			</div>`;
		}
		return html;
	}

}

loadStyle(`
	.table-wrap {
		position: relative;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
	}	
	.table-file-search {
		width: 100%;
		border-collapse: collapse;
	}
	.table-file-search thead th {
		background: var(--bg3);
		padding: 10px 14px;
		text-align: left;
		font-size: .75rem;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: .04em;
		border-bottom: 1px solid var(--border);
	}
	.table-file-search tbody tr {
		border-bottom: 1px solid rgba(48, 54, 61, .6);
		transition: .1s;
	}
	.table-file-search thead th.num {
		text-align: right;
	}
	.table-file-search td.chk, .table-file-search th.chk {
		width: 36px;
		text-align: center;
		padding: 9px 6px !important;
	}
	.table-file-search tbody td {
		padding: 9px 14px;
		font-size: .85rem;
		vertical-align: middle;
	}
	.table-file-search td.date {
		font-size: .78rem;
		color: var(--muted);
		white-space: nowrap;
	}	
	.table-file-search tbody td.name {
		max-width: 380px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}
	.empty-state,
    .loading-state,
    .error-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--muted);
    }

    .empty-state .ico,
    .loading-state .ico,
    .error-state .ico {
      font-size: 2.8rem;
      margin-bottom: 12px;
    }

    .error-state .ico {
      color: #f87171;
    }

    .error-state .msg {
      font-size: .9rem;
      color: #f87171;
      margin-top: 8px;
    }
`)
loadStyle(`
	tree-view {
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
		display: none;
	}

	.tree-inner {
		padding: 8px 4px;
	}

	.tree-node {
		user-select: none;
	}

	.tree-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		border-radius: 6px;
		cursor: pointer;
		transition: .1s;
		min-height: 32px;
	}

	.tree-row:hover {
		background: var(--bg3);
	}

	.tree-row.selected-row {
		background: rgba(99, 102, 241, .1);
	}

	.tree-row.selected-row .tree-name {
		color: #818cf8;
	}

	.tree-toggler {
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: .7rem;
		color: var(--muted);
		border-radius: 3px;
		flex-shrink: 0;
		transition: .15s;
	}

	.tree-toggler:hover {
		background: var(--border);
		color: var(--text);
	}

	.tree-toggler.leaf {
		cursor: default;
		color: transparent;
	}

	.tree-toggler.open::before {
		content: '▼';
	}

	.tree-toggler:not(.open):not(.leaf)::before {
		content: '▶';
	}

	.tree-icon {
		font-size: .95rem;
		flex-shrink: 0;
		width: 20px;
		text-align: center;
	}

	.tree-name {
		font-size: .85rem;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tree-name.folder {
		color: var(--yellow);
		font-weight: 500;
	}

	.tree-meta {
		font-family: Consolas, monospace;
		font-size: .75rem;
		color: var(--muted);
		white-space: nowrap;
		margin-left: auto;
	}

	.tree-chk {
		flex-shrink: 0;
	}

	.tree-dl {
		padding: 2px 8px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--bg3);
		color: var(--text);
		cursor: pointer;
		font-size: .74rem;
		transition: .15s;
		flex-shrink: 0;
	}

	.tree-dl:hover {
		background: var(--primary);
		border-color: var(--primary);
		color: #fff;
	}

	.tree-children {
		display: none;
	}

	.tree-children.open {
		display: block;
	}
`)	