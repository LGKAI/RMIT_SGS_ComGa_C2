import type { ConversationRow, ConversationState, Snapshot } from '../../shared/contracts';
const utf8 = new TextEncoder();
export const encode = (s: string) => utf8.encode(s);
export function toBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function fromBase64(s: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
export async function ownerId(issuer: string, sub: string): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', encode(JSON.stringify([issuer, sub]))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function importConversationKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
}
async function stateKey(root: CryptoKey, owner: string, id: string) {
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encode(id), info: encode(JSON.stringify([1, 'state-key', owner, id])) }, root, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptState(root: CryptoKey, owner: string, state: ConversationState): Promise<Snapshot> {
  const key = await stateKey(root, owner, state.id);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encode(JSON.stringify([1, 'state', owner, state.id, state.revision])) }, key, encode(JSON.stringify(state)));
  return { revision: state.revision, iv: toBase64(iv), encryptedState: toBase64(new Uint8Array(ciphertext)) };
}
export async function decryptState(root: CryptoKey, owner: string, row: ConversationRow): Promise<ConversationState> {
  try {
    if (row.ownerId !== owner) throw new Error();
    const key = await stateKey(root, owner, row.id);
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(row.iv), additionalData: encode(JSON.stringify([1, 'state', owner, row.id, row.revision])) }, key, fromBase64(row.encryptedState));
    const state = JSON.parse(new TextDecoder().decode(clear)) as ConversationState;
    if (state.version !== 1 || state.id !== row.id || state.revision !== row.revision || typeof state.title !== 'string' || !Array.isArray(state.turns) || state.turns.length > 20 || !/^[0-9a-f]{32}$/.test(state.pii?.namespace) || !Array.isArray(state.pii.entries)) throw new Error();
    return state;
  } catch { throw new Error('Không xác thực được bản mã: dữ liệu đã bị sửa, sai tài khoản hoặc sai khóa.'); }
}

// Explicit development adapter only. It never stands in for Tide or threshold authorization.
async function demoKek(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const secret = await crypto.subtle.importKey('raw', encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, secret, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function demoWrap(raw: Uint8Array<ArrayBuffer>, passphrase: string, owner: string, id: string) {
  if (passphrase.length < 12) throw new Error('Mật khẩu demo cần ít nhất 12 ký tự.');
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encode(JSON.stringify(['demo-only', owner, id])) }, await demoKek(passphrase, salt), raw);
  return JSON.stringify({ mode: 'demo-passphrase-v1', salt: toBase64(salt), iv: toBase64(iv), encrypted: toBase64(new Uint8Array(encrypted)) });
}
export async function demoUnwrap(wrapped: string, passphrase: string, owner: string, id: string) {
  try {
    const w = JSON.parse(wrapped); if (w.mode !== 'demo-passphrase-v1') throw new Error();
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(w.iv), additionalData: encode(JSON.stringify(['demo-only', owner, id])) }, await demoKek(passphrase, fromBase64(w.salt)), fromBase64(w.encrypted));
    if (raw.byteLength !== 32) throw new Error(); return new Uint8Array(raw);
  } catch { throw new Error('Không mở được khóa. Kiểm tra đúng tên tài khoản và mật khẩu demo.'); }
}
