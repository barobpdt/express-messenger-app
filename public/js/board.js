/* ═══════════════════════════════════════════════════════════
   board.js – QnA & 정보공유 게시판 클라이언트 로직
══════════════════════════════════════════════════════════════ */

const API = '/api/board';

// ── 상태 ──────────────────────────────────────────────────────────
const state = {
  boardType: 'qna',       // 'qna' | 'info'
  view: 'list',           // 'list' | 'detail'
  currentPostId: null,
  page: 1,
  totalPages: 1,
  search: '',
  searchTimeout: null,
  username: '',
  nickname: '',
  avatar: '',
  myLikes: new Set(),     // 'post-123' | 'comment-456'
};

// ── DOM 참조 ───────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ───────────────────────── 초기화 ───────────────────────────────── */
async function init() {
  // 사용자 정보 로드 (localStorage)
  state.username  = localStorage.getItem('username')  || '';
  state.nickname  = localStorage.getItem('nickname')  || state.username;
  state.avatar    = localStorage.getItem('avatar')    || '';

  renderHeader();
  bindHeaderEvents();

  // URL 해시로 탭 결정
  const hash = location.hash.replace('#', '');
  if (hash === 'info') switchBoard('info');
  else                 switchBoard('qna');

  await loadMyLikes();
}

/* ───────────────────────── 헤더 렌더 ────────────────────────────── */
function renderHeader() {
  const userBar = $('#user-bar');
  if (!userBar) return;
  if (state.username) {
    userBar.innerHTML = `
      <div class="avatar-sm" title="${escHtml(state.nickname || state.username)}">
        ${state.avatar
          ? `<img src="${escHtml(state.avatar)}" alt="avatar">`
          : escHtml((state.nickname || state.username)[0].toUpperCase())}
      </div>
      <span style="font-size:13px;color:var(--text2);font-weight:600;">${escHtml(state.nickname || state.username)}</span>
    `;
  } else {
    userBar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="promptLogin()">로그인 필요</button>
    `;
  }
}

function bindHeaderEvents() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchBoard(btn.dataset.board));
  });

  // 검색
  const searchInput = $('#search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        loadList();
      }, 350);
    });
  }

  // 글쓰기
  const writeBtn = $('#write-btn');
  if (writeBtn) writeBtn.addEventListener('click', openWriteModal);
}

/* ───────────────────────── 탭 전환 ──────────────────────────────── */
function switchBoard(type) {
  state.boardType = type;
  state.view      = 'list';
  state.page      = 1;
  state.search    = '';

  const searchInput = $('#search-input');
  if (searchInput) searchInput.value = '';

  $$('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.board === type);
  });

  // 헤더 색상 업데이트
  const boardTitle = $('#board-subtitle');
  if (boardTitle) {
    boardTitle.textContent = type === 'qna' ? 'Q&A 게시판' : '정보공유 게시판';
    boardTitle.style.color = type === 'qna' ? 'var(--accent-qna)' : 'var(--accent-info)';
  }

  const boardDesc = $('#board-desc');
  if (boardDesc) {
    boardDesc.textContent = type === 'qna'
      ? '궁금한 점을 질문하고 답변을 통해 함께 성장해요'
      : '유용한 정보와 노하우를 자유롭게 공유해요';
  }

  history.replaceState(null, '', `#${type}`);
  loadList();
}

/* ───────────────────────── 목록 로드 ────────────────────────────── */
async function loadList() {
  const container = $('#board-content');
  container.innerHTML = renderSkeletons();

  try {
    const params = new URLSearchParams({
      type: state.boardType,
      page: state.page,
      limit: 15,
      search: state.search,
    });

    const res = await fetch(`${API}/posts?${params}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    state.totalPages = data.pagination.totalPages;
    renderList(data.posts, data.pagination);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>로딩 실패</h3><p>${escHtml(err.message)}</p></div>`;
  }
}

function renderSkeletons() {
  return Array.from({ length: 5 }, () => `
    <div class="post-card" style="pointer-events:none;">
      <div class="skeleton" style="height:20px;width:60%;margin-bottom:12px;"></div>
      <div class="skeleton" style="height:13px;width:40%;"></div>
    </div>
  `).join('');
}

function renderList(posts, pagination) {
  const container = $('#board-content');

  if (!posts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${state.boardType === 'qna' ? '🙋' : '📢'}</div>
        <h3>${state.search ? '검색 결과 없음' : '등록된 게시글이 없습니다'}</h3>
        <p style="margin-top:8px;">${state.search ? '다른 키워드로 검색해 보세요.' : '첫 번째 글을 작성해 보세요!'}</p>
      </div>`;
    return;
  }

  const listHtml = posts.map((p, i) => postCardHtml(p, i)).join('');
  const paginationHtml = renderPagination(pagination);

  container.innerHTML = `<div class="post-list">${listHtml}</div>${paginationHtml}`;

  // 이벤트 연결
  $$('.post-card[data-id]').forEach(card => {
    card.addEventListener('click', () => openDetail(parseInt(card.dataset.id)));
  });
}

function postCardHtml(p, i) {
  const tags = p.tags ? p.tags.split(',').filter(Boolean) : [];
  const isNew = Date.now() - new Date(p.createdAt).getTime() < 86400000;

  return `
    <div class="post-card${p.isPinned ? ' pinned' : ''}" data-id="${p.id}" style="animation-delay:${i * 0.04}s">
      <div class="post-header-row">
        <div class="post-title">${escHtml(p.title)}</div>
        <div style="display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;">
          ${p.isPinned        ? '<span class="badge badge-pinned">📌 공지</span>' : ''}
          ${p.isAccepted      ? '<span class="badge badge-accepted">✅ 채택</span>' : ''}
          ${isNew && !p.isPinned ? '<span class="badge badge-new">NEW</span>' : ''}
        </div>
      </div>
      <div class="post-meta">
        <span class="author">
          <span class="avatar-xs">${avatarHtml(p.authorAvatar, p.authorNickname || p.author)}</span>
          ${escHtml(p.authorNickname || p.author)}
        </span>
        <span>${formatDate(p.createdAt)}</span>
        <span class="stat">👁 ${p.viewCount || 0}</span>
        <span class="stat">❤️ ${p.likeCount || 0}</span>
        <span class="stat">💬 ${p.commentCount || 0}</span>
      </div>
      ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">#${escHtml(t.trim())}</span>`).join('')}</div>` : ''}
    </div>`;
}

function renderPagination(pagination) {
  if (pagination.totalPages <= 1) return '';
  const btns = [];
  for (let i = 1; i <= pagination.totalPages; i++) {
    btns.push(`<button class="page-btn${i === pagination.page ? ' active' : ''}" onclick="gotoPage(${i})">${i}</button>`);
  }
  return `<div class="pagination">${btns.join('')}</div>`;
}

function gotoPage(page) {
  state.page = page;
  loadList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ───────────────────────── 상세 보기 ────────────────────────────── */
async function openDetail(postId) {
  state.view = 'detail';
  state.currentPostId = postId;

  const container = $('#board-content');
  container.innerHTML = `<button class="back-btn" onclick="closeDetail()">← 목록으로</button>
    <div class="post-detail"><div class="skeleton" style="height:80px;margin:20px;border-radius:8px;"></div></div>`;

  try {
    const res = await fetch(`${API}/posts/${postId}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    renderDetail(data.post, data.comments);
  } catch (err) {
    container.innerHTML = `<button class="back-btn" onclick="closeDetail()">← 목록으로</button>
      <div class="empty-state"><div class="empty-icon">⚠️</div><h3>불러오기 실패</h3></div>`;
  }
}

function renderDetail(post, comments) {
  const tags  = post.tags ? post.tags.split(',').filter(Boolean) : [];
  const liked = state.myLikes.has(`post-${post.id}`);
  const isOwner = state.username && state.username === post.author;

  const container = $('#board-content');
  container.innerHTML = `
    <button class="back-btn" onclick="closeDetail()">← 목록으로</button>

    <div class="post-detail">
      <div class="detail-hero">
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
          <span class="badge ${post.boardType === 'qna' ? 'badge-qna' : 'badge-info'}">${post.boardType === 'qna' ? 'Q&A' : '정보공유'}</span>
          ${post.isPinned   ? '<span class="badge badge-pinned">📌 공지</span>' : ''}
          ${post.isAccepted ? '<span class="badge badge-accepted">✅ 채택 완료</span>' : ''}
        </div>
        <h1 class="detail-title">${escHtml(post.title)}</h1>
        <div class="detail-meta">
          <span class="author" style="display:flex;align-items:center;gap:8px;">
            <span class="avatar-xs">${avatarHtml(post.authorAvatar, post.authorNickname || post.author)}</span>
            <strong>${escHtml(post.authorNickname || post.author)}</strong>
          </span>
          <span>${formatDate(post.createdAt)}</span>
          <span class="stat">👁 ${post.viewCount}</span>
          <span class="stat">❤️ ${post.likeCount}</span>
          <span class="stat">💬 ${post.commentCount}</span>
        </div>
        ${tags.length ? `<div class="tags" style="margin-top:14px;">${tags.map(t => `<span class="tag">#${escHtml(t.trim())}</span>`).join('')}</div>` : ''}
      </div>

      <div class="detail-content">${escHtml(post.content)}</div>

      <div class="detail-actions">
        <button class="like-btn${liked ? ' liked' : ''}" onclick="toggleLike('post',${post.id})">
          ❤️ 좋아요 <span id="post-like-count">${post.likeCount}</span>
        </button>
        ${isOwner ? `
          <button class="btn btn-ghost btn-sm" onclick="openEditModal(${post.id})">✏️ 수정</button>
          <button class="btn btn-danger btn-sm" onclick="deletePost(${post.id})">🗑️ 삭제</button>
        ` : ''}
      </div>
    </div>

    <!-- 댓글 섹션 -->
    <div class="comments-section" style="margin-top:24px;">
      <div class="section-title">
        💬 댓글 <span style="color:var(--text3);font-weight:400;">${comments.length}개</span>
      </div>
      <div class="comment-list" id="comment-list">
        ${comments.length ? comments.map(c => commentHtml(c, post)).join('') : '<div class="empty-state" style="padding:32px;"><p>첫 댓글을 작성해 보세요!</p></div>'}
      </div>
      ${renderCommentForm()}
    </div>`;
}

function commentHtml(c, post) {
  const isOwner   = state.username && state.username === c.author;
  const isPostOwner = state.username && state.username === post.author;
  const liked     = state.myLikes.has(`comment-${c.id}`);

  return `
    <div class="comment-item${c.isAccepted ? ' accepted' : ''}" id="comment-${c.id}">
      ${c.isAccepted ? '<div style="margin-bottom:8px;"><span class="badge badge-accepted">✅ 채택된 답변</span></div>' : ''}
      <div class="comment-header">
        <div class="comment-author-info">
          <span class="avatar-xs">${avatarHtml(c.authorAvatar, c.authorNickname || c.author)}</span>
          <strong style="font-size:13px;">${escHtml(c.authorNickname || c.author)}</strong>
          <span style="font-size:12px;color:var(--text3);">${formatDate(c.createdAt)}</span>
        </div>
      </div>
      <div class="comment-text">${escHtml(c.content)}</div>
      <div class="comment-actions">
        <button class="like-btn btn-sm${liked ? ' liked' : ''}" onclick="toggleLike('comment',${c.id}, this)">
          ❤️ ${c.likeCount || 0}
        </button>
        ${isPostOwner && post.boardType === 'qna' && !c.isAccepted
          ? `<button class="accept-btn" onclick="acceptAnswer(${post.id}, ${c.id})">✅ 채택</button>` : ''}
        ${isOwner ? `<button class="btn btn-danger btn-sm" onclick="deleteComment(${c.id}, ${post.id})">삭제</button>` : ''}
      </div>
    </div>`;
}

function renderCommentForm() {
  if (!state.username) {
    return `<div class="comment-form-wrap"><p style="color:var(--text3);font-size:13.5px;">댓글을 작성하려면 로그인이 필요합니다.</p></div>`;
  }
  return `
    <div class="comment-form-wrap">
      <label class="form-label">댓글 작성</label>
      <textarea class="form-textarea" id="comment-input" placeholder="${state.boardType === 'qna' ? '답변을 작성해 주세요...' : '댓글을 작성해 주세요...'}"></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:10px;">
        <button class="btn btn-primary btn-sm" onclick="submitComment()">등록</button>
      </div>
    </div>`;
}

function closeDetail() {
  state.view = 'list';
  state.currentPostId = null;
  loadList();
}

/* ───────────────────────── 댓글 제출 ────────────────────────────── */
async function submitComment() {
  if (!state.username) { showToast('로그인이 필요합니다.', 'error'); return; }
  const input = $('#comment-input');
  const content = input?.value.trim();
  if (!content) { showToast('댓글 내용을 입력하세요.', 'error'); return; }

  try {
    const res = await fetch(`${API}/posts/${state.currentPostId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: state.username,
        authorNickname: state.nickname,
        authorAvatar: state.avatar,
        content,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    showToast('댓글이 등록됐습니다.', 'success');
    openDetail(state.currentPostId);
  } catch (err) {
    showToast(err.message || '등록 실패', 'error');
  }
}

/* ───────────────────────── 댓글 삭제 ────────────────────────────── */
async function deleteComment(commentId, postId) {
  if (!confirm('댓글을 삭제하시겠습니까?')) return;
  try {
    const res = await fetch(`${API}/comments/${commentId}?username=${encodeURIComponent(state.username)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    showToast('댓글이 삭제됐습니다.', 'success');
    openDetail(postId);
  } catch (err) {
    showToast(err.message || '삭제 실패', 'error');
  }
}

/* ───────────────────────── 좋아요 ───────────────────────────────── */
async function loadMyLikes() {
  if (!state.username) return;
  try {
    const res = await fetch(`${API}/likes?username=${encodeURIComponent(state.username)}`);
    const data = await res.json();
    if (data.success) {
      state.myLikes = new Set(data.likes.map(l => `${l.targetType}-${l.targetId}`));
    }
  } catch { /* silent */ }
}

async function toggleLike(targetType, targetId, btnEl) {
  if (!state.username) { showToast('로그인이 필요합니다.', 'error'); return; }
  try {
    const res = await fetch(`${API}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, username: state.username }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const key = `${targetType}-${targetId}`;
    if (data.liked) state.myLikes.add(key);
    else            state.myLikes.delete(key);

    if (targetType === 'post') {
      // 게시글 좋아요: 카운트 숫자만 업데이트
      const countEl = $('#post-like-count');
      if (countEl) countEl.textContent = parseInt(countEl.textContent) + (data.liked ? 1 : -1);
      const likeBtn = document.querySelector(`.like-btn[onclick="toggleLike('post',${targetId})"]`);
      if (likeBtn) likeBtn.classList.toggle('liked', data.liked);
    } else {
      // 댓글 좋아요
      if (btnEl) {
        const n = parseInt(btnEl.textContent.replace(/[^\d]/g, '')) + (data.liked ? 1 : -1);
        btnEl.innerHTML = `❤️ ${n}`;
        btnEl.classList.toggle('liked', data.liked);
      }
    }
  } catch (err) {
    showToast(err.message || '실패', 'error');
  }
}

/* ───────────────────────── QnA 채택 ─────────────────────────────── */
async function acceptAnswer(postId, commentId) {
  if (!state.username) { showToast('로그인이 필요합니다.', 'error'); return; }
  if (!confirm('이 답변을 채택하시겠습니까?')) return;
  try {
    const res = await fetch(`${API}/posts/${postId}/accept`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, username: state.username }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    showToast('답변이 채택됐습니다! ✅', 'success');
    openDetail(postId);
  } catch (err) {
    showToast(err.message || '채택 실패', 'error');
  }
}

/* ───────────────────────── 글쓰기 모달 ──────────────────────────── */
function openWriteModal() {
  if (!state.username) { showToast('로그인 후 글을 작성할 수 있습니다.', 'error'); return; }
  showModal({
    title: state.boardType === 'qna' ? '질문 작성' : '정보 공유',
    body: `
      <div class="form-group">
        <label class="form-label">제목 *</label>
        <input class="form-input" id="write-title" placeholder="${state.boardType === 'qna' ? '궁금한 점을 간략히 적어주세요.' : '공유할 정보의 제목을 입력하세요.'}">
      </div>
      <div class="form-group">
        <label class="form-label">내용 *</label>
        <textarea class="form-input content-textarea" id="write-content" placeholder="${state.boardType === 'qna' ? '질문 내용을 자세히 작성하면 더 좋은 답변을 받을 수 있습니다.' : '공유할 내용을 자세히 작성해 주세요.'}"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">태그 (쉼표로 구분)</label>
        <input class="form-input" id="write-tags" placeholder="예: javascript, react, 질문">
      </div>
    `,
    onConfirm: submitPost,
    confirmText: '등록하기',
  });
}

async function submitPost() {
  const title   = $('#write-title')?.value.trim();
  const content = $('#write-content')?.value.trim();
  const tags    = $('#write-tags')?.value.trim();

  if (!title || !content) { showToast('제목과 내용은 필수입니다.', 'error'); return; }

  try {
    const res = await fetch(`${API}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardType: state.boardType,
        title, content, tags,
        author: state.username,
        authorNickname: state.nickname,
        authorAvatar: state.avatar,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    closeModal();
    showToast('게시글이 등록됐습니다! 🎉', 'success');
    state.page = 1;
    loadList();
  } catch (err) {
    showToast(err.message || '등록 실패', 'error');
  }
}

/* ───────────────────────── 수정 모달 ────────────────────────────── */
async function openEditModal(postId) {
  const res = await fetch(`${API}/posts/${postId}`);
  const data = await res.json();
  if (!data.success) return;
  const p = data.post;

  showModal({
    title: '게시글 수정',
    body: `
      <div class="form-group">
        <label class="form-label">제목</label>
        <input class="form-input" id="edit-title" value="${escHtml(p.title)}">
      </div>
      <div class="form-group">
        <label class="form-label">내용</label>
        <textarea class="form-input content-textarea" id="edit-content">${escHtml(p.content)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">태그</label>
        <input class="form-input" id="edit-tags" value="${escHtml(p.tags || '')}">
      </div>
    `,
    onConfirm: () => submitEdit(postId),
    confirmText: '수정 완료',
  });
}

async function submitEdit(postId) {
  const title   = $('#edit-title')?.value.trim();
  const content = $('#edit-content')?.value.trim();
  const tags    = $('#edit-tags')?.value.trim();
  if (!title || !content) { showToast('제목과 내용은 필수입니다.', 'error'); return; }

  try {
    const res = await fetch(`${API}/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, tags, username: state.username }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    closeModal();
    showToast('수정됐습니다.', 'success');
    openDetail(postId);
  } catch (err) {
    showToast(err.message || '수정 실패', 'error');
  }
}

/* ───────────────────────── 게시글 삭제 ──────────────────────────── */
async function deletePost(postId) {
  if (!confirm('게시글을 삭제하시겠습니까?')) return;
  try {
    const res = await fetch(`${API}/posts/${postId}?username=${encodeURIComponent(state.username)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    showToast('게시글이 삭제됐습니다.', 'success');
    closeDetail();
  } catch (err) {
    showToast(err.message || '삭제 실패', 'error');
  }
}

/* ───────────────────────── 모달 ─────────────────────────────────── */
let modalConfirmCb = null;

function showModal({ title, body, onConfirm, confirmText = '확인' }) {
  modalConfirmCb = onConfirm;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="modal-close" onclick="closeModal()" aria-label="닫기">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">취소</button>
        <button class="btn btn-primary" onclick="modalConfirm()">${confirmText}</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function modalConfirm() {
  if (typeof modalConfirmCb === 'function') modalConfirmCb();
}

function closeModal() {
  const overlay = $('#modal-overlay');
  if (overlay) overlay.remove();
  modalConfirmCb = null;
}

/* ───────────────────────── 로그인 프롬프트 ──────────────────────── */
function promptLogin() {
  showModal({
    title: '사용자 이름 설정',
    body: `
      <div class="form-group">
        <label class="form-label">사용자 이름 (username)</label>
        <input class="form-input" id="login-username" placeholder="username 입력">
      </div>
      <div class="form-group">
        <label class="form-label">닉네임 (선택)</label>
        <input class="form-input" id="login-nickname" placeholder="표시 이름">
      </div>
    `,
    onConfirm: applyLogin,
    confirmText: '저장',
  });
}

function applyLogin() {
  const username = $('#login-username')?.value.trim();
  const nickname = $('#login-nickname')?.value.trim();
  if (!username) { showToast('사용자 이름을 입력하세요.', 'error'); return; }
  state.username = username;
  state.nickname = nickname || username;
  localStorage.setItem('username', username);
  localStorage.setItem('nickname', state.nickname);
  closeModal();
  renderHeader();
  bindHeaderEvents();
  loadMyLikes();
  showToast(`환영합니다, ${state.nickname}님! 👋`, 'success');
}

/* ───────────────────────── 토스트 ───────────────────────────────── */
function showToast(msg, type = 'info') {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* ───────────────────────── 유틸 ─────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)     return '방금 전';
  if (diff < 3600)   return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400)  return `${Math.floor(diff/3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff/86400)}일 전`;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function avatarHtml(avatarUrl, name) {
  if (avatarUrl) return `<img src="${escHtml(avatarUrl)}" alt="">`;
  return escHtml((name || '?')[0].toUpperCase());
}

// 전역 노출
Object.assign(window, {
  gotoPage, openDetail, closeDetail,
  submitComment, deleteComment,
  toggleLike, acceptAnswer,
  openWriteModal, openEditModal, deletePost,
  modalConfirm, closeModal, promptLogin, switchBoard,
});

document.addEventListener('DOMContentLoaded', init);
