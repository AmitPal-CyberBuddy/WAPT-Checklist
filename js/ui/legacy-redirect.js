// Redirect helper for legacy .html URLs and extensionless paths.
// Used by the generated stub pages and the 404 page from tools/build-publish.mjs.
// <html data-redirect="app"> redirects to app/ preserving query and hash;
// <html data-redirect="auto"> (404 page) maps a known page name to its clean URL.
(function () {
  const target = document.documentElement?.dataset?.redirect;
  if (!target) return;
  if (target === 'auto') {
    const segments = location.pathname.replace(/\/+$/, '').split('/');
    const last = (segments[segments.length - 1] || '').replace(/\.html?$/, '');
    if (!['app', 'methodology', 'docs', 'workflow'].includes(last)) return;
    const base = location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1);
    location.replace(`${base}${last}/${location.search}${location.hash}`);
    return;
  }
  location.replace(`./${target}/${location.search}${location.hash}`);
}());
