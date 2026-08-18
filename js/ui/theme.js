const STORAGE_KEY = 'wapt.state.v1';
const THEMES = new Set(['light', 'dark']);

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function storedTheme() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return THEMES.has(stored?.preferences?.theme) ? stored.preferences.theme : null;
  } catch {
    return null;
  }
}

function persistTheme(theme) {
  try {
    const candidate = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const stored = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...stored,
      preferences: { ...stored.preferences, theme }
    }));
  } catch {
    // Theme changes remain available for this page when storage is blocked or full.
  }
}

function updateThemeControls(theme) {
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.textContent = theme === 'light' ? '☾' : '☀';
    button.setAttribute('aria-label', `Switch to ${nextTheme} theme`);
    button.setAttribute('title', `Switch to ${nextTheme} theme`);
    button.setAttribute('aria-pressed', String(theme === 'light'));
  });
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === 'light' ? '#f4f7fb' : '#07090d';
}

export function initializeTheme() {
  const root = document.documentElement;
  const initialTheme = THEMES.has(root.dataset.theme) ? root.dataset.theme : storedTheme() || systemTheme();
  root.dataset.theme = initialTheme;
  updateThemeControls(initialTheme);

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      root.dataset.theme = theme;
      persistTheme(theme);
      updateThemeControls(theme);
      window.dispatchEvent(new CustomEvent('wapt:themechange', { detail: { theme } }));
    });
  });
}
