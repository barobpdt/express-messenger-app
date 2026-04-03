/**
 * translate-client.js
 * LibreTranslate 서버 프록시(/api/translate)를 통한 메신저 번역 클라이언트
 *
 * 사용법:
 *   <script src="./js/translate-client.js"></script>
 *   webview-messenger.js 에서 initTranslate() 호출 후 사용
 */

const TranslateClient = (() => {
  // ─── 설정 ───
  let _targetLang = localStorage.getItem('translate_targetLang') || 'ko';
  let _enabled = localStorage.getItem('translate_enabled') === 'true';
  let _serverAvailable = null; // null=미확인, true=온라인, false=오프라인

  // ─── CSS 주입 ───
  const _css = `
    .translate-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.72rem;
      color: var(--text-muted, #8b949e);
      cursor: pointer;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid transparent;
      transition: 0.15s;
      user-select: none;
    }
    .translate-btn:hover {
      color: #60a5fa;
      border-color: rgba(96,165,250,0.3);
      background: rgba(96,165,250,0.07);
    }
    .translate-btn.loading {
      opacity: 0.6;
      pointer-events: none;
    }
    .translate-result {
      display: none;
      margin-top: 6px;
      padding: 6px 10px;
      background: rgba(96,165,250,0.08);
      border-left: 3px solid #60a5fa;
      border-radius: 0 6px 6px 0;
      font-size: 0.85rem;
      color: #bae6fd;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .translate-result .translate-lang-tag {
      font-size: 0.7rem;
      color: #60a5fa;
      margin-bottom: 3px;
      opacity: 0.8;
    }
    .translate-result.visible {
      display: block;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .translate-server-badge {
      position: fixed;
      bottom: 80px;
      right: 12px;
      font-size: 0.72rem;
      padding: 3px 8px;
      border-radius: 8px;
      background: rgba(0,0,0,0.5);
      color: #fff;
      z-index: 9999;
      pointer-events: none;
      display: none;
    }
  `;

  function _injectStyle() {
    const style = document.createElement('style');
    style.textContent = _css;
    document.head.appendChild(style);
  }

  // ─── 서버 상태 확인 ───
  async function checkServerHealth(backendOrigin = '') {
    try {
      const res = await fetch(`${backendOrigin}/api/translate/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json();
      _serverAvailable = data.status === 'ok';
    } catch {
      _serverAvailable = false;
    }
    return _serverAvailable;
  }

  // ─── 핵심 번역 함수 ───
  async function translate(text, targetLang, backendOrigin = '') {
    if (!text || !text.trim()) return null;

    try {
      const res = await fetch(`${backendOrigin}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          source: 'auto',
          target: targetLang || _targetLang,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }

      return await res.json(); // { translatedText, detectedLanguage, cached }
    } catch (err) {
      console.error('[TranslateClient]', err.message);
      throw err;
    }
  }

  // ─── 메시지 버블에 번역 버튼 삽입 ───
  function attachToBubble(messageEl, originalText, backendOrigin = '') {
    if (!originalText || !originalText.trim()) return;

    // data-translatable 중복 방지
    if (messageEl.dataset.translatable) return;
    messageEl.dataset.translatable = '1';

    const metaEl = messageEl.querySelector('.meta');
    if (!metaEl) return;

    // 번역 결과 영역
    const resultEl = document.createElement('div');
    resultEl.className = 'translate-result';
    const bubbleEl = messageEl.querySelector('.bubble');
    if (bubbleEl) {
      bubbleEl.parentElement.insertBefore(resultEl, bubbleEl.nextSibling);
    }

    // 번역 버튼
    const btn = document.createElement('span');
    btn.className = 'translate-btn';
    btn.innerHTML = '🌐 번역';
    btn.title = '번역 보기/숨기기';
    metaEl.appendChild(btn);

    let translated = null; // 캐싱

    btn.addEventListener('click', async () => {
      // 토글: 이미 번역 결과 보이면 숨기기
      if (resultEl.classList.contains('visible')) {
        resultEl.classList.remove('visible');
        btn.innerHTML = '🌐 번역';
        return;
      }

      // 이미 가져온 번역 재사용
      if (translated) {
        resultEl.classList.add('visible');
        btn.innerHTML = '🌐 숨기기';
        return;
      }

      // 번역 요청
      btn.classList.add('loading');
      btn.innerHTML = '⏳ 번역 중...';

      try {
        const result = await translate(originalText, _targetLang, backendOrigin);
        translated = result.translatedText;

        const langTag = result.detectedLanguage
          ? `<div class="translate-lang-tag">감지된 언어: ${result.detectedLanguage.language || result.detectedLanguage} → ${_targetLang}</div>`
          : '';
        resultEl.innerHTML = `${langTag}${translated}`;
        resultEl.classList.add('visible');
        btn.innerHTML = '🌐 숨기기';
      } catch (err) {
        resultEl.innerHTML = `<span style="color:#f87171">번역 실패: ${err.message}</span>`;
        resultEl.classList.add('visible');
        btn.innerHTML = '🌐 번역';
      } finally {
        btn.classList.remove('loading');
      }
    });
  }

  // ─── 자동 번역 (전체 채팅 수신 시 자동 적용) ───
  async function autoTranslate(messageEl, originalText, backendOrigin = '') {
    if (!_enabled) return;
    const resultEl = messageEl.querySelector('.translate-result');
    if (!resultEl) return;

    try {
      const result = await translate(originalText, _targetLang, backendOrigin);
      const langTag = result.detectedLanguage
        ? `<div class="translate-lang-tag">자동번역 (${result.detectedLanguage.language || result.detectedLanguage} → ${_targetLang})</div>`
        : '<div class="translate-lang-tag">자동번역</div>';
      resultEl.innerHTML = `${langTag}${result.translatedText}`;
      resultEl.classList.add('visible');
    } catch {
      // 자동 번역 실패는 무시
    }
  }

  // ─── 설정 변경 ───
  function setTargetLang(lang) {
    _targetLang = lang;
    localStorage.setItem('translate_targetLang', lang);
  }

  function setAutoTranslate(enabled) {
    _enabled = enabled;
    localStorage.setItem('translate_enabled', enabled ? 'true' : 'false');
  }

  function getTargetLang() { return _targetLang; }
  function isAutoEnabled() { return _enabled; }
  function isServerAvailable() { return _serverAvailable; }

  // ─── 초기화 ───
  function init(backendOrigin = '') {
    _injectStyle();
    // 서버 상태 비동기 확인
    checkServerHealth(backendOrigin).then(ok => {
      console.log(`[TranslateClient] LibreTranslate 서버: ${ok ? '✅ 연결됨' : '❌ 오프라인'}`);
    });
  }

  return {
    init,
    translate,
    attachToBubble,
    autoTranslate,
    checkServerHealth,
    setTargetLang,
    setAutoTranslate,
    getTargetLang,
    isAutoEnabled,
    isServerAvailable,
  };
})();
