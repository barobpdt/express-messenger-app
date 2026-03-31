# -*- coding: utf-8 -*-

"""
Python WebRTC 음성 통화 클라이언트
기존 Express WebSocket 서버를 시그널링 서버로 활용합니다.

[설치]
pip install aiortc websockets pyaudio

[실행]
python python/voice_client.py --username userA --server ws://localhost:8081
"""
import asyncio
import json
import sys
import argparse
import pyaudio
import numpy as np
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaPlayer, MediaRecorder, MediaBlackhole
from av import AudioFrame
import websockets
import sys
sys.stdout.reconfigure(encoding='utf-8')

# ── 오디오 설정 ──────────────────────────────────────────────────
AUDIO_RATE = 48000
AUDIO_CHANNELS = 1
AUDIO_CHUNK = 960           # 20ms @ 48kHz (Opus 권장)
AUDIO_FORMAT = pyaudio.paInt16

pa = pyaudio.PyAudio()


class MicrophoneTrack(MediaStreamTrack):
    """실시간 마이크 입력을 aiortc MediaStreamTrack으로 wrapping"""
    kind = "audio"

    def __init__(self):
        super().__init__()
        self._stream = pa.open(
            format=AUDIO_FORMAT,
            channels=AUDIO_CHANNELS,
            rate=AUDIO_RATE,
            input=True,
            frames_per_buffer=AUDIO_CHUNK
        )
        self._timestamp = 0

    async def recv(self):
        await asyncio.sleep(AUDIO_CHUNK / AUDIO_RATE)   # 20ms마다 1프레임

        raw = self._stream.read(AUDIO_CHUNK, exception_on_overflow=False)
        samples = np.frombuffer(raw, dtype=np.int16)

        frame = AudioFrame.from_ndarray(
            samples.reshape(1, -1),
            format="s16",
            layout="mono"
        )
        frame.sample_rate = AUDIO_RATE
        frame.pts = self._timestamp
        frame.time_base = "1/48000"
        self._timestamp += AUDIO_CHUNK
        return frame


class SpeakerSink:
    """수신된 오디오 트랙을 실시간으로 스피커에 출력"""

    def __init__(self):
        self._stream = pa.open(
            format=AUDIO_FORMAT,
            channels=AUDIO_CHANNELS,
            rate=AUDIO_RATE,
            output=True,
            frames_per_buffer=AUDIO_CHUNK
        )

    async def consume(self, track: MediaStreamTrack):
        print("🔊 오디오 수신 시작!")
        while True:
            try:
                frame = await track.recv()
                pcm = frame.to_ndarray().flatten().astype(np.int16).tobytes()
                self._stream.write(pcm)
            except Exception as e:
                print(f"[SpeakerSink] 수신 종료: {e}")
                break


# ── 전역 상태 ────────────────────────────────────────────────────
username = None
ws_conn = None
pc: RTCPeerConnection = None
speaker = SpeakerSink()


async def ws_send(data: dict):
    if ws_conn:
        await ws_conn.send(json.dumps(data))


async def make_call(target: str):
    """상대방에게 통화 요청 (Offer 생성)"""
    global pc
    pc = RTCPeerConnection()

    mic = MicrophoneTrack()
    pc.addTrack(mic)

    @pc.on("track")
    async def on_track(track):
        if track.kind == "audio":
            asyncio.create_task(speaker.consume(track))

    @pc.on("icecandidate")
    async def on_ice(candidate):
        if candidate:
            await ws_send({
                "type": "webrtc-ice",
                "targetUser": target,
                "senderId": username,
                "candidate": {
                    "candidate": candidate.candidate,
                    "sdpMid": candidate.sdpMid,
                    "sdpMLineIndex": candidate.sdpMLineIndex
                }
            })

    offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await ws_send({
        "type": "webrtc-call-request",
        "targetUser": target,
        "senderId": username,
        "senderNick": username,
        "offer": {
            "type": pc.localDescription.type,
            "sdp": pc.localDescription.sdp
        }
    })
    print(f"📞 [{target}]님에게 통화를 걸었습니다. 수락을 기다리는 중...")


async def accept_call(caller: str, offer_sdp: dict):
    """수신된 통화 요청 수락 (Answer 생성)"""
    global pc
    pc = RTCPeerConnection()

    mic = MicrophoneTrack()
    pc.addTrack(mic)

    @pc.on("track")
    async def on_track(track):
        if track.kind == "audio":
            asyncio.create_task(speaker.consume(track))

    @pc.on("icecandidate")
    async def on_ice(candidate):
        if candidate:
            await ws_send({
                "type": "webrtc-ice",
                "targetUser": caller,
                "senderId": username,
                "candidate": {
                    "candidate": candidate.candidate,
                    "sdpMid": candidate.sdpMid,
                    "sdpMLineIndex": candidate.sdpMLineIndex
                }
            })

    await pc.setRemoteDescription(RTCSessionDescription(
        sdp=offer_sdp["sdp"],
        type=offer_sdp["type"]
    ))
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await ws_send({
        "type": "webrtc-answer",
        "targetUser": caller,
        "senderId": username,
        "answer": {
            "type": pc.localDescription.type,
            "sdp": pc.localDescription.sdp
        }
    })
    print(f"✅ [{caller}]님과 통화가 연결되었습니다!")


async def handle_message(data: dict):
    """WebSocket 메시지 처리"""
    global pc
    msg_type = data.get("type", "")
    sender = data.get("senderId", "")

    if msg_type == "webrtc-call-request":
        offer = data.get("offer")
        print(f"\n📞 [{sender}]님에게서 음성 통화 요청이 왔습니다!")
        ans = input("수락하시겠습니까? [y/n]: ").strip().lower()
        if ans == "y":
            await accept_call(sender, offer)
        else:
            await ws_send({
                "type": "webrtc-call-decline",
                "targetUser": sender,
                "senderId": username
            })
            print("❌ 통화를 거절했습니다.")

    elif msg_type == "webrtc-answer":
        if pc:
            answer = data.get("answer")
            await pc.setRemoteDescription(RTCSessionDescription(
                sdp=answer["sdp"],
                type=answer["type"]
            ))
            print(f"✅ [{sender}]님이 수락했습니다. 통화가 연결되었습니다!")

    elif msg_type == "webrtc-ice":
        if pc:
            candidate_data = data.get("candidate", {})
            from aiortc import RTCIceCandidate
            try:
                cand = RTCIceCandidate(
                    component=1,
                    foundation="",
                    ip="",
                    port=0,
                    priority=0,
                    protocol="udp",
                    type="host",
                    sdpMid=candidate_data.get("sdpMid"),
                    sdpMLineIndex=candidate_data.get("sdpMLineIndex")
                )
                cand.candidate = candidate_data.get("candidate")
                await pc.addIceCandidate(cand)
            except Exception as e:
                pass  # ICE candidate 파싱 실패는 무시

    elif msg_type == "webrtc-call-decline":
        print(f"\n📵 [{sender}]님이 통화를 거절했습니다.")
        if pc:
            await pc.close()
            pc = None

    elif msg_type == "webrtc-hangup":
        print(f"\n📵 [{sender}]님이 통화를 종료했습니다.")
        if pc:
            await pc.close()
            pc = None

    elif msg_type == "onlineUsers":
        users = data.get("users", [])
        online = [u["username"] for u in users if u.get("isOnline") and u["username"] != username]
        if online:
            print(f"\n🟢 접속 중인 사용자: {', '.join(online)}")
        else:
            print(f"\n⚪ 현재 접속 중인 다른 사용자가 없습니다.")


async def cli_input_loop(call_target: str = None):
    """사용자 명령어 입력 처리 (별도 비동기 루프)"""
    global pc
    loop = asyncio.get_event_loop()

    # auto call if target specified
    if call_target:
        await asyncio.sleep(1.5)  # Wait for WS connection
        await make_call(call_target)

    while True:
        # 비동기 stdin 읽기
        cmd = await loop.run_in_executor(None, input, "\n[명령어] call <대상> | hangup | quit\n> ")
        cmd = cmd.strip()

        if cmd.startswith("call "):
            target = cmd[5:].strip()
            await make_call(target)

        elif cmd == "hangup":
            if pc:
                await ws_send({"type": "webrtc-hangup", "targetUser": None, "senderId": username})
                await pc.close()
                pc = None
                print("📵 통화를 종료했습니다.")
            else:
                print("현재 통화 중이 아닙니다.")

        elif cmd == "quit":
            print("👋 종료합니다.")
            sys.exit(0)

        else:
            print(f"알 수 없는 명령어: '{cmd}'")


async def main(server_url: str, user: str, call_target: str = None):
    global username, ws_conn
    username = user

    print(f"🔌 서버에 연결 중: {server_url}")
    async with websockets.connect(server_url) as ws:
        ws_conn = ws
        print(f"✅ 서버 접속 완료! ({username})")

        # 서버에 사용자 등록
        await ws.send(json.dumps({"type": "init", "username": username}))

        # User CLI 루프 (백그라운드)
        # asyncio.create_task(cli_input_loop(call_target))

        # WebSocket 메시지 수신 루프
        async for raw in ws:
            try:
                data = json.loads(raw)
                await handle_message(data)
            except json.JSONDecodeError:
                pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Python WebRTC 음성 통화 클라이언트")
    parser.add_argument("--username", "-u", required=True, help="사용자 아이디 (서버에 등록된 계정)")
    parser.add_argument("--server", "-s", default="ws://localhost:8081", help="WebSocket 서버 주소")
    parser.add_argument("--call", "-c", default=None, help="자동으로 통화 연결할 대상 아이디")
    args = parser.parse_args()

    try:
        asyncio.run(main(args.server, args.username, args.call))
    except KeyboardInterrupt:
        print("\n👋 종료합니다.")
        pa.terminate()
