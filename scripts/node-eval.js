/**
 * node-eval.js
 *
 * 사용법:
 *   node scripts/node-eval.js <파일경로> [--lines N] [--log <로그파일>] [--server <서버URL>] 
 
	page=page('webview:main')
	out=page.@canvas.@cmd.@logAppend.get('logFileName')
	in=logAppend('nodeCommand').get('logFileName')

	path=conf('path.express')
	cmd=Baro.process('nodeCommand')
	command=#[node node-eval.js --in "${in}" --out "${out}"]
	addCmdJob(cmd, "cd $path/scripts")
	addCmdJob(cmd, command)


*/

import fs from 'fs';
import path from 'path';
import AdmZip from "adm-zip";

// ── 인수 파싱 ────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const nodeInfo = { 
	lines: 10, 
	in: '',
	out: '',
	server: 'http://localhost:8081' 
};
const evalVars = {
	webviewLog: ''
}
const positional = [];
const today = new Date().toISOString().slice(0, 10);

function logAppend(msg) {
	const logFile = nodeInfo.out || path.join(process.cwd(), 'logs', `${today}.log`);
	try {
		fs.appendFileSync(logFile, msg + '\n');
	} catch {
		console.log(`@@logAppend 오류 ${logFile} : ${msg}`)
	}
}
function log(msg) {
	logAppend('@#>node-eval:'+msg);
}

for (let i = 0; i < rawArgs.length; i++) {
	const type = rawArgs[i]
	if ((type === '--lines' || type === '-n') && rawArgs[i + 1]) {
		nodeInfo.lines = parseInt(rawArgs[++i], 10);
	} else if (type === '--out' && rawArgs[i + 1]) {
		nodeInfo.out = rawArgs[++i];
	} else if (type === '--in' && rawArgs[i + 1]) {
		nodeInfo.in = rawArgs[++i];
	} else if (type === '--server' && rawArgs[i + 1]) {
		nodeInfo.server = rawArgs[++i];
	} else {
		positional.push(rawArgs[i]);
	}
}
log(`info=>👁  감시 시작: ${JSON.stringify(nodeInfo)} 파일:${nodeInfo.in}`);

if (nodeInfo.in < 1) {
	console.error('사용법: node scripts/node-eval.js --in [] [--lines N] [--out <로그파일>] [--server <서버URL>]');
	process.exit(1);
}

const targetPath = path.resolve(nodeInfo.in);

if (!fs.existsSync(targetPath)) {
	log(`error=>❌ 파일을 찾을 수 없습니다: ${targetPath}`);
	process.exit(1);
}

// ── 컬러 헬퍼 (ANSI 이스케이프) ─────────────────────────────────────────────

function timestamp() {
	return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}
 
async function parseCommand(type, msg) {
	if(type=='quit') {
		log(`finish=>감시를 종료합니다.`);
		process.exit(0)
	}
	if( type=='nodeInfo') {
		log(`${type}=>${JSON.stringify(nodeInfo)}`)
	}
	if( type=='eval') {
		evalVars.webviewLog=''
		eval(msg)
		if(evalVars.webviewLog) {
			logAppend('@#>'+evalVars.webviewLog)
		}
	}
}

// ── 파일 감시 & 증분 출력 ────────────────────────────────────────────────────
function watchFile(filePath) {
	let lastSize = fs.statSync(filePath).size;
	log('')
	const watcher = fs.watch(filePath, { encoding: 'utf8' }, (eventType)=>{
		// logAppend(`@#>eventType: ${eventType}`);
		if (eventType !== 'change') return;

		let stat;
		try {
			stat = fs.statSync(filePath);
		} catch {
			// 파일이 삭제/재생성되는 경우
			log(`error=>⚠ 파일이 삭제되거나 교체되었습니다. 감시를 계속합니다...`);
			lastSize = 0;
			return;
		}

		const currentSize = stat.size;

		if (currentSize < lastSize) {
			// 파일이 truncate 된 경우 처음부터 다시 읽기
			log(`error=>⚠ 파일이 초기화(truncate)되었습니다.`);
			lastSize = currentSize;
		}

		if (currentSize === lastSize) return;

		const lengthToRead = currentSize - lastSize;
		const buffer = Buffer.alloc(lengthToRead);
		const fd = fs.openSync(filePath, 'r');
		fs.readSync(fd, buffer, 0, lengthToRead, lastSize);
		fs.closeSync(fd);
		lastSize = currentSize;

		const newText = buffer.toString('utf8');
		let sp = 0, ep = 0;
		while (ep < newText.length) {
			sp = newText.indexOf('@#>', sp)
			if (sp === -1) break;
			sp += 3
			ep = newText.indexOf('@#>', sp)
			const line = ep == -1 ? newText.substring(sp) : newText.substring(sp, ep)
			sp = line.indexOf(':')
			const type = line.substring(0, sp).trim()
			const msg = line.substring(sp + 1).trim()
			console.log("type==>" + type + " msg==>" + msg)
			parseCommand(type, msg)
			if (ep == -1) break;
			sp = ep + 3
		}
	});

	watcher.on('error', (err)=>{
		log(`error=>감시 오류: ${err.message}`);
	});

	return watcher;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
log(`start=>👁  감시 시작: ${targetPath}`);

watchFile(targetPath);

// Ctrl+C 처리
process.on('SIGINT', ()=>{
	log(`finish=>감시를 종료합니다.`);
	process.exit(0);
});
