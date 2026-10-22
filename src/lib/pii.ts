import type { PiiContext, PiiEntry, PiiKind } from '../../shared/contracts';
export interface Span { start: number; end: number; value: string; kind: PiiKind; token: string; enabled: boolean }
export interface ManualSpan { start: number; end: number; kind: PiiKind }
export interface Prepared { original: string; masked: string; context: PiiContext; spans: Span[] }
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function newPiiContext(): PiiContext {
  return { namespace: Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''), entries: [] };
}
export function prepareMessage(text: string, originalContext: PiiContext, options: { disabled?: string[]; manual?: ManualSpan[]; names?: string[] } = {}): Prepared {
  if (/\[\[PCS_[0-9a-f]{32}_/i.test(text)) throw new Error('Không dán token nội bộ vào ô nhập. Hãy dùng tên hoặc nội dung gốc.');
  const context: PiiContext = structuredClone(originalContext);
  const spans: Span[] = [];
  const add = (start: number, end: number, kind: PiiKind) => {
    if (start < 0 || end > text.length || start >= end || spans.some(s => start < s.end && end > s.start)) return;
    const value = text.slice(start, end);
    let entry = context.entries.find(e => e.kind === kind && e.value.normalize('NFC') === value.normalize('NFC'));
    if (!entry) {
      const n = Math.max(0, ...context.entries.filter(e => e.kind === kind).map(e => Number(e.token.match(/_(\d+)\]\]$/)?.[1] ?? 0))) + 1;
      entry = { value, kind, token: `[[PCS_${context.namespace}_${kind}_${n}]]` };
      context.entries.push(entry);
    }
    spans.push({ start, end, value, kind, token: entry.token, enabled: !options.disabled?.includes(`${start}:${end}`) });
  };
  const scan = (regex: RegExp, kind: PiiKind, accept: (m: RegExpMatchArray) => boolean = () => true) => {
    for (const m of text.matchAll(regex)) if (accept(m)) add(m.index!, m.index! + m[0].length, kind);
  };
  for (const m of options.manual ?? []) add(m.start, m.end, m.kind);
  const dictionary = [...context.entries.filter(e => e.kind === 'NAME' || e.kind === 'CUSTOM'), ...(options.names ?? []).filter(Boolean).map(value => ({ value, kind: 'NAME' as const }))].sort((a, b) => b.value.length - a.value.length);
  for (const entry of dictionary) {
    scan(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(entry.value)}(?![\\p{L}\\p{N}])`, 'gu'), entry.kind);
  }
  scan(/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'EMAIL');
  scan(/(?<!\d)\d(?:[ .-]?\d){11}(?![ .-]?\d)/g, 'CCCD', m => {
    const before = text.slice(Math.max(0, m.index! - 35), m.index);
    return /cccd|căn cước|can cuoc|định danh|dinh danh/i.test(before) || !/stk|tài khoản|tai khoan|account/i.test(before);
  });
  scan(/(?<![\p{L}\d])(?:0[ .-]?[35789](?:[ .-]?\d){8}|0[ .-]?2(?:[ .-]?\d){9}|\+?84[ .-]?[35789](?:[ .-]?\d){8})(?![ .-]?\d)/gu, 'PHONE');
  scan(/(?<!\d)\d(?:[ .-]?\d){5,18}(?![ .-]?\d)/g, 'STK', m => {
    const before = text.slice(Math.max(0, m.index! - 55), m.index);
    return /stk|số tài khoản|so tai khoan|tài khoản|tai khoan|account|vietcombank|techcombank|bidv|vcb|mbbank/i.test(before);
  });
  // A suggestion, not comprehensive Vietnamese NER. Manual selection remains necessary.
  scan(/(?<![\p{L}\p{N}])(?:Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Lý|Đinh|Đoàn|Trương|Nguyen|Tran|Le|Pham|Dang|Do|Dinh|Truong)\s+(?:(?:Văn|Thị|Hữu|Đức|Ngọc|Minh|Thanh|Quốc|Gia|Chấn|Trung|Van|Thi|Huu|Duc|Ngoc|Minh|Thanh|Quoc|Gia|Chan|Trung)\s+)?[\p{Lu}][\p{Ll}]*(?![\p{L}])/gu, 'NAME');
  spans.sort((a, b) => a.start - b.start);
  let at = 0; let masked = '';
  for (const s of spans) { masked += text.slice(at, s.start) + (s.enabled ? s.token : s.value); at = s.end; }
  masked += text.slice(at);
  // Do not retain values for disabled matches newly found in this preview.
  const used = new Set(spans.filter(s => s.enabled).map(s => s.token));
  context.entries = context.entries.filter(e => used.has(e.token) || originalContext.entries.some(old => old.token === e.token));
  return { original: text, masked, context, spans };
}
export function unmaskText(text: string, context: PiiContext): string {
  const map = new Map(context.entries.map(e => [e.token, e.value]));
  return text.replace(/\[\[PCS_[0-9a-f]{32}_(?:NAME|CCCD|PHONE|STK|EMAIL|CUSTOM)_\d+\]\]/g, token => map.get(token) ?? token);
}
export function unknownTokens(text: string, context: PiiContext): string[] {
  const known = new Set(context.entries.map(e => e.token));
  return [...text.matchAll(/\[\[PCS_[^\]\n]{1,150}\]\]/g)].map(m => m[0]).filter(t => !known.has(t));
}
