import { initializeTheme } from './theme.js?v=1.0.0-r18';
import { asset } from './paths.js?v=1.0.0-r18';

async function renderCategories() {
  initializeTheme();
  const root = document.querySelector('[data-method-categories]');
  try {
    const response = await fetch(asset('checklist/manifest.json'), { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    root.replaceChildren(...manifest.categories.map((category) => {
      const card = document.createElement('a');
      card.className = 'method-category';
      card.href = `app.html#checklist/${category.slug}`;
      const order = document.createElement('span'); order.textContent = String(category.order).padStart(2, '0');
      const copy = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = category.name;
      const summary = document.createElement('p'); summary.textContent = category.summary;
      copy.append(title, summary);
      const count = document.createElement('em'); count.textContent = `${category.count} tests`;
      card.append(order, copy, count);
      return card;
    }));
  } catch (error) {
    root.textContent = 'Security areas could not be loaded. Refresh the page and try again.';
  }
}

renderCategories();
