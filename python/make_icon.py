# -*- coding: utf-8 -*-
"""
Clipboard Magic - 아이콘 멀티사이즈 변환기
원본 PNG 이미지를 Windows .ico 파일 및 다양한 PNG 사이즈로 저장합니다.

[설치]
pip install pillow

[실행]
python python/make_icon.py <원본_이미지_경로> [출력_폴더]

[예시]
python python/make_icon.py clipboard_magic_icon.png ./icons/

 
import cairosvg
cairosvg.svg2png(url="input.svg", write_to="output.png")
# 또는 바이트 데이터 사용
# cairosvg.svg2png(bytestring=open("input.svg", "rb").read(), write_to="output.png")
"""

import sys
import os
from PIL import Image

# ── 설정 ───────────────────────────────────────────────────────
ICON_SIZES = [16, 32, 48, 64, 128, 256, 512]

def make_icons(src_path: str, out_dir: str):
    if not os.path.exists(src_path):
        print(f"❌ 원본 파일을 찾을 수 없습니다: {src_path}")
        sys.exit(1)

    os.makedirs(out_dir, exist_ok=True)

    print(f"📂 원본 이미지 로드 중: {src_path}")
    img = Image.open(src_path).convert("RGBA")

    # ── 1. 멀티사이즈 PNG 저장 ─────────────────────────────────
    print("\n📸 PNG 사이즈별 저장:")
    for size in ICON_SIZES:
        resized = img.resize((size, size), Image.LANCZOS)
        out_path = os.path.join(out_dir, f"icon_{size}x{size}.png")
        resized.save(out_path, "PNG")
        print(f"  ✅ {size}x{size} → {out_path}")

    # ── 2. Windows .ico 파일 (16/32/48/64/128/256 멀티사이즈) ──
    ico_sizes = [(s, s) for s in [16, 32, 48, 64, 128, 256]]
    ico_images = [img.resize(s, Image.LANCZOS) for s in ico_sizes]
    ico_path = os.path.join(out_dir, "clipboard_magic.ico")
    ico_images[0].save(
        ico_path,
        format="ICO",
        sizes=ico_sizes,
        append_images=ico_images[1:]
    )
    print(f"\n🪟 Windows ICO → {ico_path}")

    # ── 3. macOS/Web용 대표 사이즈 ────────────────────────────
    for size, label in [(16, "favicon_16"), (32, "favicon_32"), (512, "app_store")]:
        resized = img.resize((size, size), Image.LANCZOS)
        out_path = os.path.join(out_dir, f"{label}.png")
        resized.save(out_path, "PNG")
    print(f"🌐 favicon 16/32 + AppStore 512 저장 완료")

    print(f"\n🎉 모든 아이콘이 [{out_dir}] 폴더에 저장되었습니다!")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print("사용법: python python/make_icon.py <원본_PNG_경로> [출력_폴더]")
        sys.exit(1)

    src = args[0]
    out = args[1] if len(args) > 1 else os.path.join(os.path.dirname(src), "icons")
    make_icons(src, out)
