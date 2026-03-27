const pageInfo = {}
const clog = window.console.log
const randomKey = () => (new Date % 9e64).toString(36)
const isNull = a => a === null || typeof a == 'undefined'
const isEmpty = a => isNull(a) || (typeof a == 'string' && a == '')
const isObj = a => !isNull(a) && typeof a == 'object';
const isNum = a => typeof a == 'number' ? true : typeof a == 'string' ? /^[0-9]+$/.test(a) : false
const jqCheck = a => a instanceof jQuery;
const constructorName = val => val && val.constructor ? val.constructor.name : ''
const isValid = a => Array.isArray(a) ? a.length > 0 : isObj(a) ? Object.keys(a).length : !isEmpty(a)
const isEl = o =>
	typeof HTMLElement === "object" ? o instanceof HTMLElement :
		o && typeof o === "object" && o.nodeType === 1 && typeof o.nodeName === "string"
const getEl = el => isEl(el) ? el :
	jqCheck(el) ? el[0] :
		typeof el == 'string' ? (('#' == el.charAt(0) || el.indexOf('.') != -1) ? $(el)[0] : document.getElementById(el)) : null;
const getJq = el => isEl(el) ? $(el) :
	jqCheck(el) ? el :
		typeof el == 'string' ? (('#' == el.charAt(0) || el.indexOf('.') != -1) ? $(el) : $(document.getElementById(el))) : null;

pageInfo.extSvgList = ['7z', 'aac', 'avi', 'bat', 'bmp', 'c', 'cpp', 'cs', 'css', 'doc', 'docx', 'flac', 'flv', 'gif', 'go', 'gz', 'h', 'hpp', 'html', 'ico', 'java', 'jpeg', 'jpg', 'js', 'json', 'jsx', 'kt', 'less', 'md', 'mkv', 'mov', 'mp3', 'mp4', 'ogg', 'older', 'older_open', 'pdf', 'php', 'png', 'ppt', 'pptx', 'ps1', 'py', 'rar', 'rb', 'rs', 'scss', 'sh', 'sql', 'svg', 'swift', 'tar', 'ts', 'tsx', 'txt', 'wav', 'webp', 'wmv', 'xls', 'xlsx', 'xml', 'yaml', 'yml', 'zip']

/*
Object.prototype.update = function (...args) { return Object.assign(this, ...args) }
Object.prototype.copy = function (...args) { return Object.assign({}, this, ...args) }
Object.prototype.isset = function (name) { return this.hasOwnProperty(name) }
Object.prototype.cmp = function (name, value) { return this.isset(name) && this[name] === value }
String.prototype.lpad = function (padLength, padString) {
	let arrTxt = this;
	if (!padString) padString = '0';
	while (arrTxt.length < padLength)
		arrTxt = padString + arrTxt;
	return arrTxt;
}
String.prototype.rpad = function (padLength, padString) {
	let arrTxt = this;
	if (!padString) padString = '0';
	while (arrTxt.length < padLength)
		arrTxt += padString;
	return arrTxt;
}
String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g,"") }
String.prototype.ltrim = function() { return this.replace(/^\s+/,"") }
String.prototype.rtrim = function() { return this.replace(/\s+$/,"") }
*/

function checkMessenger() {
	const urlParams = new URLSearchParams(window.location.search);
	const target = urlParams.get('opener');
	if (target == 'messenger') {
		const div = $('<div style="display:flex;position:absolute;right:8px;bottom:8px;width:80px;background:#aaa;"/>').appendTo(document.body)
		const btn = $('<button style="width:80px;height:24px;">메신저</button>').appendTo(div)
		btn.on('click', () => parent.closeSubpage())
		console.log('btn=>', btn)
	}
}
function getByteLength(s) {
	if (s != undefined && s != "") {
		for (b = i = 0; c = s.charCodeAt(i++); b += c >> 11 ? 3 : c >> 7 ? 2 : 1);
		return b;
	} else {
		return 0;
	}
}
// 백그라운드 여부 판단
function isPageHidden() {
	return document.hidden || document.visibilityState === 'hidden';
}
function getRandomColor() {
	var letters = '0123456789ABCDEF';
	var color = '#';
	for (var i = 0; i < 6; i++) {
		color += letters[Math.floor(Math.random() * 16)];
	}
	return color;
}
const setScrollTop = (parent, target) => {
	const a = getJq(parent), b = getJq(target)
	const yp = $(b).offset().top - $(a).offset().top
	const sp = yp + a.scrollTop()
	a.scrollTop(sp)
}
const getElOffset = (el, checkRect) => {
	const target = getEl(el)
	if (!target) return;
	if (target.getBoundingClientRect) {
		var m = target.getBoundingClientRect();
		var n = document.body;
		var c = document.documentElement;
		var a = window.pageYOffset || c.scrollTop || n.scrollTop;
		var h = window.pageXOffset || c.scrollLeft || n.scrollLeft;
		var l = c.clientTop || n.clientTop || 0;
		var o = c.clientLeft || n.clientLeft || 0;
		var r = m.top + a - l;
		var e = m.left + h - o;
		return checkRect ?
			{ top: Math.round(r), left: Math.round(e), width: m.width, height: m.height } :
			{ top: Math.round(r), left: Math.round(e) }
	}
	let aa = target;
	let left = 0, top = 0, width = aa.offsetWidth, height = aa.offsetHeight;
	while (aa) {
		left = c + parseInt(aa.offsetLeft);
		top = e + parseInt(aa.offsetTop);
		aa = aa.offsetParent
	}
	return checkRect ? { top, left, width, height } : { top, left }
}
function fmtSize(b) {
	if (!b) return '0 B';
	const u = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(b) / Math.log(1024));
	return (b / 1024 ** i).toFixed(i ? 1 : 0) + ' ' + u[i];
}
function fmtDate(iso) {
	if (!iso) return '-';
	const d = new Date(iso);
	return d.toLocaleDateString('ko-KR') + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
function extSvg(name) {
	const ext = name.split('.').pop().toLowerCase();
	return pageInfo.extSvgList.includes(ext) ? ext : 'default';
}
function extIcon(name) {
	const ext = name.split('.').pop().toLowerCase();
	return ({
		jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', webp: '🖼', svg: '🖼',
		mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', mp3: '🎵', wav: '🎵',
		pdf: '📄', doc: '📄', docx: '📄', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
		txt: '📝', md: '📝', json: '📋', xml: '📋', csv: '📋',
		js: '⚙️', ts: '⚙️', py: '🐍', java: '☕', html: '🌐', css: '🎨',
		zip: '📦', gz: '📦', tar: '📦', rar: '📦',
		exe: '🖥', msi: '🖥', sh: '🔧', bat: '🔧'
	})[ext] || '📄';
}
function barColor(r) { return r > 50 ? '#22c55e' : r > 20 ? '#f59e0b' : '#6366f1'; }

const screenSize = () => ({ width: $(window).width(), height: $(window).height() })

const loadCss = (src) => {
	var link = document.createElement("link");
	link.href = src;
	link.async = false;
	link.rel = "stylesheet";
	link.type = "text/css";
	document.head.appendChild(link);
}
const loadStyle = (src) => {
	const el = document.createElement('style');
	el.textContent = src;
	document.head.appendChild(el);
}
function loadScriptAll(arr, callback) {
	const loadScript = (src) => {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.onload = () => resolve(src);
			script.onerror = () => reject(new Error(`Script load error for ${src}`));
			script.src = src;
			document.head.appendChild(script);
		})
	}
	const loadingPromises = arr.map(loadScript)
	Promise.all(loadingPromises).then(() => {
		clog("All scripts loaded!", arr)
		if (callback) callback()
	}).catch((error) => {
		clog("One or more scripts failed to load:", arr, error.message);
	})
}
function loadScript(src, callback) {
	var script = document.createElement("script");
	// script.async = false;
	script.src = src;
	if (callback) script.onload = callback;
	var doc = document.head || document.body;
	doc.appendChild(script);
}
function closeModal() {
	$('.modal-overlay').removeClass('active')
}

function showToastBox(message) {
	if ($('#toast-box').length == 0) {
		const toastBox = $('<div class="toast-box" id="toast-box"/>').appendTo(document.body)
		$('<span id="toast-msg"/>').appendTo(toastBox)
		loadStyle(`
			.toast-box {
				position: fixed;
				bottom: 30px;
				left: 50%;
				transform: translateX(-50%) translateY(100px);
				background: #1f2937;
				color: white;
				padding: 12px 24px;
				border-radius: 30px;
				font-weight: 500;
				box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
				z-index: 1000;
				transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
				display: flex;
				align-items: center;
				gap: 10px;
			}	
			.toast-box.show {
				transform: translateX(-50%) translateY(0);
			}
		`)
	}

	$('#toast-msg').text(message)
	$('#toast-box').addClass('show')
	setTimeout(() => $('#toast-box').removeClass('show'), 2500);
}

function showDownloadProgress() {
	if ($('#download-progress-container').length == 0) return $('#download-progress-container').show()
	const el = $(`
	<div id="download-progress-container" style="position:fixed; bottom:20px; right:20px; width: 300px; background:var(--bg2, #fff); padding:15px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1); border:1px solid var(--border, #ccc); z-index:9999;">
		<div style="font-size:0.85rem; margin-bottom:8px; display:flex; justify-content:space-between;">
			<span id="dl-filename">파일명.zip</span>
			<span id="dl-percent">0%</span>
		</div>
		<div style="width:100%; height:10px; background:#e5e7eb; border-radius:5px; overflow:hidden;">
			<div id="dl-bar" style="width:0%; height:100%; background:var(--primary, #3b82f6); transition:width 0.1s;"></div>
		</div>
	</div>`).appendTo(document.body)
}
function updateDownloadProgress(filename, percent) {
	$('#dl-filename').text(filename)
	$('#dl-percent').text(percent + '%')
	$('#dl-bar').css('width', percent + '%')
}
function hideDownloadProgress() {
	$('#download-progress-container').hide()
}

function showSpinner() {
	if (pageInfo.loader) {
		pageInfo.loader.show()
		return
	}
	pageInfo.loader = $('<div class="loader" id="loading-spinner"></div>').appendTo(document.body)
	pageInfo.loader.show()
}

function hideSpinner() {
	if (pageInfo.loader) {
		pageInfo.loader.hide()
	}
}

function resizeContentRatio(targetCode, padding, ratio) {
	if (!targetCode) {
		targetCode = '.funny-slide-area'
	}
	if (!padding) {
		padding = 28
	}
	if (!ratio) {
		ratio = 16 / 9
	}
	const area = $(targetCode);
	const aW = area.width() - padding, aH = area.height() - padding;
	let w = aW, h = aW / ratio;
	if (h > aH) {
		h = aH, w = aH * ratio;
	}
	$('.funny-relative-wrap').width(w)
	$('.funny-relative-wrap').height(h)
	// Scale font-size
	$('.funny-slide-content').css('font-size', (w / 1280) + 'rem');
	$('.funny-content-box').width(w);
	$('.funny-content-box').height(h);
}
function addSideToggleBtn(target, cb) {
	if (!target) {
		target = document.body
	}
	if ($('.toggle-btn').length == 0) {
		$('<button class="toggle-btn"><i class="bx bx-chevron-left"></i></button>').appendTo(getJq(target))
		loadStyle(`
			.toggle-btn {
				position: fixed;
				right: -15px;
				top: 50%;
				transform: translateY(-50%);
				width: 30px;
				height: 30px;
				background-color: var(--primary);
				color: white;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				border: 2px solid var(--bg-body);
				z-index: 101;
				transition: all 0.2s;
				box-shadow: var(--shadow-sm);
			}
			.toggle-btn:hover {
				background-color: var(--primary-dark);
				transform: translateY(-50%) scale(1.1);
			}
			.app-container.sb-hidden .toggle-btn i {
				transform: rotate(180deg);
			}
		`)
	}
	$('.toggle-btn').on('click', () => {
		$('.app-container').toggleClass('sb-hidden')
		if (typeof cb == 'function') cb()
	})
}

class ChatProc {
	constructor(targetEl, url) {
		if (!url) {
			const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
			url = `${proto}//${location.host}`;
		}
		this.targetEl = targetEl
		this.panel = null
		this.input = null
		this.sendBtn = null
		this.closeBtn = null
		this.chatBody = null
		this.nickname = ''
		this.role = 'user'
		this.room = '룸정보없음'
		this.ws = null
		this.wsOk = false
		this.url = url
		this.pendingMessages = []
		this.init(url)
	}
	init(url) {
		const self = this
		const ws = new WebSocket(url)
		ws.onopen = () => self.openSocket()
		ws.onmessage = (e) => self.recvMessage(JSON.parse(e.data))
		ws.onclose = () => self.closeSocket()
		ws.onerror = (e) => self.errorSocket(e)
		this.ws = ws
	}
	openSocket() {
		this.wsOk = true
		clog('@@ws open')
		// flush pending messages
		while (this.pendingMessages.length > 0) {
			const msg = this.pendingMessages.shift()
			this.ws.send(JSON.stringify(msg))
		}
	}
	recvMessage(msg) {
		clog('@@ws message', msg)
		if (this.onMessage) this.onMessage(msg)
	}
	closeSocket() {
		this.wsOk = false
		clog('@@ws close')
	}
	errorSocket(e) {
		this.wsOk = false
		clog('@@ws error', e)
	}
	makeChatPanel() {
		const target = isEl(this.targetEl) ? this.targetEl : document.body
		const self = this
		this.panel = $(`<div class="chat-panel">
			<div class="chat-hdr">
				<div class="chat-title">채팅</div>
				<div class="chat-room">${this.room}</div>
				<button class="chat-close">×</button>
			</div>
			<div class="chat-msgs"></div>
			<div class="chat-input-row">
				<textarea class="chat-in" placeholder="메시지를 입력하세요..."></textarea>
				<button class="chat-send">➤</button>
			</div>
		</div>`).appendTo(target)
		this.input = $('.chat-panel .chat-in')
		this.sendBtn = $('.chat-panel .chat-send')
		this.closeBtn = $('.chat-panel .chat-close')
		this.chatBody = $('.chat-panel .chat-msgs')
		this.sendBtn.on('click', () => self.sendChat())
		this.closeBtn.on('click', () => self.closeChatPanel())
		this.input.on('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				self.sendChat();
			}
		})
		this.input.on('input', () => {
			const input = self.input[0]
			const val = input.value
			if (val && val.indexOf('\n') !== -1) {
				input.style.height = 'auto';
				input.style.height = (input.scrollHeight) + 'px';
			} else {
				input.style.height = '34px';
			}
		})
	}
	openPopup(css) {
		if (!this.panel) {
			this.makeChatPanel()
		}
		if (css) {
			this.panel.css(css)
		}
		this.panel.removeClass('hidden')
	}
	closePopup() {
		if (!this.panel) return
		this.panel.addClass('hidden')
	}
	sendChat(type) {
		if (!this.input) return clog('@@sendChat : input is null')
		const text = (this.input.val() || '').trim();
		if (!text) return clog('@@sendChat : text is empty')
		if (!type) type = 'text'
		this.sendMessage({ type: 'ppt-chat', nickname: this.nickname, role: this.role, text });
		this.input.val('')
		this.input.css('height', '34px')
	}
	sendMessage(msg) {
		if (this.wsOk) {
			msg.time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
			this.ws.send(JSON.stringify(msg))
		} else {
			this.pendingMessages.push(msg)
		}
	}
}

class EditorProc {
	constructor(target, editorCode) {
		this.target = target
		this.editorCode = editorCode
		this.editor = null
	}
	init() {
		require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs' } });
		require(['vs/editor/editor.main'], () => {
			clog('@@ editor module init ', this)
			const editor = monaco.editor.create(this.target, {
				value: '',
				language: 'sql',
				theme: 'vs-dark',
				automaticLayout: true,
				minimap: { enabled: false },
				fontSize: 14,
				fontFamily: "'JetBrains Mono', 'Consolas', 'Courier New', monospace",
				fontLigatures: false, // Ligatures can sometimes mess up cursor alignment
				lineHeight: 24,
				padding: { top: 16, bottom: 16 },
				scrollBeyondLastLine: false,
				disableMonospaceOptimizations: true,
				smoothScrolling: true,
				cursorBlinking: "smooth",
				cursorSmoothCaretAnimation: true,
				renderWhitespace: "selection"
			});

			// Bind F5 and Ctrl+Enter to run query
			editor.addCommand(monaco.KeyCode.F5, function () {
				// executeQuery();
			});
			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
				// executeQuery();
			});
			this.editor = editor;
		});
	}
	setLayout() {
		if (!this.editor) return;
		this.editor.layout();
	}
	getValue() {
		if (!this.editor) return '';
		return this.editor.getValue();
	}
	setValue(value) {
		if (!this.editor) return;
		this.editor.setValue(value);
	}
	setFocus() {
		if (!this.editor) return;
		this.editor.focus();
	}
	resetEditor() {
		if (!this.editor) return;
		this.editor.setValue('');
		this.editor.focus();
	}
	defineTheme() {
		monaco.editor.defineTheme('premium-dark', {
			base: 'vs-dark',
			inherit: true,
			rules: [],
			colors: {
				'editor.background': '#1e1e1e',
				'editorLineNumber.foreground': '#475569',
				'editorIndentGuide.background': '#334155',
			}
		});
	}
	registerCompletionItemProvider() {
		monaco.languages.registerCompletionItemProvider('sql', {
			triggerCharacters: [' ', '.'],
			provideCompletionItems: function (model, position) {
				var word = model.getWordUntilPosition(position);
				var range = {
					startLineNumber: position.lineNumber,
					endLineNumber: position.lineNumber,
					startColumn: word.startColumn,
					endColumn: word.endColumn
				};

				// Suggest tables dynamically from schema
				var suggestions = window.dbTables.map(tableName => {
					return {
						label: tableName,
						kind: monaco.languages.CompletionItemKind.Struct,
						insertText: tableName,
						range: range,
						detail: 'Table'
					};
				});
				return { suggestions: suggestions };
			}
		});
	}
	changeLanguage(language) {
		monaco.editor.setModelLanguage(this.editor.getModel(), language);
	}
	changeTheme(theme) {
		monaco.editor.setTheme(theme);
	}
	updateOptions(options) {
		this.editor.updateOptions(options);
	}
	setFontSize(fontSize) {
		this.editor.updateOptions({ fontSize: fontSize });
	}
	setLineHeight(lineHeight) {
		this.editor.updateOptions({ lineHeight: lineHeight });
	}
	setPadding(padding) {
		this.editor.updateOptions({ padding: padding });
	}
	setScrollBeyondLastLine(scrollBeyondLastLine) {
		this.editor.updateOptions({ scrollBeyondLastLine: scrollBeyondLastLine });
	}
	setDisableMonospaceOptimizations(disableMonospaceOptimizations) {
		this.editor.updateOptions({ disableMonospaceOptimizations: disableMonospaceOptimizations });
	}
	setSmoothScrolling(smoothScrolling) {
		this.editor.updateOptions({ smoothScrolling: smoothScrolling });
	}
	setCursorBlinking(cursorBlinking) {
		this.editor.updateOptions({ cursorBlinking: cursorBlinking });
	}
	setCursorSmoothCaretAnimation(cursorSmoothCaretAnimation) {
		this.editor.updateOptions({ cursorSmoothCaretAnimation: cursorSmoothCaretAnimation });
	}
	setRenderWhitespace(renderWhitespace) {
		this.editor.updateOptions({ renderWhitespace: renderWhitespace });
	}
	addCommand(keyCode, command) {
		this.editor.addCommand(keyCode, command);
	}
	getSelectValue() {
		return this.editor.getModel().getValueInRange(this.editor.getSelection());
	}
	getCursorPosition() {
		return this.editor.getPosition();
	}
	getOffsetAt(position) {
		return this.editor.getModel().getOffsetAt(position);
	}
	getLineCount() {
		return this.editor.getModel().getLineCount();
	}
	getLineContent(lineNumber) {
		return this.editor.getModel().getLineContent(lineNumber);
	}
	getLineLength(lineNumber) {
		return this.editor.getModel().getLineLength(lineNumber);
	}
	getLineFirstNonWhitespaceColumn(lineNumber) {
		return this.editor.getModel().getLineFirstNonWhitespaceColumn(lineNumber);
	}
	getLineLastNonWhitespaceColumn(lineNumber) {
		return this.editor.getModel().getLineLastNonWhitespaceColumn(lineNumber);
	}
	getLineMinColumn(lineNumber) {
		return this.editor.getModel().getLineMinColumn(lineNumber);
	}
	getLineMaxColumn(lineNumber) {
		return this.editor.getModel().getLineMaxColumn(lineNumber);
	}
	getLineRange(lineNumber) {
		return this.editor.getModel().getLineRange(lineNumber);
	}
	getLineCount() {
		return this.editor.getModel().getLineCount();
	}
	find(text) {
		const matches = this.editor.getModel().findMatches(text, false, false, false, null, false);
		return matches;
	}
	getCurrentQurey() {
		const str = this.getSelectValue();
		if (str) return str;
		const position = this.getCursorPosition();
		const text = this.getValue();
		const offset = this.getOffsetAt(position);

		let startSearchOffset = text.lastIndexOf(';', offset - 1);
		let startOffset = startSearchOffset === -1 ? 0 : startSearchOffset + 1;

		let endOffset = text.indexOf(';', offset);
		if (endOffset === -1) endOffset = text.length;
		return text.substring(startOffset, endOffset).trim();
	}
	formatCode() {
		this.editor.trigger('anyString', 'editor.action.formatDocument');
	}
	onCursorChange(callback) {
		this.editor.onDidChangeCursorPosition((e) => callback(e));
	}
	onContentChange(callback) {
		this.editor.onDidChangeModelContent((e) => callback(e));
	}
	onSelectionChange(callback) {
		this.editor.onDidChangeCursorSelection((e) => callback(e));
	}
	onCursorSelectionChange(callback) {
		this.editor.onDidChangeCursorSelection((e) => callback(e));
	}
}

class GridProc {
	constructor(target, options) {
		this.target = getEl(target)
		this.options = options
		this.grid = null
		loadCss('/css/tabulator.min.css')
		this.init()
	}
	init() {
		/*
		this.grid = new gridjs.Grid(this.options).render(this.target)
		this.grid.setColumns([{ title: "Error", field: "error_message" }]);
		this.grid.setData([{ error_message: result.error }]);
		*/
		if (!this.options.placeholder) this.options.placeholder = "데이터가 존재하지 않습니다."
		this.grid = new Tabulator(this.target, this.options)
	}
	setData(data) {
		this.grid.setData(data)
	}
	setColumns(columns) {
		this.grid.setColumns(columns)
	}
	getData() {
		return this.grid.getData()
	}
	getColumns() {
		return this.grid.getColumns()
	}
	getSelectedData() {
		return this.grid.getSelectedData()
	}
	getSelectedRows() {
		return this.grid.getSelectedRows()
	}
	makeColumns(columns, useSet = false) {
		const colDefs = columns.map(item => {
			if (typeof item == 'string') {
				return { title: item, field: item };
			}
			const field = item.field || item.code
			const colDef = { field, title: item.title || field };
			// Add some default custom widths based on length
			if (field === 'id') colDef.width = 80;
			if (field === 'status') colDef.formatter = this.statusFormatter;
			if (item.hidden) colDef.hidden = true;
			if (item.width) colDef.width = item.width;
			if (item.formatter) colDef.formatter = item.formatter;
			if (item.align) colDef.align = item.align;
			if (item.sort) {
				colDef.sorter = 'string';
				colDef.headerSort = true;
			}
			if (item.editable) {
				colDef.editor = "input";
				colDef.cellClick = this.cellClick.bind(this)
			} else if (item.useYn) {
				colDef.editor = "select";
				colDef.editorParams = { values: { "Y": "사용", "N": "미사용" } }
			}
			return colDef;
		})
		if (useSet) {
			// colDefs.unshift({formatter:"rowSelection", titleFormatter:"rowSelection", hozAlign:"center", width:90})
			this.grid.setColumns(colDefs)
		}
		return colDefs
	}
	cellClick(e, cell) {
		console.log(cell)
	}
	statusFormatter(cell, formatterParams, onRendered) {
		var value = cell.getValue();
		if (value === "active") {
			return `<span style="color: #10b981; font-weight: 600;"><i class="fa-solid fa-circle" style="font-size:0.5rem; vertical-align:middle; margin-right:4px;"></i> ${value}</span>`;
		} else {
			return `<span style="color: #94a3b8;"><i class="fa-regular fa-circle" style="font-size:0.5rem; vertical-align:middle; margin-right:4px;"></i> ${value}</span>`;
		}
	}
	addStyle() {
		loadStyle(`
			.tabulator-row {
				font-family: 'JetBrains Mono', monospace;
				font-size: 0.85rem;
			}

			.tabulator .tabulator-header {
				font-family: 'Inter', sans-serif;
				font-weight: 600;
				border-bottom: 2px solid var(--border-color) !important;
			}	
		`)
	}
}

class UploadProc {
	constructor() {
		this.inputEl = null
		this.chunkSize = 1024 * 1024 * 2
		this.uploadCheckTimer = null
		this.fileList = []
		this.onUploadProgress = null
		this.onUploadFinish = null
	}

	uploadStart() {
		if (this.inputEl) {
			//this.inputEl.remove()
			this.inputEl.value = ''
			return this.inputEl.click()
		}
		const form = document.createElement('form')
		const input = document.createElement('input')
		this.inputEl = input
		form.style.display = 'none'
		input.type = 'file'
		input.multiple = true
		form.appendChild(input)
		document.body.appendChild(form)
		input.click()
		input.onchange = (e) => {
			this.uploadFiles(e.target.files)
		}
	}
	uploadFiles(files) {
		this.fileList = Array.from(files).map(file => {
			if (file.size < this.chunkSize) {
				return {
					file: file,
					name: file.name,
					size: file.size,
					type: file.type,
					status: 'pending'
				}
			}
			const uploadId = Date.now() + '-' + Math.random().toString(36).substring(2, 9)
			const totalChunks = Math.ceil(file.size / this.chunkSize)
			return {
				file: file,
				name: file.name,
				size: file.size,
				type: file.type,
				uploadId: uploadId,
				totalChunks: totalChunks,
				uploadSize: 0,
				status: 'pending'
			}
		})
		this.fileList.forEach(fileItem => {
			if (fileItem.status === 'pending') {
				this.uploadFile(fileItem)
				if (!this.uploadCheckTimer) {
					this.uploadCheckTimer = setInterval(() => this.checkUploadStatus(), 1000)
				}
			}
		})
	}
	checkUploadStatus() {
		let finishCount = 0
		this.fileList.forEach(fileItem => {
			if (fileItem.status === 'uploaded') {
				if (fileItem.uploadId) {
					fileItem.status = 'merging'
					this.mergeChunks(fileItem)
				} else {
					fileItem.status = 'completed'
				}
			} else if (fileItem.status == 'completed' || fileItem.status == 'error') {
				finishCount++
			}
		})
		if (finishCount === this.fileList.length) {
			clearInterval(this.uploadCheckTimer)
			this.uploadCheckTimer = null
			if (this.onUploadFinish) {
				this.onUploadFinish(this.fileList)
			}
		}
	}
	uploadFile(fileItem) {
		if (fileItem.uploadId) {
			this.uploadLargeFile(fileItem)
		} else {
			this.uploadSmallFile(fileItem)
		}
	}
	uploadSmallFile(fileItem) {
		const formData = new FormData()
		formData.append('file', fileItem.file)
		if (this.onUploadProgress) {
			this.onUploadProgress('start', fileItem)
		}
		fetch('/api/upload/file', {
			method: 'POST',
			body: formData
		})
			.then(response => response.json())
			.then(data => {
				console.log(data)
				fileItem.status = 'uploaded'
				fileItem.downloadUrl = data.url
				if (this.onUploadProgress) {
					this.onUploadProgress('uploaded', fileItem)
				}
			})
			.catch(error => {
				console.error('Error:', error)
				fileItem.status = 'error'
				if (this.onUploadProgress) {
					this.onUploadProgress('error', fileItem)
				}
			})
	}
	uploadLargeFile(fileItem) {
		if (this.onUploadProgress) {
			this.onUploadProgress('start', fileItem)
		}
		for (let n = 0; n < fileItem.totalChunks; n++) {
			const chunk = fileItem.file.slice(n * this.chunkSize, (n + 1) * this.chunkSize)
			const formData = new FormData()
			formData.append('chunk', chunk)
			formData.append('uploadId', fileItem.uploadId)
			formData.append('chunkIndex', n)
			formData.append('totalChunks', fileItem.totalChunks)
			fetch('/api/upload/chunk', {
				method: 'POST',
				body: formData
			})
				.then(response => response.json())
				.then(data => {
					console.log(data)
					if (data.success) {
						const idx = n + 1
						if (idx == fileItem.totalChunks) {
							fileItem.percent = 100
							fileItem.status = 'uploaded'
						} else {
							const percent = Math.round((idx / fileItem.totalChunks) * 90);
							fileItem.percent = percent
							fileItem.status = 'uploading'
						}
						if (this.onUploadProgress) {
							this.onUploadProgress('uploading', fileItem)
						}
					} else {
						fileItem.status = 'error'
						if (this.onUploadProgress) {
							this.onUploadProgress('error', fileItem)
						}
					}
				})
				.catch(error => {
					console.error('Error:', error)
					fileItem.status = 'error'
					if (this.onUploadProgress) {
						this.onUploadProgress('error', fileItem)
					}
				})
		}
		/* file reader 이용
		const uploadId = fileItem.uploadId
		const totalChunks = fileItem.totalChunks
		const chunkSize = this.chunkSize
		const fileReader = new FileReader()
		fileReader.onload = (e) => {
			const chunk = e.target.result
			const formData = new FormData()
			formData.append('file', chunk)
			formData.append('uploadId', uploadId)
			formData.append('chunkIndex', chunkIndex)
			formData.append('totalChunks', totalChunks)
			fetch('/upload', {
				method: 'POST',
				body: formData
			})
			.then(response => response.json())
			.then(data => {
				console.log(data)
			})
			.catch(error => {
				console.error('Error:', error)
			})
		}
		fileReader.readAsArrayBuffer(file)
		*/
	}
	mergeChunks(fileItem) {
		if (this.onUploadProgress) {
			this.onUploadProgress('merging', fileItem)
		}
		try {
			fetch('/api/upload/merge', {
				method: 'POST',
				body: JSON.stringify({
					uploadId: fileItem.uploadId,
					fileName: fileItem.name,
					totalChunks: fileItem.totalChunks
				})
			})
				.then(response => response.json())
				.then(data => {
					console.log(data)
					if (data.success) {
						fileItem.status = 'completed'
						fileItem.downloadUrl = data.url
						if (this.onUploadProgress) {
							this.onUploadProgress('completed', fileItem)
						}
					} else {
						fileItem.status = 'error'
						if (this.onUploadProgress) {
							this.onUploadProgress('error', fileItem)
						}
					}
				})
				.catch(error => {
					console.error('Error:', error)
					fileItem.status = 'error'
				})
		} catch (error) {
			alert('병합 중 오류 발생: ' + error.message);
		} finally {
			uploadBtn.disabled = false;
		}
	}

}

