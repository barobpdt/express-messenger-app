import { marpCli } from '@marp-team/marp-cli';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(__dirname);
// npm install @marp-team/marp-cli
// 변환할 마크다운 파일 경로와 저장할 PPTX 파일 경로
const inputMarkdownPath = path.join(__dirname, 'sample.md');
const outputPptxPath = path.join(__dirname, 'presentation.pptx');

// 샘플 마크다운 파일이 없으면 생성합니다. (테스트용)
if (!fs.existsSync(inputMarkdownPath)) {
    const sampleMd = `
---
marp: true
theme: default
---
# 첫 번째 슬라이드
마크다운을 PPTX로 변환하는 테스트입니다.
---
# 두 번째 슬라이드
- 항목 1
- 항목 2
- 항목 3
`;
    fs.writeFileSync(inputMarkdownPath, sampleMd);
    console.log('테스트용 sample.md 파일을 생성했습니다.');
}

console.log('Markdown을 PPTX로 변환 중입니다...');

// Marp CLI를 프로그래밍 방식으로 실행
marpCli([inputMarkdownPath, '-o', outputPptxPath])
    .then((exitStatus) => {
        if (exitStatus > 0) {
            console.error(`변환 실패 (종료 코드: ${exitStatus})`);
        } else {
            console.log(`변환 성공! 파일이 저장되었습니다: ${outputPptxPath}`);
        }
    })
    .catch((err) => {
        console.error('변환 중 에러 발생:', err);
    });
