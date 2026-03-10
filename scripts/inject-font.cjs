const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if pretendard.css is already injected
    if (!content.includes('pretendard.css')) {
        content = content.replace('</head>', '\t<link rel="stylesheet" href="/css/pretendard.css">\n</head>');

        // Remove existing Google Fonts Inter if any to avoid loading unused fonts
        content = content.replace(/<link[^>]*family=Inter[^>]*>/g, '');

        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${file}`);
    } else {
        console.log(`Skipped ${file} (already updated)`);
    }
});
