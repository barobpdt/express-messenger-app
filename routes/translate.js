/**
 * translate.js - LibreTranslate 번역 프록시 라우트
 *
 * LibreTranslate 서버를 프록시하여 CORS 및 API 키를 서버에서 관리합니다.
 * Docker 실행: docker run -d -p 5000:5000 libretranslate/libretranslate
 */

const express = require('express');
const router = express.Router();

// LibreTranslate 서버 주소 (환경변수 또는 기본값)
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'http://localhost:5000';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || ''; // 무설정 사용 시 빈 문자열

// 번역 캐시 (메모리, 서버 재시작 시 초기화)
const translateCache = new Map();
const CACHE_MAX = 500; // 최대 캐시 항목 수

/**
 * POST /api/translate
 * Body: { text: string, source?: string, target: string }
 * Response: { translatedText: string, detectedLanguage?: string }
 */
router.post('/translate', async (req, res) => {
  const { text, source = 'auto', target = 'ko' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: '번역할 텍스트가 필요합니다.' });
  }
  if (text.trim().length === 0) {
    return res.status(400).json({ error: '빈 텍스트는 번역할 수 없습니다.' });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: '텍스트가 너무 깁니다. (최대 5000자)' });
  }

  // 캐시 키: source|target|text
  const cacheKey = `${source}|${target}|${text}`;
  if (translateCache.has(cacheKey)) {
    return res.json({ translatedText: translateCache.get(cacheKey), cached: true });
  }

  try {
    const payload = {
      q: text,
      source,
      target,
      format: 'text',
    };
    if (LIBRETRANSLATE_API_KEY) {
      payload.api_key = LIBRETRANSLATE_API_KEY;
    }

    const response = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10초 타임아웃
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[translate] LibreTranslate 오류:', response.status, errBody);
      return res.status(502).json({ error: `번역 서버 오류: ${response.status}` });
    }

    const data = await response.json();
    const translatedText = data.translatedText;

    // 캐시 저장 (최대 CACHE_MAX 초과 시 가장 오래된 항목 제거)
    if (translateCache.size >= CACHE_MAX) {
      const firstKey = translateCache.keys().next().value;
      translateCache.delete(firstKey);
    }
    translateCache.set(cacheKey, translatedText);

    return res.json({
      translatedText,
      detectedLanguage: data.detectedLanguage || null,
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: '번역 서버 응답 시간 초과' });
    }
    console.error('[translate] fetch 오류:', err.message);
    return res.status(503).json({ error: `번역 서버에 연결할 수 없습니다: ${err.message}` });
  }
});

/**
 * GET /api/translate/languages
 * LibreTranslate 지원 언어 목록 조회
 */
router.get('/translate/languages', async (req, res) => {
  try {
    const response = await fetch(`${LIBRETRANSLATE_URL}/languages`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return res.status(502).json({ error: '언어 목록 조회 실패' });
    }
    const languages = await response.json();
    return res.json(languages);
  } catch (err) {
    return res.status(503).json({ error: `번역 서버에 연결할 수 없습니다: ${err.message}` });
  }
});

/**
 * GET /api/translate/health
 * LibreTranslate 서버 상태 확인
 */
router.get('/translate/health', async (req, res) => {
  try {
    const response = await fetch(`${LIBRETRANSLATE_URL}/languages`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      return res.json({ status: 'ok', server: LIBRETRANSLATE_URL });
    }
    return res.status(502).json({ status: 'error', server: LIBRETRANSLATE_URL });
  } catch (err) {
    return res.status(503).json({ status: 'offline', server: LIBRETRANSLATE_URL, message: err.message });
  }
});

module.exports = router;
