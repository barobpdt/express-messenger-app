# yt-dlp 설치 (Windows)
pip install yt-dlp
# 또는 직접 다운로드
winget install yt-dlp
# FFmpeg 설치 (MP3 변환에 필수)
winget install ffmpeg

# python/youtube_mp3.py
import yt_dlp
import os

def download_mp3(youtube_url: str, output_dir: str = "./downloads"):
    """유튜브 영상의 오디오를 MP3로 저장"""
    os.makedirs(output_dir, exist_ok=True)
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{output_dir}/%(title)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',   # 128 / 192 / 320 kbps
        }],
        'quiet': False,
        'noplaylist': True,             # 재생목록은 단일 영상만
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=True)
        return {
            "title": info.get("title"),
            "duration": info.get("duration"),  # 초 단위
            "channel": info.get("channel"),
            "file": f"{output_dir}/{info.get('title')}.mp3"
        }


def download_playlist_mp3(playlist_url: str, output_dir: str = "./downloads"):
    """재생목록 전체 다운로드"""
    os.makedirs(output_dir, exist_ok=True)

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{output_dir}/%(playlist_index)02d_%(title)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'noplaylist': False,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([playlist_url])


# 실행 예시
if __name__ == "__main__":
    url = "https://www.youtube.com/watch?v=XXXXXXXXXXX"
    result = download_mp3(url, output_dir="C:/Music")
    print(f"✅ 저장 완료: {result['title']}")




# python/youtube_browser.py
import os
import json
import requests

YT_API_KEY = os.environ.get("YOUTUBE_API_KEY", "여기에_API_키_입력")
YT_BASE = "https://www.googleapis.com/youtube/v3"

def get_categories(region_code="KR", hl="ko"):
    """카테고리 목록 조회"""
    url = f"{YT_BASE}/videoCategories"
    params = {
        "part": "snippet",
        "regionCode": region_code,
        "hl": hl,
        "key": YT_API_KEY
    }
    res = requests.get(url, params=params)
    data = res.json()
    
    categories = [
        {"id": item["id"], "title": item["snippet"]["title"]}
        for item in data.get("items", [])
        if item["snippet"].get("assignable")
    ]
    return categories


def get_popular_videos(category_id="10", region_code="KR", max_results=20, page_token=None):
    """카테고리별 인기 영상"""
    url = f"{YT_BASE}/videos"
    params = {
        "part": "snippet,statistics,contentDetails",
        "chart": "mostPopular",
        "videoCategoryId": category_id,
        "regionCode": region_code,
        "maxResults": max_results,
        "key": YT_API_KEY
    }
    if page_token:
        params["pageToken"] = page_token

    res = requests.get(url, params=params)
    data = res.json()

    videos = []
    for v in data.get("items", []):
        videos.append({
            "id": v["id"],
            "title": v["snippet"]["title"],
            "channel": v["snippet"]["channelTitle"],
            "thumbnail": v["snippet"]["thumbnails"].get("medium", {}).get("url"),
            "view_count": v.get("statistics", {}).get("viewCount"),
            "duration": v.get("contentDetails", {}).get("duration"),
            "url": f"https://www.youtube.com/watch?v={v['id']}"
        })

    return {
        "videos": videos,
        "next_page_token": data.get("nextPageToken"),
        "total_results": data.get("pageInfo", {}).get("totalResults")
    }


def search_videos(query, category_id=None, max_results=10):
    """키워드 + 카테고리 검색"""
    url = f"{YT_BASE}/search"
    params = {
        "part": "snippet",
        "type": "video",
        "q": query,
        "maxResults": max_results,
        "key": YT_API_KEY
    }
    if category_id:
        params["videoCategoryId"] = category_id

    res = requests.get(url, params=params)
    data = res.json()

    return [
        {
            "id": v["id"]["videoId"],
            "title": v["snippet"]["title"],
            "channel": v["snippet"]["channelTitle"],
            "thumbnail": v["snippet"]["thumbnails"].get("medium", {}).get("url"),
            "url": f"https://www.youtube.com/watch?v={v['id']['videoId']}"
        }
        for v in data.get("items", [])
    ]


# ── 실행 예시 ──
if __name__ == "__main__":
    # 1. 카테고리 목록 출력
    print("=== 카테고리 목록 ===")
    for cat in get_categories():
        print(f"  [{cat['id']}] {cat['title']}")

    # 2. 음악(10) 카테고리 인기 영상
    print("\n=== 음악 카테고리 인기 영상 Top 5 ===")
    result = get_popular_videos(category_id="10", max_results=5)
    for v in result["videos"]:
        print(f"  - {v['title']} ({v['channel']}) 조회수: {v['view_count']}")

    # 3. 검색
    print("\n=== '아이유' 검색 결과 ===")
    for v in search_videos("아이유", max_results=3):
        print(f"  - {v['title']}")
