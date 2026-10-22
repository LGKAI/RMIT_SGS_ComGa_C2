import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AuthProvider, useAuth } from './auth/Auth';
import { api } from './lib/api';
import { decryptState, encryptState, fromBase64, importConversationKey, toBase64 } from './lib/crypto';
import { buildChatRequest } from './lib/history';
import { newPiiContext, prepareMessage, unmaskText, unknownTokens } from './lib/pii';
import type { ManualSpan, Prepared } from './lib/pii';
import type { ConversationRow, ConversationState, PublicConfig, Turn } from '../shared/contracts';
import { ApprovalQueue, statusLabel } from './components/ApprovalQueue';
import { attachmentInput, readAttachment } from './lib/files';
import type { LocalAttachment } from './lib/files';
import type { ApprovalView, ApprovalProposal, ApprovalDraft } from '../shared/contracts';
import { MAX_INPUT_CHARS, MAX_TURNS } from '../shared/contracts';
const PRESET = 'Tóm tắt hồ sơ và liệt kê giấy tờ còn thiếu cho khách hàng Đặng Thị Mai, CCCD 0010 9201 2345, STK Vietcombank 0071000123456, SĐT 0912345678, email mai@example.com. Khoản vay 2,5 tỷ đồng, tài sản bảo đảm 5,2 tỷ đồng.';
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Có lỗi xảy ra. Hãy thử lại.';
type Summary = Pick<ConversationRow, 'id' | 'revision' | 'createdAt' | 'updatedAt'>;
interface OpenConversation { state: ConversationState; key: CryptoKey; wrapped: string; row: ConversationRow | null }

export default function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; api<PublicConfig>('/config', null).then(c => { if (active) setConfig(c); }).catch(() => { if (active) setError('Không kết nối được backend. Chạy npm run dev:demo rồi tải lại.'); }); return () => { active = false; }; }, []);
  if (!config) return <main className="boot"><h1>PrivateChat Shield</h1><p role="status">{error || 'Đang kết nối backend…'}</p><button onClick={() => location.reload()}>Tải lại</button></main>;
  return <AuthProvider config={config}><Workspace config={config} /></AuthProvider>;
}
function Workspace({ config }: { config: PublicConfig }) {
  const auth = useAuth(); const [username, setUsername] = useState('alice'); const [secret, setSecret] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [summaries, setSummaries] = useState<Summary[]>([]); const [opened, setOpened] = useState<OpenConversation | null>(null);
  const [input, setInput] = useState(''); const [names, setNames] = useState(''); const [disabled, setDisabled] = useState<string[]>([]); const [manual, setManual] = useState<ManualSpan[]>([]);
  const [showReal, setShowReal] = useState(true); const [lastRequest, setLastRequest] = useState<unknown>(null);
  const [tamperResult, setTamperResult] = useState(''); const [probe, setProbe] = useState('');
  const [probeData, setProbeData] = useState('');
  const [attachment, setAttachment] = useState<LocalAttachment | null>(null);
  const [purpose, setPurpose] = useState<ApprovalProposal['purpose']>('summarize');
  const [classification, setClassification] = useState<ApprovalProposal['classification']>('confidential');
  const [approval, setApproval] = useState<ApprovalView | null>(null);
  const fileEpoch = useRef(0);
  function clearApprovalInput() { fileEpoch.current++; setAttachment(null); setApproval(null); }
  let combined = ''; let fileError = '';
  try { combined = attachmentInput(input, attachment); } catch (e) { fileError = errorText(e); }

  const epoch = useRef(0); const controller = useRef<AbortController | null>(null); const locked = useRef(false); const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftContext = useMemo(() => newPiiContext(), [opened?.state.id]);
  const preview = useMemo<{ value: Prepared | null; error: string }>(() => {
    try { return { value: prepareMessage(combined, opened?.state.pii ?? draftContext, { names: names.split(',').map(s => s.trim()).filter(Boolean), disabled, manual }), error: '' }; }
    catch (e) { return { value: null, error: errorText(e) }; }
  }, [combined, opened?.state.pii, draftContext, names, disabled, manual]);
  function resetInput(text = '') { setInput(text); setDisabled([]); setManual([]); }
  function invalidate() { fileEpoch.current++; epoch.current++; controller.current?.abort(); controller.current = null; locked.current = false; setBusy(false); }
  useEffect(() => {
    invalidate(); clearApprovalInput(); setOpened(null); setSummaries([]); resetInput(); setNames(''); setLastRequest(null); setError(''); setNotice(''); setTamperResult(''); setProbe(''); setProbeData('');
    let cancelled = false;
    if (auth.identity) void auth.getToken().then(token => api<Summary[]>('/conversations', token)).then(rows => { if (!cancelled) setSummaries(rows); }).catch(e => { if (!cancelled) setError(errorText(e)); });
    return () => { cancelled = true; epoch.current++; controller.current?.abort(); locked.current = false; };
  }, [auth.identity?.ownerId]);
  function begin() { if (locked.current) return null; locked.current = true; setBusy(true); setError(''); setNotice(''); const current = ++epoch.current; controller.current = new AbortController(); return { current, signal: controller.current.signal }; }
  function finish(current: number) { if (epoch.current === current) { locked.current = false; setBusy(false); } }
  async function refresh(token: string, current: number) {
    try { const rows = await api<Summary[]>('/conversations', token); if (current === epoch.current) setSummaries(rows); }
    catch { if (current === epoch.current) setNotice('Đã lưu hội thoại nhưng chưa tải lại được danh sách. Có thể tải lại trang.'); }
  }
  async function persist(conversation: OpenConversation, token: string, signal: AbortSignal): Promise<OpenConversation> {
    const nextRevision = conversation.row ? conversation.row.revision + 1 : 1;
    const state = { ...conversation.state, revision: nextRevision };
    const encrypted = await encryptState(conversation.key, auth.identity!.ownerId, state);
    const row = await api<ConversationRow>(conversation.row ? `/conversations/${state.id}` : '/conversations', token, {
      method: conversation.row ? 'PUT' : 'POST', signal,
      body: conversation.row ? { ...encrypted, expectedRevision: conversation.row.revision } : { id: state.id, wrappedKey: conversation.wrapped, ...encrypted },
    });
    return { ...conversation, state, row };
  }
  async function load(id: string) {
    const task = begin(); if (!task || !auth.identity) return;
    try {
      const token = await auth.getToken(); const row = await api<ConversationRow>(`/conversations/${id}`, token, { signal: task.signal });
      if (row.id !== id || row.ownerId !== auth.identity.ownerId) throw new Error('Snapshot không khớp hội thoại hoặc tài khoản đã yêu cầu.');
      const raw = await auth.unwrap(row.wrappedKey, row.id); let key: CryptoKey;
      try { key = await importConversationKey(raw); } finally { raw.fill(0); }
      const state = await decryptState(key, auth.identity.ownerId, row);
      // A browser restart leaves pending turns resumable rather than silently completed.
      state.turns = state.turns.map(t => t.status === 'pending' ? { ...t, status: 'failed' as const } : t);
      const d = state.approvalDraft;
      const savedApproval = d ? await api<ApprovalView>(`/approvals/${d.approvalId}`, token, { signal: task.signal }) : null;
      if (epoch.current === task.current) { setOpened({ row, state, key, wrapped: row.wrappedKey }); clearApprovalInput();
        if (d) { resetInput(d.prompt); setNames(d.names); setAttachment(d.attachment); setDisabled(d.disabled); setManual(d.manual); setPurpose(d.proposal.purpose); setClassification(d.proposal.classification); setApproval(savedApproval); }
        else resetInput(); setLastRequest(null); setTamperResult(''); setNotice('Đã xác thực và giải mã hội thoại tại trình duyệt.'); }
    } catch (e) { if (epoch.current === task.current) setError(errorText(e)); } finally { finish(task.current); }
  }
  const draft = opened?.state.approvalDraft;
  const matchesDraft = !!draft && draft.original === combined && draft.masked === preview.value?.masked &&
    draft.proposal.purpose === purpose && draft.proposal.classification === classification &&
    JSON.stringify(draft.proposal.files) === JSON.stringify(attachment ? [attachment.manifest] : []);
  async function chooseFile(file?: File) {
    if (!file) return; const version = ++fileEpoch.current; setError('');
    try { const value = await readAttachment(file); if (fileEpoch.current === version) { setAttachment(value); setManual([]); setDisabled([]); setNotice('Đã đọc file tại trình duyệt. Chưa gửi file gốc tới server hoặc AI.'); } }
    catch (e) { if (fileEpoch.current === version) { setAttachment(null); setError(errorText(e)); } }
  }
  async function requestApproval(retry?: Turn) {
    if (!auth.identity || (!retry && (!preview.value || !combined.trim() || fileError))) return;
    const task = begin(); if (!task) return; let working = opened;
    try {
      if (classification === 'restricted') throw new Error('Tài liệu Tuyệt mật bị chặn gửi cloud. Hãy dùng mô hình nội bộ và quy trình riêng.');
      const token = await auth.getToken();
      if (!working) {
        const id = crypto.randomUUID(); const raw = crypto.getRandomValues(new Uint8Array(32));
        try { const wrapped = await auth.wrap(raw, id); const key = await importConversationKey(raw); working = { key, wrapped, row: null, state: { id, version: 1, revision: 1, title: `Hội thoại ${new Date().toLocaleString('vi-VN')}`, pii: draftContext, turns: [] } }; } finally { raw.fill(0); }
      }
      if (!retry && working.state.turns.some(t => t.status !== 'complete')) throw new Error('Hãy xin duyệt lại lượt lỗi trước khi gửi nội dung mới.');
      if (!retry && working.state.turns.length >= MAX_TURNS) throw new Error('Đã đủ 20 lượt. Hãy tạo hội thoại mới.');
      const prepared = retry ? { original: retry.original, masked: retry.masked, context: working.state.pii } : preview.value!;
      const previous = working.state.approvalDraft;
      const proposal: ApprovalProposal = { conversationId: working.state.id, request: buildChatRequest(working.state, prepared.masked), files: retry ? (previous?.proposal.files ?? []) : (attachment ? [attachment.manifest] : []), purpose, classification };
      // Check revision and create encrypted history before admitting a review request.
      working = await persist(working, token, task.signal);
      const row = await api<ApprovalView>('/approvals', token, { method: 'POST', body: proposal, signal: task.signal });
      const nextDraft: ApprovalDraft = { approvalId: row.id, proposal, original: prepared.original, masked: prepared.masked, prompt: retry ? (previous?.prompt ?? retry.original) : input, names, attachment: retry ? (previous?.attachment ?? null) : attachment, disabled, manual, ...(retry ? { retryId: retry.id } : {}) };
      working = await persist({ ...working, state: { ...working.state, pii: prepared.context, approvalDraft: nextDraft } }, token, task.signal);
      if (epoch.current !== task.current) return;
      setOpened(working); setApproval(row);
      if (retry) { resetInput(nextDraft.prompt); setAttachment(nextDraft.attachment); }
      setNotice('Đã xin duyệt. Nội dung đã che được chuyển tới hàng đợi; AI chưa nhận dữ liệu. Mở cửa sổ khác bằng reviewer để duyệt demo.');
      await refresh(token, task.current);
    } catch (e) { if (epoch.current === task.current) setError(errorText(e)); } finally { finish(task.current); }
  }
  async function refreshApproval() {
    if (!draft) return; const task = begin(); if (!task) return;
    try { const result = await api<ApprovalView>(`/approvals/${draft.approvalId}`, await auth.getToken(), { signal: task.signal }); if (epoch.current === task.current) setApproval(result); }
    catch (e) { if (epoch.current === task.current) setError(errorText(e)); } finally { finish(task.current); }
  }
  async function send(retry?: Turn) {
    if (!auth.identity || !draft || !matchesDraft || approval?.id !== draft.approvalId || approval.status !== 'approved') return;
    retry = draft.retryId ? opened?.state.turns.find(t => t.id === draft.retryId) : undefined;
    const task = begin(); if (!task) return;
    let working = opened; let pendingTurn: Turn | null = null;
    try {
      const token = await auth.getToken();
      if (!working) {
        const id = crypto.randomUUID(); const raw = crypto.getRandomValues(new Uint8Array(32));
        try { const wrapped = await auth.wrap(raw, id); const key = await importConversationKey(raw); working = { key, wrapped, row: null, state: { id, version: 1, revision: 1, title: `Hội thoại ${new Date().toLocaleString('vi-VN')}`, pii: draftContext, turns: [] } }; }
        finally { raw.fill(0); }
      }
      if (!retry && working.state.turns.some(t => t.status !== 'complete')) throw new Error('Hãy thử lại lượt lỗi trước khi gửi nội dung mới.');
      if (!retry && working.state.turns.length >= MAX_TURNS) throw new Error('Đã đủ 20 lượt. Hãy tạo hội thoại mới.');
      const prepared = { original: draft.original, masked: draft.masked, context: working.state.pii };
      const request = draft.proposal.request;
      pendingTurn = { id: retry?.id ?? crypto.randomUUID(), original: prepared.original, masked: prepared.masked, status: 'pending' };
      const turns = retry ? working.state.turns.map(t => t.id === retry.id ? pendingTurn! : t) : [...working.state.turns, pendingTurn];
      working = { ...working, state: { ...working.state, pii: prepared.context, turns } };
      working = await persist(working, token, task.signal);
      if (epoch.current !== task.current) return;
      setOpened(working); setLastRequest({ approvalId: draft.approvalId, proposal: draft.proposal }); await refresh(token, task.current);
      const response = await api<{ text: string; provider: string }>('/chat', token, { method: 'POST', body: { approvalId: draft.approvalId, proposal: draft.proposal }, signal: task.signal, timeout: 45000 });
      if (epoch.current !== task.current) return;
      const complete: OpenConversation = { ...working, state: { ...working.state, approvalDraft: undefined, turns: working.state.turns.map(t => t.id === pendingTurn!.id ? { ...t, status: 'complete', assistantRawMasked: response.text } : t) } };
      working = await persist(complete, token, task.signal);
      if (epoch.current !== task.current) return;
      setOpened(working); resetInput(); clearApprovalInput(); setNotice('Đã lưu bản mã. Tải lại trang và đăng nhập để mở lịch sử.'); await refresh(token, task.current);
    } catch (e) {
      if (epoch.current === task.current) {
        if (working && pendingTurn) {
          const failed = { ...working, state: { ...working.state, turns: working.state.turns.map(t => t.id === pendingTurn!.id ? { ...t, status: 'failed' as const } : t) } };
          setOpened(failed);
        }
        setError(errorText(e));
      }
    } finally { finish(task.current); }
  }
  async function remove() {
    if (!opened?.row || !confirm('Xóa hội thoại khỏi ứng dụng? Bản backup cũ không được hủy bởi thao tác này.')) return;
    const id = opened.state.id; invalidate(); const task = begin(); if (!task) return;
    try { const token = await auth.getToken(); await api(`/conversations/${id}`, token, { method: 'DELETE', signal: task.signal }); if (epoch.current !== task.current) return; setOpened(null); clearApprovalInput(); resetInput(); setLastRequest(null); setTamperResult(''); setNotice('Đã xóa khỏi ứng dụng. Không tuyên bố đã hủy backup hoặc bản sao bên ngoài.'); await refresh(token, task.current); }
    catch (e) { if (epoch.current === task.current) setError(errorText(e)); } finally { finish(task.current); }
  }
  async function testTamper() {
    if (!opened?.row || !auth.identity) return;
    try {
      const row = structuredClone(opened.row); const bytes = fromBase64(row.encryptedState); bytes[0] ^= 1; row.encryptedState = toBase64(bytes);
      await decryptState(opened.key, auth.identity.ownerId, row); setTamperResult('FAIL: bản mã sửa vẫn mở được.');
    } catch { setTamperResult('PASS — AES-GCM từ chối bản sao ciphertext đã bị đổi một byte. Dữ liệu lưu không bị sửa.'); }
  }
  async function testWrapper() {
    const task = begin(); if (!task) return;
    try {
      const id = crypto.randomUUID(); const raw = crypto.getRandomValues(new Uint8Array(32)); let wrapped: string;
      const before = toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)));
      try { wrapped = await auth.wrap(raw, id); } finally { raw.fill(0); }
      const result = await auth.unwrap(wrapped, id);
      const after = toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', result))); result.fill(0);
      if (before !== after) throw new Error('Key provider trả về khóa khác với khóa đã bọc.');
      if (epoch.current === task.current) { setProbe(`Round-trip key provider ${auth.mode} thành công. Chưa chứng minh user B hoặc QEA.`); setProbeData(JSON.stringify({ id, wrappedKey: wrapped, expectedHash: before }, null, 2)); }
    } catch (e) { if (epoch.current === task.current) setProbe(errorText(e)); } finally { finish(task.current); }
  }
  async function checkForeignProbe() {
    const task = begin(); if (!task) return;
    try {
      const data = JSON.parse(probeData);
      if (typeof data.id !== 'string' || typeof data.wrappedKey !== 'string' || data.wrappedKey.length > 65536 || typeof data.expectedHash !== 'string') throw new Error('Probe JSON không hợp lệ.');
      const raw = await auth.unwrap(data.wrappedKey, data.id);
      const digest = toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', raw))); raw.fill(0);
      if (digest !== data.expectedHash) throw new Error('Khóa mở ra không khớp.');
      if (epoch.current === task.current) setProbe('Probe mở được bằng tài khoản hiện tại. Nếu đây là user B đang thử probe của A, chưa đạt cô lập user.');
    } catch (e) { if (epoch.current === task.current) setProbe(`Probe bị từ chối hoặc không hợp lệ: ${errorText(e)}`); }
    finally { finish(task.current); }
  }
  function selectManual() { const el = inputRef.current; if (el && el.selectionEnd > el.selectionStart) setManual(old => [...old, { start: el.selectionStart, end: el.selectionEnd, kind: 'CUSTOM' }]); else setNotice('Bôi đen đoạn trong ô nhập rồi nhấn “Che đoạn đã chọn”.'); }
  async function login(e: FormEvent) { e.preventDefault(); setError(''); setSecret(''); try { await auth.login(username, secret); } catch (e) { setError(errorText(e)); } }
  const unresolved = opened?.state.turns.find(t => t.status !== 'complete');
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-icon">P</span><div><h1>PrivateChat Shield</h1><p>Che định danh. Mã hóa lịch sử tại thiết bị.</p></div></div><div className="top-right"><span className={`chip ${auth.mode === 'demo' ? 'amber' : 'blue'}`}>{auth.mode === 'demo' ? 'DEMO • dữ liệu giả lập' : 'Tide • xác thực và bọc khóa'}</span>{auth.identity && <button onClick={() => { invalidate(); clearApprovalInput(); setOpened(null); setLastRequest(null); resetInput(); setNames(''); auth.logout(); }}>Đăng xuất</button>}</div></header>
    <div className="mode-notice">{config.authMode === 'demo' ? 'Đăng nhập demo không xác thực danh tính. Khóa được bọc bằng mật khẩu demo tại trình duyệt; chưa sử dụng Tide hoặc Quorum.' : 'Tide SDK xác thực và bọc khóa; quyền file-approver lấy từ token đã xác minh. QEA quản trị quyền trong Tide Console.'} {config.aiProvider === 'demo' ? 'AI đang trả lời theo mẫu; không có request tới nhà cung cấp AI.' : 'Gateway gửi nội dung đã che tới Gemini; Gemini vẫn thấy nội dung nghiệp vụ.'}</div>
    {(error || auth.error) && <div className="feedback error" role="alert">{error || auth.error}</div>}
    {notice && <div className="feedback" role="status">{notice}</div>}
    {!auth.identity ? <section className="login-card"><h2>{auth.mode === 'demo' ? 'Bắt đầu thử nghiệm' : 'Kết nối TideCloak'}</h2><p>Chỉ dùng dữ liệu tổng hợp trong bản demo. Không lưu mật khẩu hoặc khóa thô trong browser storage.</p><form onSubmit={login}>{auth.mode === 'demo' && <><label>Tên tài khoản demo<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" name="username" pattern="[a-zA-Z0-9_-]{1,40}" required /></label><label>Mật khẩu mở khóa demo<input type="password" value={secret} onChange={e => setSecret(e.target.value)} minLength={12} autoComplete="off" name="passphrase" placeholder="Tối thiểu 12 ký tự — nhớ để mở lại" required /></label></>}<button className="primary" disabled={auth.loading}>Đăng nhập{auth.mode === 'demo' ? ' demo' : ' Tide'}</button></form><p className="muted">Sau F5, đăng nhập lại cùng tên và mật khẩu để mở lịch sử. Quên mật khẩu demo sẽ không mở được khóa cũ.</p></section> : <>
    <div className="workspace-bar"><span>Đang dùng: <strong>{auth.identity.username}</strong> · Lưu trữ: {config.storage}</span><button disabled={busy} onClick={() => { invalidate(); clearApprovalInput(); setOpened(null); resetInput(); setNames(''); setLastRequest(null); setTamperResult(''); setError(''); }}>+ Hội thoại mới</button></div>
    <main className="main-grid">
      <aside className="col-card"><div className="card-head"><h2>Lịch sử mã hóa</h2></div><div className="panel-content"><p className="muted">Danh sách chỉ có ID và thời gian. Nội dung được mở tại trình duyệt.</p>{summaries.length === 0 && <p>Chưa có hội thoại được lưu.</p>}{summaries.map(s => <button key={s.id} disabled={busy} className={`conversation ${opened?.state.id === s.id ? 'selected' : ''}`} onClick={() => void load(s.id)}><strong>{s.id.slice(0, 8)}</strong><span>{new Date(s.updatedAt).toLocaleString('vi-VN')} · v{s.revision}</span></button>)}{opened?.row && <><button disabled={busy} onClick={() => void load(opened.state.id)}>Tải lại từ server</button><button className="danger" onClick={() => void remove()}>Xóa hội thoại</button></>}<hr/><h3>Kiểm tra bảo mật</h3><button disabled={busy} onClick={() => void testWrapper()}>Kiểm tra key provider</button>{probe && <p role="status">{probe}</p>}<label className="probe-label">Probe mở khóa (chỉ chứa khóa thử nghiệm đã bọc)<textarea aria-label="Probe mở khóa" rows={3} maxLength={70000} value={probeData} onChange={e => setProbeData(e.target.value)} placeholder="Tạo probe bằng nút trên, hoặc dán probe của tài khoản A để thử bằng B." /></label><button disabled={busy || !probeData} onClick={() => void checkForeignProbe()}>Thử mở probe đã dán</button><button disabled={!opened?.row || busy} onClick={() => void testTamper()}>Thử sửa bản sao ciphertext</button>{tamperResult && <p role="status">{tamperResult}</p>}{config.authMode === 'tide' && <a href={`${config.tideIssuer}/tide-console/`} target="_blank" rel="noreferrer">Mở Tide Console để kiểm tra QEA</a>}</div></aside>
      <section className="col-card chat-panel"><div className="card-head"><h2>Cuộc trò chuyện</h2><label className="toggle"><input type="checkbox" checked={showReal} onChange={e => setShowReal(e.target.checked)} />Hiện giá trị gốc</label></div><div className="chat-body" aria-live="polite">{!opened?.state.turns.length && <div className="empty"><h3>Bạn quyết định nội dung gửi đi</h3><p>Dán hồ sơ, kiểm tra preview rồi gửi. Tiền và dữ kiện nghiệp vụ được giữ nguyên trừ khi bạn che thủ công.</p></div>}{opened?.state.turns.map(t => <div key={t.id}><article className="bubble user"><strong>Bạn</strong><p>{showReal ? t.original : t.masked}</p></article>{t.assistantRawMasked && <article className="bubble assistant"><strong>{config.aiProvider === 'demo' ? 'Phản hồi DEMO' : 'Gemini'}</strong><p>{showReal ? unmaskText(t.assistantRawMasked, opened.state.pii) : t.assistantRawMasked}</p>{unknownTokens(t.assistantRawMasked, opened.state.pii).length > 0 && <small>Model trả về token không khớp. Đã giữ nguyên, không đoán danh tính.</small>}</article>}{t.status !== 'complete' && <article className="bubble pending"><p>{busy ? 'Đang xử lý và lưu bản mã…' : 'Lượt này chưa hoàn tất. Có thể thử lại mà không thêm trùng tin nhắn.'}</p>{!busy && <button onClick={() => void requestApproval(t)}>Xin duyệt lại lượt lỗi</button>}</article>}</div>)}</div>
      <form className="composer" onSubmit={e => { e.preventDefault(); void requestApproval(); }}><button type="button" disabled={busy || !!unresolved} onClick={() => resetInput(PRESET)}>Dùng hồ sơ mẫu</button><label>File cần bảo mật (.txt, .csv, .md UTF-8; tối đa 32 KiB)<input aria-label="File cần bảo mật" type="file" accept=".txt,.csv,.md" disabled={busy || !!unresolved} onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ''; }} /></label>{attachment && <div data-testid="attachment-info"><strong>{attachment.name}</strong> · {attachment.manifest.bytes} byte<button type="button" disabled={busy} onClick={() => { fileEpoch.current++; setAttachment(null); setDisabled([]); setManual([]); }}>Bỏ file</button><details><summary>Nội dung file gốc — chỉ tại trình duyệt</summary><pre>{attachment.text}</pre></details></div>}<label htmlFor="chat-input">Nội dung cần gửi</label><textarea ref={inputRef} id="chat-input" value={input} onChange={e => resetInput(e.target.value)} maxLength={MAX_INPUT_CHARS} disabled={busy || !!unresolved} placeholder="Dán hồ sơ tổng hợp tại đây…" rows={5}/><div className="composer-tools"><button type="button" disabled={busy || !input} onClick={selectManual}>Che đoạn đã chọn</button><span className="muted">{combined.length}/{MAX_INPUT_CHARS} ký tự kể cả file</span></div><label>Tên cần che thêm (cách nhau bằng dấu phẩy)<input value={names} onChange={e => setNames(e.target.value)} disabled={busy} placeholder="nguyen van hung, Đặng Thị Mai" /></label>{preview.error && <p className="error-text">{preview.error}</p>}<label>Mục đích sử dụng<select aria-label="Mục đích sử dụng" value={purpose} disabled={busy} onChange={e => setPurpose(e.target.value as ApprovalProposal['purpose'])}><option value="summarize">Tóm tắt</option><option value="extract">Trích xuất dữ kiện</option><option value="question">Hỏi đáp</option></select></label><label>Mức bảo mật<select aria-label="Mức bảo mật" value={classification} disabled={busy} onChange={e => setClassification(e.target.value as ApprovalProposal['classification'])}><option value="confidential">Bảo mật — cần người khác duyệt</option><option value="restricted">Tuyệt mật — cấm gửi cloud</option></select></label>
      <p className="muted">Người duyệt và gateway thấy toàn bộ preview đã che, kể cả lịch sử. File gốc và tên file không được gửi vào hàng đợi.</p>{fileError && <p role="alert">{fileError}</p>}
      <button className="primary" disabled={busy || !!unresolved || !combined.trim() || !preview.value || !!fileError || classification === 'restricted'}>Xin phê duyệt nội dung</button>
      {draft && <div className="approval-status" data-testid="approval-status"><strong>{approval ? statusLabel[approval.status] : 'Cần kiểm tra trạng thái'}</strong><p>Yêu cầu {draft.approvalId.slice(0, 8)} · {config.aiProvider}/{config.model}</p>{!matchesDraft && <p>Nội dung đã thay đổi. Cần xin duyệt lại trước khi gửi.</p>}<button type="button" disabled={busy} onClick={() => void refreshApproval()}>Kiểm tra phê duyệt</button><button type="button" className="primary" disabled={busy || !matchesDraft || approval?.status !== 'approved'} onClick={() => void send()}>Gửi nội dung đã duyệt</button></div>}</form></section>
      <aside className="col-card"><div className="card-head"><h2>Preview & bằng chứng</h2></div><div className="panel-content"><ApprovalQueue key={auth.identity.ownerId}/><hr/><h3>Định danh phát hiện được</h3><p className="muted">Có thể bỏ sót. Kiểm tra và che thêm trước khi gửi.</p><div className="entities">{preview.value?.spans.map(s => <label key={`${s.start}:${s.end}`}><input type="checkbox" checked={s.enabled} disabled={busy} onChange={() => { const k = `${s.start}:${s.end}`; setDisabled(old => old.includes(k) ? old.filter(v => v !== k) : [...old, k]); }} /><span><strong>{s.kind}</strong> {s.value}</span></label>)}</div><h3>Nội dung sắp gửi</h3><pre data-testid="masked-preview">{preview.value?.masked || 'Chưa có nội dung.'}</pre><h3>Request gần nhất tới Gateway</h3><pre data-testid="gateway-request">{lastRequest ? JSON.stringify(lastRequest, null, 2) : 'Chưa gửi request.'}</pre><h3>Bản mã thực tế đã lưu</h3><pre data-testid="stored-ciphertext">{opened?.row ? JSON.stringify({ id: opened.row.id, revision: opened.row.revision, iv: opened.row.iv, ciphertext: opened.row.encryptedState.slice(0, 180) + '…' }, null, 2) : 'Chưa có snapshot.'}</pre><p className="muted">Chỉ hiển thị một phần bản mã. Server vẫn biết tài khoản, thời gian và kích thước. Không bảo đảm chống rollback toàn bộ hoặc xóa backup.</p></div></aside>
    </main></>}
    <footer>Prototype bảo vệ lịch sử và giảm định danh. Người vận hành frontend, thiết bị bị xâm nhập và ngữ cảnh tái định danh vẫn là giới hạn cần xem xét.</footer>
  </div>;
}
