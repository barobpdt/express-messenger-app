import sqlite3
import re
import fasttext
import os

'''
$env:Path = "C:\APP\python;C:\APP\python\Scripts;" + $env:Path
runCommand('cd /bpdt/project/express-sample')
pythonRun('-m pip install "numpy<2.0.0"')
pythonRun('-m pip install --upgrade pip setuptools wheel')
pythonRun('-m pip install fasttext-wheel')
pythonRun('-m pip install fasttext')
pythonRun('python/train_fasttext.py')
'''
# 스크립트 실행 위치와 무관하게 프로젝트 기준 경로를 잡기 위한 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILE = os.path.join(BASE_DIR, 'data', 'test.db')
TRAIN_FILE = os.path.join(BASE_DIR, 'data', 'fasttext_train.txt')
MODEL_FILE = os.path.join(BASE_DIR, 'data', 'artist_model.bin')

def sanitize_text(text):
    if not text:
        return ""
    # 불필요한 공백, 줄바꿈 제거 및 특수문자 제거
    text = re.sub(r'[\n\r]+', ' ', text)
    text = re.sub(r'[^가-힣a-zA-Z0-9\s]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def main():
    print("1. SQLite 데이터베이스에서 가사 데이터를 조회합니다...")
    if not os.path.exists(DB_FILE):
        print(f"❌ 데이터베이스 파일을 찾을 수 없습니다: {DB_FILE}")
        return

    # 데이터베이스 연결
    conn = sqlite3.connect(DB_FILE)
    # 텍스트 인코딩 문제(Could not decode to UTF-8) 시 한글이 통째로 날아가는 것을 방지하기 위해 'replace' 사용
    # 깨진 글자만 특수기호()로 대체하고 나머지 정상 한글은 모두 살림
    conn.text_factory = lambda b: b.decode(errors='replace')
    cursor = conn.cursor()

    # 전체 데이터를 조회합니다. (원격 서버 테스트 목적인 경우 주석 처리된 LIMIT 구문을 사용하세요)
    # query = "SELECT title, summary FROM lyrics_song_info LIMIT 100 OFFSET 0"
    query = "SELECT title, summary FROM lyrics_song_info"
    
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
    except sqlite3.OperationalError as e:
        print(f"❌ 쿼리 실행 실패: {e}")
        conn.close()
        return
        
    conn.close()

    print(f"총 {len(rows)}건의 레코드를 가져왔습니다.")

    print("2. 데이터를 FastText 학습용 포맷으로 변환합니다...")
    train_lines = []
    unknown_count = 0

    for idx, row in enumerate(rows):
        title_raw = row[0]
        lyrics_raw = row[1]

        if not title_raw or not lyrics_raw:
            continue

        # 타이틀에서 "가수(+)노래제목" 형태 파싱
        # 간혹 공백이 있을 수 있으므로 여러 경우를 고려해 분리합니다.
        split_idx = title_raw.find('(+)')
        if split_idx == -1:
            split_idx = title_raw.find(' (+)')

        if split_idx != -1:
            # 띄어쓰기를 언더바(_)로 변경해 라벨이 하나로 인식되게 함
            artist = title_raw[:split_idx].strip().replace(' ', '_')
            song_title = title_raw[title_raw.find(')', split_idx) + 1:].strip().replace(' ', '_')
        else:
            unknown_count += 1
            continue
        pos=lyrics_raw.find(">")
        if pos!=-1:
            lyrics_raw=lyrics_raw[pos+1:]
        clean_lyrics = sanitize_text(lyrics_raw)
        
        # 가사가 너무 짧은(의미 없는) 경우 패스
        if len(clean_lyrics) < 10:
            continue

        # FastText는 다중 라벨을 지원하므로 가수와 노래제목 모두를 라벨로 지정 가능합니다.
        # 형태: __label__가수명 __label__노래제목 가사내용
        fasttext_line = f"__label__{artist} __label__{song_title} {clean_lyrics}"
        train_lines.append(fasttext_line)

    print(f"총 {len(train_lines)}곡의 학습 데이터를 추출했습니다. (파싱 불가 {unknown_count}곡 제외)")

    # data 디렉토리가 없으면 생성
    os.makedirs(os.path.dirname(TRAIN_FILE), exist_ok=True)

    # 학습용 txt 파일 생성
    with open(TRAIN_FILE, 'w', encoding='utf-8') as f:
        f.write("\n".join(train_lines))

    print(f"✅ 학습 데이터 저장 완료: {TRAIN_FILE}")

    print("\n3. FastText 모델 학습을 시작합니다. (데이터 양에 따라 시간이 다소 소요됩니다...)")
    # FastText 모델 생성 
    # lr: 학습률, epoch: 반복 횟수, wordNgrams: 단어 문맥 수(2=Bigram)
    model = fasttext.train_supervised(
        input=TRAIN_FILE, 
        lr=0.1, 
        epoch=30, 
        wordNgrams=2, 
        dim=100
    )

    model.save_model(MODEL_FILE)
    print(f"✅ 학습 완료! 모델이 생성되었습니다: {MODEL_FILE}")

    print("\n4. 🚀 생성된 모델 성능 테스트")
    test_lyrics = [
        "집으로 가는 길 거리에 많은 사람별들처럼 쏟아지면 그게 참 애틋해사람 사람 사는 것도", # 임영웅 우리에게 안녕
        "어떤 여자 앞에서도 기를 죽여놔 너무 들리게 말했나", # Zion.T Heroine
        "네가 숨을 내쉴 때 구름 위까지 들이마실게", # Crush 2-5-1
    ]

    for lyric in test_lyrics:
        clean_test = sanitize_text(lyric)
        # k=3 : 상위 3개 라벨 예측 (가수와 노래제목 섞여서 나올 수 있음)
        labels, probabilities = model.predict(clean_test, k=3)
        
        print(f"\n입력 가사: \"{lyric}\"")
        for i in range(len(labels)):
            label_name = labels[i].replace('__label__', '').replace('_', ' ')
            prob = probabilities[i] * 100
            print(f"  {i+1}순위 예측: {label_name} (확률: {prob:.1f}%)")

if __name__ == "__main__":
    main()
