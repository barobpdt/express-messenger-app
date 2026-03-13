##> config 
	PROJECT_PATH = @eval(
		path=conf('baro.defaultProjectPath') 
		not(path) {
			path=pathJoin(System.path(),'services')
			conf('baro.defaultProjectPath', path, true) 
		}
		return pathJoin(path, 'frontend')
	)

	PROJECT_NAME = sample-config
	USE_TAILWIND = false
	USE_TYPESCRIPT = false
	TEMPLATE_PATH = @eval( pathJoin(conf('baro.templatePath'))
	run = @eval(
		fullpath = pathJoin(this.PROJECT_PATH, this.PROJECT_NAME) 
		
		run('npm install react-ace ace-builds')

		// tailwind setup
		src=fileRead( pathJoin(fullpath, 'vite.config.ts')		
		add=>import tailwindcss from '@tailwindcss/vite'
		add=> plugins: [... tailwindcss() ...]

		src=fileRead( pathJoin(fullpath, 'src/index.html')
		delete=><link ...>

		src=fileRead( pathJoin(fullpath, 'src/index.css')
		all replace


		this.set( 'PROJECT_FULLPATH', fullpath)
	)
	cmd {
		npm install tailwindcss @tailwindcss/vite
		npm install --save-dev vite-plugin-monaco-editor
		npm install react-icons --save
	}

##> app { routes=[ Home, Login, Setup ], runLast  }
	run = @eval(
		fullpath=configValue('PROJECT_FULLPATH')
		screenPath = pathJoin(fullpath,'src/screens')		
		template = conf('react.appTemplate') not(template) return log("page 템플릿소스 미정의 (저장경로:${0})", screenPath);		
		log(">> page template : $template")
		while(name, this.get('routes') ) {
			moduleName = "${name}Screen"
			params = { 
				STORE: 'global',  
				MODULE_NAME: moduleName
			}
			savePath = pathJoin(screenPath, "${moduleName}.jsx")
			saveSource = parseTemplate(template, params)

			// fileWrite(savePath, saveSource)
			print("app::run => name=$name")
		}
	)


##> store {name=global}
	auto(

	) 
	run(
		storePath = pathJoin(fullpath,'src/stores')
		templateStore = conf('react.storeTemplate') not(templateStore) return log("page store 템플릿 미정의 (저장경로:${0})", screenPath);
		src=makeStore(this.auto)
	)
	
##> func
@baro.setNodeVersion() {
	@baro.cmdRun(c,'node -v',func(&s) {
		root=object('baro.services')
		s.findPos("\n")
		line=s.findPos("\n")
		root.set('@nodeVersion', line)
	})
}
/*
@baro.findBindPort(5173, func(port) {
	if(port) return print("front 데몬이 실행중입니다")
	print("xxxxxxx 프론트엔드 실행 시작 xxxxxxxxxxx")
	@baro.viteRunDev()
})
*/
@baro.viteCreate(projectPath, projectName) {
	cc=@baro.cmd('npm')
	not(projectPath) projectPath='c:/temp/vite'
	@baro.cmdRun(cc, 'cd c:/temp/vite')
	@baro.cmdRun(cc, 'npm create vite@latest sample-tailwind -- --template react')
	@baro.cmdRun(cc, 'cd sample-tailwind')
	@baro.cmdRun(cc, 'npm install react-router-dom')
	@baro.cmdRun(cc, 'npm install -D tailwindcss@3 postcss autoprefixer')
	@baro.cmdRun(cc, 'npx tailwindcss init -p')
	tailwinConfigFile = 'c:/temp/vite/tailwind.config.js'
	src=fileRead(tailwinConfigFile)
	saveConfig(src)
	saveConfig=func(&s) {
		ss=''
		content='"./index.html", "./src/**/*.{js,ts,jsx,tsx}"'
		left=s.findPos('content:') 
		c=s.ch()
		not(c)return print("@@ tailwinConfig 파일 수정오류 (경로:$tailwinConfigFile)")
		s.match()
		ss.add(left)
		ss.add("content: [$content]")
		ss.add(s)
		fileWrite(tailwinConfigFile,ss)
	};
	@baro.viteRunDev(pathJoin(projectPath,projectName) )
}
@baro.viteRunDev(projectPath, logPath) {
	not(projectPath) projectPath = 'C:/temp/vite/sample-baro1'
	not(logPath) logPath='log.txt'	
	npmCmd = 'npm run dev >> "$logPath" 2>&1'
	cc=@baro.cmd('frontend')
	@baro.cmdRun(cc, "cd $projectPath", @baro.frontendProc )
	@baro.cmdRun(cc, _s(npmCmd) )
	print("xxxxxxx 프론트엔드 실행중 xxxxxxxxxxx")
}
