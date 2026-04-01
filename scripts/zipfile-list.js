import AdmZip from "adm-zip";
import fs from 'fs';
import path from 'path';
// import fetch from 'node-fetch';

const args = process.argv.slice(2);
const inputFile = args[0];
const outputFile = args[1];

function zipFileList(zipPath) {
	try {
		if (!fs.existsSync(zipPath)) {
			return console.log({ error: "ZIP 파일을 찾을 수 없습니다: " + zipPath });
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
		// console.log(JSON.stringify(result, null, 2));

		if (outputFile) {
			// Save to file if output path is provided
			try {
				const outPath = path.resolve(outputFile);
				fs.appendFileSync(outPath, `\n@#>runScript:setZipfileList('${JSON.stringify(result)}')`, 'utf8');
				console.log(`✅ Base64 데이터가 성공적으로 저장되었습니다: ${outPath}`);
			} catch (err) {
				console.log(`✅ Base64 데이터가 생성오류: ${outPath} 에러:${err}`);
			}
		} else {
			console.log(`   node zipfile-list.js "${inputFile}" output.txt`);
		}
	} catch (err) {
		console.log("ZIP list error", { error: err.message });
	}
}

zipFileList(inputFile);
