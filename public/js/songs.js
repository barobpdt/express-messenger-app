// Song database and search functionality
// ── DB API 연동 버전 ──────────────────────────────────────────────────────────

const SONG_API = '/api/songs';

let allSongs = [];
let filteredSongs = [];

/**
 * DB API에서 전체 곡 목록 로드
 * songsTable: id, artist, title, lyrics, artistChosung, titleChosung
 * number 컬럼이 없으므로 id를 곡번호로 사용
 // 예: 다음 페이지
	const PAGE_SIZE = 30;
	let currentPage = 0;

	// 다음 페이지 로드
	await SongManager.loadSongs(currentPage * PAGE_SIZE, PAGE_SIZE);
	currentPage++;

	// 전체 페이지 수 계산
	const totalPages = Math.ceil(total / PAGE_SIZE); 
*/
async function loadSongs(offset = 0, limit = 30) {
	try {
		console.log(`Loading songs from API... (offset=${offset}, limit=${limit})`);
		const response = await fetch(`${SONG_API}?limit=${limit}&offset=${offset}`);

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
		}

		const data = await response.json();

		// 응답 구조: { total, limit, offset, songs }
		const list = Array.isArray(data) ? data : (data.songs ?? []);

		allSongs = list.map(normalizeSong);
		filteredSongs = [...allSongs];
		console.log(`Loaded ${allSongs.length} / ${data.total ?? '?'} songs`);
		return allSongs;
	} catch (error) {
		console.error('Failed to load songs from API:', error.message);
		allSongs = [];
		filteredSongs = [];
		return [];
	}
}

/** DB 레코드 → UI 필드 정규화 */
function normalizeSong(song) {
	return {
		id: song.id,
		number: String(song.id).padStart(5, '0'),   // id를 곡번호로
		title: song.title,
		artist: song.artist,
		category: song.category ?? '기타',            // DB에 없으면 '기타'
		language: song.language ?? 'korean',
	};
}

/**
 * 검색 — 서버 초성 검색 API 활용
 * 검색어가 있으면 /api/songs/search?q=... 호출
 * 없으면 로컬 allSongs 반환
 */
async function searchSongsAsync(query) {
	if (!query || query.trim() === '') {
		filteredSongs = [...allSongs];
		return filteredSongs;
	}

	try {
		const res = await fetch(`${SONG_API}/search?q=${encodeURIComponent(query.trim())}`);
		if (!res.ok) throw new Error('search api error');
		const { songs } = await res.json();
		filteredSongs = songs.map(normalizeSong);
		return filteredSongs;
	} catch {
		// 서버 검색 실패 시 클라이언트 필터링 폴백
		return searchSongs(query);
	}
}

/** 클라이언트 측 텍스트 검색 (폴백) */
function searchSongs(query) {
	if (!query || query.trim() === '') {
		filteredSongs = [...allSongs];
		return filteredSongs;
	}

	const searchTerm = query.toLowerCase().trim();
	filteredSongs = allSongs.filter(song =>
		song.title.toLowerCase().includes(searchTerm) ||
		song.artist.toLowerCase().includes(searchTerm) ||
		song.number.includes(searchTerm)
	);
	return filteredSongs;
}

/** 카테고리 필터 (DB에 category 컬럼 없으므로 클라이언트 필터링) */
function filterByCategory(category) {
	if (!category || category === 'all') {
		filteredSongs = [...allSongs];
		return filteredSongs;
	}
	filteredSongs = allSongs.filter(song => song.category === category);
	return filteredSongs;
}

/** 언어 필터 */
function filterByLanguage(language) {
	if (!language || language === 'all') {
		filteredSongs = [...allSongs];
		return filteredSongs;
	}
	filteredSongs = allSongs.filter(song => song.language === language);
	return filteredSongs;
}

/**
 * 복합 필터 (카테고리 + 검색어)
 * 검색어가 있으면 서버 검색 후 카테고리 필터 적용
 */
function applyFilters(category, searchQuery) {
	let results = [...allSongs];

	if (category && category !== 'all') {
		results = results.filter(song => song.category === category);
	}

	if (searchQuery && searchQuery.trim() !== '') {
		const searchTerm = searchQuery.toLowerCase().trim();
		results = results.filter(song =>
			song.title.toLowerCase().includes(searchTerm) ||
			song.artist.toLowerCase().includes(searchTerm) ||
			song.number.includes(searchTerm)
		);
	}

	filteredSongs = results;
	return filteredSongs;
}

/** 전체 카테고리 목록 */
function getCategories() {
	const categories = new Set(allSongs.map(song => song.category));
	return ['all', ...Array.from(categories)];
}

/** ID로 곡 조회 */
function getSongById(id) {
	return allSongs.find(song => song.id === id);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * pg_trgm 유사도 검색
 * @param {string} q       - 검색어 (가사 일부, 노래 제목, 아티스트명 등)
 * @param {object} options - { target: 'lyrics'|'title'|'artist'|'all', threshold: 0~1, limit: number }
 */
async function similarSearch(q, { target = 'lyrics', threshold = 0.1, limit = 20 } = {}) {
	if (!q?.trim()) return [];
	try {
		const params = new URLSearchParams({ q, target, threshold, limit });
		const res = await fetch(`${SONG_API}/similar?${params}`);
		if (!res.ok) throw new Error(`similar API error ${res.status}`);
		const data = await res.json();
		// score 필드 포함된 결과 반환 (정규화)
		return (data.songs ?? []).map(s => ({ ...normalizeSong(s), score: s.score }));
	} catch (e) {
		console.error('similarSearch error:', e.message);
		return [];
	}
}

window.SongManager = {
	loadSongs,
	searchSongs,
	searchSongsAsync,
	similarSearch,
	filterByCategory,
	filterByLanguage,
	applyFilters,
	getCategories,
	getSongById,
	getAllSongs: () => allSongs,
	getFilteredSongs: () => filteredSongs,
};
