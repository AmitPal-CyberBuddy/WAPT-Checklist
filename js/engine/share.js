// Shareable assessment scope. The URL carries answers and the engagement label only —
// never statuses, notes, findings, or evidence. Opening it builds the same plan locally.
import { normalizeScopeAnswers } from './context.js?v=1.0.0-r15';

export const SHARE_VERSION = 1;
const TOKEN_MAX = 8000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes) {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(token) {
  const padded = token.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((token.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function encodeShare(scope = {}) {
  const payload = {
    v: SHARE_VERSION,
    n: String(scope.name || '').slice(0, 120),
    u: String(scope.targetUrl || '').slice(0, 2048),
    a: normalizeScopeAnswers(scope.answers)
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeShare(token) {
  if (typeof token !== 'string' || !token || token.length > TOKEN_MAX || !TOKEN_PATTERN.test(token)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(token)));
    if (!payload || payload.v !== SHARE_VERSION || typeof payload !== 'object') return null;
    return {
      name: typeof payload.n === 'string' ? payload.n.slice(0, 120) : '',
      targetUrl: typeof payload.u === 'string' ? payload.u.slice(0, 2048) : '',
      answers: normalizeScopeAnswers(payload.a)
    };
  } catch {
    return null;
  }
}

export function shareHref(scope, originHref = '') {
  const base = String(originHref || '').split('#')[0] || 'app.html';
  return `${base}#share/${encodeShare(scope)}`;
}

export function parseShareHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw.startsWith('share/')) return null;
  return decodeShare(raw.slice('share/'.length));
}

export function engagementIsBlank(state = {}) {
  if ((state.engagement?.name || '').trim()) return false;
  if ((state.engagement?.targetUrl || '').trim()) return false;
  if (Object.keys(state.statuses || {}).length) return false;
  if ((state.findings || []).length) return false;
  if (Object.keys(state.notes || {}).length) return false;
  const answers = state.answers || {};
  return !Object.values(answers).some((value) => {
    const entries = Array.isArray(value) ? value : [value];
    return entries.some((entry) => entry && entry !== 'unknown');
  });
}
