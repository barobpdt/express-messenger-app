# LibreTranslate 셀프호스팅 + 메신저 번역 연동 가이드

## 1. LibreTranslate란?

| 항목 | 내용 |
|---|---|
| 오픈소스 | MIT 라이선스, 완전 무료 |
| 셀프호스팅 | 인터넷 없이 내부망에서 운영 가능 |
| 지원 언어 | 영어, 한국어, 일본어, 중국어 등 30+ 언어 |
| API 방식 | REST API (POST /translate) |
| API 키 | 선택사항 (인증 없이도 사용 가능) |

---

## 2. Docker로 LibreTranslate 설치

> [!IMPORTANT]
> Docker Desktop이 설치되어 있어야 합니다.
> Windows: https://www.docker.com/products/docker-desktop

### 기본 실행 (인증 없음)
```bash
docker run -d \
  --name libretranslate \
  -p 5000:5000 \
  libretranslate/libretranslate
```

### 한국어 포함 특정 언어만 설치 (빠른 시작)
```bash
docker run -d \
  --name libretranslate \
  -p 5000:5000 \
  libretranslate/libretranslate \
  --load-only en,ko,ja,zh,fr,de,es
```

### API 키 필수로 설정 (보안 강화)
```bash
docker run -d \
  --name libretranslate \
  -p 5000:5000 \
  libretranslate/libretranslate \
  --api-keys \
  --api-keys-db-path /app/db/api_keys.db
```

### 언어 모델 영구 저장 (컨테이너 재시작 시 재다운로드 방지)
```bash
docker run -d \
  --name libretranslate \
  -p 5000:5000 \
  -v libretranslate_models:/home/libretranslate/.local \
  libretranslate/libretranslate \
  --load-only en,ko,ja,zh
```

> [!NOTE]
> 최초 실행 시 언어 모델을 다운로드합니다. 전체 언어 기준 약 10~20분, 한국어 포함 4개 언어만 선택하면 5분 내외.

---

## 3. 설치 확인

```bash
# 실행 상태 확인
docker ps

# 로그 확인 (모델 다운로드 진행 상황)
docker logs -f libretranslate

# API 테스트
curl http://localhost:5000/languages
```

### 브라우저에서 확인
`http://localhost:5000` 접속 → LibreTranslate 웹 UI 확인

---

## 4. Node.js Express 연동

### 4-1. 라우트 등록 (server.js)

```js
// server.js 상단 require 영역에 추가
const translateRouter = require('./routes/translate');

// 라우트 등록 (다른 라우트 등록 부분과 함께)
app.use('/api', translateRouter);
```

### 4-2. 환경변수 설정 (.env)

```env
# LibreTranslate 서버 주소 (Docker 기본: localhost:5000)
LIBRETRANSLATE_URL=http://localhost:5000

# API 키 (--api-keys 없이 실행 시 빈 값으로 둠)
LIBRETRANSLATE_API_KEY=
```

### 4-3. 생성된 파일
- [translate.js](file:///c:/bpdt/project/express-sample/routes/translate.js) — Express 라우트 (프록시 + 캐시)
- [translate-client.js](file:///c:/bpdt/project/express-sample/public/js/translate-client.js) — 프론트엔드 클라이언트 모듈

---

## 5. API 사용 예시

### 번역 요청
```bash
curl -X POST http://localhost:8081/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, World!", "target": "ko"}'
```

### 응답
```json
{
  "translatedText": "안녕하세요, 세계!",
  "detectedLanguage": { "language": "en", "confidence": 97 }
}
```

### 지원 언어 목록
```bash
curl http://localhost:8081/api/translate/languages
```

### 서버 상태 확인
```bash
curl http://localhost:8081/api/translate/health
```

---

## 6. 메신저 프론트엔드 연동

### webview-messenger.html에 스크립트 추가
```html
<!-- webview-messenger.js 로드 전에 추가 -->
<script src="./js/translate-client.js"></script>
```

### webview-messenger.js 수정 포인트

#### 초기화 (connectWebSocket 또는 fetchUserInfo 완료 후)
```js
// fetchUserInfo 성공 후 호출
TranslateClient.init(backendOrigin);
```

#### appendMessageBubble 함수 끝 부분에 추가
```js
// 내 메시지가 아닌 경우에만 번역 버튼 추가
if (!isMine && (data.type === 'text' || data.type === 'command')) {
    // originalText는 XSS 처리 전 원본 텍스트
    TranslateClient.attachToBubble(el, data.text, backendOrigin);
}
```

---

## 7. 언어 코드 참조

| 언어 | 코드 |
|---|---|
| 한국어 | `ko` |
| 영어 | `en` |
| 일본어 | `ja` |
| 중국어(간체) | `zh` |
| 프랑스어 | `fr` |
| 독일어 | `de` |
| 스페인어 | `es` |

---

## 8. 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| 번역 서버 오프라인 | Docker 미실행 | `docker start libretranslate` |
| 번역이 매우 느림 | CPU 모드 | GPU 지원 Docker 이미지 사용 또는 언어 수 줄이기 |
| 특정 언어 없음 | 모델 미설치 | `--load-only` 옵션에 해당 언어 코드 추가 후 재실행 |
| CORS 오류 | 직접 5000포트 호출 | 반드시 `/api/translate` 프록시를 통해서 호출 |

---

## 9. 아키텍처 요약

```
[메신저 브라우저]
    ↓ POST /api/translate
[Express 서버 :8081]  ← routes/translate.js (캐시 포함)
    ↓ POST /translate
[LibreTranslate :5000] (Docker)
    ↓ 번역 결과
[Express 서버]
    ↓ translatedText
[메신저 브라우저]
```
