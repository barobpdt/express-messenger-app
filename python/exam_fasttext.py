import fasttext
import re
import os

# 1. 아까 5시간 동안 만든 모델 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_FILE = os.path.join(BASE_DIR, 'data', 'artist_model.bin')

# 2. 텍스트 정제 함수 (학습 시 사용했던 것과 동일)
def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'[\n\r]+', ' ', text)
    text = re.sub(r'[^가-힣a-zA-Z0-9\s]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

print("저장된 AI 모델을 로딩 중입니다... (1~2초 소요)")
try:
    model = fasttext.load_model(MODEL_FILE)
    print("✅ 모델 로딩 성공!")
except Exception as e:
    print(f"❌ 모델 로딩 실패 (학습이 덜 끝났거나 파일이 없습니다): {e}")
    exit()

print("-" * 50)

# 3. 모델 테스트 해보기
test_lyrics = [
    "집으로 가는 길 거리에 많은 사람별들처럼 쏟아지면 그게 참 애틋해사람 사람 사는 것도", # 임영웅 우리에게 안녕
    "어떤 여자 앞에서도 기를 죽여놔 너무 들리게 말했나", # Zion.T Heroine
    "네가 숨을 내쉴 때 구름 위까지 들이마실게", # Crush 2-5-1
]

for lyric in test_lyrics:
    preprocessed_text = clean_text(lyric)
    # k=3 (가장 확률이 높은 상위 3개 예측 도출)
    labels, probabilities = model.predict(preprocessed_text, k=3)
    
    print(f"\n[분석할 가사] \"{lyric}\"")
    for i in range(len(labels)):
        name = labels[i].replace('__label__', '').replace('_', ' ')
        prob = probabilities[i] * 100
        print(f"  {i+1}순위 예측 👉 {name} (확률: {prob:.1f}%)")
print("-" * 50)
