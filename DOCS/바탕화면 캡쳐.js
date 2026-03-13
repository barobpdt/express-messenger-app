npm install screenshot-desktop
import screenshot from 'screenshot-desktop';
import fs from 'fs';
// 전체 화면 캡처 → 파일 저장
const img = await screenshot({ format: 'png' });
fs.writeFileSync('screen.png', img);
console.log('캡처 완료: screen.png');

// 다중 모니터가 있는 경우 특정 모니터 지정
const displays = await screenshot.listDisplays();
console.log(displays); // [{ id: 1, name: '...' }, ...]
const img2 = await screenshot({ screen: displays[0].id, format: 'png' });


방법 2: PowerShell 네이티브 호출 (패키지 없이)
javascript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
async function captureScreen(outputPath = 'C:\\screen.png') {
    const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen
        $bmp = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $screen.Bounds.Size)
        $bmp.Save('${outputPath.replace(/\\/g, '\\\\')}')
        $g.Dispose(); $bmp.Dispose()
    `;
    await execAsync(`powershell -Command "${psScript}"`);
    console.log(`캡처 완료: ${outputPath}`);
}
captureScreen();


## API
import screenshot from 'screenshot-desktop';
import path from 'path';
app.get('/api/screenshot', async (req, res) => {
    const img = await screenshot({ format: 'png' });
    const filename = `screen_${Date.now()}.png`;
    const savePath = path.join(__dirname, 'public/uploads/files', filename);
    fs.writeFileSync(savePath, img);
    res.json({ url: `/uploads/files/${filename}` });
});
