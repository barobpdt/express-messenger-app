import sys
import argparse
import os
import time
from PyQt6.QtWidgets import QApplication, QMainWindow
from PyQt6.QtWebEngineWidgets import *
from PyQt6.QtWebEngineCore import *
from PyQt6.QtGui import QDragEnterEvent, QDropEvent
from PyQt6.QtCore import Qt, QTimer, QTime, QUrl, QEvent, QObject, pyqtSlot
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
		self.acceptDrops = True
		self.urlChanged.connect(self.onUrlChange)
		self.setPage(WebPage(self))
		self.fp=open(args.command, 'r', encoding='utf8')
		# self.fa=open(args.out, 'a', encoding='utf8')
		self.lastPos=self.fp.seek(0, os.SEEK_END)
		self.tm=time.time()		
		self.nextCommand = ''
		self.parent_hwnd = None
		self.timer = QTimer(self)
		self.timer.setInterval(100)
		self.timer.timeout.connect(self.timeout)		
		self.timerCount=0
		self.setGeometry(-500, -500, 400, 400)
		self.hide()
		self.timer.start()
		try:
			self.channel = QWebChannel(self)
			self.bridge = Bridge(self)
			self.channel.registerObject("bridge", self.bridge)
			self.page().setWebChannel(self.channel)
			# self.setBackgroundColor(QtCore.Qt.transparent)
			# self.setAcceptDrops(True)
			# self.setMouseTracking(True)
			# self.focusProxy().setMouseTracking(True)
			# self.focusProxy().installEventFilter(self)
			# profile.setHttpCacheType(QWebEngineProfile.NoCache)
			profile = self.page().profile()
			profile.clearHttpCache()						
		except Exception as e:
			logAppend(f'webview:start exception {e}')
	
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

	def timeout(self):
		try:
			# sender = self.sender()
			# currentTime = QTime.currentTime().toString("hh:mm:ss")
			if self.timerCount<10:
				if self.timerCount==5:
					urlDefault='http://localhost:8081/webview-messenger.html'
					if args.url:
						urlDefault=args.url
					self.setUrl(QUrl(urlDefault))
				elif self.timerCount==8:
					logAppend('start:webview')
				self.timerCount+=1
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
				elif ftype=='geo':
					arr = [val.strip() for val in params.split(',')]
					# self.setWindowFlags(Qt.WindowType.SplashScreen)
					# self.move(0,0)
					# self.resize(int(arr[2]), int(arr[3]))
					# self.show()
					self.setGeometry(int(float(arr[0])),int(float(arr[1])),int(float(arr[2])),int(float(arr[3])))
				elif ftype=='echo':
					logAppend(f"echo = {params}")
				elif ftype=='start':
					logAppend(f"start:webview")
				elif ftype=='clearCache':
					profile = self.page().profile()
					# profile.setHttpCacheType(QWebEngineProfile.NoCache)
					profile.clearHttpCache()
					profile.cookieStore().deleteAllCookies()
					self.reload()
					logAppend(f"clearCache:{params}")
				elif ftype=='runScript':
					self.page().runJavaScript(params, handle_result)
				elif ftype=='zoom':
					self.setZoomFactor(float(params))
				elif ftype=='pageActive':
					win32gui.SetForegroundWindow(self.parent_hwnd)
				elif ftype=='setParent':
					# self.setWindowFlag(Qt.WindowStaysOnTopHint)
					parent = int(params)
					win32gui.SetParent(self.winId(), parent)
					self.setWindowFlags(Qt.WindowType.Window | Qt.WindowType.FramelessWindowHint)
					self.show()
					# win32gui.ShowWindow(child_hwnd, win32con.SW_SHOW)
					win32gui.SetForegroundWindow(parent)
					self.parent_hwnd = parent
				elif ftype=='hide':
					self.hide()
				elif ftype=='show':
					self.show()
				elif ftype=='url':
					url=params.strip()
					self.setUrl(QUrl(url))
				else:
					logAppend(f"{ftype}:not defined")
			## if params
			self.lastPos=fsize
			logAppend(f"result:{ftype}")
			# end if print(f"currentTime=={currentTime}")
		except Exception as e:
			logAppend(f"commandException:{ftype} {e}")

	def eventFilter(self, source, event):
		if source is self.focusProxy() and event.type() == QEvent.Type.MouseButtonPress:
			logAppend(f"mouseFocus: {event.position().x()}, {event.position().y()}")
		return super().eventFilter(source, event)

def main():	
	app = QApplication(sys.argv)
	webview = MyWebView()
	# webview.show()
	sys.exit(app.exec())
	logAppend('app:quit')

if __name__ == '__main__':
	main()