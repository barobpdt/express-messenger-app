import fs from 'fs';
import path from 'path';

// CLI Arguments
const args = process.argv.slice(2);
const inputFile = args[0];
const outputFile = args[1];

//[사용방법] node scripts/img2base64.js <이미지_경로> <저장할_텍스트파일_경로>

if (!inputFile) {
    console.log('이미지를 읽어 Base64 형식으로 변환합니다.');
    console.error('사용법: node img2base64.js <이미지_파일_경로> [출력_텍스트_파일경로]');
    process.exit(1);
}

try {
    const filePath = path.resolve(inputFile);
    if (!fs.existsSync(filePath)) {
        console.error(`입력 파일을 찾을 수 없습니다: ${filePath}`);
        process.exit(1);
    }

    // Read file
    const fileBuffer = fs.readFileSync(filePath);

    // Determine mime type based on extension for standard data URI
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.svg') mimeType = 'image/svg+xml';
    else if (ext === '.webp') mimeType = 'image/webp';

    // Convert to base64 and format as Data URI
    const base64Data = fileBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    if (outputFile) {
        // Save to file if output path is provided
		try {
			const outPath = path.resolve(outputFile);
			fs.appendFileSync(outPath, `\n@#>runScript:addChatMessage('<img src="${dataUri}">')`, 'utf8');
			console.log(`✅ Base64 데이터가 성공적으로 저장되었습니다: ${outPath}`);
		} catch(err) {
			console.log(`✅ Base64 데이터가 생성오류: ${outPath} 에러:${err}`);
		}
    } else {
        // Print to console
        console.log('--- 변환된 Base64(Data URI) 데이터 결과 ---');
        console.log(dataUri);
        console.log('\n💡 팁: 텍스트 파일로 바로 저장하려면 아래와 같이 실행하세요.');
        console.log(`   node img2base64.js "${inputFile}" output.txt`);
    }

} catch (err) {
    console.error('❌ 변환 중 오류 발생:', err.message);
}
