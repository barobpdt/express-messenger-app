/**
 * Windows 서비스 제거 스크립트
 * 실행 방법: node scripts/uninstall-service.cjs
 * ※ 반드시 관리자 권한으로 실행하세요
 */
const { Service } = require('node-windows');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const svc = new Service({
    name: 'ExpressSampleServer',
    script: path.join(rootDir, 'server.js'),
});

svc.on('uninstall', () => {
    console.log('✅ 서비스 제거 완료: ExpressSampleServer');
});

svc.on('error', (err) => {
    console.error('❌ 오류:', err);
});

svc.on('notinstalled', () => {
    console.log('⚠️  설치된 서비스가 없습니다.');
});

console.log('🗑️  Windows 서비스 제거 중...');
svc.uninstall();
