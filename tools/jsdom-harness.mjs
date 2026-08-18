// Shared jsdom boot harness: runs the REAL application (app.html + UI modules)
// against a locally served copy of the repository, with real localStorage,
// real event dispatch, and same-origin-only fetch.
//
// Used by tools/functional-workflows.mjs and tools/tester-audit.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
export const BASE = process.env.WAPT_BASE_URL || 'http://localhost:8000';
const APP_ENTRY = path.join(ROOT, 'js/ui/app.js');

export function loadJsdom() {
  try {
    return require('jsdom').JSDOM;
  } catch {
    return null;
  }
}

export function createRuntime() {
  const state = { fetchLog: [], externalRequests: 0, consoleErrors: [], exports: [], clipboardWrites: 0, printed: 0 };
  const nodeFetch = globalThis.fetch;

  async function appFetch(url, options) {
    state.fetchLog.push(url);
    const absolute = new URL(url, BASE).href;
    if (!absolute.startsWith(BASE)) {
      state.externalRequests += 1;
      state.consoleErrors.push(`EXTERNAL REQUEST BLOCKED: ${absolute}`);
      throw new Error(`external request blocked: ${absolute}`);
    }
    return nodeFetch(absolute, options);
  }

  function buildShims(window) {
    window.matchMedia = (query) => {
      const q = String(query);
      let matches = false;
      if (q.includes('prefers-color-scheme')) matches = !q.includes('light');
      const listeners = new Set();
      return {
        get matches() { return matches; }, media: q, onchange: null,
        addEventListener: (type, fn) => listeners.add(fn),
        removeEventListener: (type, fn) => listeners.delete(fn),
        addListener: (fn) => listeners.add(fn),
        removeListener: (fn) => listeners.delete(fn),
        dispatchEvent: (event) => listeners.forEach((fn) => fn(event))
      };
    };
    window.fetch = appFetch;
    window.confirm = () => true;
    window.prompt = () => 'Runtime verification override';
    window.print = () => { state.printed += 1; };
    window.scrollIntoView = window.scrollIntoView || (() => {});
    if (typeof window.HTMLElement !== 'undefined') {
      window.HTMLElement.prototype.scrollIntoView = () => {};
      const dialog = window.HTMLDialogElement;
      if (dialog && !dialog.prototype.showModal) {
        dialog.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
        dialog.prototype.close = function close() { this.removeAttribute('open'); };
      }
    }
    if (!window.Option) {
      window.Option = function Option(text, value) {
        const option = window.document.createElement('option');
        option.textContent = text;
        if (value !== undefined) option.value = value;
        return option;
      };
    }
    window.navigator.clipboard = { writeText: async () => { state.clipboardWrites += 1; } };
    window.URL.createObjectURL = () => 'blob:fake-object-url';
    window.URL.revokeObjectURL = () => {};
    window.structuredClone = structuredClone;
    window.TextEncoder = TextEncoder;
    window.crypto.randomUUID = window.crypto?.randomUUID || crypto.randomUUID.bind(crypto);
    window.addEventListener('error', (event) => state.consoleErrors.push(`window error: ${event.message}`));
    window.addEventListener('unhandledrejection', (event) => state.consoleErrors.push(`unhandled rejection: ${String(event.reason)}`));
  }

  function captureBlobs(window) {
    const Original = window.Blob;
    window.Blob = class extends Original {
      constructor(parts, options) {
        super(parts, options);
        this.__waptText = parts.map((part) => String(part)).join('');
      }
    };
    const originalClick = window.HTMLAnchorElement.prototype.click;
    window.HTMLAnchorElement.prototype.click = function click() {
      if (this.download && String(this.href).startsWith('blob:')) {
        state.exports.push({ filename: this.download, text: window.__waptLastBlob?.__waptText || '' });
        return;
      }
      return originalClick.call(this);
    };
    window.URL.createObjectURL = (blob) => {
      window.__waptLastBlob = blob;
      return 'blob:captured';
    };
  }

  async function boot(JSDOM, pathPrefix, seedStorage) {
    const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
    const dom = new JSDOM(html, {
      url: `${BASE}/${pathPrefix ? pathPrefix + '/' : ''}app.html`,
      runScripts: 'outside-only',
      pretendToBeVisual: true
    });
    buildShims(dom.window);
    captureBlobs(dom.window);
    if (seedStorage) dom.window.localStorage.setItem('wapt.state.v1', seedStorage);
    const themeBoot = fs.readFileSync(path.join(ROOT, 'js/ui/theme-boot.js'), 'utf8');
    dom.window.eval(themeBoot);

    const g = globalThis;
    const bindings = {
      window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
      navigator: dom.window.navigator, location: dom.window.location, history: dom.window.history,
      fetch: appFetch, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event,
      CustomEvent: dom.window.CustomEvent, Option: dom.window.Option, Blob: dom.window.Blob, URL: dom.window.URL
    };
    for (const [key, value] of Object.entries(bindings)) {
      Object.defineProperty(g, key, { configurable: true, writable: true, value });
    }
    const bootId = `boot-${Date.now()}-${Math.random()}`;
    await import(pathToFileURL(APP_ENTRY).href + `?${bootId}`);
    return dom;
  }

  return { state, appFetch, boot };
}

export async function waitFor(check, timeout = 8000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await check()) return true;
    } catch { /* keep polling */ }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timeout waiting for ${label}`);
}

export const text = (node) => (node?.textContent || '').trim();
