import os
import json
import requests
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple
import hashlib
import logging
from datetime import datetime

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('icon_utils')

class IconManager:
    """
    파일 확장자별 아이콘을 다운로드하고 관리하는 클래스
    """
    
    # 기본 아이콘 URL (예: VSCode 아이콘)
    DEFAULT_ICON_URLS = {
        # 문서 파일
        '.txt': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_text.svg',
        '.md': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_markdown.svg',
        '.pdf': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_pdf.svg',
        '.doc': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_word.svg',
        '.docx': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_word.svg',
        '.xls': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_excel.svg',
        '.xlsx': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_excel.svg',
        '.ppt': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_powerpoint.svg',
        '.pptx': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_powerpoint.svg',
        
        # 코드 파일
        '.py': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_python.svg',
        '.js': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_js.svg',
        '.jsx': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_reactjs.svg',
        '.ts': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_typescript.svg',
        '.tsx': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_reactts.svg',
        '.html': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_html.svg',
        '.css': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_css.svg',
        '.scss': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_scss.svg',
        '.less': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_less.svg',
        '.json': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_json.svg',
        '.xml': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_xml.svg',
        '.yaml': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_yaml.svg',
        '.yml': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_yaml.svg',
        '.sql': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_sql.svg',
        '.php': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_php.svg',
        '.java': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_java.svg',
        '.c': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_c.svg',
        '.cpp': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_cpp.svg',
        '.h': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_h.svg',
        '.hpp': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_hpp.svg',
        '.cs': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_csharp.svg',
        '.go': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_go.svg',
        '.rb': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_ruby.svg',
        '.swift': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_swift.svg',
        '.kt': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_kotlin.svg',
        '.rs': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_rust.svg',
        '.sh': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_shell.svg',
        '.bat': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_shell.svg',
        '.ps1': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_powershell.svg',
        
        # 이미지 파일
        '.jpg': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_image.svg',
        '.jpeg': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_image.svg',
        '.png': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_image.svg',
        '.gif': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_image.svg',
        '.bmp': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_image.svg',
        '.svg': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_svg.svg',
        '.ico': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_image.svg',
        '.webp': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_image.svg',
        
        # 오디오 파일
        '.mp3': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_audio.svg',
        '.wav': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_audio.svg',
        '.ogg': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_audio.svg',
        '.flac': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_audio.svg',
        '.aac': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_audio.svg',
        
        # 비디오 파일
        '.mp4': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_video.svg',
        '.avi': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_video.svg',
        '.mov': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_video.svg',
        '.wmv': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_video.svg',
        '.flv': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_video.svg',
        '.mkv': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_video.svg',
        
        # 압축 파일
        '.zip': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_zip.svg',
        '.rar': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_archive.svg',
        '.7z': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_archive.svg',
        '.tar': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_archive.svg',
        '.gz': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file_type_archive.svg',
        
        # 폴더
        'folder': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/folder.svg',
        'folder_open': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/folder_opened.svg',
        
        # 기본 아이콘
        'default': 'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/file.svg',
    }
    
    def __init__(self, cache_dir: Optional[Union[str, Path]] = None):
        """
        아이콘 매니저 초기화
        
        Args:
            cache_dir (Optional[Union[str, Path]]): 아이콘 캐시 디렉토리 경로 (기본값: ~/.icon_cache)
        """
        if cache_dir is None:
            cache_dir = os.path.expanduser('~/.icon_cache')
        
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # 캐시 정보 파일 경로
        self.cache_info_path = self.cache_dir / 'cache_info.json'
        
        # 캐시 정보 로드
        self.cache_info = self._load_cache_info()
        
        # 아이콘 URL 매핑
        self.icon_urls = self.DEFAULT_ICON_URLS.copy()
    
    def _load_cache_info(self) -> Dict:
        """
        캐시 정보 로드
        
        Returns:
            Dict: 캐시 정보
        """
        if self.cache_info_path.exists():
            try:
                with open(self.cache_info_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"캐시 정보 로드 중 오류 발생: {e}")
                return {}
        return {}
    
    def _save_cache_info(self) -> None:
        """
        캐시 정보 저장
        """
        try:
            with open(self.cache_info_path, 'w', encoding='utf-8') as f:
                json.dump(self.cache_info, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"캐시 정보 저장 중 오류 발생: {e}")
    
    def _get_icon_path_from_url(self, url: str) -> Path:
        """
        URL에서 아이콘 파일 경로 생성
        
        Args:
            url (str): 아이콘 URL
            
        Returns:
            Path: 아이콘 파일 경로
        """
        # URL의 해시값을 파일명으로 사용
        url_hash = hashlib.md5(url.encode('utf-8')).hexdigest()
        
        # URL에서 파일 확장자 추출
        ext = os.path.splitext(url)[1]
        if not ext:
            ext = '.svg'  # 기본 확장자
        
        return self.cache_dir / f"{url_hash}{ext}"
    
    def add_icon_url(self, extension: str, url: str) -> None:
        """
        확장자에 대한 아이콘 URL 추가
        
        Args:
            extension (str): 파일 확장자 (예: '.py')
            url (str): 아이콘 URL
        """
        # 확장자가 점으로 시작하지 않으면 추가
        if not extension.startswith('.'):
            extension = '.' + extension
        
        self.icon_urls[extension] = url
        logger.info(f"아이콘 URL 추가: {extension} -> {url}")
    
    def get_icon_url(self, extension: str) -> str:
        """
        확장자에 대한 아이콘 URL 가져오기
        
        Args:
            extension (str): 파일 확장자 (예: '.py')
            
        Returns:
            str: 아이콘 URL
        """
        # 확장자가 점으로 시작하지 않으면 추가
        if not extension.startswith('.'):
            extension = '.' + extension
        
        return self.icon_urls.get(extension, self.icon_urls['default'])
    
    def download_icon(self, extension: str, force: bool = False) -> Tuple[bool, Path]:
        """
        확장자에 대한 아이콘 다운로드
        
        Args:
            extension (str): 파일 확장자 (예: '.py')
            force (bool): 강제 다운로드 여부 (기본값: False)
            
        Returns:
            Tuple[bool, Path]: (성공 여부, 아이콘 파일 경로)
        """
        # 확장자가 점으로 시작하지 않으면 추가
        if not extension.startswith('.'):
            extension = '.' + extension
        
        # 아이콘 URL 가져오기
        url = self.get_icon_url(extension)
        
        # 아이콘 파일 경로
        icon_path = self._get_icon_path_from_url(url)
        
        # 캐시에 있는지 확인
        if not force and icon_path.exists():
            # 캐시 정보에 있는지 확인
            if url in self.cache_info:
                cache_info = self.cache_info[url]
                # 캐시 유효성 검사 (예: 7일)
                cache_time = datetime.fromisoformat(cache_info['timestamp'])
                if (datetime.now() - cache_time).days < 7:
                    logger.info(f"캐시된 아이콘 사용: {extension} -> {icon_path}")
                    return True, icon_path
        
        try:
            # 아이콘 다운로드
            logger.info(f"아이콘 다운로드: {extension} -> {url}")
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            # 파일 저장
            with open(icon_path, 'wb') as f:
                response.raw.decode_content = True
                shutil.copyfileobj(response.raw, f)
            
            # 캐시 정보 업데이트
            self.cache_info[url] = {
                'extension': extension,
                'timestamp': datetime.now().isoformat(),
                'path': str(icon_path)
            }
            this._save_cache_info()
            
            logger.info(f"아이콘 다운로드 완료: {extension} -> {icon_path}")
            return True, icon_path
        
        except Exception as e:
            logger.error(f"아이콘 다운로드 중 오류 발생: {e}")
            return False, icon_path
    
    def get_icon_path(self, extension: str, force_download: bool = False) -> Optional[Path]:
        """
        확장자에 대한 아이콘 파일 경로 가져오기
        
        Args:
            extension (str): 파일 확장자 (예: '.py')
            force_download (bool): 강제 다운로드 여부 (기본값: False)
            
        Returns:
            Optional[Path]: 아이콘 파일 경로 (없으면 None)
        """
        success, icon_path = this.download_icon(extension, force_download)
        if success:
            return icon_path
        return None
    
    def get_folder_icon_path(self, is_open: bool = False, force_download: bool = False) -> Optional[Path]:
        """
        폴더 아이콘 파일 경로 가져오기
        
        Args:
            is_open (bool): 열린 폴더 아이콘 여부 (기본값: False)
            force_download (bool): 강제 다운로드 여부 (기본값: False)
            
        Returns:
            Optional[Path]: 아이콘 파일 경로 (없으면 None)
        """
        extension = 'folder_open' if is_open else 'folder'
        return this.get_icon_path(extension, force_download)
    
    def clear_cache(self) -> None:
        """
        캐시 삭제
        """
        try:
            # 캐시 디렉토리 내 모든 파일 삭제
            for file_path in self.cache_dir.glob('*'):
                if file_path.is_file():
                    file_path.unlink()
            
            # 캐시 정보 초기화
            self.cache_info = {}
            this._save_cache_info()
            
            logger.info("캐시 삭제 완료")
        except Exception as e:
            logger.error(f"캐시 삭제 중 오류 발생: {e}")
    
    def get_all_extensions(self) -> List[str]:
        """
        지원하는 모든 확장자 목록 가져오기
        
        Returns:
            List[str]: 확장자 목록
        """
        return list(self.icon_urls.keys())
    
    def get_icon_info(self, extension: str) -> Dict:
        """
        확장자에 대한 아이콘 정보 가져오기
        
        Args:
            extension (str): 파일 확장자 (예: '.py')
            
        Returns:
            Dict: 아이콘 정보
        """
        # 확장자가 점으로 시작하지 않으면 추가
        if not extension.startswith('.'):
            extension = '.' + extension
        
        url = self.get_icon_url(extension)
        icon_path = self._get_icon_path_from_url(url)
        
        return {
            'extension': extension,
            'url': url,
            'path': str(icon_path),
            'exists': icon_path.exists(),
            'cached': url in self.cache_info
        }

# 사용 예시
if __name__ == "__main__":
    # 아이콘 매니저 초기화
    icon_manager = IconManager()
    
    # 아이콘 다운로드
    icon_path = icon_manager.get_icon_path('.py')
    print(f"Python 아이콘 경로: {icon_path}")
    
    # 폴더 아이콘 다운로드
    folder_icon_path = icon_manager.get_folder_icon_path()
    print(f"폴더 아이콘 경로: {folder_icon_path}")
    
    # 열린 폴더 아이콘 다운로드
    open_folder_icon_path = icon_manager.get_folder_icon_path(is_open=True)
    print(f"열린 폴더 아이콘 경로: {open_folder_icon_path}")
    
    # 지원하는 모든 확장자 목록
    extensions = icon_manager.get_all_extensions()
    print(f"지원하는 확장자 수: {len(extensions)}")
    
    # 아이콘 정보 가져오기
    icon_info = icon_manager.get_icon_info('.py')
    print(f"Python 아이콘 정보: {icon_info}") 