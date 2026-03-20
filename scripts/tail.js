/**
 * tail.js - Unix tail -f 처럼 파일 변경 시 새로 추가된 내용만 실시간 출력
 *
 * 사용법:
 *   node scripts/tail.js <파일경로>
 *   node scripts/tail.js logs/2026-03-20.log
 *   node scripts/tail.js logs/2026-03-20.log --lines 20   ← 시작 시 마지막 N줄 출력 (기본 10)
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ── 인수 파싱 ────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const flags   = { lines: 10 };
const positional = [];

for (let i = 0; i < rawArgs.length; i++) {
    if ((rawArgs[i] === '--lines' || rawArgs[i] === '-n') && rawArgs[i + 1]) {
        flags.lines = parseInt(rawArgs[++i], 10);
    } else {
        positional.push(rawArgs[i]);
    }
}

if (positional.length < 1) {
    console.error('사용법: node scripts/tail.js <파일경로> [--lines N]');
    process.exit(1);
}

const targetPath = path.resolve(positional[0]);

if (!fs.existsSync(targetPath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${targetPath}`);
    process.exit(1);
}

// ── 컬러 헬퍼 (ANSI 이스케이프) ─────────────────────────────────────────────
const RESET  = '\x1b[0m';
const CYAN   = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const DIM    = '\x1b[2m';

function timestamp() {
    return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

// ── 시작 시 마지막 N줄 출력 ──────────────────────────────────────────────────
function printLastLines(filePath, n) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines   = content.split('\n');
    // 마지막 빈 줄 제거 후 뒤에서 n줄
    const tail    = lines.filter((_, i) => i < lines.length - 1 || lines[i] !== '').slice(-n);

    if (tail.length > 0) {
        console.log(`${DIM}── 마지막 ${tail.length}줄 ─────────────────────────${RESET}`);
        tail.forEach(line => console.log(`${DIM}${line}${RESET}`));
        console.log(`${DIM}─────────────────────────────────────────${RESET}`);
    }
}

// ── 파일 감시 & 증분 출력 ────────────────────────────────────────────────────
function watchFile(filePath) {
    let lastSize = fs.statSync(filePath).size;

    const watcher = fs.watch(filePath, { encoding: 'utf8' }, (eventType) => {
        if (eventType !== 'change') return;

        let stat;
        try {
            stat = fs.statSync(filePath);
        } catch {
            // 파일이 삭제/재생성되는 경우
            console.log(`${YELLOW}⚠ 파일이 삭제되거나 교체되었습니다. 감시를 계속합니다...${RESET}`);
            lastSize = 0;
            return;
        }

        const currentSize = stat.size;

        if (currentSize < lastSize) {
            // 파일이 truncate 된 경우 처음부터 다시 읽기
            console.log(`${YELLOW}⚠ 파일이 초기화(truncate)되었습니다.${RESET}`);
            lastSize = 0;
        }

        if (currentSize === lastSize) return;

        const lengthToRead = currentSize - lastSize;
        const buffer = Buffer.alloc(lengthToRead);
        const fd     = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, lengthToRead, lastSize);
        fs.closeSync(fd);
        lastSize = currentSize;

        const newText = buffer.toString('utf8');
        // 추가된 내용을 줄 단위로 출력
        const newLines = newText.split('\n');
        newLines.forEach((line, idx) => {
            // 마지막 빈 줄(개행 끝)은 건너뜀
            if (idx === newLines.length - 1 && line === '') return;
            process.stdout.write(`${GREEN}[${timestamp()}]${RESET} ${line}\n`);
        });
    });

    watcher.on('error', (err) => {
        console.error(`${YELLOW}감시 오류: ${err.message}${RESET}`);
    });

    return watcher;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
console.log(`${CYAN}👁  감시 시작: ${targetPath}${RESET}`);
console.log(`${DIM}    Ctrl+C 로 종료${RESET}\n`);

printLastLines(targetPath, flags.lines);
watchFile(targetPath);

// Ctrl+C 처리
process.on('SIGINT', () => {
    console.log(`\n${CYAN}감시를 종료합니다.${RESET}`);
    process.exit(0);
});
