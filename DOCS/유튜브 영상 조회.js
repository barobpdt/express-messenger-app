// routes/youtube.js 영상 mp3 저장 및 유튜브 조회
const express = require('express');
const router = express.Router();
const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const YT_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * GET /api/youtube/categories?regionCode=KR
 * 카테고리 목록 조회
 */
router.get('/youtube/categories', async (req, res) => {
  const regionCode = req.query.regionCode || 'KR';
  const hl = req.query.hl || 'ko';

  try {
    const url = `${YT_BASE}/videoCategories?part=snippet&regionCode=${regionCode}&hl=${hl}&key=${YT_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    // assignable=true인 카테고리만 (실제 영상에 사용 가능한 것)
    const categories = data.items
      .filter(item => item.snippet.assignable)
      .map(item => ({
        id: item.id,
        title: item.snippet.title
      }));

    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/youtube/videos?categoryId=10&maxResults=20&pageToken=...
 * 카테고리별 인기 영상 조회
 */
router.get('/youtube/videos', async (req, res) => {
  const {
    categoryId = '10',   // 10 = 음악
    regionCode = 'KR',
    maxResults = 20,
    pageToken = ''
  } = req.query;

  try {
    let url = `${YT_BASE}/videos?part=snippet,statistics,contentDetails`
            + `&chart=mostPopular`
            + `&videoCategoryId=${categoryId}`
            + `&regionCode=${regionCode}`
            + `&maxResults=${maxResults}`
            + `&key=${YT_API_KEY}`;

    if (pageToken) url += `&pageToken=${pageToken}`;

    const response = await fetch(url);
    const data = await response.json();

    const videos = (data.items || []).map(v => ({
      id: v.id,
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      thumbnail: v.snippet.thumbnails?.medium?.url,
      publishedAt: v.snippet.publishedAt,
      viewCount: v.statistics?.viewCount,
      likeCount: v.statistics?.likeCount,
      duration: v.contentDetails?.duration,  // ISO 8601 (PT4M13S)
      url: `https://www.youtube.com/watch?v=${v.id}`
    }));

    res.json({
      videos,
      nextPageToken: data.nextPageToken || null,
      totalResults: data.pageInfo?.totalResults
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/youtube/search?q=검색어&categoryId=10&maxResults=10
 * 카테고리 내 키워드 검색
 */
router.get('/youtube/search', async (req, res) => {
  const { q, categoryId, maxResults = 10, pageToken = '' } = req.query;
  if (!q) return res.status(400).json({ error: '검색어(q)가 필요합니다.' });

  try {
    let url = `${YT_BASE}/search?part=snippet`
            + `&type=video`
            + `&q=${encodeURIComponent(q)}`
            + `&maxResults=${maxResults}`
            + `&key=${YT_API_KEY}`;

    if (categoryId) url += `&videoCategoryId=${categoryId}`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const response = await fetch(url);
    const data = await response.json();

    const videos = (data.items || []).map(v => ({
      id: v.id.videoId,
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      thumbnail: v.snippet.thumbnails?.medium?.url,
      publishedAt: v.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${v.id.videoId}`
    }));

    res.json({ videos, nextPageToken: data.nextPageToken || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;




// routes/ytmp3.js
const DOWNLOAD_DIR = process.env.YTMP3_DIR || path.join(__dirname, '../downloads/music');

// 다운로드 디렉토리 생성
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

/**
 * POST /api/ytmp3/download
 * Body: { url: string, quality?: "128"|"192"|"320" }
 */
router.post('/ytmp3/download', async (req, res) => {
    const { url, quality = '192' } = req.body;
    if (!url) return res.status(400).json({ error: 'YouTube URL이 필요합니다.' });

    // 영상 제목 먼저 조회
    const infoResult = await getVideoInfo(url);
    if (!infoResult.success) return res.status(400).json({ error: infoResult.error });

    const title = infoResult.title;

    // 진행 상황 SSE 또는 단순 응답
    const args = [
        url,
        '-f', 'bestaudio/best',
        '-x',                              // 오디오 추출
        '--audio-format', 'mp3',
        '--audio-quality', quality + 'K',
        '-o', path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
        '--no-playlist',
    ];

    const proc = spawn('yt-dlp', args);
    let stderr = '';

    proc.stderr.on('data', data => { stderr += data.toString(); });

    proc.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({ error: '다운로드 실패', detail: stderr });
        }
        const file = path.join(DOWNLOAD_DIR, `${title}.mp3`);
        res.json({
            success: true,
            title,
            file,
            quality: quality + 'kbps'
        });
    });
});

/**
 * GET /api/ytmp3/info?url=...
 * 영상 정보 조회 (다운로드 없이)
 */
router.get('/ytmp3/info', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url 파라미터가 필요합니다.' });

    const result = await getVideoInfo(url);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result);
});

/**
 * GET /api/ytmp3/stream?url=...
 * MP3를 파일로 저장하지 않고 직접 스트리밍
 */
router.get('/ytmp3/stream', (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url이 필요합니다.' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    const proc = spawn('yt-dlp', [
        url,
        '-f', 'bestaudio/best',
        '-o', '-',              // stdout으로 출력
        '--no-playlist',
    ]);

    // FFmpeg로 MP3 변환 후 스트리밍
    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',         // stdin에서 읽기
        '-f', 'mp3',
        '-ab', '192k',
        'pipe:1'                // stdout으로 출력
    ]);

    proc.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res);

    req.on('close', () => {
        proc.kill();
        ffmpeg.kill();
    });
});

// ── 내부 함수 ──
function getVideoInfo(url) {
    return new Promise((resolve) => {
        execFile('yt-dlp', [
            url,
            '--dump-json',
            '--no-playlist',
            '--no-download'
        ], (err, stdout) => {
            if (err) return resolve({ success: false, error: err.message });
            try {
                const info = JSON.parse(stdout);
                resolve({
                    success: true,
                    title: info.title,
                    duration: info.duration,         // 초
                    channel: info.channel,
                    thumbnail: info.thumbnail,
                    url: info.webpage_url,
                    viewCount: info.view_count
                });
            } catch {
                resolve({ success: false, error: 'JSON 파싱 실패' });
            }
        });
    });
}

module.exports = router;
