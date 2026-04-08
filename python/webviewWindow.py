import sys
import argparse
import os
import time
from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QSizeGrip
from PyQt6.QtWebEngineWidgets import *
from PyQt6.QtWebEngineCore import *
from PyQt6.QtGui import QDragEnterEvent, QDropEvent
from PyQt6.QtCore import Qt, QTimer, QTime, QUrl, QEvent, QObject, QPoint, pyqtSlot
from PyQt6.QtWebChannel import QWebChannel
import win32.win32gui as win32gui

'''
pythonRun('-m pip install PyQt6 PyQt6-WebEngine')
pywin32 306
'''

parser = argparse.ArgumentParser(description='프로그램 확장기능 처리')
class CustomAction(argparse.Action):
	def __call__(self, parser, namespace, values, option_string=None):
		setattr(namespace, self.dest, " ".join(values))

# 입력받을 인자값 등록
parser.add_argument('--command', action=CustomAction, nargs='+', required=True, help='로그파일')
parser.add_argument('--out', action=CustomAction, nargs='+', required=True, help='출력파일')
parser.add_argument('--url')
args = parser.parse_args()

fpOut=open(args.out, 'a', encoding='utf8')

def logAppend (msg):
	fpOut.write(f"@#> {msg}\n")
	fpOut.flush()

def handle_result(result):
	logAppend(f"runScript: {result}")

class Bridge(QObject):
	def __init__(self, webview):
		super().__init__()
		self.webview = webview

	@pyqtSlot(str)
	def logAppend(self, msg):
		if msg[0]=='#':
			webview=self.webview
			params = msg[1:]
			arr = [val.strip() for val in params.split(',')]
			x=webview.x()
			y=webview.y()
			webview.move(x+int(arr[0]),y+int(arr[1]))
		else:
			logAppend(f'bridge:{msg}')

class WebPage(QWebEnginePage):
	def acceptNavigationRequest(self, url, _type, isMainFrame):
		# print(f"Navigation request intercepted: URL={url.toString()}, Type={_type}, MainFrame={isMainFrame}")
		if _type == QWebEnginePage.NavigationType.NavigationTypeLinkClicked:
			logAppend(f"linkClick:{url.toString()}")
			return False 
		return super().acceptNavigationRequest(url, _type, isMainFrame)

class MyWebView(QWebEngineView):
	# Store external windows.
	# external_windows = []
	def __init__(self, parent=None):
		super().__init__(parent)
		logAppend(f'webview:init')
		self.urlChanged.connect(self.onUrlChange)
		self.setPage(WebPage(self))
		self.fp=open(args.command, 'r', encoding='utf8')
		# self.fa=open(args.out, 'a', encoding='utf8')
		self.lastPos=self.fp.seek(0, os.SEEK_END)
		self.useWindowMove = True
		self.tm=time.time()		
		self.nextCommand = ''
		self.parent_hwnd = None
		self.timer = QTimer(self)
		self.timer.setInterval(50)
		self.timer.timeout.connect(self.timeout)		
		self.timerCount=0
		self.old_pos = QPoint()
		# self.setGeometry(-500, -500, 400, 400)
		# self.hide()		
		self.timer.start()
		try:
			self.channel = QWebChannel(self)
			self.bridge = Bridge(self)
			self.channel.registerObject("bridge", self.bridge)
			self.page().setWebChannel(self.channel)
			self.setAcceptDrops(True)
			# self.setBackgroundColor(QtCore.Qt.transparent)
			# self.setMouseTracking(True)
			# self.focusProxy().setMouseTracking(True)
			# self.focusProxy().installEventFilter(self)
			# profile.setHttpCacheType(QWebEngineProfile.NoCache)
			profile = self.page().profile()
			profile.clearHttpCache()						
		except Exception as e:
			logAppend(f'webview:init exception {e}')
	
	def setWindowMove(self, useWindowMove):
		self.useWindowMove = useWindowMove
	def getWindowMove(self):
		return self.useWindowMove

		# 5. 마우스 드래그로 창 이동 구현
	def mousePressEvent(self, event):
		if event.button() == Qt.MouseButton.LeftButton:
			self.old_pos = event.globalPosition().toPoint()

	def mouseMoveEvent(self, event):
		if event.buttons() == Qt.MouseButton.LeftButton:
			delta = QPoint(event.globalPosition().toPoint() - self.old_pos)
			self.move(self.x() + delta.x(), self.y() + delta.y())
			self.old_pos = event.globalPosition().toPoint()

	
	def onUrlChange(self, url):
		logAppend(f'urlChange: {url.toString()}')
		# self.back()

	def dragEnterEvent(self, event: QDragEnterEvent):
		if event.mimeData().hasUrls():
			event.acceptProposedAction()
		else:
			event.ignore()

	def dropEvent(self, event: QDropEvent):
		files = [u.toLocalFile() for u in event.mimeData().urls()]
		if files:
			logAppend(f"@#>drop-file: {files}")
		event.acceptProposedAction()

	def acceptNavigationRequest(self, url,  type, isMainFrame):
		if type == QWebEnginePage.NavigationTypeLinkClicked:
			logAppend(f"linkClick:{url}")
			'''
			w = QWebEngineView()
			w.setUrl(url)
			w.show()
			self.external_windows.append(w)
			'''
			return False
		return super().acceptNavigationRequest(url,  _type, isMainFrame)

	def timeout(self):
		try:
			# sender = self.sender()
			# currentTime = QTime.currentTime().toString("hh:mm:ss")
			if self.timerCount<5:			
				self.timerCount+=1
				if self.timerCount==5:
					urlDefault='http://localhost:8081/test-tabs.html'
					if args.url:
						urlDefault=args.url
					self.setUrl(QUrl(urlDefault))
					logAppend('start:webview')
				return
			fsize=os.stat(args.command).st_size			
			if self.nextCommand:
				data = self.nextCommand
			elif fsize>self.lastPos :
				data = self.fp.read().strip()
			else:
				return			
			pos=data.find("@#>")
			# dist=time.time()-self.tm
			# logAppend(f"line:{data} dist={dist}")
			params=None
			val = ''
			ftype = ''
			if pos!=-1 :
				ep=data.find("@#>", pos+3)
				if ep!=-1:
					line = data[pos+3:ep]
					self.nextCommand = data[ep:].strip()
				else:
					line = data[pos+3:]
					self.nextCommand = ''
				end=line.find(":", pos)
				if end!=-1 :
					ftype = line[0:end].strip()
					params = line[end+1:]
			# pos
			# logAppend(f">> {ftype} {params}")
			if params!=None :
				if ftype=='quit':
					self.fp.close()
					fpOut.close()
					sys.exit()
				elif ftype=='moveForeground':
					self.setWindowState(self.windowState() & ~Qt.WindowState.WindowMinimized | Qt.WindowState.WindowActive)
					self.raise_()
					self.activateWindow()
					logAppend("moveForeground:ok")
				elif ftype=='move':
					arr = [val.strip() for val in params.split(',')]
					x=self.x()
					y=self.y()
					self.move(x+int(float(arr[0])),y+int(float(arr[1])))
				elif ftype=='geo':
					arr = [val.strip() for val in params.split(',')]
					# self.setWindowFlags(Qt.WindowType.SplashScreen)
					# self.move(0,0)
					# self.resize(int(arr[2]), int(arr[3]))
					# self.show()
					self.setGeometry(int(float(arr[0])),int(float(arr[1])),int(float(arr[2])),int(float(arr[3])))
					if self.isHidden():
						self.show()
					logAppend("geo:ok")
				elif ftype=='echo':
					logAppend(f"echo = {params}")
				elif ftype=='start':
					logAppend("start:webview")
				elif ftype=='clearCache':
					profile = self.page().profile()
					# profile.setHttpCacheType(QWebEngineProfile.NoCache)
					profile.clearHttpCache()
					profile.cookieStore().deleteAllCookies()
					self.reload()
					logAppend("clearCache:ok")
				elif ftype=='runScript':
					self.page().runJavaScript(params, handle_result)
					logAppend("runScript:ok")
				elif ftype=='zoom':
					self.setZoomFactor(float(params))
					logAppend("zoom:ok")
				elif ftype=='pageActive':
					win32gui.SetForegroundWindow(self.parent_hwnd)
					logAppend(f"pageActive:{params}")
				elif ftype=='setParent':
					# self.setWindowFlag(Qt.WindowStaysOnTopHint)
					parent = int(params)
					win32gui.SetParent(self.winId(), parent)
					self.setWindowFlags(Qt.WindowType.Window | Qt.WindowType.FramelessWindowHint)
					self.show()
					# win32gui.ShowWindow(child_hwnd, win32con.SW_SHOW)
					win32gui.SetForegroundWindow(parent)
					self.parent_hwnd = parent
					logAppend("setParent:ok")
				elif ftype=='hide':
					self.hide()
					logAppend("hide:ok")
				elif ftype=='show':
					self.show()
					logAppend("show:ok")
				elif ftype=='url':
					url=params.strip()
					self.setUrl(QUrl(url))
					logAppend(f"url:{url}")
				else:
					logAppend(f"error:{ftype} defined")
			## if params
			self.lastPos=fsize			
			# end if print(f"currentTime=={currentTime}")
		except Exception as e:
			logAppend(f"commandException:{ftype} {e}")

	def eventFilter(self, source, event):
		if source is self.focusProxy() and event.type() == QEvent.Type.MouseButtonPress:
			logAppend(f"mouseFocus: {event.position().x()}, {event.position().y()}")
		return super().eventFilter(source, event)


class FramelessBrowser(QMainWindow):
	def __init__(self):
		super().__init__()

		# 1. 프레임리스 설정
		self.setWindowFlags(Qt.WindowType.FramelessWindowHint)
		self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)

		# 2. 메인 위젯 및 레이아웃 설정
		central_widget = QWidget()
		self.setCentralWidget(central_widget)
		layout = QVBoxLayout(central_widget)
		layout.setContentsMargins(0, 0, 0, 0)
		layout.setSpacing(0)

		# 3. QWebEngineView 설정
		self.browser = MyWebView()
		layout.addWidget(self.browser)

		# 4. 크기 조절을 위한 SizeGrip (우측 하단)
		sizegrip = QSizeGrip(self)
		layout.addWidget(sizegrip, 0, Qt.AlignmentFlag.AlignBottom | Qt.AlignmentFlag.AlignRight)

		# 마우스 이동 관련 변수
		self.old_pos = QPoint()

	# 5. 마우스 드래그로 창 이동 구현
	def mousePressEvent(self, event):
		if event.button() == Qt.MouseButton.LeftButton:
			self.old_pos = event.globalPosition().toPoint()

	def mouseMoveEvent(self, event):
		if event.buttons() == Qt.MouseButton.LeftButton and self.browser.getWindowMove():
			delta = QPoint(event.globalPosition().toPoint() - self.old_pos)
			self.move(self.x() + delta.x(), self.y() + delta.y())
			self.old_pos = event.globalPosition().toPoint()

def main():	
	app = QApplication(sys.argv)
	'''
	window = FramelessBrowser()
	window.resize(1024, 768)
	window.show()
	'''
	window = MyWebView()
	window.resize(1024, 768)
	# window.setWindowFlags(Qt.WindowType.Window&~Qt.WindowType.WindowTitleHint) #Qt.WindowType.Window | Sheet
	window.setWindowFlags(Qt.WindowType.CustomizeWindowHint)
	window.show()
	sys.exit(app.exec())
	logAppend('close:webview')

if __name__ == '__main__':
	main()