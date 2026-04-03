from libretranslatepy import LibreTranslateAPI
lt = LibreTranslateAPI("http://localhost:5000") # 로컬 서버 주소
print(lt.translate("Hello World", "en", "ko")) # 영어 -> 스페인어
