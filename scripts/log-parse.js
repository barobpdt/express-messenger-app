/**
 * log-parse.js
 *
 * 사용법:
 *   node scripts/log-parse.js <파일경로> [--lines N] [--log <로그파일>] [--server <서버URL>] 
path=conf('path.express')
log=logAppend('logParse')
cmd=Baro.process('logParse')
command=#[node log-parse.js "${log.member(logFileName)}" --log "${cmd.@logTail.member(logFileName)}"]
addCmdJob(cmd, "cd ${conf('path.express')}/scripts")
addCmdJob(cmd, command)
logAppend('logParse').append('@#>zip:C:/Users/isitn/Downloads/JetBrainsMono-2.304.zip')
logAppend('logParse').append('@#>quit:')

*/

import fs from 'fs';
import path from 'path';
import AdmZip from "adm-zip";

// ── 인수 파싱 ────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const flags = { lines: 10, server: 'http://localhost:8081' };
const positional = [];
const today = new Date().toISOString().slice(0, 10);
function logAppend(msg) {
	const logFile = flags.log || path.join(process.cwd(), 'logs', `${today}.log`);
	// console.log("log append => ", logFile, msg);
	fs.appendFileSync(logFile, msg + '\n');
}

for (let i = 0; i < rawArgs.length; i++) {
	if ((rawArgs[i] === '--lines' || rawArgs[i] === '-n') && rawArgs[i + 1]) {
		flags.lines = parseInt(rawArgs[++i], 10);
	} else if (rawArgs[i] === '--log' && rawArgs[i + 1]) {
		flags.log = rawArgs[++i];
	} else if (rawArgs[i] === '--server' && rawArgs[i + 1]) {
		flags.server = rawArgs[++i];
	} else {
		positional.push(rawArgs[i]);
	}
}
logAppend(`@#>log-parse: 👁  감시 시작: ${JSON.stringify(flags)} 파일:${positional[0]}`);

if (positional.length < 1) {
	console.error('사용법: node scripts/log-parse.js <파일경로> [--lines N] [--log <로그파일>] [--server <서버URL>]');
	process.exit(1);
}

const targetPath = path.resolve(positional[0]);

if (!fs.existsSync(targetPath)) {
	console.error(`❌ 파일을 찾을 수 없습니다: ${targetPath}`);
	process.exit(1);
}

// ── 컬러 헬퍼 (ANSI 이스케이프) ─────────────────────────────────────────────

function timestamp() {
	return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

// ── 시작 시 마지막 N줄 출력 ──────────────────────────────────────────────────
function printLastLines(filePath, n) {
	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split('\n');
	// 마지막 빈 줄 제거 후 뒤에서 n줄
	const tail = lines.filter((_, i) => i < lines.length - 1 || lines[i] !== '').slice(-n);

	if (tail.length > 0) {
		console.log(`── 마지막 ${tail.length}줄 ─────────────────────────`);
		tail.forEach(line => console.log(line));
		console.log(`─────────────────────────────────────────`);
	}
}

/**
 * 파일 크기가 10MB 이하면 /api/upload/file (단순 업로드),
 * 초과하면 /api/upload/chunk + /api/upload/merge (청크 업로드)를 자동으로 선택합니다.
 * @param {string} filePath  - 업로드할 로컬 파일 경로
 * @param {string} serverUrl - 서버 베이스 URL (예: http://localhost:8081)
 * @returns {Promise<{name: string, url: string}>}
 */
const SMALL_FILE_LIMIT = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB (서버 routes/upload.js 와 동일)

async function uploadToServer(filePath, serverUrl) {
	const fileBuffer = fs.readFileSync(filePath);
	const fileName = path.basename(filePath);
	const fileSize = fileBuffer.byteLength;

	if (fileSize <= SMALL_FILE_LIMIT) {
		// ── 일반 업로드 ──────────────────────────────────────────────────────
		logAppend(`@#> upload-start: 일반 업로드 중 (${(fileSize / 1024 / 1024).toFixed(2)} MB): ${serverUrl}/api/upload/file`);

		const formData = new FormData();
		formData.append('file', new Blob([fileBuffer], { type: 'image/png' }), fileName);

		const res = await fetch(`${serverUrl}/api/upload/file`, { method: 'POST', body: formData });
		if (!res.ok) throw new Error(`업로드 실패 (${res.status}): ${await res.text()}`);

		const data = await res.json();
		return { name: data.name, url: data.url };

	} else {
		// ── 청크 업로드 ──────────────────────────────────────────────────────
		const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
		const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
		logAppend(`@#> upload-start: 청크 업로드 시작 (${(fileSize / 1024 / 1024).toFixed(2)} MB → ${totalChunks}개 청크, ID: ${uploadId})`);

		for (let i = 0; i < totalChunks; i++) {
			const start = i * CHUNK_SIZE;
			const chunk = fileBuffer.slice(start, start + CHUNK_SIZE);

			const formData = new FormData();
			formData.append('chunk', new Blob([chunk], { type: 'application/octet-stream' }), `chunk-${i}`);
			formData.append('uploadId', uploadId);
			formData.append('chunkIndex', String(i));

			const res = await fetch(`${serverUrl}/api/upload/chunk`, { method: 'POST', body: formData });
			if (!res.ok) throw new Error(`청크 ${i} 업로드 실패 (${res.status}): ${await res.text()}`);

			const pct = Math.round(((i + 1) / totalChunks) * 90);
			logAppend(`@#>upload-progress: ${pct}%  (${i + 1}/${totalChunks} 청크 완료)`);
		}

		// 병합 요청
		logAppend(`@#>upload-progress: 95%  병합 중...`);
		const mergeRes = await fetch(`${serverUrl}/api/upload/merge`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ uploadId, fileName, totalChunks }),
		});
		if (!mergeRes.ok) throw new Error(`병합 실패 (${mergeRes.status}): ${await mergeRes.text()}`);

		const mergeData = await mergeRes.json();
		if (!mergeData.success) throw new Error(`병합 오류: ${mergeData.error}`);
		logAppend(`@#>upload-progress: 100%  완료!`);

		return { name: fileName, url: mergeData.filePath };
	}
}

function zipFileList(zipPath) {
	try {
		if (!fs.existsSync(zipPath)) {
			return logAppend("@#>zip-error: ZIP 파일을 찾을 수 없습니다: " + zipPath);
		}
		const zip = new AdmZip(zipPath);
		const entries = zip.getEntries().map(entry => ({
			name: entry.entryName,
			isDirectory: entry.isDirectory,
			size: entry.header.size,
			compressedSize: entry.header.compressedSize,
			ratio: entry.header.size > 0
				? ((1 - entry.header.compressedSize / entry.header.size) * 100).toFixed(1)
				: '0.0',
			date: entry.header.time ? new Date(entry.header.time).toISOString() : null,
			comment: entry.comment || ''
		}));

		const files = entries.filter(e => !e.isDirectory);
		const totalSize = files.reduce((s, f) => s + f.size, 0);
		const totalCompressed = files.reduce((s, f) => s + f.compressedSize, 0);
		const result = {
			file: path.basename(zipPath),
			fileCount: files.length,
			totalSize,
			totalCompressed,
			savedRatio: totalSize > 0
				? ((1 - totalCompressed / totalSize) * 100).toFixed(1)
				: '0.0',
			entries
		}
		logAppend("@#>zip-result: " + JSON.stringify(result, null, 2));
	} catch (err) {
		logAppend("@#>zip-error: " + err.message);
	}
}

async function parseCommand(type, msg) {
	if (type == 'quit') {
		process.exit(0);
	}
	else if (type == 'zip') {
		zipFileList(msg);
	}
	else if (type == 'upload') {
		try {
			const result = await uploadToServer(msg, flags.server);
			logAppend(`@#>upload-result: ${JSON.stringify(result)}`);
		} catch (error) {
			logAppend(`@#>upload-error: ${error}`);
		}
	}

}

// ── 파일 감시 & 증분 출력 ────────────────────────────────────────────────────
function watchFile(filePath) {
	let lastSize = fs.statSync(filePath).size;

	const watcher = fs.watch(filePath, { encoding: 'utf8' }, (eventType) => {
		// logAppend(`@#>eventType: ${eventType}`);
		if (eventType !== 'change') return;

		let stat;
		try {
			stat = fs.statSync(filePath);
		} catch {
			// 파일이 삭제/재생성되는 경우
			logAppend(`@#>file-check: ⚠ 파일이 삭제되거나 교체되었습니다. 감시를 계속합니다...`);
			lastSize = 0;
			return;
		}

		const currentSize = stat.size;

		if (currentSize < lastSize) {
			// 파일이 truncate 된 경우 처음부터 다시 읽기
			logAppend(`@#>file-check: ⚠ 파일이 초기화(truncate)되었습니다.`);
			lastSize = 0;
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
			// console.log("type==>" + type + " msg==>" + msg)
			parseCommand(type, msg)
			if (ep == -1) break;
			sp = ep + 3
		}
		/* 추가된 내용을 줄 단위로 출력
		const newLines = newText.split('\n');
		newLines.forEach((line, idx) => {
			// 마지막 빈 줄(개행 끝)은 건너뜀
			if (idx === newLines.length - 1 && line === '') return;
			process.stdout.write(`[${timestamp()}] ${line}\n`);
		});
		*/
	});

	watcher.on('error', (err) => {
		logAppend(`@#>file-check: 감시 오류: ${err.message}`);
	});

	return watcher;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
logAppend(`@#>log-parse: 👁  감시 시작: ${targetPath}`);
logAppend(`@#>log-parse: Ctrl+C 로 종료\n`);

// printLastLines(targetPath, flags.lines);
watchFile(targetPath);

// Ctrl+C 처리
process.on('SIGINT', () => {
	logAppend(`@#>log-parse: 감시를 종료합니다.`);
	process.exit(0);
});
