import sys
import os
# 현재 스크립트의 상위 디렉토리를 Python path에 추가
# sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import argparse
import time

class CustomAction(argparse.Action):
	def __call__(self, parser, namespace, values, option_string=None):
		setattr(namespace, self.dest, " ".join(values))
# 인자값을 받을 수 있는 인스턴스 생성
parser = argparse.ArgumentParser(description='프로그램 확장기능 처리')
# 입력받을 인자값 등록
parser.add_argument('--command', action=CustomAction, nargs='+', required=True, help='로그파일')
parser.add_argument('--out', action=CustomAction, nargs='+', required=True, help='출력파일')
args = parser.parse_args()

import ssl
ssl._create_default_https_context = ssl._create_unverified_context

'''
#pip install "rembg[cpu]"  # for CPU
#pip install "rembg[gpu]"  # for NVIDIA/CUDA GPU
from rembg import remove, new_session 
from PIL import Image
def remove_background(input_path, output_path): 
	model_name = "isnet-general-use"  # 모델이름
	session = new_session(model_name)
	input_image = Image.open(input_path)
	output_image = remove(input_image, session=session)
	output_image.save(output_path)
	log(f"rembg:{output_path}")


from PIL import Image
from transparent_background import Remover
remover=None
def remove_background(input_path, output_path): 
	global remover
	if remover==None: 
		remover = Remover()
	input_image = Image.open(input_path)
	output_image = remover.process(input_image)
	output_image.save(output_path)
	log(f"rembg:{output_path}")
'''


choseong_list = [char for char in "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"]
jungseong_list = [char for char in "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"]
jongseong_list = [char for char in " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"]
ko_dict = {'q':'ㅂ', 'Q':'ㅃ', 'w':'ㅈ', 'W':'ㅉ', 
		'e':'ㄷ', 'E':'ㄸ', 'r':'ㄱ', 'R':'ㄲ', 't':'ㅅ', 
		'T':'ㅆ', 'y':'ㅛ', 'u':'ㅕ', 'i':'ㅑ', 'o':'ㅐ', 
		'p':'ㅔ', 'a':'ㅁ', 's':'ㄴ', 'd':'ㅇ', 'f':'ㄹ', 
		'g':'ㅎ', 'h':'ㅗ', 'j':'ㅓ', 'k':'ㅏ', 'l':'ㅣ', 
		'z':'ㅋ', 'x':'ㅌ', 'c':'ㅊ', 'v':'ㅍ', 'b':'ㅠ', 
		'n':'ㅜ', 'm':'ㅡ', 'O':'ㅒ', 'P':'ㅖ', 'Y':'ㅛ', 
		'U':'ㅕ', 'I':'ㅑ', 'H':'ㅗ', 'J':'ㅓ', 'K':'ㅏ', 
		'L':'ㅣ', 'B':'ㅠ', 'N':'ㅜ', 'M':'ㅡ', 'A':'ㅁ',
		'S':'ㄴ', 'D':'ㅇ', 'F':'ㄹ', 'G':'ㅎ', 'Z':'ㅋ',
		'X':'ㅌ', 'C':'ㅊ', 'V':'ㅍ'}

def en2ko(str):
	ko_word = []
	for c in str:
		try:
			ko_word.append(ko_dict[c])
		except:
			ko_word.append(c)
	ko_word = list(''.join(ko_word)) # + ['\n']	
	return en2koWord(ko_word)
	
def en2koWord(ko_word):
	# log(f'en2koWord:{ko_word}')
	# seperate by one letter
	words = []
	start = 0
	lenKo = len(ko_word)
	if lenKo==1:
		words.append(ko_word[0:lenKo])
	else:
		for i in range(1, lenKo):
			if (i == lenKo-1):
				words.append(ko_word[start:lenKo])
			elif (ko_word[i] in choseong_list and ko_word[i+1] in jungseong_list) or (ko_word[i] not in choseong_list and ko_word[i] not in jungseong_list):
				words.append(ko_word[start:i])
				start = i 
	
	# convert dubble letter
	for word in words:
		if len(word) > 2 and word[0] in choseong_list and word[1] in jungseong_list:
			if word[1] in jungseong_list and word[2] in jungseong_list:
				b = word[1]
				word[1] = make_jungseong_list(word[1:3])
				if (b != word[1]):
					word.pop(2)
			if len(word) >= 4 and word[2] in jongseong_list and word[3] in jongseong_list:
				b = word[2]
				word[2] = make_jongseong_list(word[2:4])
				if (b != word[2]):
					word.pop(3)

	lastIndex = len(words) - 1
	# log(f'lastIndex:{lastIndex}, ing:{words[lastIndex]}, ingLen:{len(words[lastIndex])}')
	log(f'ing:{words[lastIndex]}')
	# combine each letter
	output_list = []
	for char in words:
		jongseong_index = 0
		if len(char) > 1 and char[0] in choseong_list and char[1] in jungseong_list:
			choseong_index = choseong_list.index(char.pop(0))
			jungseong_index = jungseong_list.index(char.pop(0))
			if len(char) > 0 and char[0] in jongseong_list:
				jongseong_index = jongseong_list.index(char.pop(0))
			character_code = jongseong_index + 0xAC00 + (choseong_index * 21 * 28) + (jungseong_index * 28)
			output_list.append(chr(character_code))
		while char:
			output_list.append(char.pop(0))

	# print("{}\t|    (변환)    |\n{}".format(main_input, ''.join(output_list)))
	# print('{} : {}'.format(len(main_input), time.time() - start_time))
	return ''.join(output_list)

def make_jongseong_list(char_list):
	if char_list[0] == 'ㄱ' and char_list[1] == 'ㄱ':
		return "ㄲ"
	if char_list[0] == 'ㄱ' and char_list[1] == 'ㅅ':
		return "ㄳ"
	if char_list[0] == 'ㄴ' and char_list[1] == 'ㅈ':
		return "ㄵ"
	if char_list[0] == 'ㄴ' and char_list[1] == 'ㅎ':
		return "ㄶ"
	if char_list[0] == 'ㄹ' and char_list[1] == 'ㄱ':
		return "ㄺ"
	if char_list[0] == 'ㄹ' and char_list[1] == 'ㅁ':
		return "ㄻ"
	if char_list[0] == 'ㄹ' and char_list[1] == 'ㅂ':
		return "ㄼ"
	if char_list[0] == 'ㄹ' and char_list[1] == 'ㅅ':
		return "ㄽ"
	if char_list[0] == 'ㄹ' and char_list[1] == 'ㅌ':
		return "ㄾ"
	if char_list[0] == 'ㄹ' and char_list[1] == 'ㅍ':
		return "ㄿ"
	if char_list[0] == 'ㄹ' and char_list[1] == 'ㅎ':
		return "ㅀ"
	if char_list[0] == 'ㅂ' and char_list[1] == 'ㅅ':
		return "ㅄ"
	return char_list[0]

def make_jungseong_list(char_list):
	if char_list[0]=='ㅗ' and char_list[1] == 'ㅏ':
		return "ㅘ"
	if char_list[0]=='ㅗ' and char_list[1] == 'ㅐ':
		return "ㅙ"
	if char_list[0]=='ㅗ' and char_list[1] == 'ㅣ':
		return "ㅚ"
	if char_list[0]=='ㅜ' and char_list[1] == 'ㅓ':
		return "ㅝ"
	if char_list[0]=='ㅜ' and char_list[1] == 'ㅔ':
		return "ㅞ"
	if char_list[0]=='ㅜ' and char_list[1] == 'ㅣ':
		return "ㅟ"
	if char_list[0]=='ㅡ' and char_list[1] == 'ㅣ':
		return "ㅢ"
	return char_list[0]

try:
	fpCommand=open(args.command, 'r', encoding='utf8')
	fpOut=open(args.out, 'a', encoding='utf8')
	lastPos=fpCommand.seek(0, os.SEEK_END)
	nextCommand = ''
	tm=time.time()
	def log (msg):
		fpOut.write(f"@#> {msg}\n")
		fpOut.flush()
        
	log(f"파이션 실행툴 시작 {tm}")
	while True:
		dist=time.time()-tm
		fsize=os.stat(args.command).st_size
		checkCommand = True
		if nextCommand:
			commands = nextCommand
		elif fsize > lastPos :
			commands=fpCommand.read().strip()
		else:
			commands = ''
			checkCommand = False
		if checkCommand:
			pos=commands.find("@#>")
			ftype='undefined'
			data=''
			if pos!=-1 :
				ep = commands.find("@#>", pos+3)
				if ep!=-1 :
					line = commands[pos: ep]
					nextCommand = data[ep:].strip()
				else :
					line = commands[pos:]
					nextCommand = ''
				end=line.find(":")
				if end!=-1 :
					ftype=line[pos+3:end].strip()
					data=line[end+1:].strip()
			# pos
			if ftype=='quit':
				break
			elif ftype=='eval':
				try:
					result=eval(data)
					log(f"eval:{result}")
				except Exception as ex:
					log(f"evalException:{ex}")
			elif ftype=='exec':
				try:
					result=exec(data)
					log(f"exec:{result}")
				except Exception as ex:
					log(f"execException:{ex}")
			elif ftype=='result':
				try:
					exec("log(f'result:{"+data+"}')")
				except Exception as ex:
					log(f"execException:{ex}")
			elif ftype=='echo':
				params=[v.strip() for v in data.split(',')]
				log(f"echo:params={params}")
			elif ftype=='save_base64':
				path = data
				if not check_file_exists(path):
					log(f"error:file not exists {path}")
					continue
				save_path = change_extension(path, 'base64')
				base64_data = file_to_base64(path)
				ret = save_file(save_path, base64_data)
				log(f"save_base64:path={save_path}, ret={ret}")
			elif ftype=='undefined':
				print(f"ftype=undefined data={data}")
			else:
				log(f"errorType:ftype={ftype} not defined")
			lastPos=fsize
			if nextCommand!='':
				log(f"result:{ftype}<next>{nextCommand}")
		time.sleep(0.2)
	log(f"close test python [filepath:{args.output}]")
	fpOut.close()
	fpCommand.close()
except Exception as e:
	print(f" error: {e}")

