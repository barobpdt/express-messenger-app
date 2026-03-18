/* 
페이지 공통설정 
*/
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

// Object.prototype.update = function (...args) { return Object.assign(this, ...args) }
// Object.prototype.copy = function (...args) { return Object.assign({}, this, ...args) }
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
/*
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