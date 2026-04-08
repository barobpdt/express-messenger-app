initService() {
	// conf('cf.useWatch', true, true)
	// conf('cf.useDebug', true, true)
	// include('classes/common/baro-services')
	initConfig()
	include('@modules#baro.common.html')
	startGlobalTimer()
	getServiceNode('baro', 'apps')
	getServiceNode('baro', 'modules')
	getServiceNode('baro', 'tools')	
	initModules()
	initWidgetConfig()
	// initWas()
	// initWebsocket()
	Cf.debug(true,"data/logs")
	include("@apps#user_module")
	include("@apps#SourceRun")	
	page = page("SourceRun:main")
	page.open()	
	// include('@tools#CanvasTest')
}
initConfig() {
	print("설정초기화 처리")
	pathLib=conf('path.libs')
	not(isFolder(pathLib)) {
		conf('path.libs','C:/bpdt/project/template/baro_config',true)
	}
	not(isFolder(conf('path.mdc'))) {
		conf('path.mdc',"$pathLib/mdc",true)
	}
	include('@mdc#mdc_common')
}

_node_user_func(source) {
	fn=Cf.funcNode('parent')
	funcIndex = _nodeUserfuncIndex_++;
	type=source.findPos('/').trim()	
	switch(type) {
	case info:
		return _arrayvar_make_info(source, fn)
	case filter: 
		print("filter 함수구현중");
	case map: 
		print("map 함수구현중");
	default:
	}
}
_arrayvar_make_info(s,fn) {
	ss=''
	arr=[]
	while(s.valid(),n) {
		vnm=s.findPos(',').trim()
		v=this.get(vnm)
		arr.add("$vnm=$v")
	}
	return arr.join(', ')
}

_arr(code) {
	not( code ) {
		return Cf.array();
	}
	if(typeof(code,'bool')) {
		idx=global().incrNum('_arr.presist_idx')
		a=global().addArray('_arr.presist')
		if(idx==256) {
			idx=0
			global().set("_arr.presist_idx",1)
		}
		if(idx<a.size()) {
			arr=a.get(idx).reuse()
		} else {
			arr=a.add(Cf.newArray())
		}
	} else {
		arr=global().addArray("_arr.$code")
	}
	return arr;
}
_node(code) {
	not( code ) {
		return Cf.node();
	}
	if(typeof(code,'bool')) {
		idx=global().incrNum('_node.presist_idx')
		a=global().addArray('_node.presist')
		if(idx==256) {
			idx=0
			global().set("_node.presist_idx",1)
		}
		if(idx<a.size()) {
			node=a.get(idx).reuse()
		} else {
			node=a.add(Cf.newNode())
		}
	} else {
		node=Cf.rootNode("_node.$code", true)
	}
	not(node.@tag ) node.@tag = code
	return node;
}
_sv() {
	fn=Cf.funcNode('parent')
	switch(args().size()) {
	case 1:
		args(&s)
		serviceNode=fn.get('@this')
	case 2:
		args(serviceNode, &s)
	default:
	}
	not(typeof(serviceNode,'node')) return print("@@sv 함수 서비스노드 미정의")
	cur=serviceNode
	while(s.valid()) {
		not(s.ch()) break;
		name=s.move()
		cur=cur.get(name)
		c=s.ch()
		if(c.eq('.')) {
			s.incr()
			continue;
		}
		break;
	}
	return cur;
}
baseConfig(service,base) { 
	if(service) {
		serviceNode=getServiceNode(service)
	} else {
		projectInfo=object("baro.serviceProjectInfo")
		serviceNode=projectInfo.@currentService
	}
	not(base) {
		splitSep(this.@baseCode,':').inject(base,id)
		not(base) return print("@@ baseConfig base코드 미정의", this);
	}
	not(serviceNode) return print("@@ baseConfig serviceNode 미정의", service, base);
	node=serviceNode.get(base)
	not(node) {
		node=serviceNode.addNode(base)
	}
	return node;
}
catchError() {
	err=Cf.error() not(err) return false;
	print("## catch error : $err")
	return true;
}
findParentNode(cur, field, val) {
	not(typeof(cur,'node')) return;
	asize=args().size()
	check=func(cur) {
		if(asize==3) {
			if(cur.cmp(field,val)) return true;
		} else {
			if(cur.isVar(field)) return true;
		}
	};
	p=cur
	while(isValid(p)) {
		if(check(p)) return p;
		p=p.parentNode()
	}
	return;
}
findField(root, field, val) {
	not(typeof(root,'node','array')) return;
	asize=args().size() 
	while(cur, root) {
		if(asize==3) 
			if(cur.cmp(field,val)) return cur;			
		else 
			if(cur.isVar(field)) return cur;
		if(cur.childCount()) {
			if(typeof(root,
			'array')) continue;
			if(asize==3) 
				sub=findField(cur,field,val)
			else
				sub=findField(cur,field)
			if(sub) return sub;
		}
	}
	return;
}
startWith(&s) {
	not(s.ch()) return false;
	arr=args()
	while(v, arr, n) {
		if(n) {
			if(s.start(v)) return true;
		}
	}
	return false;
}
findTag(root, tag) {
	while( cur, root ) {
		if( cur.cmp("tag", tag) ) return cur;
		if( cur.childCount() ) {
			find=findTag(cur,tag);
			if( find ) return find;
		}
	}
	return null;
}
findId( root, id) {
	while(cur, root) {
		if(cur.cmp("id",id))return cur;
		if( cur.childCount() ) {
			find=findId(cur,id);
			if( find ) return find;
		}
	}
	return;
}
recalc(total, info) {
	arr=_arr()
	return arr.recalc(total, info)
}
range(sp,ep) {
	a=_arr()
	while(n=sp, n<ep, n++) a.add(n)
	return a;
}
checkTick(tick, duration) {
	not(tick) return false;
	not(duration) duration=1000
	dist=System.tick() - tick;
	return dist.gt(duration);
}
setArray(arr, idx, node) {
	not(typeof(idx,"num")) return arr;
	if(idx.lt(arr.size()) ) {
		arr.set(idx, node);
	} else {
		arr.add(node);
	} 
	return arr;
}
log(param) {
	self=Cf.funcNode().get('@this') not(self) self=_node('logs')
	fn=Cf.funcNode('parent')
	msg=str(param,fn,self)
	while(c,args(1), n) {
		idx=n+1;
		msg.add("\n\tparam$idx: $c")
	}
	date=System.date('hh:mm:ss')
	func=call('logAppend')
	if(func) {
		logAppend('logs').append("logs $date>> $msg")
		if(global().flag(0x40000)) {
			print("log>>$msg")
		}
	} else {
		print("log>>$msg")
	}
	if(msg.start('error::')) return print("$msg")
}
parseJson(node,&str,checkStr) {
	node.removeAll(true)
	node.parseJson(str)
	if(checkStr) {
		return json(node,'data');
	} else {
		return node;
	}
}

event(obj, eventName, fc, target, reset) {		
	not(typeof(obj,'node')) return print('@@ event 객체 오류', obj, fc) 
	fn = obj.get(eventName)
	if( typeof(fn,'func')) {
		not(reset) {
			print("＠＠ $eventName 함수가 이미등록되었습니다")
			return fn;
		}
	}
	fcType = typeof(fc)
	not( fcType.eq('funcRef') ) {		
		if(fc) log("@@ job event  함수타입 오류 (타입:$fcType)")
		return;
	}
	fn=Cf.funcNode(fc, obj)
	if( typeof(target,'node')) {
		fn.set('@sender', obj);
		fn.set('@this',target)
	}
	obj.set(eventName, fn)
	log('${obj.tag} $eventName 이벤트 등록')
	return fn;		
}
 
toLong(s) {
	a=when(typeof(s,'number'),"$s",s)
	return a.toLong()
}
toDouble(s) {
	a=when(typeof(s,'number'),"$s",s)
	return a.toDouble()		
}
checkFunc(functionName) {
	return object('@inc.userFunc').get(functionName);
}
checkModule(param) {
	if(typeof(param,'node')) {
		args(obj, moduleName)
		
		obj.inject(@moduleList)
		if( isValid(moduleList) && moduleList.find(moduleName) ) return true;
		return false;
	} else {
		args(moduleName)
		return object('user.subfuncMap').get(moduleName);
	}
}

getObjectInfo(name) {
	info={}
	fnm="${name}."
	root=Cf.getObject()
	while(k, root.keys()) {
		if(k.start(fnm)) {
			info.set(k, root.get(k) )
		}
	}
	return info;
}
isObject(obj) {
	if(typeof(obj,'node','array')) {
		return true;
	}
	if(typeof(obj,'string')) {
		splitSep(obj,'.').inject(a,b)
		return Cf.getObject(a,b);
	}
	return false;
}
isEventName(&s) {
	if(s.start('on',true)) {
		c=s.ch()
		if(c.is('upper')) return true;
	}
	return false;
}
isNull(s) { 
	if(typeof(s,'bool','number')) return false;	
	return when(s,false,true) 
}
cmdObject(id) {
	if(id) return Baro.process(id);
	while(n=0,32) {
		cmd=Baro.process("cmd-$n")
		not(cmd.@c) return cmd;
		status=cmd.@jobStatus not(status) status='finish'
		if( status.eq('finish') ) {
			return cmd;
		}
	}
	return Baro.process();
}
webObject(id) { 
	if(id) return Baro.web(id) 
	while(n=0,32) {
		web=Baro.web("web-$n")
		if(web.is('run')) {
			continue;
		}
		status=web.@jobStatus not(status) status='finish'
		if( status.eq('finish') ) {
			return web;
		}		
	}
	return Baro.web();
}
fileObject(id) {
	if(id) return Baro.file(id);
	while(n=0,16) {
		file=Baro.file("file-$n")
		if(file.open()) continue;
		return file;
	}
	return Baro.file();
}
workerObject(id) {
	if(id) return Baro.worker(id);
	while(n=0,16) {
		worker=Baro.worker("worker-$n")
		if(w.@canllback) continue;
		return worker;
	}
	return Baro.worker();
}

checkVar(name) {
	not(typeof(name,'string')) return;
	fn=Cf.funcNode('parent')
	val=fn.get(name)
	if(isValid(val)) return this.var("$name", val);
	fn.set(name, this.var("$name"))
}
checkValid(s) {
	not(s) return null;
	if(typeof(s,'array') ) {
		not(s.size()) return null;
	}
	return s;
}

isValid(s,idx) {
	not(s) return false;
	if(typeof(s,'array') ) {
		asize=s.size()
		if(typeof(idx,'num')) {
			if(idx.lt(0) || idx.ge(asize)) return false;
		} else {
			not(asize) return false;
		}
	}
	return true;
}
notValid(s) {
	return when(isValid(s),false,true)
}
isColor(c) {
	if(typeof(c,'string')) {
		if(c.ch('#')) return true;
	}
	return when(typeof(c,'color'), true, false)
}
notValid(s) { return when(isValid(s),false,true) }
isFullpath(s) {
	not(s) return false;
	c=s.ch(1)
	if(c.eq(':')) {
		return true;
	}
	return false;
}
splitSep(&s, sep) {
	arr=[];
	not(sep) sep=',';
	while(s.valid()) {
		val=s.findPos(sep).trim();
		arr.add(val);
	}
	return arr;
}
varValue(k, fn, node) {
	not(fn) fn=Cf.funcNode('parent') 
	if(fn.isset(k)) {
		return fn.get(k);
	}
	not(node) {
		node=fn.get('@this')
	}
	if(typeof(node,'node')) {
		if(node.isVar(k)) {
			return node.get(k);
		}
		fn=Cf.funcNode(node)
		if(fn && fn.isset(k)) {
			return fn.get(k);
		}
	}
	print("@@ varValue [$k] 변수 미정의");
	return;
}
getVarValue(&s,fn,node) {
	not(typeof(s,'string')) return;
	isVar = func(s) {
		c=s.next().ch() not(c) return true;
		while(c.eq('.')) c=s.next().ch()
		if(c.eq('?',':')) return true;
		return when(c,false,true);
	};
	if(s.start('conf.',true)) {
		return conf(s.trim())
	} 
	not(fn) fn=Cf.funcNode('parent')
	not(node.isVar(s)) {
		return eval(s, fn)
	} 
	k=s.move()
	val=varValue(k,fn,node)
	c=s.ch()
	not(c) return val;
	while(c.eq('.')) {
		not(typeof(val,'node')) {
			return;
		}
		k=s.incr().move()
		val=val.get(k)
		c=s.ch()
	}
	if(c.eq('?')) {
		s.incr()		
		c=s.ch()
		if(c.eq('[')) {
			ss=s.match(1)
			not(val) {
				c=s.ch()
				if(c.eq(':')) {
					c=s.incr().ch()
					if(c.eq('[')) ss=s.match(1) else ss=s					
				} else {
					ss=''
				}
			}			
		} else {
			ss=s.findPos(':')
			not(val) {
				ss=s
			}
		}
		val=''
		if(ss) val=str(ss,fn,node)
	}
	else if(c.eq(':')) {
		type=s.incr().move()		
		if(type.eq('int')) {
			if(typeof(val,'num')) {
				val=val.toInt()
			} else {
				val=0
			}
		} else if(type.eq('json')) {
			if(typeof(val,'node')) {
				val=json(val)
			} else {
				val='{}'
			}
		}
	}
	return val;
}

str(&s, fn, node) {
	if(typeof(fn,'node')) {
		node=fn
		fn=null
	} 
	not(fn) {
		fn=Cf.funcNode('parent')
	}
	not(typeof(node,'node')) {
		node=fn.get('@this')
	}
	ss=''
	while(s.valid()) {
		left = s.findPos('$')
		ss.add(left)
		c=s.ch() not(c) break;
		if(c.eq('{')) {
			src=s.match(1)
			if(typeof(src,'bool')) break;
			ss.add(getVarValue(src,fn,node))
			continue;
		}
		k=s.move()
		c=s.ch(0)
		v=varValue(k,fn,node)
		if(isValid(v)) ss.add(v)
	}
	return ss;
}
left(&str, sep) {
	not(sep) sep=',';
	return str.findPos(sep).trim();
}
right(&str, sep) {
	not(sep) sep='.';
	if( str.find(sep)) str.findLast(sep)
	return str.trim();
}
format(&s, param) {
	rst=''
	arr=args(1), map=null
	if(typeof(param,'func')) {
		args(fn, map, params)
		if(typeof(params,'array')) arr=param
	} else if(typeof(param,'array')) {
		arr=param
	} else if(typeof(param,'node')) {
		map=param
		fn=Cf.funcNode('parent')
	}
	while(s.valid()) {
		left=s.findPos('#{')
		rst.add(left)
		not(s.valid()) break;
		key=s.findPos('}').trim()
		if(typeof(key,'num')) {
			val=arr.get(key)
		} else {
			if( map && map.isset(key)) {
				val=map.get(key)
			} else {
				val=fn.get(key)
			}
		}
		rst.add(val)
	}
	return rst;
}

confSearch(&s) {
	not(s.ch()) return;
	sp=s.cur()
	c=s.next().ch()
	while(c.eq('#')) {
		c=s.incr().next().ch()
	}
	a=s.trim(sp, s.cur(), true)
	db=Baro.db('config')
	filter=''
	if(a.eq('*') ) {
		c=s.ch()
		not(c.eq('.')) return print("@@ error conf list $a 하위 정보 오류");
		b=s.incr().trim()
		if(b.find('%')) {
			filter = "and cd like '$b'"
		} else {
			filter = "and cd='$b' "
		}
	} else {
		if(c.eq('.')) {
			b=s.incr().trim()
			if(b.eq('*')) {
				filter = "and grp='$a'"
			} else {
				filter = "and grp='$a' and cd like '$b'"
			}
		} else {
			filter = "and grp='$a'"
		}
	}
	node=db.fetchAll("select grp, cd, data from conf_info where 1=1 $filter")
	ss='', nl=conf('cf.newline')
	while(cur, node) {
		cur.inject(grp, cd, data)
		info = getLine(data)
		line=str('$grp.$cd $info')
		ss.add(line, nl)
	}
	return ss;
}
localFunc(func) {
	Cf.rootNode().set('@inlineMode','')
	root=Cf.getObject()
	not(args().size()) return root.@localFunc;
	root.@localFunc=func
	return func;
}
global(code) {
	not(code) return Cf.rootNode();
	return Cf.rootNode().addNode(code);
}
object(code, newCheck) {
	not(code) return Cf.rootNode();
	if(code.find('.')) {
		code.split('.').inject(a,b);
	} else {
		a='object'
		b=code
	}
	return Cf.getObject(a,b,true);
}
checkError(msg) {
	err=Cf.error()
	if(err) {
		print("@@ $msg [error]: $err");
		return true;
	}
	return;
}
isFunc(&s) {
	s.ch() not(c) return;
	if(c.eq('@')) s.incr()
	c=s.next().ch()
	while(c.eq('-','.')) c=s.incr().next().ch()
	return when(c.eq('('), true)
}
getLine(&s) {
	not(s) return '[line blank]';
	not(typeof(s,'string')) return "$s";
	s.ch()
	return s.findPos("\n").trim();
}
getLineCount(&s) {
	cnt=0;
	while(s.valid()) {
		line=s.findPos("\n").trim()
		if(line) cnt++;
	}
	return cnt;
}
lastLine(&s) {
	if( s.find("\n")) {
		left=s.findLast("\n")
		return left.right();
	} else if(s) {
		return s;
	}
}
jsValue(s) {
	ss=''
	if(typeof(s,'string')) {
		if(typeof(s,'num')) {
			return s;
		} else {
			return Cf.jsValue(s)
		}
	} else if(typeof(s,'bool','number')) {
		return s
	}
	return Cf.jsValue("$s")
}
printAll(prefix) {
	not(prefix) prefix='printAll'
	fn=Cf.funcNode('parent')
	s=fn.get()
	s.ref()
	ss=">> $prefix {\n\t"
	a=_arr()
	while(s.valid()) {
		line=s.findPos("\n").trim() not(line) break;
		a.add(line)
	}
	ss.add(a.sort().join("\n\t"))
	ss.add("\n}\n")
	log(ss)
}
strEncode() {
	s=''
	while(v,args()) {
		s.add(v)
	}
	return s.encode();
}
strDecode(s) {
	return s.decode()
}
strJoin() {
	ss=''
	a=args()
	while(c,a) {
		if(typeof(c,'array')) {
			ss.add(c.join(''))
		} else {
			ss.add(c)
		}
	}
	return ss;
}
arrJoin(a) {
	ss='['
	while(c,a) ss.add(Cf.jsValue(c))
	ss.add(']')
	return ss;
}
arrRemoveLast(a) {
	not(typeof(a,'array')) return false;
	not(a.size()) return false;
	last=a.size()-1
	a.remove(last)
	return a;
}
getDownloadName(filename) {
	not(isFile(filename)) return filename; 
	while(n=0, 256) {		
		filePathInfo(filename).inject(path,fnm,name)
		ext=right(fnm,'.')
		nm = name
		nm.ref()
		checkNum=false;
		if(nm.find('-')) {
			a=nm.findLast('-')
			b=a.right().trim()
			if(typeof(b,'num')) {
				checkNum=true;
				name=strJoin(a,'-',b+1)
			}
		}
		not(checkNum) {
			name.add('-1')
		}
		if(ext) {
			name.add(".$ext")
		}
		filename=pathJoin(path,name)
		not(isFile(filename)) return filename;
	}
	return filename;
}
typeVal(&s) {
	return when(typeof(s,'string'), s.typeValue(), s);
}	
valueOf(s, convert) {
	if(typeof(s,'string')) {
		return s.typeValue();
	} 
	if(convert) {		
		if(typeof(s,'node','array')) {		
			if(typeof(s,'array')) {
				node=_node()
				node.array=s
			} else {
				node=s
			}
			return json(node,true,false)
		}
		return "$s";
	} else {
		return s;
	}
}
thisAppend(varName, value) {
	s=this.get(varName) not(s) s=''
	s.add(value)
	this.set(varName,s)
	return s;
}
getVarName(&s) {
	not(typeof(s,'string')) return;
	ss='', upper=false
	while(n=0,s.size()) {
		c=s.ch(n) not(c) break;
		if(c.eq('_','-')) {
			upper=true
			continue;
		}
		if(c.eq('/')) {
			c='_'
			continue;
		} 
		if(c.eq(' ') || c.is('oper')) {
			break;
		}
		if(upper){
			ss.add(c.upper())
			upper=false
		} else {
			ss.add(c)
		}
	}
	return ss;
}
getStyleKeyName(&s) {
	not(typeof(s,'string')) return;
	ss='', upper=false
	while(n=0,s.size()) {
		c=s.ch(n)
		if(c.is('upper')) {
			if(n) ss.add('-',c.lower())
		} else {
			ss.add(c)
		}
	}
	return ss;
}
getDbFieldName(&s) {
	not(typeof(s,'string')) return;
	ss='', upper=false
	while(n=0,s.size()) {
		c=s.ch(n)
		if(c.is('upper')) {
			if(n) ss.add('_',c.upper())
		} else {
			ss.add(c.upper())
		}
	}
	return ss;
}  
propValue(&prop, key, checkOnly) {
	while(prop.valid()) {
		not(prop.find(key)) return;
		left=prop.findPos(key)
		c=prop.ch() 
		if(checkOnly) {
			if(c.is('alphanum')) continue;
			c=left.ch(-1)
			if(c.is('alphanum')) continue;
			return true;
		}		
		not(c) break;		
		if(c.eq('=',':') ) {
			c=left.ch(-1)
			if(c.is('alphanum')) continue;			
			c=prop.incr().ch();
			if(c.eq()) {
				val=prop.match().value();
			} else {
				val=prop.findPos(" ,\t\n",4).trim();
			}
			return val;
		}
	}
	return;
}

stripComment(&s, mode) {
	not(mode) mode=1;
	rst='';
	while(s.valid()) {
		if(mode.eq(1)) {
			left=s.findPos("/*",1,1);
			s.match();
		} else if(mode.eq(2)) {
			left=s.findPos("//",1,1);
			s.findPos("\n");
		} else if(mode.eq(3)) {
			left=s.findPos("<!--",1,1);
			s.match("<!--","-->");
		} else if(mode.eq(4)) {
			left=s.findPos("--",1,1);
			s.findPos("\n");
		}
		rst.add(left);
		not(s.valid()) break;
	}
	return rst;
}
stripJsComment(&s) {
	rst=stripComment(s,1);
	return stripComment(rst,2);
}

filePathInfo(path) {
	a=_arr()
	b=path.replace('\','/')
	s=b.ref()
	path=s.findLast('/')
	if(path) {
		filename=path.right()
	} else {
		path=b, filename=b
	}
	a.add(path,filename)
	name=filename.findLast('.')
	a.add(name)
	return a;
}
fileTime(fullpath) { return Baro.file().modifyDate(fullpath) }
isFile(fileName) { return Baro.file().isFile(fileName) }
isFolder(fullPath, makeCheck) {
	fo=Baro.file(); 
	folder=fo.isFolder(fullPath);
	not(folder) {
		if(makeCheck) {
			fo.mkdir(fullPath, true);
			folder=fo.isFolder(fullPath);
		}
	}
	return folder;
}
isFullPath(path) {
	c=path.ch(1)
	if(c.eq(':')) return true;
	return false;
}
pathJoin() {
	ss=''
	while(a,args(), n) {
		not(typeof(a,'string')) return print("pathJoin 오류 메게변수 오류 ",args())
		if(a.find('\')) a=a.replace('\','/')
		c=a.ch(-1)
		if(c.eq('/')) a=a.value(0,-1)
		if(n) {
			ss.add('/')
		}
		c=a.ch()
		if(c.eq('/')) {
			ss.add(a.value(1))
		} else {
			ss.add(a)
		}
	}
	return ss;
}
relativePath(base, path) {
	if(base ) {
		base=base.trim();
	} else {
		base=System.path();
	}
	not(path ) return base;
	while( path.ch('.') ) {
		ch=path.ch(1);
		// 경로 ./ 처리
		if( ch.eq('/') ) {
			path=path.value(2);
		} 
		// 경로 ../../ 처리
		else if( ch.eq('.') ) {
			ch=path.ch(2);
			if( ch.eq("/") ) {
				path=path.value(3);
				not( base.find("/") ) return print("[relativePath] 기준경로 오류 (base:$base)");
				base=base.findLast("/").trim();
			} else {
				return print("[relativePath] 경로오류 (path:$path)");
			}
		}
	}
	return pathJoin(base,path);
} 

fileRead(path) {	
	fo=Baro.file('read'); // 파일객체 생성
	not(fo.open(path,'read')) {
		return print("readFile open error (경로 $path)");
	}
	src = fo.read();
	fo.close()
	return src;
}
fileReadAll(path,offset) {
	return Baro.file().readAll(path, offset);
}
fileSave(path, buf) {
	return Baro.file().writeAll(path, buf);
}
fileWrite(path, buf) {
	fo=Baro.file('save');
	if(path.find('/')) {
		str=path.findLast('/').trim();
	} else {
		str=path;
	}
	not(fo.isFolder(str)) {
		fo.mkdir(str, true);
	}
	not(fo.open(path,"write")) return print("writeFile open error (경로 $path)");
	fo.write(buf);
	fo.close();
} 
fileDelete(path) {
	fo=Baro.file();
	if(isFile(path)) {
		result=fo.delete(path);
	} else if(isFolder(path)) {
		result=fo.rmDir(path);
	}
	return result;
}
fileMove(srcFile, destFile, overwrite, mode, modifyDate) {
	not(srcFile && destFile) {
		return print("fileMove 파일 이동 오류 파일명 미정의", srcFile, destFile);
	}
	not(isFile(srcFile)) {
		return print("fileMove 파일 이동 오류 $srcFile 파일 미존재");
	}
	if(isFile(destFile)) {
		if(overwrite) {
			not( fileDelete(destFile) ) {
				return print("fileMove 파일 이동 오류 $destFile 파일 삭제 오류");
			}
		} else {
			return print("fileMove 파일 이동 오류 $destFile 파일이 존재합니다");
		}
	}
	if(mode.eq('command')) {
		of=conf('cf.os') not(os) os='windows'
		if( os.eq('windows') ) {
			a=srcFile.replace("/","\\"), b=destFile.replace("/","\\")
			command=f[move /Y "$a" "$b"]
			cmd=Baro.process('common')
			cmd.modifyDate=modifyDate
			print(">> fileMove command:$command")
			runCommand(command, function(a,b) { 
				not(b) return;
				if(this.modifyDate) Baro.file().timeStamp(destFile,this.modifyDate)
				print("파일이동:$a") 
			})
		}
		result = true
	} else {
		result = Baro.file().move(srcFile, destFile)
	}
	return result;
}
/*
페이지처리 함수
*/
include(name, checkReg) {
	serviceNode=null
	if( name.ch('#')) {		
		service='tools'
		name=name.value(1)
		path=conf("path.$service")
		not(name.find('.')) name.add('.html')
		fullname="$path/$name"
	} else if( name.find('#') ) {
		splitSep(name,'#').inject(service,name)
		if(service.ch('@')) {
			service=service.value(1)
			path=conf("path.$service")
			not(isFolder(path)) {
				return print("@@include 오류 서비스 $service 에 등록된 폴더가 없습니다 $path")
			}			
			not(name.find('.')) name.add('.html')
			fullname="$path/$name"
		} else {
			fullname=name
		}
		serviceNode=getServiceNode(service)
		not(serviceNode) {
			serviceNode=getServiceNode('baro',service)
		}
	} else {
		service=null
		not(name.find('.')) {
			name.add('.js')
		}
		path = conf('include.path') not(path) path=System.path()
		fullname = "$path/$name"
	}
	
	not( isFile(fullname) ) {
		return print("@@include 오류 ($fullname 파일이 없습니다)")
	}	
	filePathInfo(fullname).inject(folder,null,fname)
	if(serviceNode) {
		// 파일변경시 자동반영체크
		if(checkReg) {
			regServiceFile(service, fullname)
		}
		name="$service::$fname"
	}
	print("@@ include fullname: $fullname")
	map=object('map.include') 
	modify=fileTime(fullname)
	if( map.get(name)==modify) {
		print("include 경로 $name 이미 등록", modify)
		return;
	}
	prevName = Cf.rootNode('@funcInfo').get('includeFileName') 
	not(prevName) prevName=''
	Cf.rootNode('@funcInfo').set('includeFileName', name)	
	map.set(name, modify)
	src=fileRead(fullname)
	parseSource(stripJsComment(src), fname, serviceNode)
	Cf.rootNode('@funcInfo').set('includeFileName', prevName)
}
pageLoad(&src, base, pageId) {
	if(base.find(':')) {
		splitSep(base,':').inject(base, pageId)
	} else {
		not(base) base='test'
		not(pageId) pageId='main'
	}
	source =str( '<widgets base="$base">$src</widgets>')
	Cf.rootNode('@funcInfo').set('pageBase', base)
	Cf.sourceApply(source)
	Cf.rootNode('@funcInfo').set('pageBase', '')
	return page("$base:$pageId");
}
page(name, moduleCode) {	
	asize=args().size()
	if(asize.eq(0)) {
		target=this
		not(target) {
			return print("page 함수 호출오류 (this 미정의)")
		}
		p=target.parentWidget()
		return when(p, p.pageNode(), target.pageNode());
	}
	if( name.find(':') ) {
		baseCode=name
	} else {
		target=this
		not(target.@baseCode) {
			return print("page 타겟 baseCode 미존재 (이름:$name, 타겟:$target)")
		}
		splitSep(target.@baseCode, ':').inject(base, targetName) 
		not(base) {
			return print("page 함수 호출오류 (페이지 base 코드오류)");
		}
		baseCode = "$base:$name"
	}
	page = Cf.getObject('page', baseCode) 
	not(page) {
		print("page 함수오류 ($baseCode 페이지를 찾을수 없습니다)")
		return;
	}
	if( page.@useInit ) {
		return page;
	}	
	addModule(page, 'page')	
	not(moduleCode) {
		moduleCode=page.module
	}
	if( moduleCode ) {
		addModule(page, moduleCode)
	}
	if(typeof(page.initPage,'func')) {
		page.initPage()
	}
	page.@useInit = true
	return page;
}
dialog(name, moduleCode) {
	target=this
	 
	if( name.find(':') ) {
		baseCode=name
	} else {
		not(typeof(target,'widget')) {
			return print("dialog 대상이 위젯이 아닙니다 (이름:$name)")
		}
		splitSep(target.@baseCode, ':').inject(base, targetName) 
		not(base) {
			return print("dialog 함수 호출오류 (페이지 base 코드오류)");
		}
		baseCode = "$base:$name"
	}
	dialog = Cf.getObject('dialog', baseCode) 
	not(dialog) {
		return print("dialog 함수 호출오류 ($baseCode 페이지를 찾을수 없습니다)")
	}
	if( dialog.@useInit ) {
		return dialog;
	}
	not(moduleCode) {
		moduleCode=dialog.module
	}
	if( moduleCode ) {
		addModule(dialog, moduleCode)
	}
	if(typeof(dialog.initDialog,'func')) {
		dialog.initDialog()
	}
	dialog.@useInit = true
	return dialog;
}
widget(name, moduleCode) {
	target=this
	if(typeof(name,'widget')) {
		args(target, name, moduleCode)
	} 
	if(name.find('.')) {
		splitSep(name,'.').inject(pageCode, name)
		page=page("$base:$pageCode")
		not(page) {
			return print("@@ widget 함수 오류 $pageCode 페이지를 찾을 수 없습니다");
		}
		target=page
	}
	not(typeof(target,'widget')) {
		return print("widget 참조 대상이 위젯이 아닙니다 (이름:$name)")
	}
	base=''
	if( target.@baseCode ) {
		splitSep(target.@baseCode,':').inject(base, targetName)
	}
	widget = target.findWidget(name)
	not(typeof(widget,'widget')) {
		return print("widget 위젯 찾기오류 (이름:$name)");
	}
	if( widget.@useInit ) {
		return widget
	}
	if(base ) {
		widget.set('@baseCode', "$base:$name")
	}
	not(moduleCode) {
		moduleCode=widget.module
	}	
	if( moduleCode ) {
		addModule(widget, moduleCode)
	}
	if( widget.tag=='canvas' ) {
		not(widget.onDraw) {
			widget.@skipFuncUpdate=true
			addModule(widget,'canvas')
		}
	}
	if(typeof(widget.initWidget,'func')) {
		widget.initWidget()
	}
	widget.@useInit = true
	return widget;	
}

allWidget(parent, arr) {
	not(arr) arr=_arr()
	while(cur, parent) {
		not(cur.tag) continue;
		arr.add(cur)
		if(cur.childCount()) {
			allWidget(cur,arr)
		}
	}
	return arr;
}

applyFunc(&src, module) {
	if( module ) {
		if(module.ch('@')) {
			module=module.value(1)
		}
		Cf.rootNode('@funcInfo').set('refName', module)
		Cf.sourceApply("<func>$src</func>")
		Cf.rootNode('@funcInfo').set('refName', '')
	} else {
		Cf.sourceApply("<func>$src</func>")
	}
}
makeParam(param) {
	if(typeof(param,'node')) {
		args(node,&s,target,fn)
	} else {
		args(&s,target,fn)
		node=_node()
	}
	not(fn) {
		fn=Cf.funcNode('parent')
	}
	while(s.valid()) {
		c=s.ch() not(c) break;
		if(c.eq(',')) {
			s.incr()
			continue;
		}
		k=s.move(), v=''
		c=s.ch()		
		if(c.eq(':','=')) {
			c=s.incr().ch()
			if(c.eq()) {
				v=s.match()
			} else {
				name=s.move()
				if(fn.isset(name)) {
					v=fn.get(name)
				} else if(target) {
					v=target.get(name)
				}
			}
		} else {
			if(fn.isset(k)) {
				v=fn.get(k)
			} else if(target) {
				v=target.get(k)
			}
		}
		node.set(k,v)
	}
	return node;
}
makeWidgets(widgetSource, base, serviceNode) {
	not(widgetSource) return print("@@ makeWidgets 함수 실행오류 위젯생성 소스가 없습니다");
	not(base) base='test'
	Cf.rootNode('@funcInfo').set('pageBase', base)
	Cf.sourceApply(str('<widgets base="$base">$widgetSource</widgets>'))
	Cf.rootNode('@funcInfo').set('pageBase', '')	
	page=null
	if(typeof(serviceNode,'node')) {
		page=page("$base:main")
		if(page) serviceNode.@page=page
	}
	return page;
}
getServiceNode(param) {
	if(typeof(param,'node')) {
		return param;
	}
	asize=args().size()
	projectInfo = object("baro.serviceProjectInfo")
	serviceNode=null
	projectName='baro', serviceName=''
	findName=''
	newCheck=false
	if(asize==1) {
		findName=param
	}
	else if(asize==2) {
		args(a,b)
		if(typeof(b,'bool')) {
			findName=a
			newCheck=true
		} else {
			projectName=a
			serviceName=b
		}
	} 
	if(findName) {
		while(project, projectInfo ) {
			while(service, project) {
				if(service.cmp('serviceName', findName)) {
					serviceNode=service
					break;
				}
			}
			if(serviceNode) break;
		}
		if( newCheck && ~(serviceNode) ) {
			project=projectInfo.addNode(projectName)
			serviceNode=project.addNode(findName)
			serviceNode.set('serviceName', findName)
		}
	} else if(projectName && serviceName) {
		project=projectInfo.addNode(projectName)
		serviceNode=project.addNode(serviceName)
		not(project.projectName) project.set('projectName', projectName)
		not(serviceNode.serviceName) serviceNode.set('serviceName', serviceName)
	}
	projectInfo.set('@currentProject', project)
	projectInfo.set('@currentService', serviceNode)
	return serviceNode;
}
parseSource(&s, base, serviceNode) {
	c=s.ch()
	not(c.eq('<')) {
		applyFunc(s)
		return
	}
	isOneLine = func(&s) {
		while(s.valid()) {
			if(lineBlankCheck(s)) {
				s.findPos("\n")
				continue;
			}
			line=s.findPos("\n")
			if(s.ch()) {
				break;
			}
			return true;
		}
		return false;
	};
	getData = func(&s) {
		if(isOneLine(s)) {
			return s.trim()
		} else {
			return removeIndentText(s)
		}
	};
	not(base) base='test'
	debug=conf('cf.useDebug') 
	if(serviceNode) {
		baseNode=serviceNode.addNode(base)
	} else {
		baseNode=baseConfig('tools',base)
	}
	widgetSource=''
	evalSource=''
	testSource=''
	while(s.valid() ) {
		c=s.ch() 
		not(c.eq('<')) {
			break;
		} 
		if(s.start('<!--')) {
			s.match('<!--', '-->')
			continue;
		}
		sp=s.cur()
		tag = s.incr().move() 
		s.pos(sp)
		if( tag.eq('script') ) {
			ss=s.match("<script","</script>", 1)
		} else {			
			ss=s.match("<$tag","</$tag>")
		}			
		if(typeof(ss,'bool')) {
			line=getLine(s)
			return print("parseSource 함수오류 ($tag 태그 매칭오류)", line)
		}
		prop=ss.findPos('>')
		if( propValue(prop,'skip',true) ) {
			continue;
		}
		if( tag.eq('page','dialog') ) {
			widgetSource.add("<$tag $prop>$ss</$tag>")		
		} else if( tag.eq('script') ) {
			module=propValue(prop,'module')
			note=propValue(prop,'note')
			checkEval=propValue(prop,'eval',true)
			checkInclude=propValue(prop,'include',true)
			if(debug && serviceNode ) {
				mapNode=baseNode.addNode('script')
				if(checkEval) {
					evalSource.add(ss)
				} 
				else {
					type=module
					not(type) {
						type=propValue(prop,'type')
						not(type) type='default'
					}
					if( ss.eq(mapNode.get(type)) ) {
						print("@@ 소스변경되지 않음 $base:$type")
						continue;
					}
					mapNode.set(type,ss)
					if(module) mapNode.set("$type#module",module)
					if(note) mapNode.set("$type#note", note)
				}
			} 
			if(checkEval || checkInclude) {
				if(checkInclude) {
					func=call('runEval')
					call(func, baseNode, ss)
				}
				continue;
			}
			print("@@ 소스적용 $base:$type 모듈:$module")
			applyFunc(ss, module)
		} else if( tag.eq('eval') ) {
			evalSource.add(ss)
		} else if( tag.eq('conf') ) {			
			name=propValue(prop, 'name')
			type=propValue(prop, 'type') not(type) type='text'
			if(name) {
				mapNode=baseNode.addNode('conf')				
				src=getData(ss)
				prev=conf(name)
				if( propValue(prop,'first',true) ) {
					not(prev) {
						conf(name, src, true)
						mapNode.set(name, src)
						mapNode.set("$name#type", type)
					}
				}
				else {
					not(prev.eq(src)) {
						print("conf add $name", ss.size())
						conf(name, src, true)
						mapNode.set(name, src)
						mapNode.set("$name#type", type)
					}
				}				
			}
		} else if( tag.eq('data') ) {
			mapNode=baseNode.addNode('data')
			name=propValue(prop, 'name')
			type=propValue(prop, 'type') not(type) type='text'
			src=getData(ss)
			if(type.eq('json')) {
				if(name) {
					jsonNode=mapNode.addNode(name)
				} else {
					jsonNode=mapNode
				}
				jsonNode.parseJson(src)
			} else {
				not(name) name='default'
				mapNode.set(name,src)
				mapNode.set("$name#type",type)
			}
		} else {
			print("@@ parseSource 태그:$tag 미정의")
		}
	}
	if( widgetSource ) {
		mapNode=baseNode.addNode('data')
		prev=mapNode.get('@widgets')
		if( prev.ne(widgetSource) ) {
			mapNode.set('@widgets',widgetSource)
			makeWidgets(widgetSource, base, baseNode)			
		}
	}
	if( evalSource && serviceNode ) {
		mapNode=baseNode.addNode('script')
		prev=mapNode.get('@eval')
		if( prev.ne(evalSource) ) {
			baseNode.@baseCode = "$base:eval"
			func=call('runEval')
			call(func, baseNode, "Cf.debug('clear')\r\n$evalSource")
			mapNode.set('@eval', evalSource)
		}
	}
}

runEval(src) { eval(stripJsComment(src)) }

nodeVar(obj, name, value) {
	not(typeof(name,'string')) {
		print("@@ nodeVar 이름오류", args())
		return;
	}
	not(typeof(obj,'node') ) {
		print("@@ nodeVar [$name] 매개변수오류", args())
		return;
	}
	vnm=when(name.ch('@'),name,"@$name")
	asize=args().size()
	if(asize==3) {
		obj.set(vnm, value)
		return value;
	} else {
		not(obj.isVar(vnm)) {
			print("@@ nodeVar $vnm 변수 미설정")
			return;
		}
		return obj.get(vnm)
	}
}
escapeString(&s) {
	ss='', nl="\n"
	while(s.valid()) {
		left=s.findPos('\n')
		ss.add(left)
		not(s.valid()) break
		ss.add(nl)
	}
	return ss;
}
 
resetModule(obj) {
	obj.@useModule = false
	obj.@moduleList.reuse()
}
addModule(obj, moduleName) {
	// print("add module args ==> ", args())
	
	moduleList=obj.@moduleList
	not(moduleList) moduleList=obj.addArray('@moduleList')
	params=args(2)
	if(moduleName.find(',')) {
		while(name, splitSep(moduleName)) {
			loadModule(name)
		}
	} else {
		loadModule(moduleName)
	}
	if( obj.@skipFuncUpdate ) {
		obj.@skipFuncUpdate = false
	}
	obj.@useModule=true
	return obj;
	
	loadModule = func(moduleName) {
		if( moduleList.find(moduleName) ) {
			return obj;
		} 
		funcInfo = object('user.subfuncMap').get(moduleName) 
		if( addModuleFunc(obj, moduleName, funcInfo, obj.@skipFuncUpdate) ) {
			fcInit = obj.get("init")
			if( typeof(fcInit,'func') ) {
				call(fcInit, obj, params)
			}
		} 
		moduleList.add(moduleName)
	};
}

addModuleFunc(obj, moduleName, &funcs, skipFuncUpdate) {
	not(funcs.ch()) return;
	cnt = 0
	while(funcs.valid()) {
		fnm=funcs.findPos(',').trim() not(fnm) break;
		fc=call("${moduleName}.${fnm}") not(typeof(fc,'func')) continue;
		if(fnm.eq('init')) {
			cnt++
		} else if(skipFuncUpdate) {
			if(obj.isVar(fnm)) continue;
		}
		if(isEventName(fnm)) {
			fn=Cf.funcNode(fc,obj)
			fn.setPersist(true)
			obj.set(fnm, fn)
		} else {
			obj.set(fnm, fc)
		}
		// print("모듈함수 ${skipFuncUpdate} ${moduleName}.${fnm} 등록")
	}
	return cnt;
}
