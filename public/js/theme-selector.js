// Theme Selector JavaScript

const THEME_STORAGE_KEY = 'karaoke_selected_theme';

// Theme definitions
const themes = {
    'purple-dream': {
        '--color-primary': 'hsl(280, 85%, 60%)',
        '--color-primary-light': 'hsl(280, 85%, 70%)',
        '--color-primary-dark': 'hsl(280, 85%, 50%)',
        '--color-secondary': 'hsl(200, 90%, 55%)',
        '--color-secondary-light': 'hsl(200, 90%, 65%)',
        '--color-accent': 'hsl(330, 85%, 60%)',
        '--color-accent-light': 'hsl(330, 85%, 70%)'
    },
    'ocean-blue': {
        '--color-primary': 'hsl(200, 85%, 55%)',
        '--color-primary-light': 'hsl(200, 85%, 65%)',
        '--color-primary-dark': 'hsl(200, 85%, 45%)',
        '--color-secondary': 'hsl(220, 85%, 60%)',
        '--color-secondary-light': 'hsl(220, 85%, 70%)',
        '--color-accent': 'hsl(180, 80%, 50%)',
        '--color-accent-light': 'hsl(180, 80%, 60%)'
    },
    'sunset-orange': {
        '--color-primary': 'hsl(25, 95%, 60%)',
        '--color-primary-light': 'hsl(25, 95%, 70%)',
        '--color-primary-dark': 'hsl(25, 95%, 50%)',
        '--color-secondary': 'hsl(45, 95%, 60%)',
        '--color-secondary-light': 'hsl(45, 95%, 70%)',
        '--color-accent': 'hsl(0, 85%, 60%)',
        '--color-accent-light': 'hsl(0, 85%, 70%)'
    },
    'mint-fresh': {
        '--color-primary': 'hsl(160, 70%, 55%)',
        '--color-primary-light': 'hsl(160, 70%, 65%)',
        '--color-primary-dark': 'hsl(160, 70%, 45%)',
        '--color-secondary': 'hsl(140, 70%, 55%)',
        '--color-secondary-light': 'hsl(140, 70%, 65%)',
        '--color-accent': 'hsl(180, 65%, 50%)',
        '--color-accent-light': 'hsl(180, 65%, 60%)'
    },
    'rose-pink': {
        '--color-primary': 'hsl(340, 80%, 60%)',
        '--color-primary-light': 'hsl(340, 80%, 70%)',
        '--color-primary-dark': 'hsl(340, 80%, 50%)',
        '--color-secondary': 'hsl(320, 75%, 65%)',
        '--color-secondary-light': 'hsl(320, 75%, 75%)',
        '--color-accent': 'hsl(0, 70%, 70%)',
        '--color-accent-light': 'hsl(0, 70%, 80%)'
    },
    'neon-cyber': {
        '--color-primary': 'hsl(300, 100%, 60%)',
        '--color-primary-light': 'hsl(300, 100%, 70%)',
        '--color-primary-dark': 'hsl(300, 100%, 50%)',
        '--color-secondary': 'hsl(180, 100%, 50%)',
        '--color-secondary-light': 'hsl(180, 100%, 60%)',
        '--color-accent': 'hsl(60, 100%, 50%)',
        '--color-accent-light': 'hsl(60, 100%, 60%)'
    }
};

// Apply theme
function applyTheme(themeName) {
    const theme = themes[themeName];
    if (!theme) return;

    const root = document.documentElement;

    // Apply all theme colors
    Object.keys(theme).forEach(varName => {
        root.style.setProperty(varName, theme[varName]);
    });

    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, themeName);

    // Update UI
    updateThemeUI(themeName);

    // Show notification
    showNotification(`${getThemeName(themeName)} 테마가 적용되었습니다!`);
}

// Get theme display name
function getThemeName(themeKey) {
    const names = {
        'purple-dream': 'Purple Dream',
        'ocean-blue': 'Ocean Blue',
        'sunset-orange': 'Sunset Orange',
        'mint-fresh': 'Mint Fresh',
        'rose-pink': 'Rose Pink',
        'neon-cyber': 'Neon Cyber'
    };
    return names[themeKey] || themeKey;
}

// Update theme UI
function updateThemeUI(themeName) {
    // Update active card
    document.querySelectorAll('.theme-card').forEach(card => {
        const isActive = card.dataset.theme === themeName;
        card.classList.toggle('active', isActive);

        const btn = card.querySelector('.apply-theme-btn');
        if (btn) {
            btn.classList.toggle('active', isActive);
            btn.textContent = isActive ? '적용됨' : '적용하기';
        }
    });
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = message;

    Object.assign(notification.style, {
        position: 'fixed',
        bottom: '100px',
        right: '32px',
        background: 'var(--color-success)',
        color: 'white',
        padding: '16px 24px',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: '1000',
        fontWeight: '600',
        animation: 'slideInRight 0.3s ease'
    });

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

// Setup theme cards
function setupThemeCards() {
    document.querySelectorAll('.theme-card').forEach(card => {
        const btn = card.querySelector('.apply-theme-btn');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const themeName = card.dataset.theme;
            applyTheme(themeName);
        });

        // Also allow clicking the card itself
        card.addEventListener('click', () => {
            const themeName = card.dataset.theme;
            applyTheme(themeName);
        });
    });
}

// Load saved theme
function loadSavedTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme && themes[savedTheme]) {
        applyTheme(savedTheme);
    } else {
        // Default theme
        updateThemeUI('purple-dream');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupThemeCards();
    loadSavedTheme();
});
