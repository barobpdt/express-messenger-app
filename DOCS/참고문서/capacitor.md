## Android 파일 경로: android/app/src/main/AndroidManifest.xml
<manifest ...>
    <!-- 카메라 권한 -->
    <uses-permission android:name="android.permission.CAMERA" />
    <!-- 마이크 권한 (WebRTC 음성 통화용) -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <!-- 카메라/마이크 기능 선언 (선택사항이지만 권장) -->
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    <application ...>


## IOS 파일 경로: ios/App/App/Info.plist
<dict>
    <!-- 카메라 권한 -->
    <key>NSCameraUsageDescription</key>
    <string>사진 촬영 및 영상 통화를 위해 카메라 권한이 필요합니다.</string>
    <!-- 마이크 권한 -->
    <key>NSMicrophoneUsageDescription</key>
    <string>음성 통화를 위해 마이크 권한이 필요합니다.</string>
    <!-- (선택) 사진 라이브러리 접근 -->
    <key>NSPhotoLibraryUsageDescription</key>
    <string>프로필 사진 등록을 위해 사진 라이브러리 접근이 필요합니다.</string>
</dict>


##
// @capacitor/camera 플러그인 사용 시
import { Camera, CameraPermissionState } from '@capacitor/camera';
async function checkPermissions() {
    // 현재 권한 상태 확인
    const status = await Camera.checkPermissions();
    console.log(status); // { camera: 'granted'|'denied'|'prompt', photos: ... }

    // 권한 요청
    if (status.camera !== 'granted') {
        const result = await Camera.requestPermissions({ permissions: ['camera'] });
        console.log(result);
    }
}

// WebRTC 마이크 권한은 getUserMedia 호출 시 자동 요청됨
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });


// android/app/src/main/java/...MainActivity.java
@Override
public void onWebViewCreateRequest(WebView view) {
    // Capacitor 최신 버전에서는 자동으로 처리됨
}
