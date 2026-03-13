##> func {name=utils}
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
	
	
	
	