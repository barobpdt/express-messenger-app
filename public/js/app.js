// Main application logic

let currentView = 'selection';
let currentCategory = 'all';
let draggedElement = null;
let draggedIndex = null;

// Initialize application
async function initApp() {
    // Initialize managers
    SettingsManager.initSettings();
    CartManager.initCart();
    CategorySelectorManager.initCategorySelector();

    // Load songs
    console.log('Loading songs...');
    const songs = await SongManager.loadSongs();
    console.log('Songs loaded:', songs ? songs.length : 0);

    // Setup event listeners
    setupEventListeners();

    // Render initial view
    console.log('Rendering initial view...');
    if (songs && songs.length > 0) {
        renderSongSelection();
    } else {
        console.error('No songs to render!');
        const songsGrid = document.getElementById('songs-grid');
        if (songsGrid) {
            songsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--color-text-tertiary);">
                    <p style="font-size: 1.25rem;">노래 데이터를 불러오지 못했습니다</p>
                    <p style="margin-top: 1rem;">페이지를 새로고침 해주세요</p>
                </div>
            `;
        }
    }
    showView('selection');

    // Auto-open category selector on page load (optional)
    // Uncomment the line below if you want the modal to open automatically
    // setTimeout(() => CategorySelectorManager.openCategorySelector(), 500);
}

// Setup all event listeners
function setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            showView(view);
        });
    });

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
    }

    // Category filters
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            handleCategoryFilter(e.target.dataset.category);
        });
    });

    // Cart float button
    const cartFloatBtn = document.getElementById('cart-float-btn');
    if (cartFloatBtn) {
        cartFloatBtn.addEventListener('click', openCartModal);
    }

    // Cart modal close
    const closeCartBtn = document.getElementById('close-cart-btn');
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', closeCartModal);
    }

    // Cart modal backdrop
    const cartModal = document.getElementById('cart-modal');
    if (cartModal) {
        cartModal.addEventListener('click', (e) => {
            if (e.target === cartModal) {
                closeCartModal();
            }
        });
    }

    // Clear cart button
    const clearCartBtn = document.getElementById('clear-cart-btn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', handleClearCart);
    }

    // Confirm cart button
    const confirmCartBtn = document.getElementById('confirm-cart-btn');
    if (confirmCartBtn) {
        confirmCartBtn.addEventListener('click', handleConfirmCart);
    }

    // Settings controls
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            SettingsManager.toggleTheme();
        });
    }

    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            SettingsManager.setLanguage(e.target.value);
        });
    }

    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            SettingsManager.setVolume(e.target.value);
        });
    }

    // Category selector button
    const categorySelectorBtn = document.getElementById('category-selector-btn');
    if (categorySelectorBtn) {
        categorySelectorBtn.addEventListener('click', () => {
            CategorySelectorManager.openCategorySelector();
        });
    }
}

// Show specific view
function showView(viewName) {
    currentView = viewName;

    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}-view`);
    });

    // Render view content
    if (viewName === 'selection') {
        renderSongSelection();
    } else if (viewName === 'status') {
        renderReservationStatus();
    } else if (viewName === 'settings') {
        SettingsManager.initSettings();
    }
}

// Handle search (서버 초성 검색 + 300ms debounce)
let _searchTimer = null;
function handleSearch(query) {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(async () => {
        const songs = await SongManager.searchSongsAsync(query);
        renderSongs(songs);
    }, 300);
}

// Handle category filter
function handleCategoryFilter(category) {
    currentCategory = category;

    // Update filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.category === category);
    });

    // Apply filter
    const searchQuery = document.getElementById('search-input').value;
    const songs = SongManager.applyFilters(category, searchQuery);
    renderSongs(songs);
}

// Render song selection view
function renderSongSelection() {
    const searchQuery = document.getElementById('search-input')?.value || '';
    const songs = SongManager.applyFilters(currentCategory, searchQuery);
    renderSongs(songs);
}

// Render songs grid
function renderSongs(songs) {
    console.log('renderSongs called with', songs.length, 'songs');
    const songsGrid = document.getElementById('songs-grid');
    if (!songsGrid) {
        console.error('songs-grid element not found!');
        return;
    }

    if (songs.length === 0) {
        console.warn('No songs to display');
        songsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--color-text-tertiary);">
        <p style="font-size: 1.25rem;">검색 결과가 없습니다</p>
      </div>
    `;
        return;
    }

    console.log('Rendering', songs.length, 'song cards');
    songsGrid.innerHTML = songs.map(song => `
    <div class="song-card" data-song-id="${song.id}">
      <div class="song-number">${song.number}</div>
      <div class="song-title">${song.title}</div>
      <div class="song-artist">${song.artist}</div>
      <div class="song-footer">
        <span class="song-category">${song.category}</span>
        <button class="add-to-cart-btn" data-song-id="${song.id}">
          예약하기
        </button>
      </div>
    </div>
  `).join('');

    // Add event listeners to add-to-cart buttons
    songsGrid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const songId = parseInt(e.target.dataset.songId);
            const song = SongManager.getSongById(songId);
            if (song) {
                CartManager.addToCart(song);
            }
        });
    });
}

// Open cart modal
function openCartModal() {
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.classList.add('active');
        renderCartItems();
    }
}

// Close cart modal
function closeCartModal() {
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Render cart items
function renderCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartEmpty = document.getElementById('cart-empty');
    const items = CartManager.getCartItems();

    if (items.length === 0) {
        cartEmpty.classList.remove('hidden');
        cartItemsContainer.classList.add('hidden');
        return;
    }

    cartEmpty.classList.add('hidden');
    cartItemsContainer.classList.remove('hidden');

    cartItemsContainer.innerHTML = items.map((item, index) => `
    <div class="cart-item" draggable="true" data-index="${index}" data-song-id="${item.id}">
      <span class="drag-handle">☰</span>
      <div class="cart-item-info">
        <div class="cart-item-number">#${item.number}</div>
        <div class="cart-item-title">${item.title}</div>
        <div class="cart-item-artist">${item.artist}</div>
      </div>
      <button class="remove-item-btn" data-song-id="${item.id}">×</button>
    </div>
  `).join('');

    // Add drag and drop event listeners
    setupDragAndDrop();

    // Add remove button event listeners
    cartItemsContainer.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const songId = parseInt(e.target.dataset.songId);
            CartManager.removeFromCart(songId);
            renderCartItems();
        });
    });
}

// Setup drag and drop for cart items
function setupDragAndDrop() {
    const cartItems = document.querySelectorAll('.cart-item');

    cartItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(e) {
    draggedElement = e.target;
    draggedIndex = parseInt(e.target.dataset.index);
    e.target.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();

    const dropTarget = e.target.closest('.cart-item');
    if (!dropTarget || dropTarget === draggedElement) return;

    const dropIndex = parseInt(dropTarget.dataset.index);

    if (draggedIndex !== dropIndex) {
        CartManager.reorderCart(draggedIndex, dropIndex);
        renderCartItems();
    }
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedElement = null;
    draggedIndex = null;
}

// Handle clear cart
function handleClearCart() {
    if (confirm('예약 목록을 모두 삭제하시겠습니까?')) {
        CartManager.clearCart();
        renderCartItems();
    }
}

// Handle confirm cart
function handleConfirmCart() {
    const items = CartManager.getCartItems();
    if (items.length === 0) {
        alert('예약 목록이 비어있습니다');
        return;
    }

    alert(`${items.length}곡이 예약되었습니다!`);
    closeCartModal();
    showView('status');
}

// Render reservation status view
function renderReservationStatus() {
    const queueList = document.getElementById('queue-list');
    const items = CartManager.getCartItems();

    if (items.length === 0) {
        queueList.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--color-text-tertiary);">
        <p style="font-size: 1.25rem;">예약된 곡이 없습니다</p>
        <p style="margin-top: 1rem;">노래를 선곡하여 예약해주세요</p>
      </div>
    `;
        return;
    }

    queueList.innerHTML = items.map((item, index) => `
    <div class="queue-item">
      <div class="queue-number">${index + 1}</div>
      <div class="queue-info">
        <div class="queue-song-number">#${item.number}</div>
        <div class="queue-song-title">${item.title}</div>
        <div class="queue-song-artist">${item.artist}</div>
      </div>
    </div>
  `).join('');
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
