// Color Table JavaScript

// Get computed color values
function getColorValue(varName) {
    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue(varName).trim();
}

// Display all color values
function displayColorValues() {
    const colorVars = [
        '--color-primary',
        '--color-primary-light',
        '--color-primary-dark',
        '--color-secondary',
        '--color-secondary-light',
        '--color-accent',
        '--color-accent-light',
        '--color-success',
        '--color-warning',
        '--color-danger',
        '--color-bg-primary',
        '--color-bg-secondary',
        '--color-bg-tertiary',
        '--color-bg-glass',
        '--color-text-primary',
        '--color-text-secondary',
        '--color-text-tertiary',
        '--color-border',
        '--color-divider'
    ];

    colorVars.forEach(varName => {
        const value = getColorValue(varName);
        const id = 'val-' + varName.replace('--color-', '').replace(/-/g, '-');
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Copy color value to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showCopyNotification();
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Show copy notification
function showCopyNotification() {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = '색상 코드가 복사되었습니다!';
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Add click handlers to color cards
function setupColorCards() {
    const colorCards = document.querySelectorAll('.color-card');

    colorCards.forEach(card => {
        card.addEventListener('click', () => {
            const varName = card.dataset.var;
            const value = getColorValue(varName);
            copyToClipboard(value);
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    displayColorValues();
    setupColorCards();
});
