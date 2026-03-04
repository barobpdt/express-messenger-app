/**
 * Windows 서비스 등록 스크립트
 * 실행 방법: node scripts/install-service.cjs
 * ※ 반드시 관리자 권한으로 실행하세요
 */
const { Service } = require('node-windows');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const svc = new Service({
    name: 'ExpressSampleServer',
    description: 'Express Sample Node.js Server (카라오케/주문 시스템)',
    script: path.join(rootDir, 'server.js'),
    // node-windows는 내부적으로 node를 실행 — ESM은 package.json "type":"module" 로 처리됨
    nodeOptions: [],
    env: [
        // .env 파일을 사용하고 있어 별도 환경변수 불필요하지만
        // 필요 시 여기에 추가 가능
        // { name: 'NODE_ENV', value: 'production' }
    ],
    // 서비스 재시작 정책 (크래시 시 자동 재시작)
    wait: 2,   // 재시작 전 대기 (초)
    grow: 0.5, // 재시작 간격 증가 배율
});

svc.on('install', () => {
    console.log('✅ 서비스 설치 완료 — 서비스를 시작합니다...');
    svc.start();
});

svc.on('start', () => {
    console.log('🚀 서비스 시작됨: ExpressSampleServer');
    console.log('   services.msc 에서 상태를 확인할 수 있습니다.');
});

svc.on('error', (err) => {
    console.error('❌ 서비스 오류:', err);
});

svc.on('alreadyinstalled', () => {
    console.log('⚠️  이미 설치된 서비스입니다. 먼저 uninstall-service.cjs를 실행하세요.');
});

console.log('📦 Windows 서비스 등록 중...');
console.log('   서비스명: ExpressSampleServer');
console.log('   스크립트:', svc.script);
svc.install();
