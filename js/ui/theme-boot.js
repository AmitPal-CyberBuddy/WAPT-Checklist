(function applyThemeBeforePaint() {
  const STORAGE_KEY = 'wapt.state.v1';
  const root = document.documentElement;
  // Marks a scripting environment so progressive enhancements (scroll reveals)
  // never hide content when JavaScript is unavailable.
  root.classList.add('js');
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

  // Paint the themed canvas before the stylesheet parses so cross-document
  // navigation never flashes a white page.
  const light = root.dataset.theme === 'light';
  root.style.backgroundColor = light ? '#f7f9fc' : '#090d13';
  root.style.colorScheme = light ? 'light' : 'dark';

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = light ? '#f7f9fc' : '#090d13';
}());
