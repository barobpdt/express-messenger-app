<widgets>
	<page id="p1">
		<canvas id="c">
	</page>
</widgets>
~~
p=page('test:p1')
p.open()
t= p.tray()
t.icon('vicon:application_add')
t.show()

node=_node('menus')

arr=_arr('menus')
node.addNode().with(id:'aaa',text:'aaa',icon:'vicon:arrow_branch')

node.addNode().with(id:'bbb',text:'bbb',icon:'vicon:arrow_divide')
while(c,node) arr.add(c)
arr
t.contextMenu(arr)
t.message('알림','내용이 복사되었습니다','vicon:arrow_divide')

~~
p[
	onAction(act) {
		print("act==$act")
		this.flags('active')
		this.active()
	}
	onTrayEvent(type) {
		print("xxxxxxx tray event xxxxxx",a,b)
		if(type=='click') {
			
		} else if( type=='messageClick') {
			
		}
	}
]



