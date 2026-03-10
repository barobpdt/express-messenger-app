const fs = require('fs');
const path = require('path');

try {
    require.resolve('canvas');
    require.resolve('gifencoder');
} catch (e) {
    console.error('필수 라이브러리가 설치되지 않았습니다. 먼저 아래 명령어를 실행해주세요:');
    console.error('npm install canvas gifencoder');
    process.exit(1);
}

const { createCanvas, loadImage } = require('canvas');
const GIFEncoder = require('gifencoder');

async function convertSpriteToGif() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log('사용법: node scripts/sprite-to-gif.js <이미지경로> <프레임가로> <프레임세로> [FPS(기본10)]');
        console.log('예시: node scripts/sprite-to-gif.js public/images/sprite/8049563-bg.png 300 200 10');
        process.exit(1);
    }

    const inputPath = path.resolve(args[0]);
    const frameWidth = parseInt(args[1], 10);
    const frameHeight = parseInt(args[2], 10);
    const fps = args[3] ? parseInt(args[3], 10) : 10;

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ 파일을 찾을 수 없습니다: ${inputPath}`);
        process.exit(1);
    }

    const outputPath = inputPath.replace(/\.png$/i, '.gif');

    console.log(`🖼️ 이미지 로딩 중: ${inputPath}`);
    const image = await loadImage(inputPath);
    console.log(`✅ 원본 크기: ${image.width} x ${image.height}`);

    const cols = Math.floor(image.width / frameWidth);
    const rows = Math.floor(image.height / frameHeight);
    const totalFrames = cols * rows;

    if (totalFrames <= 0) {
        console.error('❌ 프레임 설정 오류: 잘라낼 프레임 크기가 원본 이미지보다 큽니다!');
        process.exit(1);
    }

    console.log(`🎬 분할 형태: ${cols}열 x ${rows}행 = 총 ${totalFrames}개 프레임 GIF로 조립 시작`);

    const encoder = new GIFEncoder(frameWidth, frameHeight);
    encoder.createReadStream().pipe(fs.createWriteStream(outputPath));

    encoder.start();
    encoder.setRepeat(0);   // 무한 반복
    encoder.setDelay(1000 / fps);  // 프레임 지연 시간
    encoder.setQuality(10); // 기본 품질
    encoder.setTransparent(0x00000000); // 투명 배경 지원

    const canvas = createCanvas(frameWidth, frameHeight);
    const ctx = canvas.getContext('2d');

    let count = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            ctx.clearRect(0, 0, frameWidth, frameHeight);

            // X, Y 시작점부터 가로/세로 만큼 잘라내어 캔버스에 그리기
            ctx.drawImage(
                image,
                col * frameWidth, row * frameHeight, frameWidth, frameHeight,
                0, 0, frameWidth, frameHeight
            );

            encoder.addFrame(ctx);
            count++;
            process.stdout.write(`\r⏳ 처리 중... (${count}/${totalFrames})`);
        }
    }

    encoder.finish();
    console.log(`\n🎉 변환 완료! 아래에 저장되었습니다:\n${outputPath}`);
}

convertSpriteToGif().catch(err => {
    console.error('\n❌ 에러 발생:', err);
});
