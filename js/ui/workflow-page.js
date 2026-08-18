import { initializeTheme } from './theme.js?v=1.0.0-r3';
import { renderMarkdown } from './markdown.js?v=1.0.0-r3';

const TOOLS = Object.freeze({
  proxy: 'Proxy', repeater: 'Repeater', intruder: 'Intruder', scanner: 'Scanner',
  comparer: 'Comparer', decoder: 'Decoder', sequencer: 'Sequencer', logger: 'Logger',
  'param-miner': 'Param Miner', autorize: 'Autorize', 'turbo-intruder': 'Turbo Intruder', collaborator: 'Collaborator'
});

async function loadWorkflow() {
  initializeTheme();
  const requested = new URLSearchParams(location.search).get('tool') || 'repeater';
  const key = Object.hasOwn(TOOLS, requested) ? requested : 'repeater';
  const name = TOOLS[key];
  document.title = `Burp ${name} workflow — WAPT Checklist`;
  document.querySelector('[data-workflow-name]').textContent = name;
  document.querySelector('[data-workflow-title]').textContent = `Burp ${name}`;
  const root = document.querySelector('[data-workflow-content]');
  try {
    const response = await fetch(`burp-workflows/${key}.md`, { headers: { Accept: 'text/plain' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderMarkdown(await response.text(), root);
  } catch (error) {
    root.textContent = `Workflow could not be loaded: ${error.message}`;
  }
}

loadWorkflow();
