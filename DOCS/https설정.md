1. 도메인 준비 (DuckDNS, 무료)
https://www.duckdns.org/ 접속
Google/GitHub 등으로 로그인
reCaptcha 완료 (주황색 ">>> reCaptcha <<<" 버튼을 클릭해서 인증을 완료)
원하는 이름 입력 (예: big-syster-hub) -> big-syster-hub.duckdns.org 생성
2. Let's Encrypt 무료 SSL 인증서 설정

DuckDNS 자체는 DNS 서비스만 제공하고, HTTPS 인증서는 별도로 설정해야함


# 1. certbot 설치
apt update && apt install -y certbot

# 2. 인증서용 디렉토리 생성
mkdir -p /var/www/certbot

# 3. 기존 컨테이너 중지 (80 포트 해제)
cd /app
docker compose -f docker-compose.prod.yml down 2>/dev/null || docker compose down 2>/dev/null || true

# 4. SSL 인증서 발급 (이메일 변경 필요)
certbot certonly --standalone \
-d big-sister-hub.duckdns.org \
--email your-email@example.com \
--agree-tos \
--no-eff-email

# 5. 인증서 자동 갱신 cron 등록 (매월 1일)
(crontab -l 2>/dev/null; echo "0 0 1 * * certbot renew --quiet && docker restart big-sister-hub-nginx") | crontab -

왜 서버에서 직접 해야 하나?

| 작업         | 이유                                                  |
|--------------|-------------------------------------------------------|
| certbot 설치 | 호스트에 설치해야 인증서 관리 용이                    |
| 인증서 발급  | Let's Encrypt가 도메인 소유권 확인 필요 (80포트 사용) |
| cron 등록    | 인증서 90일마다 갱신 필요                             |

인증서 발급 완료 후 GitHub에 push하면 HTTPS가 적용됩니다.

 

HTTP/HTTPS 포트 열기
서버 처음 세팅할때 분명히 열었는데 막혀있어서 인증서가 정상적으로 생성되지 않음, 그래서 다시 열어줌

# 확인
ufw status

# 80, 443 방화벽 허용
ufw allow 80
ufw allow 443

# 방화벽 적용
ufw reload
