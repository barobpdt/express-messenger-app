document.addEventListener('DOMContentLoaded', async () => {
    const iconGrid = document.getElementById('icon-grid');
    const searchInput = document.getElementById('search-input');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const statsInfo = document.getElementById('stats-info');
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');

    let allIcons = [];
    let currentFilter = 'all';

    // 1. Load Icons (from generated file or handle fetch)
    async function loadIcons() {
        try {
            const response = await fetch('./boxicons_list.json');
            if (!response.ok) throw new Error('Failed to fetch icon list');
            allIcons = await response.json();
            renderIcons(allIcons);
        } catch (error) {
            console.error('Error loading icons:', error);
            // Fallback: If fetch fails, show error in grid
            iconGrid.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-error-circle'></i>
                    <p>아이콘 목록을 불러오지 못했습니다. (./boxicons_list.json)</p>
                </div>`;
        }
    }

    // 2. Render Icons
    function renderIcons(icons) {
        if (icons.length === 0) {
            iconGrid.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-search-alt'></i>
                    <p>검색 결과가 없습니다.</p>
                </div>`;
            statsInfo.textContent = `검색 결과: 0 / ${allIcons.length}`;
            return;
        }

        iconGrid.innerHTML = '';
        const fragment = document.createDocumentFragment();

        icons.forEach(iconName => {
            const card = document.createElement('div');
            card.className = 'icon-card';
            card.innerHTML = `
                <i class='bx ${iconName}'></i>
                <div class="icon-name">${iconName}</div>
                <div class="copy-overlay">
                    <i class='bx bx-copy'></i>
                    <span>COPY</span>
                </div>
            `;

            card.addEventListener('click', () => copyToClipboard(iconName, card));
            fragment.appendChild(card);
        });

        iconGrid.appendChild(fragment);
        statsInfo.textContent = `조회된 아이콘: ${icons.length} / ${allIcons.length}`;
    }

    // 3. Search and Filter Logic
    function filterAndSearch() {
        const query = searchInput.value.toLowerCase().trim();
        
        let filtered = allIcons.filter(name => {
            // Filter by prefix
            const isMatchFilter = 
                currentFilter === 'all' || 
                (currentFilter === 'regular' && name.startsWith('bx-') && !name.startsWith('bxs-') && !name.startsWith('bxl-')) ||
                (currentFilter === 'solid' && name.startsWith('bxs-')) ||
                (currentFilter === 'logo' && name.startsWith('bxl-'));
            
            // Search by name
            const isMatchSearch = name.includes(query);

            return isMatchFilter && isMatchSearch;
        });

        renderIcons(filtered);
    }

    // 4. Clipboard Function
    function copyToClipboard(iconName, element) {
        const textToCopy = `<i class='bx ${iconName}'></i>`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Show card animation
            element.classList.add('copied');
            setTimeout(() => element.classList.remove('copied'), 1000);

            // Show Toast
            showToast(`복사되었습니다: ${textToCopy}`);
        }).catch(err => {
            console.error('Could not copy text: ', err);
            showToast('복사에 실패했습니다.');
        });
    }

    function showToast(message) {
        toastMsg.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // Event Listeners
    searchInput.addEventListener('input', filterAndSearch);

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            filterAndSearch();
        });
    });

    // Initialize
    loadIcons();
});
