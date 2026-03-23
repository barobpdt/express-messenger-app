import AdmZip from "adm-zip";
import fs from 'fs';
import path from 'path';
// import fetch from 'node-fetch';

const rawArgs = process.argv.slice(2);
const flags = { lines: 10 };
const positional = [];

for (let i = 0; i < rawArgs.length; i++) {
	if ((rawArgs[i] === '--lines' || rawArgs[i] === '-n') && rawArgs[i + 1]) {
		flags.lines = parseInt(rawArgs[++i], 10);
	} else {
		positional.push(rawArgs[i]);
	}
}

async function zipFileList(zipPath) {
	try {
		if (!fs.existsSync(zipPath)) {
			return console.log({ error: "ZIP 파일을 찾을 수 없습니다: " + relPath });
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
		console.log(JSON.stringify(result, null, 2));
	} catch (err) {
		console.log("ZIP list error", { error: err.message });
	}
}

zipFileList(positional[0]);
