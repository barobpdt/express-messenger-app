# 🔐 Vultr 클라우드 무료 HTTPS (SSL) 설정 가이드

Vultr 클라우드 서버에서 **완전 무료로 HTTPS(SSL 인증서)**를 설정하는 가장 확실하고 대중적인 방법은 **Let's Encrypt** (무료 SSL 제공 기관)와 **Nginx** (웹 서버/리버스 프록시)를 조합하여 사용하는 것입니다.

현재 만들고 계신 Node.js(Express) 프로젝트를 기준으로 설명해 드립니다.

---

## 🌎 1단계: 무료 도메인 연결하기 (필수)
HTTPS 인증서(SSL)는 IP 주소(예: `123.456.78.90`)에는 발급받을 수 없고, 반드시 **도메인 이름**(예: `my-chat.com`)이 있어야 합니다.
만약 도메인이 없다면, **DuckDNS** 같은 무료 서비스로 서브도메인을 만들 수 있습니다.

1. [DuckDNS (duckdns.org)](https://www.duckdns.org/) 에 접속하여 회원가입(구글/깃허브 연동)합니다.
2. 원하는 서브도메인을 만듭니다. (예: `my-chat-app.duckdns.org`)
3. 도메인의 **Current IP** 입력 칸에 **Vultr 서버의 퍼블릭 IP**를 기입하고 `Update IP`를 누릅니다.
   > [!NOTE]  
   > 도메인이 글로벌 DNS에 전파되는 데 5~10분 정도 걸릴 수 있습니다.

---

## 🛠 2단계: Vultr 서버 (Ubuntu 기준) 패키지 설치
Vultr 서버에 SSH(터미널)로 접속한 뒤, Nginx와 Certbot을 설치합니다.

```bash
# 시스템 패키지 업데이트
sudo apt update

# Nginx 설치
sudo apt install nginx -y

# Let's Encrypt 인증서 발급을 위한 Certbot 설치
sudo apt install certbot python3-certbot-nginx -y
```

---

## 🔄 3단계: Nginx 리버스 프록시 설정
Nginx는 외부에서 들어오는 80번(HTTP) 및 443번(HTTPS) 포트 요청을 받아, 로컬에서 실행 중인 Express 서버(예: `8081` 포트)로 토스해주는 역할을 합니다.

1. Nginx 설정 파일을 생성합니다. (`<본인도메인>` 부분을 실제 도메인으로 변경하세요)
```bash
sudo nano /etc/nginx/sites-available/<본인도메인>
```

2. 파일 안에 아래 내용을 복사해서 붙여넣습니다. (이때 포트번호 `8081`을 환경에 맞게 적으세요)
```nginx
server {
    listen 80;
    server_name my-chat-app.duckdns.org; # 본인의 무료 도메인을 입력하세요.

    location / {
        proxy_pass http://localhost:8081; # Node.js 서버 포트번호
        proxy_http_version 1.1;
        
        # WebSocket, WebRTC 통신을 위한 필수 헤더
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # 대용량 파일 업로드 허용 크기 확장 (필요 시 수정)
        client_max_body_size 50M; 
    }
}
```

3. 설정을 활성화하고 Nginx를 재시작합니다.
```bash
# 설정 활성화 (심볼릭 링크)
sudo ln -s /etc/nginx/sites-available/<본인도메인> /etc/nginx/sites-enabled/

# 설정에 문법적 오류가 없는지 테스트 (syntax is ok 메시지 확인)
sudo nginx -t

# Nginx 재시작
sudo systemctl reload nginx
```

---

## 📜 4단계: 무료 SSL(HTTPS) 인증서 적용하기
이제 모든 준비가 끝났으니, Certbot을 이용해 클릭 몇 번으로 HTTPS를 자동 적용합니다.

```bash
sudo certbot --nginx -d my-chat-app.duckdns.org
```

- 명령어를 실행하면 이메일 주소를 입력하라는 안내가 나옵니다. (인증서 갱신 안내용)
- 약관에 동의(`Y`)를 진행합니다.
- Certbot이 Nginx 설정 파일을 찾아 자동으로 HTTPS(443 포트) 관련 설정을 추가합니다.

> [!TIP]  
> 설정 중에 **"Redirect HTTP traffic to HTTPS"** 를 선택하는 화면이 나온다면 `2번(Redirect)`을 선택하는 것이 좋습니다. 사용자가 `http://` 로 접속하더라도 안전한 `https://` 로 자동 연결되게 해줍니다.

---

## ✅ 5단계: 최종 확인 및 백그라운드 서버 유지

1. **PM2로 Node.js 서버 띄우기**
   Vultr 서버 터미널을 닫아도 24시간 서버가 켜져 있도록 앱 폴더로 이동하여 `pm2` 로 실행해 둡니다.
```bash
cd /경로/express-sample
npm install pm2 -g
pm2 start server.js --name "messenger"
```

2. **접속 확인**
   브라우저에서 `https://<본인도메인>` 로 접속해 봅니다. 주소창 옆에 **자물쇠(🔒)** 모양이 정상적으로 뜬다면 HTTPS 설정이 성공적으로 완료된 것입니다!

---
> [!NOTE] 인증서 자동 갱신 안내  
> Let's Encrypt 무료 인증서의 기본 유효기간은 90일입니다. 하지만 위에서 설치한 `Certbot` 패키지가 시스템 내부에 타이머 스케줄러를 등록하여 만료일 전에 **알아서 자동으로 갱신**해 주므로 셋팅 후 특별히 신경 쓰실 필요는 없습니다.
