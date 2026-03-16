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