/* 
페이지 공통설정 
*/
const pageInfo = {}
const clog=window.console.log
const randomKey = () => (new Date%9e64).toString(36)
const isNull = a => a===null || typeof a == 'undefined'
const isEmpty = a => isNull(a) || (typeof a=='string' && a=='' )
const isObj = a => !isNull(a) && typeof a=='object';
const isNum = a => typeof a=='number' ? true: typeof a=='string' ? /^[0-9]+$/.test(a): false
const jqCheck= a => a instanceof jQuery;
const constructorName = val => val && val.constructor ? val.constructor.name: ''
const isValid= a => Array.isArray(a)? a.length>0: isObj(a)? Object.keys(a).length : !isEmpty(a)
const isEl = o => 
	typeof HTMLElement === "object" ? o instanceof HTMLElement :
	o && typeof o === "object" && o.nodeType === 1 && typeof o.nodeName==="string"
const getEl = el => isEl(el) ? el : 
	jqCheck(el)? el[0]: 
	typeof el=='string'? (('#'==el.charAt(0)|| el.indexOf('.')!=-1)? $(el)[0]: document.getElementById(el)): null;
const getJq = el => isEl(el) ? $(el) : 
	jqCheck(el)? el: 
	typeof el=='string'? (('#'==el.charAt(0)|| el.indexOf('.')!=-1)? $(el): $(document.getElementById(el))): null;

Object.prototype.update = function(...args) { return Object.assign(this,...args) }
Object.prototype.copy = function(...args) { return Object.assign({},this,...args) }
Object.prototype.isset = function(name) { return this.hasOwnProperty(name) }
Object.prototype.cmp = function(name, value) { return this.isset(name) && this[name]===value }

String.prototype.lpad = function(padLength, padString) {
    let arrTxt = this;
	if(!padString) padString='0';
    while (arrTxt.length < padLength)
        arrTxt = padString + arrTxt;
    return arrTxt;
}
String.prototype.rpad = function(padLength, padString) {
    let arrTxt = this;
	if(!padString) padString='0';
    while (arrTxt.length < padLength)
        arrTxt += padString;
    return arrTxt;
}
/*
String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g,"") }
String.prototype.ltrim = function() { return this.replace(/^\s+/,"") }
String.prototype.rtrim = function() { return this.replace(/\s+$/,"") }
*/
function getByteLength(s) {
	if(s != undefined && s != "") {
		for(b=i=0;c=s.charCodeAt(i++);b+=c>>11?3:c>>7?2:1);
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
function getElRect(el) {
	const target = getEl(el)
	if(target) {
		return target.getBoundingClientRect()
	}
}
const setScrollTop = (parent, target) => {
	const a = getJq(parent), b=getJq(target)
	const yp = $(b).offset().top - $(a).offset().top
	const sp = yp + a.scrollTop()
	a.scrollTop(sp)
}
const getOffsetParent = target => {
	const a=getJq(target)
	if( !a[0] ) return {top:0,left:0}
	const tag = a.offsetParent().prop('tagName')
	if( tag=='HTML' ) {
		return a.offset()
	}
	let {top,left} = a.offset()
	let p=a.parent()
	while( p.prop('tagName')!='BODY' ) {
		const o=p.offset()
		top+=o.top
		left+=o.left
		p=p.parent()
	}
	return {top,left}
}
const getElOffset = (el, checkRect) => {
	const target=getEl(el)
	if( !target ) return;
	if( target.getBoundingClientRect ) {
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
	let left=0, top=0, width=aa.offsetWidth, height=aa.offsetHeight;
	while (aa) {
		left = c + parseInt(aa.offsetLeft);
		top = e + parseInt(aa.offsetTop);
		aa = aa.offsetParent
	}
	return checkRect? {top,left,width,height} : { top, left }
}

const screenSize = () => ({ width:$(window).width(), height:$(window).height() })

const getLocalId = (prefix, arr) => {
	const idx = arr.length+''
	return prefix+'_'+idx.lpad(2,'0')
}
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
const apiGet = async (url, param) => {
	if( isObj(param) ) {
		const query = Object.keys(param).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(param[k]) ).join('&')
		url += (url.indexOf('?')==-1 ? '?':'&') + query
	}
	const res = await fetch(url)
	return res.text()
}
const tagBtn3d = (target, text, style) => {
	if( style ) loadStyle(style)
	const el = $('<button type="button" class="btn3d"/>').css({marginLeft:10}).appendTo(getJq(target))
	$('<div class="top">').html(text).appendTo(el)
	$('<div class="bottom">').appendTo(el)
	return el
}
const loadPage = (app, url) => {
	if( !jqCheck(app.contentEl) ) return clog(`@@loadPage 부모 content 미정의  ${url} 페이지 로드오류`)
	apiGet(cf.devHost+url, res => app.createPage(res.pageId, app.contentEl, res) )
}
class Apps {
	constructor(target) {	
		this.apps = []
		this.targetEl = getJq(target)
		this.currentApp = null
		this.menus = null
		this.tabs = null
		this.currentAddCode = null
	}
	getApp(code) {
		return this.apps.find(cur=>cur.code==code)
	}
	createApp(code, appInfo) {
		if( !jqCheck(this.targetEl) ) return clog(`@@ Apps 타겟객체 미정의`)
		if( this.getApp(code) ) return clog(`@@ Apps ${code} 앱이 이미 추가됨`)
		const sty = cf.styles
		const appStyle = {}
		if( isObj(appInfo) ) {
			if(appInfo.isset('color')) appStyle.color=appInfo.color
			if(appInfo.isset('bg')||appInfo.isset('background')) appStyle.background=appInfo.background||appInfo.bg
			// background: getRandomColor()
		} else {
			appInfo={}
		}
		clog('appStyle===>', appStyle, appInfo)
		const container = $('<div/>').css(appStyle.update(sty.full, sty.flexcenter)).appendTo(this.targetEl)
		const app = new App(container, code, appInfo )
		this.apps.push(app)
		if( this.currentAddCode==null ) {
			const me = this
			this.currentAddCode = code
			setTimeout(()=> {
				me.setCurrentApp(me.currentAddCode)
				me.currentAddCode = null
			}, 100)
		} else {
			this.currentAddCode = code
		}
		return app
	}
	setCurrentApp(code) {
		const app = this.getApp(code)
		if( app ) {
			this.apps.map(cur=>cur.hideApp())
			this.currentApp = app
			app.showApp()
		} else {
			clog(`@@ Apps.setCurrentApp ${code} 앱오류`)
		}
	}
	reload() {
		if( !this.currentApp ) return
		this.currentApp.reload()
	}
}

class App {
	constructor(container, code, appInfo) {
		this.pages=[]
		this.containerEl = container
		this.contentEl = null
		this.code = code
		this.name = appInfo.name||''
		this.appInfo = appInfo
		this.currentAddPageId = null
		this.currentPage = null
		this.currentPopup = null
		this.layout = appInfo.isset('layout') ? this.makeLayout(appInfo.layout): null
	}
	
	deleteLayout() {
		
	}
	makeLayout(layoutInfo) {
		if(this.layout ) {
			this.deleteLayout()
		}
		const layout = new LayoutTree(this.containerEl, layoutInfo, null, this.contentEl)
		if( layout.contentUse ) {
			this.contentEl = layout.el
		}
		return layout
	}
	getPage(pageId) {
		return this.pages.find(cur=>cur.id==pageId)
	}
	createPage(pageId, targetEl, pageInfo) {
		if( this.getPage(pageId) ) return clog(`@@createPage ${pageId} 페이지 이미 추가됨`)
		const page = new Page(pageId, targetEl, pageInfo)
		this.pages.push(page)
		if( this.currentAddPageId==null ) {
			const me = this
			this.currentAddPageId = pageId
			setTimeout(()=> {
				me.setCurrentPage(me.currentAddPageId)
				me.currentAddPageId = null
			}, 100)
		} else {
			this.currentAddPageId = pageId
		}
	}
	setCurrentPage(pageId, reload) {
		const page = this.pages.find(cur=>cur.id==pageId)
		if( page ) {
			this.pages.map(cur=>cur.hidePage())
			this.currentPage = page
			page.showPage()
			if(reload) {
				page.rendor()
			}
		} else {
			clog(`@@ Apps.setCurrentPage ${pageId} page 오류`)
		}
	}
	hideApp() {
		if(!jqCheck(this.contentEl)) return clog('@@ app hideApp 대상오류', this.dump())
		this.contentEl.hide()
	}
	showApp() {
		if(!jqCheck(this.contentEl)) return clog('@@ app showApp 대상오류', this.dump())
		this.contentEl.show()
	}
	reload() {
		if( this.currentPopup) {
			this.currentPopup.reload()
		}
		if( this.currentPage ) {
			this.currentPage.reload()
		}
	}
	
 
	dump() {
	
	}
}
class Page {
	constructor(pageId, targetEl, pageInfo) { 
		const sty = cf.styles
		const css = {}.update(sty.flexCenter, sty.full)
		if(pageInfo.css ) css.update(pageInfo.css) 
		this.id = pageId
		this.info = pageInfo
		this.pageEl = $('<div/>').css(css).appendTo(targetEl)
		this.targetEl = targetEl
		this.layout = null
		this.contentEl = null
		if( isObj(pageInfo.layout) ) this.makeLayout(pageInfo.layout)
	}
	deleteLayout() {
		
	}
	makeLayout(layoutInfo) {
		if(this.layout ) {
			this.deleteLayout()
		}
		this.layout = new LayoutTree(this.pageEl, layoutInfo, null, this)
		this.contentEl = layout.findContent()
		clog('@page make layout => ', this)
	}
	findEl(selector) {
		return this.layout.findEl(selector)
	}
	showPage() {
		this.pageEl.show()
	}
	hidePage() {
		this.pageEl.hide()
	}
	reload() {
		
	}
}
	
class LayoutTree {
	constructor(parentEl, layoutInfo, parentLayout, target) {
		this.target = target
		this.parentLayout = parentLayout
		this.parentEl = parentEl
		this.layoutInfo = layoutInfo
		this.el = null
		this.contentUse = layoutInfo.contentUse||false
		this.childLayout = []
		this.createLayout(layoutInfo)
	} 
	createLayout(layout) {
		const tag = layout.tag || 'div'
		const sty = layout.style || {}
		this.el = $('<'+tag+'/>').css(sty).data('layout-tree',this).appendTo(this.parentEl)
		if( layout.className) this.el.attr('class', layout.className)			
		if( layout.page || layout.cmp('type','content')) {
			this.el.data('type', 'content')
		}
		if( Array.isArray(layout.children) ) {
			for( let cur of layout.children ) {
				const obj = new LayoutTree(this.el, cur, this, this.target)
				this.childLayout.push(obj)
			}
		}
	}
	findEl(selector) {
		return this.el.find(selector)
	}
	findContent() {
		if( this.el.data('type')=='content' ) return this.el
		const result = this.childLayout.filter(cur=> cur.el.data('type')=='content')
		return result && result.length? result[0] : this.el
	}
}

function getCss() {
	const sty = cf.styles
	const css = {}
	for(v of arguments) {
		if( typeof v=='string') {
			if(sty.isset(v)) {
				Object.assign(css,sty[v])
			} 
		} else if( isObj(v)) {
			Object.assign(css,v)
		}
	}
	return css
}
const cf = {
	apps: null
	, devMode: false 		// 개발자모드
	, styles:{				// 공통스타일
		full:{width:'100%',height:'100%'},
		flexCenter: {display:'flex', alignItems:'center', justifyContent:'center' },		
		hbox: {display:'flex', flexDirection:'row', width:'100%' },
		vbox: {display:'flex', flexDirection:'column', height:'100%' }
	}
	, devHost: 'http://localhost'
	, apiHost: 'http://localhost:8000'
}
