// Tablet Order System Logic (public/js/order.js)

const API = "/api/order";
async function get(path) {
    try {
        const res = await fetch(API + path);
        if (!res.ok) throw new Error("API request failed");
        return await res.json();
    } catch (e) {
        console.error("API Get Error:", e);
        return [];
    }
}

// State
let categories = [];
let menus = [];
let cart = [];
let currentCategoryId = null;

// Mock Table ID for now (In real life, this comes from a setup screen or URL param)
const urlParams = new URLSearchParams(window.location.search);
let tableId = urlParams.get('tableId') || 1;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // 1. Fetch data
    [categories, menus] = await Promise.all([
        get("/categories"),
        get("/menu")
    ]);

    // 2. Initial Render
    renderCategories();
    renderMenus();
    updateCartUI();

    // 3. Connect WebSocket for realtime sync (Phase 4 placeholder)
    initWebSocket();

    // 4. Idle 시뮬레이션용 스크린세이버 시작 (Phase 5)
    initScreensaver();
}

// ── 달콤한 UI 렌더링 로직 (Categories & Menus) ── 

function renderCategories() {
    const listEl = document.getElementById('category-list');

    // 기본 "전체메뉴" 버튼
    let html = `<button class="cat-btn ${currentCategoryId === null ? 'active' : ''}" 
                        onclick="selectCategory(null)">🔥 전체메뉴</button>`;

    categories.forEach(cat => {
        const isActive = currentCategoryId === cat.id ? 'active' : '';
        html += `<button class="cat-btn ${isActive}" 
                         onclick="selectCategory(${cat.id})">${cat.name}</button>`;
    });

    listEl.innerHTML = html;
}

function selectCategory(id) {
    currentCategoryId = id;
    renderCategories();
    renderMenus();

    // UI 업데이트 (현재 선택된 카테고리 헤더)
    const headerTitle = id === null ? "🔥 전체메뉴" : categories.find(c => c.id === id)?.name || "메뉴";
    document.getElementById('current-category').innerText = headerTitle;
}

function renderMenus() {
    const gridEl = document.getElementById('menu-grid');

    // Filter menus based on selected category
    const filteredMenus = currentCategoryId === null
        ? menus
        : menus.filter(m => m.category_id === currentCategoryId);

    if (filteredMenus.length === 0) {
        gridEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-muted);">
            이 카테고리에는 등록된 메뉴가 없습니다.
        </div>`;
        return;
    }

    gridEl.innerHTML = filteredMenus.map(m => {
        // DB 컬럼 매핑: is_available (false면 품절), image
        const isSoldOut = m.is_available === false;
        const isBest = m.isBest || false; // 베스트 뱃지 (임시 필드)

        const cardClass = isSoldOut ? "menu-card sold-out" : "menu-card";

        let badgesHtml = "";
        if (isBest) badgesHtml += `<div class="badge best">BEST</div>`;
        if (isSoldOut) badgesHtml += `<div class="badge soldout">품절</div>`;

        // DB에서 image를 가져올 수 있다면 그 이미지를 사용
        const imgContent = m.image
            ? `<img src="${m.image}" alt="${m.name}" loading="lazy">`
            : `<div class="img-placeholder">🍽️</div>`;

        return `
            <div class="${cardClass}" onclick="${isSoldOut ? '' : `addToCart(${m.id}, '${m.name.replace(/'/g, "\\'")}', ${m.price})`}">
                <div class="badges">
                    ${badgesHtml}
                </div>
                <div class="img-wrapper">
                    ${imgContent}
                </div>
                <div class="menu-info">
                    <div class="m-title">${m.name}</div>
                    <div class="m-desc">${m.description || "설명이 등록되지 않았습니다."}</div>
                    <div class="m-price">
                        <span>${m.price.toLocaleString()}원</span>
                        ${!isSoldOut ? `<div class="add-cart-icon">+</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

// ── 장바구니 로직 (Cart) ── 

function addToCart(id, name, price) {
    const existing = cart.find(c => c.id === id);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id, name, price, qty: 1 });
    }
    updateCartUI();

    // 시각적 피드백 (주문 패널 살짝 흔들기)
    const panel = document.querySelector('.cart-panel');
    panel.style.transform = 'scale(1.02)';
    setTimeout(() => panel.style.transform = 'scale(1)', 150);
}

function updateCartUI() {
    const itemsEl = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-price');
    const submitBtn = document.getElementById('btn-submit-order');

    if (cart.length === 0) {
        itemsEl.innerHTML = `
            <div class="cart-empty-msg">
                메뉴를 터치하여<br>장바구니에 담아주세요 🍽️
            </div>
        `;
        totalEl.innerText = "0원";
        submitBtn.disabled = true;
        return;
    }

    let html = "";
    let total = 0;

    cart.forEach((c, idx) => {
        total += (c.price * c.qty);
        html += `
            <div class="cart-item">
                <div class="ci-top">
                    <span class="ci-name">${c.name}</span>
                    <button class="ci-del" onclick="removeFromCart(${idx})" title="삭제">×</button>
                </div>
                <div class="ci-bottom">
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
                        <span class="qty-display">${c.qty}</span>
                        <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
                    </div>
                    <span class="ci-price">${(c.price * c.qty).toLocaleString()}원</span>
                </div>
            </div>
        `;
    });

    itemsEl.innerHTML = html;
    totalEl.innerText = `${total.toLocaleString()}원`;
    submitBtn.disabled = false;

    // 스크롤 맨 아래로
    itemsEl.scrollTop = itemsEl.scrollHeight;
}

function changeQty(index, delta) {
    const item = cart[index];
    item.qty += delta;
    if (item.qty <= 0) {
        cart.splice(index, 1);
    }
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm("장바구니를 모두 지우시겠습니까?")) {
        cart = [];
        updateCartUI();
    }
}

// ── 주문 전송 및 기능 모달 (Phase 2 & 3 Placeholder) ── 

async function submitOrder() {
    if (cart.length === 0) return;

    const confirmMsg = `총 ${cart.length}개 메뉴를 주문하시겠습니까?\n결제 금액: ${document.getElementById('cart-total-price').innerText}`;
    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById('btn-submit-order');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span style="font-size:1rem;">⏳ 전송 중...</span>`;
    btn.disabled = true;

    try {
        const payload = {
            tableId: parseInt(tableId),
            memo: "태블릿 주문",
            items: cart.map(c => ({
                menuItemId: c.id,
                quantity: c.qty
            }))
        };

        const res = await fetch(API + "/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Order failed");

        // Success
        cart = [];
        updateCartUI();

        showPopup("주문 완료", "주문이 주방으로\\n성공적으로 전달되었습니다! 🎉", "✅");
    } catch (e) {
        console.error(e);
        showPopup("주문 실패", "주문 전송 중 오류가 발생했습니다.\\n카운터에 문의해주세요.", "❌");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ── 커스텀 팝업 ──
function showPopup(title, message, icon = "✅") {
    document.getElementById("popup-title").innerText = title;
    document.getElementById("popup-message").innerText = message;
    document.getElementById("popup-icon").innerText = icon;
    document.getElementById("custom-popup").classList.add("show");
}

function closePopup() {
    document.getElementById("custom-popup").classList.remove("show");
}

async function openBillModal() {
    try {
        const btn = document.querySelector('[onclick="openBillModal()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span style="font-size:1.2rem;">⏳ </span>로딩 중...`;
        btn.disabled = true;

        // 1. 해당 테이블의 모든 주문 가져오기
        const orders = await get('/orders/table/' + tableId);
        // 결제되지 않은 주문만 필터링
        const activeOrders = orders.filter(o => o.status !== 'paid');

        // 2. 각 주문의 상세 정보(items) 병렬로 가져오기
        const details = await Promise.all(activeOrders.map(o => get(`/orders/${o.id}`)));

        // 3. 아이템 병합 (동일한 menuItemId는 수량과 금액 합산)
        const merged = new Map();
        for (const order of details) {
            for (const item of (order.items || [])) {
                if (merged.has(item.menuItemId)) {
                    const m = merged.get(item.menuItemId);
                    m.quantity += item.quantity;
                    m.subtotal += item.subtotal;
                } else {
                    merged.set(item.menuItemId, {
                        name: item.name || '알 수 없는 메뉴',
                        unitPrice: item.unitPrice,
                        quantity: item.quantity,
                        subtotal: item.subtotal,
                    });
                }
            }
        }

        const contentEl = document.getElementById('bill-content');
        const totalEl = document.getElementById('bill-total-price');

        if (merged.size === 0) {
            contentEl.innerHTML = `<div style="text-align:center; padding: 40px 0; color: var(--text-muted);">주문 내역이 없습니다.</div>`;
            totalEl.innerText = "0원";
        } else {
            // 서브토탈 기준으로 내림차순 정렬
            const sorted = [...merged.values()].sort((a, b) => b.subtotal - a.subtotal);
            let html = "";
            let grandTotal = 0;

            sorted.forEach(item => {
                grandTotal += item.subtotal;
                html += `
                    <div class="bill-item">
                        <span class="bill-item-name">${item.name}</span>
                        <span class="bill-item-qty">${item.quantity}개</span>
                        <span class="bill-item-price">${item.subtotal.toLocaleString()}원</span>
                    </div>
                `;
            });
            contentEl.innerHTML = html;
            totalEl.innerText = `${grandTotal.toLocaleString()}원`;
        }

        // 모달 열기
        document.getElementById('bill-modal').classList.add('show');

    } catch (e) {
        console.error(e);
        showPopup("오류", "주문 내역을 불러오는데 실패했습니다.", "❌");
    } finally {
        const btn = document.querySelector('[onclick="openBillModal()"]');
        if (btn) {
            btn.innerHTML = `<span>🧾</span> 주문내역`;
            btn.disabled = false;
        }
    }
}

function closeBillModal() {
    document.getElementById('bill-modal').classList.remove('show');
}

function openCallModal() {
    document.getElementById('call-modal').classList.add('show');
}

function closeCallModal() {
    document.getElementById('call-modal').classList.remove('show');
}

let ws = null;

function sendCall(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'staff-call',
            tableId: tableId,
            message: message
        }));
        closeCallModal();
        showPopup("호출 완료", `[${message}]\\n요청이 카운터로 전달되었습니다.`, "🔔");
    } else {
        showPopup("통신 오류", "서버와 연결이 끊어졌습니다.\\n잠시 후 다시 시도해주세요.", "❌");
    }
}

// ── WebSocket (Phase 4) ──
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        // 테이블 POS용으로 등록
        ws.send(JSON.stringify({ type: 'table-init', tableId: tableId }));
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'menu-update') {
                // 메뉴 품절 상태 반영
                // menus = data.menus; renderMenus();
            }
        } catch (e) { }
    };
}

// ── 타이머 / 스크린세이버 (Phase 5) ──
let idleTimer = null;
const IDLE_TIMEOUT = 1000 * 30; // 30초 테스트용 (실제 배포 시 60~120초 권장)

function initScreensaver() {
    const events = ['touchstart', 'click', 'mousemove', 'scroll', 'keypress'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showScreensaver, IDLE_TIMEOUT);
}

function showScreensaver() {
    const ss = document.getElementById('screensaver');
    if (ss && !ss.classList.contains('active')) {
        ss.classList.add('active');

        const video = document.getElementById('ss-video');
        if (video) video.play().catch(() => { });

        // 방치 방지: 열려있는 모달들을 닫고 초기화
        closeCallModal();
        closeBillModal();
        closePopup();
        clearCartNoConfirm(); // 빈 테이블 방치 시 장바구니 찌꺼기 방지
        selectCategory(null); // 메인 화면으로 복구

        // 스크롤도 맨 위로
        document.getElementById('menu-grid').scrollTop = 0;
    }
}

function hideScreensaver() {
    const ss = document.getElementById('screensaver');
    if (ss) ss.classList.remove('active');
    resetIdleTimer();
}

function clearCartNoConfirm() {
    if (cart.length > 0) {
        cart = [];
        updateCartUI();
    }
}
