/**
 * tablet-agent.js
 * 태블릿 order.html 에 포함되어 오류 수집, 화면 캡처, 원격 명령 수신을 처리합니다.
 * order.js 의 전역 변수 ws 를 공유합니다.
 * html2canvas CDN 이 먼저 로드되어야 합니다.
 */

(function () {
    'use strict';

    // ── 설정 ───────────────────────────────────────────────────────────────────
    const SCREENSHOT_QUALITY = 0.6;   // 0~1 (낮을수록 용량 감소)
    const SCREENSHOT_SCALE   = 0.5;   // 렌더 해상도 비율

    // ── WebSocket 전송 헬퍼 (order.js 의 ws 를 공유) ───────────────────────────
    function sendWs(payload) {
        // order.js 에서 ws 변수가 초기화될 시간을 고려해 지연 발송
        const tryCount = { n: 0 };
        function trySend() {
            if (typeof ws !== 'undefined' && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
            } else if (tryCount.n < 10) {
                tryCount.n++;
                setTimeout(trySend, 500);
            }
        }
        trySend();
    }

    // ── 화면 캡처 ──────────────────────────────────────────────────────────────
    async function captureScreen() {
        if (typeof html2canvas === 'undefined') return null;
        try {
            const canvas = await html2canvas(document.body, {
                scale: SCREENSHOT_SCALE,
                useCORS: true,
                logging: false,
                ignoreElements: (el) => el.id === 'screensaver' && !el.classList.contains('active'),
            });
            return canvas.toDataURL('image/jpeg', SCREENSHOT_QUALITY);
        } catch (e) {
            console.warn('[tablet-agent] 화면 캡처 실패:', e);
            return null;
        }
    }

    // ── 오류 보고 ──────────────────────────────────────────────────────────────
    async function reportError(errorInfo) {
        const screenshot = await captureScreen();
        const urlParams = new URLSearchParams(window.location.search);
        sendWs({
            type: 'tablet-error',
            tableId: urlParams.get('tableId') || '?',
            timestamp: Date.now(),
            error: errorInfo,
            screenshot,
            url: window.location.href,
            ua: navigator.userAgent,
        });
    }

    // ── native fetch 패치 (API 오류 감지) ────────────────────────────────────
    const _origFetch = window.fetch;
    window.fetch = async function (...args) {
        try {
            const res = await _origFetch.apply(this, args);
            if (!res.ok) {
                const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
                reportError({
                    type: 'fetch',
                    message: `HTTP ${res.status} ${res.statusText}`,
                    url,
                });
            }
            return res;
        } catch (err) {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
            reportError({ type: 'fetch', message: err.message, url });
            throw err;
        }
    };

    // ── 전역 JS 오류 감지 ─────────────────────────────────────────────────────
    const _origOnError = window.onerror;
    window.onerror = function (msg, src, line, col, err) {
        reportError({
            type: 'js',
            message: msg,
            source: src,
            line,
            col,
            stack: err?.stack || '',
        });
        if (typeof _origOnError === 'function') _origOnError.apply(this, arguments);
        return false; // 기본 처리도 계속 진행
    };

    window.addEventListener('unhandledrejection', (e) => {
        reportError({
            type: 'promise',
            message: e.reason?.message || String(e.reason),
            stack: e.reason?.stack || '',
        });
    });

    // ── 원격 명령 수신 ─────────────────────────────────────────────────────────
    async function handleCommand(data) {
        switch (data.cmd) {
            case 'reload':
                window.location.reload();
                break;

            case 'eval':
                try {
                    // eslint-disable-next-line no-eval
                    const result = eval(data.code);
                    sendWs({ type: 'tablet-cmd-result', tableId: data.tableId, result: String(result) });
                } catch (e) {
                    sendWs({ type: 'tablet-cmd-result', tableId: data.tableId, result: `ERROR: ${e.message}` });
                }
                break;

            case 'alert':
                if (typeof showPopup === 'function') {
                    showPopup('📢 관리자 메시지', data.message, '📢');
                } else {
                    alert(data.message);
                }
                break;

            case 'navigate':
                window.location.href = data.url;
                break;

            case 'screenshot': {
                const screenshot = await captureScreen();
                const urlParams = new URLSearchParams(window.location.search);
                sendWs({
                    type: 'tablet-screenshot',
                    tableId: urlParams.get('tableId') || '?',
                    timestamp: Date.now(),
                    screenshot,
                });
                break;
            }

            default:
                console.warn('[tablet-agent] 알 수 없는 명령:', data.cmd);
        }
    }

    // ── ws 메시지 핸들러 연결 (order.js 의 ws.onmessage 를 래핑) ─────────────
    function hookWsMessage() {
        if (typeof ws === 'undefined' || !ws) {
            setTimeout(hookWsMessage, 300);
            return;
        }

        const _origOnMessage = ws.onmessage;
        ws.onmessage = function (event) {
            // 기존 핸들러 호출
            if (typeof _origOnMessage === 'function') _origOnMessage.call(this, event);

            try {
                const data = JSON.parse(event.data);
                if (data.type === 'tablet-cmd') {
                    handleCommand(data);
                }
            } catch { /* JSON 파싱 실패는 무시 */ }
        };

        // 관리자에게 접속 알림
        const urlParams = new URLSearchParams(window.location.search);
        sendWs({
            type: 'tablet-init',
            tableId: urlParams.get('tableId') || '?',
            timestamp: Date.now(),
            url: window.location.href,
        });

        console.log('[tablet-agent] 모니터링 에이전트 활성화');
    }

    // DOMContentLoaded 후 ws 가 준비될 때까지 폴링
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(hookWsMessage, 800));
    } else {
        setTimeout(hookWsMessage, 800);
    }
})();
