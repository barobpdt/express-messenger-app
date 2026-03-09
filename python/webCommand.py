import sys
import argparse
import os
import time
from PyQt5.QtWidgets import QWidget, QApplication, QVBoxLayout
from PyQt5.QtWidgets import QApplication
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEnginePage
from PyQt5.QtGui import QDragEnterEvent, QDropEvent
from PyQt5.QtCore import Qt, QTimer, QTime, QUrl, QEvent, QObject, pyqtSlot
from PyQt5.QtWebChannel import QWebChannel
import win32.win32gui as win32gui

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
		logAppend(f'bridge:{msg}')


class MyWebView(QWebEngineView):
	# Store external windows.
	external_windows = []
	def __init__(self, parent=None):
		super().__init__(parent)
		self.acceptDrops = True
		self.urlChanged.connect(self.onUrlChange)
		try:
			self.channel = QWebChannel(self)
			self.bridge = Bridge(self)
			self.channel.registerObject("bridge", self.bridge)
			self.page().setWebChannel(self.channel)
			# self.setBackgroundColor(QtCore.Qt.transparent)
			self.setAcceptDrops(True)
			self.setMouseTracking(True)
			# self.focusProxy().setMouseTracking(True)
			# self.focusProxy().installEventFilter(self)
		except Exception as e:
			print(f" error: {e}")
	
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
		event.accept()

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

	def eventFilter(self, source, event):
		if source is self.focusProxy() and event.type() == QEvent.Type.MouseButtonPress:
			logAppend(f"mouseFocus: {event.position().x()}, {event.position().y()}")
		return super().eventFilter(source, event)

class WebWidget(QWidget):
	def __init__(self):
		super().__init__()
		print("init ", args.command)
		try:
			self.fp=open(args.command, 'r', encoding='utf8')
			# self.fa=open(args.out, 'a', encoding='utf8')
			self.lastPos=self.fp.seek(0, os.SEEK_END)
			self.tm=time.time()
		except Exception as e:
			print(f" error: {e}")
		self.initUI()

	def initUI(self):
		self._glwidget = None
		self.webEngineView = MyWebView(self)
		urlDefault='http://localhost/chat/chat.html'
		if args.url:
			urlDefault=args.url
		vbox = QVBoxLayout(self)
		vbox.setContentsMargins(0, 0, 0, 0)
		# vbox.setMargin(0)
		vbox.addWidget(self.webEngineView)
		self.setLayout(vbox)
		self.setGeometry(0, 0, 350, 250)
		self.setWindowTitle('webview')
		self.timer = QTimer(self)
		self.timer.setInterval(100)
		self.timer.timeout.connect(self.timeout)
		self.timer.start()
		self.nextCommand = ''
		self.parent_hwnd = None
		self.setAttribute(Qt.WA_TranslucentBackground)
		# self.setWindowFlags(Qt.SplashScreen)
		# self.hide()
		# self.webEngineView.installEventFilter(self)
		profile = self.webEngineView.page().profile()
		# profile.setHttpCacheType(QWebEngineProfile.NoCache)
		profile.clearHttpCache()
		self.loadUrl(urlDefault)
		logAppend(f'start:webview')

	def eventFilter(self, source, event):
		# logAppend(f'web-view event filter: {event.type()}')
		if source is self.webEngineView.focusProxy() and event.type() == event.MouseButtonPress:
			logAppend(f'mousePress: {event.pos()}')
		return super().eventFilter(source, event)

	def loadUrl(self, url):
		self.webEngineView.setUrl(QUrl(url))
	def loadFile(self):
		with open('src/test.html', 'r') as f:
			html = f.read()
			self.webEngineView.setHtml(html)
	def timeout(self):
		# sender = self.sender()
		# currentTime = QTime.currentTime().toString("hh:mm:ss")
		fsize=os.stat(args.command).st_size
		checkCommand = True
		if self.nextCommand:
			data = self.nextCommand
		elif fsize>self.lastPos :
			data = self.fp.read().strip()
		else:
			checkCommand = False
		if checkCommand:
			dist=time.time()-self.tm
			pos=data.find("@#>")
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
				elif ftype=='geo':
					# self.setGeometry(int(params[0]), int(params[1]), int(params[2]), int(params[3]))
					arr = [val.strip() for val in params.split(',')]
					self.setWindowFlags(Qt.SplashScreen)
					self.move(0,0)
					self.resize(int(arr[2]), int(arr[3]))
					self.show()
				elif ftype=='echo':
					logAppend(f"echo = {params}")
				elif ftype=='start':
					logAppend(f"webview:start")
				elif ftype=='clearCache':
					profile = self.webEngineView.page().profile()
					# profile.setHttpCacheType(QWebEngineProfile.NoCache)
					profile.clearHttpCache()
					profile.cookieStore().deleteAllCookies()
					self.webEngineView.reload()
					logAppend(f"clearCache:{params}")
				elif ftype=='runScript':
					self.webEngineView.page().runJavaScript(params, handle_result)
				elif ftype=='zoom':
					self.webEngineView.setZoomFactor(float(params))
				elif ftype=='pageActive':
					if self.parent_hwnd != None:
						win32gui.SetForegroundWindow(self.parent_hwnd)
				elif ftype=='setParent':
					# self.setWindowFlag(Qt.WindowStaysOnTopHint)
					parent = int(params)
					child_hwnd = self.winId()
					win32gui.SetParent(child_hwnd, parent)
					self.setWindowFlags(Qt.Window | Qt.FramelessWindowHint)
					self.show()
					# win32gui.ShowWindow(child_hwnd, win32con.SW_SHOW)
					win32gui.SetForegroundWindow(parent)
					self.parent_hwnd = parent
				elif ftype=='hide':
					self.hide()
				elif ftype=='show':
					self.show()
				elif ftype=='url':
					self.loadUrl(params.strip())
				elif ftype=='top':
					self.setWindowFlags(Qt.Window | Qt.WindowStaysOnTopHint|Qt.SplashScreen)
					self.show()
				elif ftype=='splash':
					self.setWindowFlags(Qt.SplashScreen)
					self.show()
				else:
					logAppend(f"{ftype}:not defined")
			## if params
			self.lastPos=fsize
			logAppend(f"result:{ftype}")
		# end if print(f"currentTime=={currentTime}")
def main():
	app = QApplication(sys.argv)
	ex = WebWidget()
	sys.exit(app.exec_())
	logAppend("app:quit")

if __name__ == '__main__':
	main()