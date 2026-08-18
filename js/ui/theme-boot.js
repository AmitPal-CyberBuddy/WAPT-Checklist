(function applyThemeBeforePaint() {
  const STORAGE_KEY = 'wapt.state.v1';
  const root = document.documentElement;
  let storedTheme = null;

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const candidate = stored?.preferences?.theme;
    if (candidate === 'light' || candidate === 'dark') storedTheme = candidate;
  } catch {
    // Invalid or unavailable local state falls back to the operating-system preference.
  }

  const systemTheme = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.dataset.theme = storedTheme || systemTheme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = root.dataset.theme === 'light' ? '#f4f7fb' : '#07090d';
}());
