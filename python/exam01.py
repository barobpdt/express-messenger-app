import fasttext
import re
import os

# 1. 모델 파일 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_FILE = os.path.join(BASE_DIR, 'data', 'artist_model.bin')

# 2. 모델 로드
print("모델을 로딩 중입니다...")
model = fasttext.load_model(MODEL_FILE)

# 3. 텍스트 정제 함수 (학습할 때와 동일하게 특수문자 제거 필수!)
def clean_text(text):
    text = re.sub(r'[\n\r]+', ' ', text)
    text = re.sub(r'[^가-힣a-zA-Z0-9\s]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

# 4. 실전 테스트
target_lyrics = "네가 숨을 내쉴 때 구름 위까지 들이마실게"
preprocessed_text = clean_text(target_lyrics)

# k=3은 가장 확률이 높은 3개의 라벨(가수명 or 노래제목)을 가져오라는 뜻입니다.
labels, probabilities = model.predict(preprocessed_text, k=3)

print(f"\n[분석할 가사] {target_lyrics}")
for label, prob in zip(labels, probabilities):
    # __label__ 을 빈칸으로 없애고, 띄어쓰기(_) 복구
    name = label.replace('__label__', '').replace('_', ' ')
    print(f"👉 예측: {name} (확률: {prob * 100:.2f}%)")
