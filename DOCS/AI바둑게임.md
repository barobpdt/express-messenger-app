# AI 바둑 대국 구현 계획

`go-game.html`의 세련된 UI에 `go/js/goban.js` + `go/js/model.js`의 KataGo AI 엔진을 통합합니다. 사용자는 항상 **흑**으로 플레이하고, AI는 **백**을 담당합니다.

---

## 요청 기능 목록

| 기능 | 구현 방법 |
|------|----------|
| 바둑판 크기 | 9×9 / 13×13 / 19×19 선택 → `goban.js` size 파라미터 |
| 핸디캡 | 0~9수 선택 → `goban.setHandicap()` |
| AI 레벨 | 단(dan) / 급(kyu) → `model.js` level 변수 |
| 초읽기 | 착수 후 카운트다운, 시간 초과 시 자동 패스 |
| 자동 계가 | 두 번 연속 패스 시 중국식 집 계산 + 결과 모달 |
| 기보 다운로드 | `goban.exportSgf()` → `.sgf` 파일 저장 |

---

## Proposed Changes

### 신규 파일

#### [NEW] go-ai.html (file:///c:/bpdt/project/express-sample/public/go-ai.html)
- `go-game.html`을 기반으로 전면 개편
- `go/js/tensorflow.js`, `go/js/goban.js`, `go/js/model.js` 참조
- 설정 모달, 초읽기 UI, 계가 모달, 기보 다운로드 버튼 포함

#### [NEW] go-ai.js (file:///c:/bpdt/project/express-sample/public/js/go-ai.js)
- 기존 `go-game.js`를 완전히 대체하는 AI 전용 게임 로직
- `Goban` 객체를 `#goban` div 대신 `#go-board` 캔버스에 직접 그리도록 래핑
- 주요 로직:
  - **설정 모달**: 게임 시작 전 사이즈/핸디캡/레벨/시간 수집
  - **ai-move()**: 사용자 착수 후 KataGo 모델 추론 → 최선 착수
  - **모델 캐싱**: 첫 게임 시 1회만 로드 후 전역 변수에 캐시
  - **초읽기**: `setInterval` 기반, 시간 초과 시 자동 패스(`goban.pass()`)
  - **계가 (Scoring)**: 두 번 연속 패스 시 `computeScore()` 실행 (중국식 규칙: 집+살아있는 돌)
  - **SGF 저장**: `goban.exportSgf()` 결과를 Blob으로 다운로드

---

## UI 레이아웃 설계

```
┌─────────────────────────────────────────────────┐
│  🎮 AI 바둑 대국          [⚙️ 새 게임]  [☀️/🌙]  │  <- 헤더
├──────────────┬──────────────────────────────────┤
│ 사이드바     │                                  │
│ ┌──────────┐ │         바둑판 (캔버스)           │
│ │ AI 생각중│ │                                  │
│ │ 흑: ●    │ │                                  │
│ │ 백: ○    │ │                                  │
│ │⏱️ 00:30  │ │                                  │
│ └──────────┘ │                                  │
│ [한 수 쉼]  │                                  │
│ [기권]      │                                  │
│ [기보저장]  │                                  │
│ [계가요청]  │                                  │
└──────────────┴──────────────────────────────────┘
```

---

## 설정 모달 항목

```
┌─── 새 게임 설정 ────────────────────────│
│ 바둑판 크기:  ○ 9×9  ○ 13×13  ● 19×19  │
│ 핸디캡:      [0 ▼]                      │
│ AI 레벨:     ○ 단(강)  ● 급(약)         │
│ 초읽기 시간: [30] 초                    │
│                     [취소] [게임 시작]  │
└─────────────────────────────────────────┘
```

---

## 기술 세부사항

### 좌표 변환
- `goban.js` 내부는 `(size+2)×(size+2)` 좌표 사용
- `model.js`의 `play()` 함수는 21×21 sq 인덱스를 직접 사용
- `go-ai.js`에서는 `Goban` API만 사용하므로 내부 좌표 변환 불필요

### 모델 캐싱 전략
```javascript
let cachedModel = null;
async function getModel(size) {
  if (!cachedModel) {
    cachedModel = await tf.loadGraphModel(`/go/model/b10c128-.../model.json`);
  }
  return cachedModel;
}
```

### 계가 알고리즘 (중국식)
- `goban.position()` 배열 순회
- BFS로 빈점 연결 영역 탐색 → 인접 색 판별 → 집 귀속
- 흑집 + 흑돌 수 vs 백집 + 백돌 수 + 코미

---

## Verification Plan

### 브라우저 수동 테스트
1. 서버 실행: `node server.js` (포트 확인)
2. 브라우저에서 `http://localhost:PORT/go-ai.html` 접속
3. **설정 모달 확인**: 게임 시작 버튼 클릭 시 모달 표시
4. **AI 착수 확인**: 흑돌 클릭 후 백돌 AI 자동 착수 및 "KataNet이 생각 중..." 표시
5. **초읽기 확인**: 타이머 카운트다운 동작, 0초 시 자동 패스
6. **기보 저장**: [기보저장] 버튼 → `.sgf` 파일 다운로드 확인
7. **계가**: [계가 요청] 버튼 또는 연속 패스 → 결과 모달 표시 확인
