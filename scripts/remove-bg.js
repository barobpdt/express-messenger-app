// "@imgly/background-removal-node": "^1.4.5",
import { removeBackground } from '@imgly/background-removal-node';
import fs from "fs";
import path from "path";

async function runBackgroundRemoval() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log("사용법: node scripts/remove-bg.js <원본이미지경로> [결과이미지경로]");
        console.log("예시: node scripts/remove-bg.js public/images/sample.jpg public/images/sample-nobg.png");
        process.exit(1);
    }

    const inputPath = path.resolve(args[0]);
    if (!fs.existsSync(inputPath)) {
        console.error(`❌ 파일을 찾을 수 없습니다: ${inputPath}`);
        process.exit(1);
    }

    // 결과 파일 경로를 지정하지 않았을 경우 원본 파일 이름에 -nobg 를 붙여서 생성
    const parsedPath = path.parse(inputPath);
    const defaultOutputPath = path.join(parsedPath.dir, `${parsedPath.name}-nobg.png`);
    const outputPath = args[1] ? path.resolve(args[1]) : defaultOutputPath;

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
    } catch (error) {
        console.error("❌ 배경 제거 중 오류가 발생했습니다:", error);
    }
}

runBackgroundRemoval();
