// Category Selector Modal Management

let selectedCategory = null;

// Open category selector modal
function openCategorySelector() {
    const modal = document.getElementById('category-selector-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

// Close category selector modal
function closeCategorySelector() {
    const modal = document.getElementById('category-selector-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Handle category selection
function handleCategorySelection(category) {
    selectedCategory = category;

    // Log the selection
    console.log('Selected category:', category);

    // You can add custom logic here based on the selected category
    // For example, filter songs, navigate to a different view, etc.

    // Show a notification to the user
    let categoryName = '';
    switch (category) {
        case 'new':
            categoryName = '신곡';
            break;
        case 'recommended':
            categoryName = '추천곡';
            break;
        case 'best':
            categoryName = 'BEST곡';
            break;
    }

    alert(`${categoryName} 카테고리가 선택되었습니다!`);

    // Close the modal
    closeCategorySelector();

    // Optional: Apply category filter to songs
    // You can uncomment and modify this based on your needs
    // handleCategoryFilter(categoryName);
}

// Initialize category selector event listeners
function initCategorySelector() {
    // Category option click handlers
    const categoryOptions = document.querySelectorAll('.category-option');
    categoryOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            const category = e.currentTarget.dataset.category;
            handleCategorySelection(category);
        });
    });

    // Close button handler
    const closeBtn = document.querySelector('.category-selector-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCategorySelector);
    }

    // Close on backdrop click
    const modal = document.getElementById('category-selector-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCategorySelector();
            }
        });
    }
}

// Export functions
window.CategorySelectorManager = {
    openCategorySelector,
    closeCategorySelector,
    handleCategorySelection,
    initCategorySelector,
    getSelectedCategory: () => selectedCategory
};
