// Shopping cart-style reservation system

let cartItems = [];
const STORAGE_KEY = 'karaoke_cart';

// Initialize cart from localStorage
function initCart() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            cartItems = JSON.parse(stored);
        } catch (error) {
            console.error('Failed to load cart from storage:', error);
            cartItems = [];
        }
    }
    updateCartBadge();
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    updateCartBadge();
}

// Add song to cart
function addToCart(song) {
    // Check if song already exists in cart
    const exists = cartItems.some(item => item.id === song.id);

    if (exists) {
        showToast('이미 예약 목록에 있습니다', 'warning');
        return false;
    }

    cartItems.push({
        ...song,
        addedAt: Date.now()
    });

    saveCart();
    showToast('예약 목록에 추가되었습니다', 'success');
    return true;
}

// Remove song from cart
function removeFromCart(songId) {
    const index = cartItems.findIndex(item => item.id === songId);

    if (index !== -1) {
        cartItems.splice(index, 1);
        saveCart();
        return true;
    }

    return false;
}

// Clear all items from cart
function clearCart() {
    cartItems = [];
    saveCart();
    showToast('예약 목록이 비워졌습니다', 'success');
}

// Get cart items
function getCartItems() {
    return [...cartItems];
}

// Get cart count
function getCartCount() {
    return cartItems.length;
}

// Reorder cart items (drag and drop)
function reorderCart(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= cartItems.length ||
        toIndex < 0 || toIndex >= cartItems.length) {
        return false;
    }

    const [movedItem] = cartItems.splice(fromIndex, 1);
    cartItems.splice(toIndex, 0, movedItem);
    saveCart();
    return true;
}

// Update cart badge
function updateCartBadge() {
    const badge = document.querySelector('.cart-badge');
    const count = getCartCount();

    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add styles
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '100px',
        right: '32px',
        padding: '16px 24px',
        background: type === 'success' ? 'var(--color-success)' :
            type === 'warning' ? 'var(--color-warning)' :
                'var(--color-primary)',
        color: 'white',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: '1000',
        fontWeight: '600',
        animation: 'slideInRight 0.3s ease',
        maxWidth: '300px'
    });

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Export functions
window.CartManager = {
    initCart,
    addToCart,
    removeFromCart,
    clearCart,
    getCartItems,
    getCartCount,
    reorderCart,
    updateCartBadge
};
