// "@imgly/background-removal-node": "^1.4.5",
import { removeBackground } from '@imgly/background-removal-node';
import fs from "fs";
import path from "path";

const SMALL_FILE_LIMIT = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE       = 2  * 1024 * 1024; // 2MB (서버 routes/upload.js 와 동일)

/**
 * 파일 크기가 10MB 이하면 /api/upload/file (단순 업로드),
 * 초과하면 /api/upload/chunk + /api/upload/merge (청크 업로드)를 자동으로 선택합니다.
 * @param {string} filePath  - 업로드할 로컬 파일 경로
 * @param {string} serverUrl - 서버 베이스 URL (예: http://localhost:8081)
 * @returns {Promise<{name: string, url: string}>}
 */
async function uploadToServer(filePath, serverUrl) {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName   = path.basename(filePath);
    const fileSize   = fileBuffer.byteLength;

    if (fileSize <= SMALL_FILE_LIMIT) {
        // ── 일반 업로드 ──────────────────────────────────────────────────────
        console.log(`\n📤 일반 업로드 중 (${(fileSize / 1024 / 1024).toFixed(2)} MB): ${serverUrl}/api/upload/file`);

        const formData = new FormData();
        formData.append('file', new Blob([fileBuffer], { type: 'image/png' }), fileName);

        const res = await fetch(`${serverUrl}/api/upload/file`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`업로드 실패 (${res.status}): ${await res.text()}`);

        const data = await res.json();
        return { name: data.name, url: data.url };

    } else {
        // ── 청크 업로드 ──────────────────────────────────────────────────────
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
        const uploadId    = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        console.log(`\n📦 청크 업로드 시작 (${(fileSize / 1024 / 1024).toFixed(2)} MB → ${totalChunks}개 청크, ID: ${uploadId})`);

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
            process.stdout.write(`\r   진행률: ${pct}%  (${i + 1}/${totalChunks} 청크 완료)`);
        }

        // 병합 요청
        process.stdout.write(`\r   진행률: 95%  병합 중...                          \n`);
        const mergeRes = await fetch(`${serverUrl}/api/upload/merge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId, fileName, totalChunks }),
        });
        if (!mergeRes.ok) throw new Error(`병합 실패 (${mergeRes.status}): ${await mergeRes.text()}`);

        const mergeData = await mergeRes.json();
        if (!mergeData.success) throw new Error(`병합 오류: ${mergeData.error}`);
        process.stdout.write(`   진행률: 100%  완료!\n`);

        return { name: fileName, url: mergeData.filePath };
    }
}

async function runBackgroundRemoval() {
    const rawArgs = process.argv.slice(2);

    // 플래그 파싱: --upload, --server <url>
    const flags = { upload: false, server: 'http://localhost:8081' };
    const positionalArgs = [];

    for (let i = 0; i < rawArgs.length; i++) {
        if (rawArgs[i] === '--upload') {
            flags.upload = true;
        } else if (rawArgs[i] === '--server' && rawArgs[i + 1]) {
            flags.server = rawArgs[++i];
        } else {
            positionalArgs.push(rawArgs[i]);
        }
    }

    if (positionalArgs.length < 1) {
        console.log("사용법: node scripts/remove-bg.js <원본이미지경로> [결과이미지경로] [옵션]");
        console.log("예시: node scripts/remove-bg.js public/images/sample.jpg public/images/sample-nobg.png");
        console.log("      node scripts/remove-bg.js public/images/sample.jpg --upload");
        console.log("      node scripts/remove-bg.js public/images/sample.jpg --upload --server http://localhost:8081");
        process.exit(1);
    }

    const inputPath = path.resolve(positionalArgs[0]);
    if (!fs.existsSync(inputPath)) {
        console.error(`❌ 파일을 찾을 수 없습니다: ${inputPath}`);
        process.exit(1);
    }

    // 결과 파일 경로를 지정하지 않았을 경우 원본 파일 이름에 -nobg 를 붙여서 생성
    const parsedPath = path.parse(inputPath);
    const defaultOutputPath = path.join(parsedPath.dir, `${parsedPath.name}-nobg.png`);
    const outputPath = positionalArgs[1] ? path.resolve(positionalArgs[1]) : defaultOutputPath;

    try {
        console.log(`⏳ 모델 셋업 및 이미지 분석 중 (최초 1회 실행 시 AI 모델을 다운로드하므로 1~2분 정도 걸릴 수 있습니다)...`);

        // Read file into a Node.js Buffer
        const imageBuffer = fs.readFileSync(inputPath);

        // Determine mime type based on extension
        const ext = path.extname(inputPath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';

        // Convert the Buffer to a Blob required by @imgly/background-removal-node
        const blob = new Blob([imageBuffer], { type: mimeType });

        // Run AI removal
        const resultBlob = await removeBackground(blob);

        // Convert result Blob back to Buffer and save
        const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());

        fs.writeFileSync(outputPath, resultBuffer);

        console.log(`\n🎉 배경 제거 완료! 아래에 저장되었습니다:\n${outputPath}`);

        // --upload 플래그가 있으면 서버로 업로드
        if (flags.upload) {
            try {
                const result = await uploadToServer(outputPath, flags.server);
                console.log(`\n✅ 서버 업로드 성공!`);
                console.log(`   - 파일명: ${result.name}`);
                console.log(`   - 서버 URL: ${flags.server}${result.url}`);
            } catch (uploadError) {
                console.error(`\n❌ 서버 업로드 실패:`, uploadError.message);
            }
        }
    } catch (error) {
        console.error("❌ 배경 제거 중 오류가 발생했습니다:", error);
    }
}

runBackgroundRemoval();
