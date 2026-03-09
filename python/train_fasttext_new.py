import sqlite3
import re
import fasttext
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILE = os.path.join(BASE_DIR, 'data', 'test.db')
TRAIN_FILE = os.path.join(BASE_DIR, 'data', 'fasttext_train.txt')
MODEL_FILE = os.path.join(BASE_DIR, 'data', 'artist_model.bin')

def sanitize_text(text):
    if not text:
        return ""
    text = re.sub(r'[\n\r]+', ' ', text)
    text = re.sub(r'[^가-힣a-zA-Z0-9\s]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def main():
    print("1. SQLite 데이터베이스에서 가사 데이터를 조회합니다...")
    conn = sqlite3.connect(DB_FILE)
    conn.text_factory = lambda b: b.decode(errors='replace')
    cursor = conn.cursor()

    query = "SELECT title, summary FROM lyrics_song_info"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    print("2. 데이터를 FastText 학습용 포맷으로 변환합니다...")
    train_lines = []
    
    for row in rows:
        title_raw = row[0]
        lyrics_raw = row[1]

        if not title_raw or not lyrics_raw:
            continue

        split_idx = title_raw.find('(+)')
        if split_idx == -1:
            split_idx = title_raw.find(' (+)')

        if split_idx != -1:
            artist = title_raw[:split_idx].strip().replace(' ', '_')
            song_title = title_raw[title_raw.find(')', split_idx) + 1:].strip().replace(' ', '_')
        else:
            continue
            
        # ⭐ 핵심 수정 1: 가수 이름이나 제목이 빈칸이면 과감히 버림!
        if not artist or not song_title:
             continue

        pos = lyrics_raw.find(">")
        if pos != -1:
            lyrics_raw = lyrics_raw[pos+1:]
            
        clean_lyrics = sanitize_text(lyrics_raw)
        
        # 가사가 20자 미만인 곡들은 불량 데이터일 확률이 높으므로 버림
        if len(clean_lyrics) < 20: 
            continue

        fasttext_line = f"__label__{artist} __label__{song_title} {clean_lyrics}"
        train_lines.append(fasttext_line)

    print(f"총 {len(train_lines)}곡의 깨끗한 데이터를 추출했습니다.")
    os.makedirs(os.path.dirname(TRAIN_FILE), exist_ok=True)

    with open(TRAIN_FILE, 'w', encoding='utf-8') as f:
        f.write("\n".join(train_lines))

    print("\n3. FastText 모델 학습을 시작합니다. (훨씬 빨라집니다!)")
    
    # ⭐ 핵심 수정 2: 속도 최적화 및 멍텅구리(과적합) 방지
    # (Encountered NaN 에러를 방지하기 위해 학습률(lr)을 안정적인 0.1로 되돌리고, 너무 희귀한 단어는 제외(minCount)합니다.)
    model = fasttext.train_supervised(
        input=TRAIN_FILE, 
        lr=0.1,           # 학습 과정이 터지지 않게(NaN 에러 방지) 안정적인 기본값 사용
        epoch=5,          # 15번은 너무 오래 걸립니다. 5번으로 줄여서 속도를 비약적으로 높입니다.
        dim=50,           # 단어 벡터 크기를 절반으로 줄여 속도를 높임
        minCount=5,       # 쓸모없는 단어는 버림 (메모리+속도 최적화)
        thread=8          # CPU 코어를 여러 개 써서 학습 속도를 최소 8배 높임
    )

    model.save_model(MODEL_FILE)
    print(f"✅ 학습 완료! 모델이 생성되었습니다: {MODEL_FILE}")

if __name__ == "__main__":
    main()
