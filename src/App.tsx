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

const PRESET = 'Tóm tắt hồ sơ tín dụng và thẩm định bảo mật cho khách hàng Lê Gia Khánh, CCCD 0792 0100 2345, STK Vietcombank 0071000123456, SĐT 0912345678, email giakhanh@rmit.edu.vn. Khoản vay 2,5 tỷ đồng, tài sản bảo đảm 5,2 tỷ đồng. Người bảo lãnh: Trần Trung Hiếu (SĐT 0987654321), Thẩm định viên: Nguyễn Chấn Khoa, Người phê duyệt: Trương Bảo Kin.';
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Có lỗi xảy ra. Hãy thử lại.';
type Summary = Pick<ConversationRow, 'id' | 'revision' | 'createdAt' | 'updatedAt'>;
interface OpenConversation { state: ConversationState; key: CryptoKey; wrapped: string; row: ConversationRow | null }

const TEAM_MEMBERS = [
  { id: 'giakhanh', name: 'Lê Gia Khánh', role: 'Người gửi (Requester)', isApprover: false },
  { id: 'baokin', name: 'Trương Bảo Kin', role: 'Phê duyệt viên (Reviewer)', isApprover: true },
  { id: 'hieu', name: 'Trần Trung Hiếu', role: 'Thành viên thẩm định', isApprover: false },
  { id: 'khoa', name: 'Nguyễn Chấn Khoa', role: 'Kiểm soát viên', isApprover: false },
];

export default function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api<PublicConfig>('/config', null)
      .then(c => { if (active) setConfig(c); })
      .catch(() => { if (active) setError('Không kết nối được backend. Chạy npm run dev:demo rồi tải lại.'); });
    return () => { active = false; };
  }, []);

  if (!config) {
    return (
      <main className="boot">
        <div className="brand-icon-wrapper" style={{ margin: '0 auto 16px' }}>
          <img src="/favicon.svg" alt="PrivateChat Shield Logo" className="brand-icon-svg" />
        </div>
        <h1>PrivateChat Shield</h1>
        <p role="status">{error || 'Đang kết nối backend…'}</p>
        <button onClick={() => location.reload()}>Tải lại</button>
      </main>
    );
  }

  return (
    <AuthProvider config={config}>
      <Workspace config={config} />
    </AuthProvider>
  );
}

function Workspace({ config }: { config: PublicConfig }) {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [opened, setOpened] = useState<OpenConversation | null>(null);
  const [input, setInput] = useState('');
  const [names, setNames] = useState('');
  const [disabled, setDisabled] = useState<string[]>([]);
  const [manual, setManual] = useState<ManualSpan[]>([]);
  const [showReal, setShowReal] = useState(true);
  const [lastRequest, setLastRequest] = useState<unknown>(null);
  const [tamperResult, setTamperResult] = useState('');
  const [probe, setProbe] = useState('');
  const [probeData, setProbeData] = useState('');
  const [attachment, setAttachment] = useState<LocalAttachment | null>(null);
  const [purpose, setPurpose] = useState<ApprovalProposal['purpose']>('summarize');
  const [classification, setClassification] = useState<ApprovalProposal['classification']>('confidential');
  const [approval, setApproval] = useState<ApprovalView | null>(null);
  const fileEpoch = useRef(0);

  function clearApprovalInput() {
    fileEpoch.current++;
    setAttachment(null);
    setApproval(null);
  }

  let combined = '';
  let fileError = '';
  try { combined = attachmentInput(input, attachment); } catch (e) { fileError = errorText(e); }

  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftContext = useMemo(() => newPiiContext(), [opened?.state.id]);

  const preview = useMemo<{ value: Prepared | null; error: string }>(() => {
    try {
      return {
        value: prepareMessage(combined, opened?.state.pii ?? draftContext, {
          names: names.split(',').map(s => s.trim()).filter(Boolean),
          disabled,
          manual,
        }),
        error: '',
      };
    } catch (e) {
      return { value: null, error: errorText(e) };
    }
  }, [combined, opened?.state.pii, draftContext, names, disabled, manual]);

  function resetInput(text = '') { setInput(text); setDisabled([]); setManual([]); }
  function invalidate() {
    fileEpoch.current++;
    epoch.current++;
    controller.current?.abort();
    controller.current = null;
    locked.current = false;
    setBusy(false);
  }

  useEffect(() => {
    invalidate();
    clearApprovalInput();
    setOpened(null);
    setSummaries([]);
    resetInput();
    setNames('');
    setLastRequest(null);
    setError('');
    setNotice('');
    setTamperResult('');
    setProbe('');
    setProbeData('');

    let cancelled = false;
    if (auth.identity) {
      void auth.getToken()
        .then(token => api<Summary[]>('/conversations', token))
        .then(rows => { if (!cancelled) setSummaries(rows); })
        .catch(e => { if (!cancelled) setError(errorText(e)); });
    }
    return () => {
      cancelled = true;
      epoch.current++;
      controller.current?.abort();
      locked.current = false;
    };
  }, [auth.identity?.ownerId]);

  function begin() {
    if (locked.current) return null;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const current = ++epoch.current;
    controller.current = new AbortController();
    return { current, signal: controller.current.signal };
  }

  function finish(current: number) {
    if (epoch.current === current) {
      locked.current = false;
      setBusy(false);
    }
  }

  async function refresh(token: string, current: number) {
    try {
      const rows = await api<Summary[]>('/conversations', token);
      if (current === epoch.current) setSummaries(rows);
    } catch {
      if (current === epoch.current) setNotice('Đã lưu hội thoại nhưng chưa tải lại được danh sách. Có thể tải lại trang.');
    }
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
      const token = await auth.getToken();
      const row = await api<ConversationRow>(`/conversations/${id}`, token, { signal: task.signal });
      if (row.id !== id || row.ownerId !== auth.identity.ownerId) throw new Error('Snapshot không khớp hội thoại hoặc tài khoản đã yêu cầu.');
      const raw = await auth.unwrap(row.wrappedKey, row.id);
      let key: CryptoKey;
      try { key = await importConversationKey(raw); } finally { raw.fill(0); }
      const state = await decryptState(key, auth.identity.ownerId, row);
      state.turns = state.turns.map(t => t.status === 'pending' ? { ...t, status: 'failed' as const } : t);
      const d = state.approvalDraft;
      const savedApproval = d ? await api<ApprovalView>(`/approvals/${d.approvalId}`, token, { signal: task.signal }) : null;
      if (epoch.current === task.current) {
        setOpened({ row, state, key, wrapped: row.wrappedKey });
        clearApprovalInput();
        if (d) {
          resetInput(d.prompt);
          setNames(d.names);
          setAttachment(d.attachment);
          setDisabled(d.disabled);
          setManual(d.manual);
          setPurpose(d.proposal.purpose);
          setClassification(d.proposal.classification);
          setApproval(savedApproval);
        } else {
          resetInput();
        }
        setLastRequest(null);
        setTamperResult('');
        setNotice('Đã xác thực và giải mã lịch sử hội thoại tại trình duyệt.');
      }
    } catch (e) {
      if (epoch.current === task.current) setError(errorText(e));
    } finally {
      finish(task.current);
    }
  }

  const draft = opened?.state.approvalDraft;
  const matchesDraft = !!draft && draft.original === combined && draft.masked === preview.value?.masked &&
    draft.proposal.purpose === purpose && draft.proposal.classification === classification &&
    JSON.stringify(draft.proposal.files) === JSON.stringify(attachment ? [attachment.manifest] : []);

  async function chooseFile(file?: File) {
    if (!file) return;
    const version = ++fileEpoch.current;
    setError('');
    try {
      const value = await readAttachment(file);
      if (fileEpoch.current === version) {
        setAttachment(value);
        setManual([]);
        setDisabled([]);
        setNotice(`Đã đọc ${value.name} tại trình duyệt. Nội dung được trích xuất an toàn để lọc PII.`);
      }
    } catch (e) {
      if (fileEpoch.current === version) {
        setAttachment(null);
        setError(errorText(e));
      }
    }
  }

  async function requestApproval(retry?: Turn) {
    if (!auth.identity || (!retry && (!preview.value || !combined.trim() || fileError))) return;
    const task = begin(); if (!task) return;
    let working = opened;
    try {
      if (classification === 'restricted') throw new Error('Tài liệu Tuyệt mật bị chặn gửi cloud. Hãy dùng mô hình nội bộ và quy trình riêng.');
      const token = await auth.getToken();
      if (!working) {
        const id = crypto.randomUUID();
        const raw = crypto.getRandomValues(new Uint8Array(32));
        try {
          const wrapped = await auth.wrap(raw, id);
          const key = await importConversationKey(raw);
          working = { key, wrapped, row: null, state: { id, version: 1, revision: 1, title: `Hội thoại ${new Date().toLocaleString('vi-VN')}`, pii: draftContext, turns: [] } };
        } finally {
          raw.fill(0);
        }
      }
      if (!retry && working.state.turns.some(t => t.status !== 'complete')) throw new Error('Hãy xin duyệt lại lượt lỗi trước khi gửi nội dung mới.');
      if (!retry && working.state.turns.length >= MAX_TURNS) throw new Error('Đã đủ 20 lượt. Hãy tạo hội thoại mới.');
      const prepared = retry ? { original: retry.original, masked: retry.masked, context: working.state.pii } : preview.value!;
      const previous = working.state.approvalDraft;
      const proposal: ApprovalProposal = {
        conversationId: working.state.id,
        request: buildChatRequest(working.state, prepared.masked),
        files: retry ? (previous?.proposal.files ?? []) : (attachment ? [attachment.manifest] : []),
        purpose,
        classification,
      };
      working = await persist(working, token, task.signal);
      const row = await api<ApprovalView>('/approvals', token, { method: 'POST', body: proposal, signal: task.signal });
      const nextDraft: ApprovalDraft = {
        approvalId: row.id,
        proposal,
        original: prepared.original,
        masked: prepared.masked,
        prompt: retry ? (previous?.prompt ?? retry.original) : input,
        names,
        attachment: retry ? (previous?.attachment ?? null) : attachment,
        disabled,
        manual,
        ...(retry ? { retryId: retry.id } : {}),
      };
      working = await persist({ ...working, state: { ...working.state, pii: prepared.context, approvalDraft: nextDraft } }, token, task.signal);
      if (epoch.current !== task.current) return;
      setOpened(working);
      setApproval(row);
      if (retry) { resetInput(nextDraft.prompt); setAttachment(nextDraft.attachment); }
      setNotice('Đã gửi yêu cầu phê duyệt vào hàng đợi. Hãy chuyển sang tài khoản Trương Bảo Kin ở thanh trên để duyệt.');
      await refresh(token, task.current);
    } catch (e) {
      if (epoch.current === task.current) setError(errorText(e));
    } finally {
      finish(task.current);
    }
  }

  async function refreshApproval() {
    if (!draft) return;
    const task = begin(); if (!task) return;
    try {
      const result = await api<ApprovalView>(`/approvals/${draft.approvalId}`, await auth.getToken(), { signal: task.signal });
      if (epoch.current === task.current) setApproval(result);
    } catch (e) {
      if (epoch.current === task.current) setError(errorText(e));
    } finally {
      finish(task.current);
    }
  }

  async function send(retry?: Turn) {
    if (!auth.identity || !draft || !matchesDraft || approval?.id !== draft.approvalId || approval.status !== 'approved') return;
    retry = draft.retryId ? opened?.state.turns.find(t => t.id === draft.retryId) : undefined;
    const task = begin(); if (!task) return;
    let working = opened;
    let pendingTurn: Turn | null = null;
    try {
      const token = await auth.getToken();
      if (!working) {
        const id = crypto.randomUUID();
        const raw = crypto.getRandomValues(new Uint8Array(32));
        try {
          const wrapped = await auth.wrap(raw, id);
          const key = await importConversationKey(raw);
          working = { key, wrapped, row: null, state: { id, version: 1, revision: 1, title: `Hội thoại ${new Date().toLocaleString('vi-VN')}`, pii: draftContext, turns: [] } };
        } finally {
          raw.fill(0);
        }
      }
      if (!retry && working.state.turns.some(t => t.status !== 'complete')) throw new Error('Hãy thử lại lượt lỗi trước khi gửi nội dung mới.');
      if (!retry && working.state.turns.length >= MAX_TURNS) throw new Error('Đã đủ 20 lượt. Hãy tạo hội thoại mới.');
      const prepared = { original: draft.original, masked: draft.masked, context: working.state.pii };
      pendingTurn = { id: retry?.id ?? crypto.randomUUID(), original: prepared.original, masked: prepared.masked, status: 'pending' };
      const turns = retry ? working.state.turns.map(t => t.id === retry.id ? pendingTurn! : t) : [...working.state.turns, pendingTurn];
      working = { ...working, state: { ...working.state, pii: prepared.context, turns } };
      working = await persist(working, token, task.signal);
      if (epoch.current !== task.current) return;
      setOpened(working);
      setLastRequest({ approvalId: draft.approvalId, proposal: draft.proposal });
      await refresh(token, task.current);
      const response = await api<{ text: string; provider: string }>('/chat', token, { method: 'POST', body: { approvalId: draft.approvalId, proposal: draft.proposal }, signal: task.signal, timeout: 45000 });
      if (epoch.current !== task.current) return;
      const complete: OpenConversation = {
        ...working,
        state: {
          ...working.state,
          approvalDraft: undefined,
          turns: working.state.turns.map(t => t.id === pendingTurn!.id ? { ...t, status: 'complete', assistantRawMasked: response.text } : t),
        },
      };
      working = await persist(complete, token, task.signal);
      if (epoch.current !== task.current) return;
      setOpened(working);
      resetInput();
      clearApprovalInput();
      setNotice('Đã nhận phản hồi từ AI Gateway và lưu trữ bản mã E2EE thành công.');
      await refresh(token, task.current);
    } catch (e) {
      if (epoch.current === task.current) {
        if (working && pendingTurn) {
          const failed = { ...working, state: { ...working.state, turns: working.state.turns.map(t => t.id === pendingTurn!.id ? { ...t, status: 'failed' as const } : t) } };
          setOpened(failed);
        }
        setError(errorText(e));
      }
    } finally {
      finish(task.current);
    }
  }

  async function remove() {
    if (!opened?.row || !confirm('Xóa hội thoại khỏi ứng dụng?')) return;
    const id = opened.state.id;
    invalidate();
    const task = begin(); if (!task) return;
    try {
      const token = await auth.getToken();
      await api(`/conversations/${id}`, token, { method: 'DELETE', signal: task.signal });
      if (epoch.current !== task.current) return;
      setOpened(null);
      clearApprovalInput();
      resetInput();
      setLastRequest(null);
      setTamperResult('');
      setNotice('Đã xóa hội thoại khỏi cơ sở dữ liệu mã hóa.');
      await refresh(token, task.current);
    } catch (e) {
      if (epoch.current === task.current) setError(errorText(e));
    } finally {
      finish(task.current);
    }
  }

  async function testTamper() {
    if (!opened?.row || !auth.identity) return;
    try {
      const row = structuredClone(opened.row);
      const bytes = fromBase64(row.encryptedState);
      bytes[0] ^= 1;
      row.encryptedState = toBase64(bytes);
      await decryptState(opened.key, auth.identity.ownerId, row);
      setTamperResult('FAIL: bản mã sửa vẫn mở được.');
    } catch {
      setTamperResult('PASS — AES-GCM từ chối bản sao ciphertext đã bị sửa đổi một byte. Tính toàn vẹn dữ liệu được đảm bảo.');
    }
  }

  async function testWrapper() {
    const task = begin(); if (!task) return;
    try {
      const id = crypto.randomUUID();
      const raw = crypto.getRandomValues(new Uint8Array(32));
      let wrapped: string;
      const before = toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)));
      try { wrapped = await auth.wrap(raw, id); } finally { raw.fill(0); }
      const result = await auth.unwrap(wrapped, id);
      const after = toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', result)));
      result.fill(0);
      if (before !== after) throw new Error('Key provider trả về khóa khác với khóa đã bọc.');
      if (epoch.current === task.current) {
        setProbe(`Khóa mã hóa round-trip thành công (${auth.mode.toUpperCase()}).`);
        setProbeData(JSON.stringify({ id, wrappedKey: wrapped, expectedHash: before }, null, 2));
      }
    } catch (e) {
      if (epoch.current === task.current) setProbe(errorText(e));
    } finally {
      finish(task.current);
    }
  }

  async function checkForeignProbe() {
    const task = begin(); if (!task) return;
    try {
      const data = JSON.parse(probeData);
      if (typeof data.id !== 'string' || typeof data.wrappedKey !== 'string' || data.wrappedKey.length > 65536 || typeof data.expectedHash !== 'string') {
        throw new Error('Probe JSON không hợp lệ.');
      }
      const raw = await auth.unwrap(data.wrappedKey, data.id);
      const digest = toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)));
      raw.fill(0);
      if (digest !== data.expectedHash) throw new Error('Khóa mở ra không khớp.');
      if (epoch.current === task.current) setProbe('Probe mở được bằng tài khoản hiện tại.');
    } catch (e) {
      if (epoch.current === task.current) setProbe(`Probe bị từ chối: ${errorText(e)}`);
    } finally {
      finish(task.current);
    }
  }

  function selectManual() {
    const el = inputRef.current;
    if (el && el.selectionEnd > el.selectionStart) {
      setManual(old => [...old, { start: el.selectionStart, end: el.selectionEnd, kind: 'CUSTOM' }]);
    } else {
      setNotice('Bôi đen đoạn văn bản trong ô nhập rồi nhấn “Che đoạn đã chọn”.');
    }
  }

  const unresolved = opened?.state.turns.find(t => t.status !== 'complete');

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon-wrapper">
            <img src="/favicon.svg" alt="PrivateChat Shield Logo" className="brand-icon-svg" />
          </div>
          <div>
            <h1>PrivateChat Shield</h1>
            <p>Khử định danh PII • Mã hóa E2EE • Phê duyệt 2 người trước khi gửi Cloud AI</p>
          </div>
        </div>
        <div className="top-right">
          <div className="member-switcher">
            <span className="member-label">Chuyển tài khoản:</span>
            {TEAM_MEMBERS.map(m => (
              <button
                key={m.id}
                type="button"
                className={`member-btn ${auth.identity?.username === m.id ? 'active' : ''}`}
                onClick={() => {
                  if (auth.identity?.username !== m.id) {
                    invalidate();
                    clearApprovalInput();
                    setOpened(null);
                    setLastRequest(null);
                    void auth.login(m.id);
                  }
                }}
              >
                {m.isApprover ? '🛡️' : '👤'} {m.name}
              </button>
            ))}
          </div>
          <span className={`chip ${auth.mode === 'demo' ? 'amber' : 'blue'}`}>
            {auth.mode === 'demo' ? 'DEMO • Zero-Trust' : 'TideCloak SSO'}
          </span>
        </div>
      </header>

      {(error || auth.error) && <div className="feedback error" role="alert">{error || auth.error}</div>}
      {notice && <div className="feedback" role="status">{notice}</div>}

      <div className="workspace-bar">
        <div className="active-user-badge">
          <span>Tài khoản hiện tại:</span>
          <strong>
            {auth.identity?.username === 'baokin' ? '🛡️ Trương Bảo Kin (Phê duyệt viên)' :
             auth.identity?.username === 'hieu' ? '👤 Trần Trung Hiếu' :
             auth.identity?.username === 'khoa' ? '👤 Nguyễn Chấn Khoa' :
             '👤 Lê Gia Khánh (Người gửi)'}
          </strong>
          {auth.identity?.canApproveFiles && <span className="approver-pill">Quyền duyệt (file-approver)</span>}
        </div>
        <button
          disabled={busy}
          onClick={() => {
            invalidate();
            clearApprovalInput();
            setOpened(null);
            resetInput();
            setNames('');
            setLastRequest(null);
            setTamperResult('');
            setError('');
          }}
        >
          + Hội thoại mới
        </button>
      </div>

      <main className="main-grid">
        {/* CỘT 1: LỊCH SỬ MÃ HÓA & SECURITY PROBES */}
        <aside className="col-card">
          <div className="card-head">
            <h2>Lịch sử mã hóa</h2>
          </div>
          <div className="panel-content">
            <p className="muted">Danh sách lưu trữ chỉ chứa ID và dấu thời gian. Bản tin mã hóa chỉ mở tại trình duyệt.</p>
            {summaries.length === 0 && <p className="muted">Chưa có hội thoại được lưu.</p>}
            {summaries.map(s => (
              <button
                key={s.id}
                disabled={busy}
                className={`conversation ${opened?.state.id === s.id ? 'selected' : ''}`}
                onClick={() => void load(s.id)}
              >
                <strong>{s.id.slice(0, 8)}</strong>
                <span>{new Date(s.updatedAt).toLocaleString('vi-VN')} · v{s.revision}</span>
              </button>
            ))}
            {opened?.row && (
              <div className="conv-actions">
                <button disabled={busy} onClick={() => void load(opened.state.id)}>Tải lại từ server</button>
                <button className="danger" onClick={() => void remove()}>Xóa hội thoại</button>
              </div>
            )}
            <hr />
            <h3>Kiểm tra bảo mật (Security Lab)</h3>
            <button disabled={busy} onClick={() => void testWrapper()}>Kiểm tra Key Wrapping</button>
            {probe && <p role="status" className="probe-result">{probe}</p>}
            <label className="probe-label">
              Probe thử nghiệm khóa:
              <textarea
                aria-label="Probe mở khóa"
                rows={2}
                maxLength={70000}
                value={probeData}
                onChange={e => setProbeData(e.target.value)}
                placeholder="Dán probe để kiểm tra tính cô lập tài khoản..."
              />
            </label>
            <button disabled={busy || !probeData} onClick={() => void checkForeignProbe()}>Thử mở probe đã dán</button>
            <button disabled={!opened?.row || busy} onClick={() => void testTamper()}>Thử sửa bản sao Ciphertext (AES-GCM)</button>
            {tamperResult && <p role="status" className="probe-result">{tamperResult}</p>}
          </div>
        </aside>

        {/* CỘT 2: CUỘC TRÒ CHUYỆN & FILE COMPOSER */}
        <section className="col-card chat-panel">
          <div className="card-head">
            <h2>Cuộc trò chuyện an toàn</h2>
            <label className="toggle">
              <input type="checkbox" checked={showReal} onChange={e => setShowReal(e.target.checked)} />
              Hiện giá trị gốc
            </label>
          </div>
          <div className="chat-body" aria-live="polite">
            {!opened?.state.turns.length && (
              <div className="empty">
                <h3>Bảo vệ thông tin cá nhân & Tài liệu mật</h3>
                <p>Mọi định danh (CCCD, Họ tên, STK, SĐT, Email) trong câu hỏi và file đính kèm được che trước khi gửi. Nhà phát hành AI không bao giờ thu thập được danh tính gốc.</p>
              </div>
            )}
            {opened?.state.turns.map(t => (
              <div key={t.id}>
                <article className="bubble user">
                  <strong>Bạn</strong>
                  <p>{showReal ? t.original : t.masked}</p>
                </article>
                {t.assistantRawMasked && (
                  <article className="bubble assistant">
                    <strong>{config.aiProvider === 'demo' ? 'Phản hồi AI Demo' : 'Gemini AI'}</strong>
                    <p>{showReal ? unmaskText(t.assistantRawMasked, opened.state.pii) : t.assistantRawMasked}</p>
                    {unknownTokens(t.assistantRawMasked, opened.state.pii).length > 0 && (
                      <small>Model trả về token không khớp context.</small>
                    )}
                  </article>
                )}
                {t.status !== 'complete' && (
                  <article className="bubble pending">
                    <p>{busy ? 'Đang xử lý và lưu bản mã…' : 'Lượt này chưa hoàn tất.'}</p>
                    {!busy && <button onClick={() => void requestApproval(t)}>Xin duyệt lại lượt lỗi</button>}
                  </article>
                )}
              </div>
            ))}
          </div>

          <form className="composer" onSubmit={e => { e.preventDefault(); void requestApproval(); }}>
            <div className="preset-bar">
              <button
                type="button"
                className="btn-preset"
                disabled={busy || !!unresolved}
                onClick={() => resetInput(PRESET)}
              >
                📋 Dùng hồ sơ mẫu (Lê Gia Khánh)
              </button>
            </div>

            <label className="file-upload-label">
              <span>Đính kèm tài liệu bảo mật (.pdf, ảnh .png/.jpg, .txt, .csv, .md):</span>
              <input
                aria-label="File cần bảo mật"
                type="file"
                accept=".txt,.csv,.md,.pdf,.png,.jpg,.jpeg,.webp"
                disabled={busy || !!unresolved}
                onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </label>

            {attachment && (
              <div data-testid="attachment-info" className="attachment-card">
                <div className="attachment-top">
                  <div className="attachment-title">
                    <span className="file-icon">
                      {attachment.isImage ? '🖼️' : attachment.isPdf ? '📄' : '📝'}
                    </span>
                    <strong>{attachment.name}</strong>
                    <span className="file-size">({(attachment.manifest.bytes / 1024).toFixed(1)} KiB)</span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-file"
                    disabled={busy}
                    onClick={() => { fileEpoch.current++; setAttachment(null); setDisabled([]); setManual([]); }}
                  >
                    Bỏ file
                  </button>
                </div>
                {attachment.previewUrl && (
                  <div className="image-preview-container">
                    <img src={attachment.previewUrl} alt="Preview" className="img-attachment-preview" />
                  </div>
                )}
                <details className="file-content-details">
                  <summary>Nội dung trích xuất ({attachment.isImage ? 'OCR' : attachment.isPdf ? 'PDF' : 'Text'}) — xử lý cục bộ</summary>
                  <pre>{attachment.text}</pre>
                </details>
              </div>
            )}

            <label htmlFor="chat-input">Nội dung câu hỏi & chỉ dẫn cho AI</label>
            <textarea
              ref={inputRef}
              id="chat-input"
              value={input}
              onChange={e => resetInput(e.target.value)}
              maxLength={MAX_INPUT_CHARS}
              disabled={busy || !!unresolved}
              placeholder="Dán nội dung hồ sơ hoặc tài liệu tại đây…"
              rows={4}
            />

            <div className="composer-tools">
              <button type="button" disabled={busy || !input} onClick={selectManual}>
                ✂️ Che đoạn đã chọn
              </button>
              <span className="muted">{combined.length}/{MAX_INPUT_CHARS} ký tự</span>
            </div>

            <label>Tên thành viên / người cần che thêm:
              <input
                value={names}
                onChange={e => setNames(e.target.value)}
                disabled={busy}
                placeholder="Lê Gia Khánh, Trần Trung Hiếu, Nguyễn Chấn Khoa, Trương Bảo Kin"
              />
            </label>

            {preview.error && <p className="error-text">{preview.error}</p>}

            <div className="classification-row">
              <label>Mục đích sử dụng:
                <select
                  aria-label="Mục đích sử dụng"
                  value={purpose}
                  disabled={busy}
                  onChange={e => setPurpose(e.target.value as ApprovalProposal['purpose'])}
                >
                  <option value="summarize">Tóm tắt hồ sơ</option>
                  <option value="extract">Trích xuất dữ kiện</option>
                  <option value="question">Hỏi đáp bảo mật</option>
                </select>
              </label>

              <label>Mức độ phân loại:
                <select
                  aria-label="Mức bảo mật"
                  value={classification}
                  disabled={busy}
                  onChange={e => setClassification(e.target.value as ApprovalProposal['classification'])}
                >
                  <option value="confidential">Bảo mật (Cần phê duyệt độc lập)</option>
                  <option value="restricted">Tuyệt mật (Chặn hoàn toàn gửi Cloud)</option>
                </select>
              </label>
            </div>

            {fileError && <p role="alert" className="error-text">{fileError}</p>}

            <button
              className="primary btn-submit-approval"
              disabled={busy || !!unresolved || !combined.trim() || !preview.value || !!fileError || classification === 'restricted'}
            >
              🔒 Xin phê duyệt nội dung
            </button>

            {draft && (
              <div className="approval-status" data-testid="approval-status">
                <div className="status-header">
                  <strong>Trạng thái: {approval ? statusLabel[approval.status] : 'Đang kiểm tra...'}</strong>
                  <span className="approval-id">ID: {draft.approvalId.slice(0, 8)}</span>
                </div>
                {!matchesDraft && <p className="warning-text">Nội dung đã bị sửa đổi. Cần xin phê duyệt lại.</p>}
                <div className="approval-buttons">
                  <button type="button" disabled={busy} onClick={() => void refreshApproval()}>
                    Kiểm tra phê duyệt
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={busy || !matchesDraft || approval?.status !== 'approved'}
                    onClick={() => void send()}
                  >
                    🚀 Gửi nội dung đã duyệt sang AI
                  </button>
                </div>
              </div>
            )}
          </form>
        </section>

        {/* CỘT 3: PREVIEW & BẰNG CHỨNG MÃ HÓA */}
        <aside className="col-card">
          <div className="card-head">
            <h2>Preview & Bằng chứng bảo mật</h2>
          </div>
          <div className="panel-content">
            <ApprovalQueue key={auth.identity?.ownerId} />
            <hr />
            <h3>Định danh PII phát hiện được</h3>
            <div className="entities">
              {(!preview.value?.spans || preview.value.spans.length === 0) && (
                <p className="muted">Chưa phát hiện PII nhạy cảm.</p>
              )}
              {preview.value?.spans.map(s => (
                <label key={`${s.start}:${s.end}`}>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    disabled={busy}
                    onChange={() => {
                      const k = `${s.start}:${s.end}`;
                      setDisabled(old => old.includes(k) ? old.filter(v => v !== k) : [...old, k]);
                    }}
                  />
                  <span><strong>{s.kind}</strong> {s.value}</span>
                </label>
              ))}
            </div>

            <h3>Nội dung đã che (Gateway sẽ thấy)</h3>
            <pre data-testid="masked-preview">{preview.value?.masked || 'Chưa có nội dung.'}</pre>

            <h3>Request gần nhất gửi tới Gateway</h3>
            <pre data-testid="gateway-request">
              {lastRequest ? JSON.stringify(lastRequest, null, 2) : 'Chưa gửi request.'}
            </pre>

            <h3>Bản mã lưu trữ (Ciphertext tại DB)</h3>
            <pre data-testid="stored-ciphertext">
              {opened?.row
                ? JSON.stringify({ id: opened.row.id, revision: opened.row.revision, iv: opened.row.iv, ciphertext: opened.row.encryptedState.slice(0, 140) + '…' }, null, 2)
                : 'Chưa có snapshot.'}
            </pre>
          </div>
        </aside>
      </main>

      <footer>
        PrivateChat Shield — Giải pháp bảo vệ quyền riêng tư & Quản trị AI Zero-Trust. Nhóm ComGa • RMIT Hackathon 2026.
      </footer>
    </div>
  );
}
