// Settings management

const SETTINGS_KEY = 'karaoke_settings';

const defaultSettings = {
    theme: 'dark',
    language: 'ko',
    volume: 70
};

let currentSettings = { ...defaultSettings };

// Initialize settings
function initSettings() {
    const stored = localStorage.getItem(SETTINGS_KEY);

    if (stored) {
        try {
            currentSettings = { ...defaultSettings, ...JSON.parse(stored) };
        } catch (error) {
            console.error('Failed to load settings:', error);
            currentSettings = { ...defaultSettings };
        }
    }

    applySettings();
}

// Save settings
function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
}

// Apply settings to the UI
function applySettings() {
    // Apply theme
    document.documentElement.setAttribute('data-theme', currentSettings.theme);

    // Update UI elements
    updateSettingsUI();
}

// Update settings UI elements
function updateSettingsUI() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.classList.toggle('active', currentSettings.theme === 'light');
    }

    // Language select
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
        languageSelect.value = currentSettings.language;
    }

    // Volume slider
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        volumeSlider.value = currentSettings.volume;
    }

    const volumeValue = document.getElementById('volume-value');
    if (volumeValue) {
        volumeValue.textContent = `${currentSettings.volume}%`;
    }
}

// Toggle theme
function toggleTheme() {
    currentSettings.theme = currentSettings.theme === 'dark' ? 'light' : 'dark';
    saveSettings();
    applySettings();
}

// Set language
function setLanguage(language) {
    currentSettings.language = language;
    saveSettings();
    applySettings();
}

// Set volume
function setVolume(volume) {
    currentSettings.volume = Math.max(0, Math.min(100, parseInt(volume)));
    saveSettings();

    const volumeValue = document.getElementById('volume-value');
    if (volumeValue) {
        volumeValue.textContent = `${currentSettings.volume}%`;
    }
}

// Get current settings
function getSettings() {
    return { ...currentSettings };
}

// Reset settings to default
function resetSettings() {
    currentSettings = { ...defaultSettings };
    saveSettings();
    applySettings();
}

// Export functions
window.SettingsManager = {
    initSettings,
    toggleTheme,
    setLanguage,
    setVolume,
    getSettings,
    resetSettings
};
