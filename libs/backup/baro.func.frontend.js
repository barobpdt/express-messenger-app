##> config {name=css}
	STYLE_MAP = @eval( return object('user.styleMap').parseJson(this.styleMap) )
	styleMap {
		w:width,h:height,p:padding,m:margin,
		mt:marginTop, mb:marginBottom, ml:marginLeft, mr:marginRight,
		pt:paddingTop, pb:paddingBottom, pl:paddingLeft, pr:paddingRight,
		bg:background,
		bd:border,
		b:border,
		bt:borderTop, bb:borderBottom, bl:borderLeft, br:borderRight,
		rad:borderRadius,
		c:color,
		x:top, y:left,
		t:top, l:left,
		tform: transform,
		tf: transform,
		tr:transition, 
		trdelay:transitionDelay,
		fwrap:flexWrap,
		ani:animation
		anidelay: animationDelay,
		bgpos:backgroundPosition,
		bgsize:backgroundSize,
		fit:object-fit,
		minh:minHeight,
		maxh:maxHeight,
		minw:minWidth,
		maxw:maxWidth,
		rel:relative,
		abs:absolute,
		space:letterSpace,
		ls:letterSpace,
		lh:lineHeight,
		fs:fontSize,
		fw:fontWeight,
		pe:pointerEvent,
		ai:alignItems,
		jc:justifyContent,
		shadow: boxShadow,
		ctt: content,
		hint: placeholder
	}
##> func {name=frontend}
	/* [프론트앤드] 레이아웃 노드 설정값으로 react 태그 생성 */
	renderLayout(page,node) {
		result=''
		not(node) {
			node=page.get('@layout') 
		}
		map=object('user.styleMap')
		while(cur, node) {
			cur.inject(tag,css,style)
			if(css) {
				nodeCss=parseConfigProps(css)
				while(key, nodeCss.get('@keyArray')) {
					val=nodeCass.get(key)
					name=map.get(key) not(name) name=key;
					
				}
			}
		}
		return result;
	}
	/* [프론트앤드] PUG 형태 태그 트리노드 생성 */
	makeLayout(page, &s) { 
		layout = page.addNode('@layout').removeAll(true)
		parentArray=[]
		indentArray=[]
		parentArray.add(layout)	
		while(s.valid()) {
			// line 공백이면 무시
			if(lineBlankCheck(s)) {
				s.findPos("\n")
				continue;
			}
			a = indentText(s)
			c = s.ch()
			not(c) return;
			// line 'end'로 시작하면 현재 태그끝
			if( s.start('end') ) {
				not(cur) continue;
				if( cur && lineCheck(s,'<')) {
					s.findPos('<',0,1)
					_tagValue()
				}
				s.findPos("\n")
				_tagValue()
				continue;
			}
			// line 공백문자로 부모 인덱스 찾기
			if( indentArray.size()) {
				if(a) {
					idx=indentArray.find(a)
				} else {
					idx=0
				}
				if(idx==-1) {
					idx=indentArray.size()
					indentArray.add(a)
				}
			} else {
				idx=0
				indentArray.add(a)
			}
			/* 부모태그를 찾았다면 현재 라인 태그 생성 (태그는 -또는 . 문자포함 가능)
				예) tag [속성] <>html</> 형태
			   태그와 속성사이값이 있다면 하위 html로 추가 
				예) label 이름 [id:name]
			*/
			base = parentArray.get(idx)
			not(base ) return print("@@ 레이아웃 분석 부모노드 찾기오류 idx:$idx");
			sp = s.cur()
			c=s.next().ch(1)
			while(c.eq('-','.')) c=s.incr().next().ch(1)
			tag = s.trim(sp,s.cur(),true)
			cur = base.addNode()
			cur.tag=tag
			// tag 속성분석 
			if( lineCheck(s,'[') ) {
				left = s.findPos('[',1,1)
				body = s.match(1)
				if(typeof(body,'bool')) return print("태그 속성 매핑오류 태그:$tag", left);
				if( left.ch()) {				
					cur.appendText('@html', left.trim())
				}
				@baro.parseConfig(root,cur,body)
			} else if(_checkProp(s)) {				
				s.ch()
				body = s.match(1)
				@baro.parseConfig(root,cur, body)
			}
			// html 태그로 시작한다면 현재 tag 하위 요소로 추가
			not(_tagValue()) {
				left = s.findPos("\n")
				if( left.ch()) {
					cur.appendText('@html', left.trim())				
				}
			}
			if( checkError('태그분석오류') ) return;
			// 현재노드를 배열 다음인덱스에 추가
			setArray(parentArray, idx+1, cur)
		}
		return renderLayout(page);
		
		/* 속성 체크 */
		_checkProp = func(&s) {
			if(lineBlankCheck(s) ) {
				c=s.ch()
				return c.eq('[');
			}
			return false;
		};
		/* 태그체크 */
		_checkTag = func(&s) {
			c=s.ch()
			return c.eq('<')
		};
		/* 태그값 분석 (연속된 태그값도 허용 )*/
		_tagValue = func() {
			not(_checkTag(s) ) return false;
			html=''
			while(_checkTag(s)) {
				c=s.ch() not(c) break;
				cc=s.ch(1)
				if(cc.eq('>')) {
					body=s.match('<>','<>',1)
					print("@@ <><> html : $body")
					html.add(body)
					continue;
				}			
				sp=s.cur()
				c=s.incr().next().ch(1)
				if(c.eq('-',':')) c=s.incr().next().ch(1)
				tag=s.trim(sp+1, s.cur(), true)
				print("_checkTag", page.pageCode, tag, line)
				s.pos(sp)
				body=s.match("<$tag", "</$tag>",8)
				if(typeof(body,'bool')) {
					return print("매칭되는 태그를 찾을수 없습니다", left, tag);
				}				 
				props=body.findPos('>')
				src=@baro.parseSource(parent,page,cur,body,'value')
				html.add("<$tag")
				if(props.ch()) {
					html.add(" $props>")
				} else {
					html.add( ">")
				}
				html.add( src,"</$tag>")
			}
			node.appendText('@html', html)
			return true;
		};
	}

