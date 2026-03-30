# Node.js 클라이언트 간 WebRTC 음성 통화

기존 Express WebSocket 서버를 시그널링 서버로 그대로 활용하고, 두 Node.js 프로세스가 `node-datachannel`로 P2P 오디오를 주고받는 구조입니다.

## User Review Required

> [!IMPORTANT]
> Windows 환경에서 마이크/스피커를 Node.js에서 직접 다루려면 **네이티브 C++ 모듈** 설치가 필요합니다.
> - `node-datachannel`: WebRTC P2P 연결 (C++ 빌드 필요)
> - `naudiodon` or `node-speaker` + `mic`: 마이크/스피커 I/O
>
> **Visual Studio Build Tools** (C++ 빌드 환경)가 미설치된 경우 `npm install` 단계에서 오류가 발생할 수 있습니다.
> 진행하시기 전에 빌드 환경이 갖춰져 있는지 확인이 필요합니다.

## 구성

```
[PC-A] scripts/voice-client.js
    마이크 → PCM Audio →  node-datachannel (offer)
                              ↕  (WebSocket 시그널링)
[PC-B] scripts/voice-client.js
    node-datachannel (answer) → PCM Audio → 스피커
```

- **시그널링**: 기존 `server.js` WebSocket 그대로 사용 (ICE, SDP 중계)
- **미디어 전송**: `node-datachannel`의 DataChannel로 PCM 오디오 청크 전송
- **Audio I/O**: `mic` (마이크 캡처) + `node-speaker` (스피커 재생)

## Proposed Changes

### `express-sample/scripts/voice-client.js` [NEW]
- CLI 실행: `node scripts/voice-client.js [username] [target]`
- WebSocket으로 기존 서버에 `init` 메시지를 보내 등록
- `webrtc-call-request` 수신/발신 처리 (기존 브라우저 시그널링과 동일한 타입 사용)
- `node-datachannel`로 P2P 연결 후 마이크 PCM → DataChannel → 스피커 재생

### `package.json` 의존성 추가
```bash
npm install node-datachannel mic node-speaker
```

## Verification Plan

1. PC-A: `node scripts/voice-client.js userA`
2. PC-B: `node scripts/voice-client.js userB`
3. PC-A에서 `call userB` 명령어 입력 → 연결 수립 확인
4. 양방향 음성 전달 확인
