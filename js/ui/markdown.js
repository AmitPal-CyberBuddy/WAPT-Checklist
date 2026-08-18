function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const DESIGNED_DOCS = Object.freeze({
  'docs/OPERATING.md': 'operating',
  'SECURITY.md': 'security', 'CONTRIBUTING.md': 'contributing', LICENSE: 'license',
  'docs/ARCHITECTURE.md': 'architecture', 'docs/TAXONOMY.md': 'taxonomy',
  'docs/CONTENT-GUIDE.md': 'content-guide', 'docs/ENGINE.md': 'engine',
  'docs/QA.md': 'browser-qa', 'docs/RESPONSIVE-QA.md': 'responsive',
  'docs/REFERENCE-QA.md': 'reference-qa', 'docs/CONTENT-QA-REPORT.md': 'content-qa',
  'docs/PHASE7-LIBRARIES.md': 'libraries', 'docs/RELEASE.md': 'release',
  'docs/EVIDENCE-WORKFLOW.md': 'evidence-workflow',
  'docs/FEATURE-VERIFICATION.md': 'feature-verification'
});

function designedHref(raw) {
  const normalized = raw.replace(/^\.\//, '').split('#')[0];
  const key = DESIGNED_DOCS[normalized];
  return key ? `docs.html?doc=${key}` : raw;
}

function inline(text) {
  const fragment = document.createDocumentFragment();
  const pattern = /(`[^`]+`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    fragment.append(document.createTextNode(text.slice(last, match.index)));
    if (match[0].startsWith('`')) fragment.append(make('code', '', match[0].slice(1, -1)));
    else if (match[2]) {
      const link = make('a', '', match[2]);
      const raw = designedHref(match[3]);
      if (/^(https:\/\/|[A-Za-z0-9_./?&=-]+$)/.test(raw) && !raw.startsWith('javascript:')) {
        link.href = raw;
        if (raw.startsWith('https://')) { link.target = '_blank'; link.rel = 'noreferrer noopener'; }
      }
      fragment.append(link);
    } else fragment.append(make('strong', '', match[4]));
    last = match.index + match[0].length;
  }
  fragment.append(document.createTextNode(text.slice(last)));
  return fragment;
}

function appendParagraph(root, lines) {
  if (!lines.length) return;
  const paragraph = make('p');
  paragraph.append(inline(lines.join(' ')));
  root.append(paragraph);
  lines.length = 0;
}

export function renderMarkdown(markdown, root, options = {}) {
  if (options.plain) {
    const pre = make('pre', 'plain-document', markdown);
    root.replaceChildren(pre);
    return;
  }
  const lines = String(markdown).replaceAll('\r\n', '\n').split('\n');
  const output = document.createDocumentFragment();
  const paragraph = [];
  let code = null;
  let list = null;
  let listType = null;
  let table = null;

  const endList = () => { list = null; listType = null; };
  const endTable = () => { table = null; };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('```')) {
      appendParagraph(output, paragraph); endList(); endTable();
      if (code) { output.append(code); code = null; }
      else code = make('pre', 'doc-code');
      continue;
    }
    if (code) {
      code.textContent += `${line}\n`;
      continue;
    }
    if (!line.trim()) { appendParagraph(output, paragraph); endList(); endTable(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      appendParagraph(output, paragraph); endList(); endTable();
      const level = Math.min(4, heading[1].length + 1);
      const node = make(`h${level}`);
      node.append(inline(heading[2]));
      output.append(node);
      continue;
    }
    if (/^>\s?/.test(line)) {
      appendParagraph(output, paragraph); endList(); endTable();
      const quote = make('blockquote'); quote.append(inline(line.replace(/^>\s?/, ''))); output.append(quote); continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (bullet || ordered) {
      appendParagraph(output, paragraph); endTable();
      const type = ordered ? 'ol' : 'ul';
      if (!list || listType !== type) { list = make(type); listType = type; output.append(list); }
      const item = make('li'); item.append(inline((bullet || ordered)[1])); list.append(item); continue;
    }
    if (/^\|.*\|$/.test(line.trim())) {
      appendParagraph(output, paragraph); endList();
      if (/^\|[\s:|-]+\|$/.test(line.trim())) continue;
      if (!table) { table = make('table', 'doc-table'); output.append(table); }
      const cells = line.trim().slice(1, -1).split('|').map((cell) => cell.trim());
      const row = document.createElement('tr');
      cells.forEach((cell) => { const td = make(table.rows.length ? 'td' : 'th'); td.append(inline(cell)); row.append(td); });
      table.append(row); continue;
    }
    paragraph.push(line.trim());
  }
  appendParagraph(output, paragraph);
  if (code) output.append(code);
  root.replaceChildren(output);
}
