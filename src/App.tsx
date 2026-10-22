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

const PRESET_EN = 'Please review and summarize the credit application and identify missing compliance documents for client Lê Gia Khánh, National ID 0792 0100 2345, Vietcombank account 0071000123456, Phone 0912345678, Email giakhanh@rmit.edu.vn. Loan request: 2.5 Billion VND, Collateral value: 5.2 Billion VND. Guarantor: Trần Trung Hiếu, Credit Assessor: Phạm Chấn Khoa, Approval Officer: Cái Hoàng Bảo Kin.';
const PRESET_VI = 'Tóm tắt hồ sơ tín dụng và thẩm định bảo mật cho khách hàng Lê Gia Khánh, CCCD 0792 0100 2345, STK Vietcombank 0071000123456, SĐT 0912345678, email giakhanh@rmit.edu.vn. Khoản vay 2,5 tỷ đồng, tài sản bảo đảm 5,2 tỷ đồng. Người bảo lãnh: Trần Trung Hiếu, Thẩm định viên: Phạm Chấn Khoa, Người phê duyệt: Cái Hoàng Bảo Kin.';

const errorText = (e: unknown) => e instanceof Error ? e.message : 'An error occurred. Please try again.';
type Summary = Pick<ConversationRow, 'id' | 'revision' | 'createdAt' | 'updatedAt'>;
interface OpenConversation { state: ConversationState; key: CryptoKey; wrapped: string; row: ConversationRow | null }

const TEAM_PERSONAS = [
  {
    id: 'giakhanh',
    name: 'Lê Gia Khánh',
    title: 'Enterprise Requester',
    roleLabel: 'Requester (User)',
    icon: '👤',
    isApprover: false,
    description: 'Enterprise Credit Officer: Authors sensitive prompts, attaches confidential dossiers, and inspects local unmasked AI insights.',
  },
  {
    id: 'baokin',
    name: 'Cái Hoàng Bảo Kin',
    title: 'Security Reviewer',
    roleLabel: 'Security Reviewer',
    icon: '🛡️',
    isApprover: true,
    description: 'Dual-Control Gatekeeper: Verifies pseudonymized outbound payloads before cloud release. Enforces Vietnam PDPD Law 91/2025.',
  },
  {
    id: 'hieu',
    name: 'Trần Trung Hiếu',
    title: 'Cloud AI Vendor / AI Admin',
    roleLabel: 'AI Admin Auditor',
    icon: '🤖',
    isApprover: false,
    description: 'Threat Auditor (AI Provider / AI Admin View): Demonstrates that the AI vendor (Gemini/OpenAI) receives 0.00% raw PII—only pseudonymized tokens.',
  },
  {
    id: 'khoa',
    name: 'Phạm Chấn Khoa',
    title: 'Database & Infrastructure Admin',
    roleLabel: 'DBA / Threat Inspector',
    icon: '🗄️',
    isApprover: false,
    description: 'Threat Auditor (DB Admin View): Proves that even a malicious DBA holding PostgreSQL storage sees only AES-256-GCM ciphertext.',
  },
];

export default function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api<PublicConfig>('/config', null)
      .then(c => { if (active) setConfig(c); })
      .catch(() => { if (active) setError('Cannot connect to backend server. Make sure the server is running.'); });
    return () => { active = false; };
  }, []);

  if (!config) {
    return (
      <main className="boot">
        <div className="brand-icon-wrapper" style={{ margin: '0 auto 16px' }}>
          <img src="/favicon.svg" alt="PrivateChat Shield Logo" className="brand-icon-svg" />
        </div>
        <h1>PrivateChat Shield</h1>
        <p role="status">{error || 'Initializing Zero-Trust Security Gateway…'}</p>
        <button onClick={() => location.reload()}>Reload Page</button>
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
      if (current === epoch.current) setNotice('Session saved, but list refresh is pending. You can reload if needed.');
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
      if (row.id !== id || row.ownerId !== auth.identity.ownerId) throw new Error('Snapshot does not match requested conversation or owner.');
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
        setNotice('Conversation verified and decrypted inside local client browser.');
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
        setNotice(`Attached ${value.name} (${(value.manifest.bytes / 1024).toFixed(1)} KiB). Content extracted locally for zero-trust PII sanitization.`);
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
      if (classification === 'restricted') throw new Error('Restricted content cannot be dispatched to cloud AI. Use an on-premise model and dedicated air-gapped pipeline.');
      const token = await auth.getToken();
      if (!working) {
        const id = crypto.randomUUID();
        const raw = crypto.getRandomValues(new Uint8Array(32));
        try {
          const wrapped = await auth.wrap(raw, id);
          const key = await importConversationKey(raw);
          working = { key, wrapped, row: null, state: { id, version: 1, revision: 1, title: `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pii: draftContext, turns: [] } };
        } finally {
          raw.fill(0);
        }
      }
      if (!retry && working.state.turns.some(t => t.status !== 'complete')) throw new Error('Please resolve pending turns before dispatching new prompts.');
      if (!retry && working.state.turns.length >= MAX_TURNS) throw new Error('Maximum 20 turns reached. Please start a new session.');
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
      setNotice('Outbound approval request submitted. Switch to reviewer "Cái Hoàng Bảo Kin" to authorize dispatch.');
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
          working = { key, wrapped, row: null, state: { id, version: 1, revision: 1, title: `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pii: draftContext, turns: [] } };
        } finally {
          raw.fill(0);
        }
      }
      if (!retry && working.state.turns.some(t => t.status !== 'complete')) throw new Error('Please retry incomplete turns before submitting new messages.');
      if (!retry && working.state.turns.length >= MAX_TURNS) throw new Error('Maximum 20 turns reached. Please start a new session.');
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
      setNotice('AI response received. Ciphertext snapshot persisted to PostgreSQL.');
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
    if (!opened?.row || !confirm('Permanently delete this encrypted conversation session?')) return;
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
      setNotice('Conversation session deleted from encrypted storage.');
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
      setTamperResult('FAIL: Tampered ciphertext was accepted (VULNERABILITY).');
    } catch {
      setTamperResult('PASS — AES-256-GCM + AAD rejected tampered ciphertext byte. Data integrity guaranteed.');
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
      if (before !== after) throw new Error('Key provider returned mismatched key.');
      if (epoch.current === task.current) {
        setProbe(`Key wrap / unwrap round-trip verified (${auth.mode.toUpperCase()}).`);
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
        throw new Error('Invalid probe JSON format.');
      }
      const raw = await auth.unwrap(data.wrappedKey, data.id);
      const digest = toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)));
      raw.fill(0);
      if (digest !== data.expectedHash) throw new Error('Unwrapped key hash mismatch.');
      if (epoch.current === task.current) setProbe('Probe unlocked under current credentials.');
    } catch (e) {
      if (epoch.current === task.current) setProbe(`Probe rejected: ${errorText(e)}`);
    } finally {
      finish(task.current);
    }
  }

  function selectManual() {
    const el = inputRef.current;
    if (el && el.selectionEnd > el.selectionStart) {
      setManual(old => [...old, { start: el.selectionStart, end: el.selectionEnd, kind: 'CUSTOM' }]);
    } else {
      setNotice('Highlight text in the input box, then click "Mask Selected Text".');
    }
  }

  const currentPersona = TEAM_PERSONAS.find(p => p.id === auth.identity?.username) ?? TEAM_PERSONAS[0];
  const unresolved = opened?.state.turns.find(t => t.status !== 'complete');

  return (
    <div className="app-shell">
      {/* TOPBAR */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon-wrapper">
            <img src="/favicon.svg" alt="PrivateChat Shield Logo" className="brand-icon-svg" />
          </div>
          <div>
            <h1>PrivateChat Shield</h1>
            <p>Zero-Trust AI Privacy & Dual-Control Outbound Governance Gateway</p>
          </div>
        </div>

        <div className="top-right">
          <div className="tide-node-status">
            <a
              href="http://localhost:8080/realms/myrealm/account/"
              target="_blank"
              rel="noreferrer"
              className="tide-link-btn"
              title="Open TideCloak Identity Provider on localhost:8080"
            >
              <span className="dot-pulse">●</span> TideCloak Node (8080)
            </a>
            <a
              href="http://localhost:8080/admin/"
              target="_blank"
              rel="noreferrer"
              className="tide-console-btn"
              title="Open Tide Admin Console (QEA & Threshold Fabric)"
            >
              🏛️ Tide Console
            </a>
          </div>

          <span className={`chip ${auth.mode === 'demo' ? 'amber' : 'blue'}`}>
            {auth.mode === 'demo' ? 'Zero-Trust Envelope Active' : 'TideCloak SSO Active'}
          </span>
        </div>
      </header>

      {/* MULTI-ROLE PERSPECTIVE SWITCHER */}
      <nav className="perspective-nav">
        <div className="perspective-nav-header">
          <span className="perspective-title">HACKATHON THREAT MODEL & PERSONAS:</span>
          <span className="perspective-subtitle">Switch perspectives to audit every layer of defense</span>
        </div>
        <div className="persona-buttons">
          {TEAM_PERSONAS.map(m => (
            <button
              key={m.id}
              type="button"
              className={`persona-card-btn ${auth.identity?.username === m.id ? 'active' : ''}`}
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
              <div className="persona-btn-head">
                <span className="persona-icon">{m.icon}</span>
                <strong>{m.name}</strong>
              </div>
              <span className="persona-role-badge">{m.roleLabel}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ACTIVE PERSPECTIVE CONTEXT BANNER */}
      <div className={`persona-banner role-${currentPersona.id}`}>
        <div className="persona-banner-content">
          <span className="persona-banner-badge">{currentPersona.icon} {currentPersona.title}</span>
          <span className="persona-banner-desc">{currentPersona.description}</span>
        </div>
      </div>

      {(error || auth.error) && <div className="feedback error" role="alert">{error || auth.error}</div>}
      {notice && <div className="feedback" role="status">{notice}</div>}

      <div className="workspace-bar">
        <div className="active-user-badge">
          <span>Active Identity:</span>
          <strong>{currentPersona.icon} {currentPersona.name} ({currentPersona.title})</strong>
          {auth.identity?.canApproveFiles && <span className="approver-pill">Dual-Control Approver Verified</span>}
        </div>
        <button
          className="btn-new-chat"
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
          + New Encrypted Chat
        </button>
      </div>

      <main className="main-grid">
        {/* COLUMN 1: ENCRYPTED HISTORY & SECURITY LAB */}
        <aside className="col-card">
          <div className="card-head">
            <h2>Encrypted Vault</h2>
          </div>
          <div className="panel-content">
            <p className="muted">PostgreSQL stores only anonymous UUIDs and ciphertext snapshots. Plaintext is decryptable solely inside this browser.</p>
            {summaries.length === 0 && <p className="muted">No encrypted conversations found.</p>}
            {summaries.map(s => (
              <button
                key={s.id}
                disabled={busy}
                className={`conversation ${opened?.state.id === s.id ? 'selected' : ''}`}
                onClick={() => void load(s.id)}
              >
                <strong>Session {s.id.slice(0, 8)}</strong>
                <span>{new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Revision {s.revision}</span>
              </button>
            ))}
            {opened?.row && (
              <div className="conv-actions">
                <button disabled={busy} onClick={() => void load(opened.state.id)}>Reload Snapshot</button>
                <button className="danger" onClick={() => void remove()}>Delete Session</button>
              </div>
            )}
            <hr />
            <h3>Cryptographic Security Lab</h3>
            <button disabled={busy} onClick={() => void testWrapper()}>Verify Key Wrapping Round-Trip</button>
            {probe && <p role="status" className="probe-result">{probe}</p>}
            <label className="probe-label">
              Wrapped Key Isolation Probe:
              <textarea
                aria-label="Probe Payload"
                rows={2}
                maxLength={70000}
                value={probeData}
                onChange={e => setProbeData(e.target.value)}
                placeholder="Generate probe above, or paste another user's probe to test isolation..."
              />
            </label>
            <button disabled={busy || !probeData} onClick={() => void checkForeignProbe()}>Test Foreign Probe Rejection</button>
            <button disabled={!opened?.row || busy} onClick={() => void testTamper()}>Simulate Ciphertext Tamper Attack (AES-GCM)</button>
            {tamperResult && <p role="status" className="probe-result">{tamperResult}</p>}
          </div>
        </aside>

        {/* COLUMN 2: SECURE CHAT & COMPOSER */}
        <section className="col-card chat-panel">
          <div className="card-head">
            <h2>Secure AI Conversation</h2>
            <label className="toggle">
              <input type="checkbox" checked={showReal} onChange={e => setShowReal(e.target.checked)} />
              Show Original Values (Client Unmasking)
            </label>
          </div>
          <div className="chat-body" aria-live="polite">
            {!opened?.state.turns.length && (
              <div className="empty">
                <h3>Zero-Trust Data Protection</h3>
                <p>All sensitive personal identifiers (CCCD, Bank Accounts, Phone, Email, Names) in prompts and attachments are pseudonymized in your browser before dispatch. Cloud LLMs and AI Admins never receive raw data.</p>
              </div>
            )}
            {opened?.state.turns.map(t => (
              <div key={t.id}>
                <article className="bubble user">
                  <strong>You ({showReal ? 'Client Decrypted View' : 'Sanitized View'})</strong>
                  <p>{showReal ? t.original : t.masked}</p>
                </article>
                {t.assistantRawMasked && (
                  <article className="bubble assistant">
                    <strong>{config.aiProvider === 'demo' ? 'PrivateChat AI Responder' : 'Google Gemini LLM'}</strong>
                    <p>{showReal ? unmaskText(t.assistantRawMasked, opened.state.pii) : t.assistantRawMasked}</p>
                    {unknownTokens(t.assistantRawMasked, opened.state.pii).length > 0 && (
                      <small>Model generated unmatched token. Preserved raw placeholder.</small>
                    )}
                  </article>
                )}
                {t.status !== 'complete' && (
                  <article className="bubble pending">
                    <p>{busy ? 'Encrypting and persisting snapshot…' : 'This turn did not complete.'}</p>
                    {!busy && <button onClick={() => void requestApproval(t)}>Retry Incomplete Turn</button>}
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
                onClick={() => resetInput(PRESET_EN)}
              >
                📋 Load Credit Dossier (English)
              </button>
              <button
                type="button"
                className="btn-preset"
                disabled={busy || !!unresolved}
                onClick={() => resetInput(PRESET_VI)}
              >
                📋 Nạp hồ sơ tín dụng (Tiếng Việt)
              </button>
            </div>

            <label className="file-upload-label">
              <span>Attach Confidential File (.pdf, images .png/.jpg, .txt, .csv, .md):</span>
              <input
                aria-label="Confidential File"
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
                    Remove File
                  </button>
                </div>
                {attachment.previewUrl && (
                  <div className="image-preview-container">
                    <img src={attachment.previewUrl} alt="Preview" className="img-attachment-preview" />
                  </div>
                )}
                <details className="file-content-details">
                  <summary>Extracted Content ({attachment.isImage ? 'Local OCR' : attachment.isPdf ? 'PDF Parser' : 'Text'}) — Processed on device</summary>
                  <pre>{attachment.text}</pre>
                </details>
              </div>
            )}

            <label htmlFor="chat-input">Prompt & Cloud AI Instructions</label>
            <textarea
              ref={inputRef}
              id="chat-input"
              value={input}
              onChange={e => resetInput(e.target.value)}
              maxLength={MAX_INPUT_CHARS}
              disabled={busy || !!unresolved}
              placeholder="Paste dossier, contract, or compliance request here (English or Vietnamese)..."
              rows={4}
            />

            <div className="composer-tools">
              <button type="button" disabled={busy || !input} onClick={selectManual}>
                ✂️ Mask Highlighted Span
              </button>
              <span className="muted">{combined.length}/{MAX_INPUT_CHARS} characters</span>
            </div>

            <label>Custom Names or Terms to Mask (comma-separated):
              <input
                value={names}
                onChange={e => setNames(e.target.value)}
                disabled={busy}
                placeholder="Lê Gia Khánh, Trần Trung Hiếu, Phạm Chấn Khoa, Cái Hoàng Bảo Kin"
              />
            </label>

            {preview.error && <p className="error-text">{preview.error}</p>}

            <div className="classification-row">
              <label>Intended Purpose:
                <select
                  aria-label="Intended Purpose"
                  value={purpose}
                  disabled={busy}
                  onChange={e => setPurpose(e.target.value as ApprovalProposal['purpose'])}
                >
                  <option value="summarize">Dossier Summarization</option>
                  <option value="extract">Structured Fact Extraction</option>
                  <option value="question">Confidential Q&A Inquiry</option>
                </select>
              </label>

              <label>Data Classification:
                <select
                  aria-label="Data Classification"
                  value={classification}
                  disabled={busy}
                  onChange={e => setClassification(e.target.value as ApprovalProposal['classification'])}
                >
                  <option value="confidential">Confidential (Requires Dual-Control Review)</option>
                  <option value="restricted">Restricted / Top Secret (Cloud AI Blocked)</option>
                </select>
              </label>
            </div>

            {fileError && <p role="alert" className="error-text">{fileError}</p>}

            <button
              className="primary btn-submit-approval"
              disabled={busy || !!unresolved || !combined.trim() || !preview.value || !!fileError || classification === 'restricted'}
            >
              🔒 Request Dual-Control Approval
            </button>

            {draft && (
              <div className="approval-status" data-testid="approval-status">
                <div className="status-header">
                  <strong>Approval Status: {approval ? (statusLabel[approval.status] ?? approval.status) : 'Checking...'}</strong>
                  <span className="approval-id">Request ID: {draft.approvalId.slice(0, 8)}</span>
                </div>
                {!matchesDraft && <p className="warning-text">Content was modified. A new approval request is required.</p>}
                <div className="approval-buttons">
                  <button type="button" disabled={busy} onClick={() => void refreshApproval()}>
                    🔄 Check Status
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={busy || !matchesDraft || approval?.status !== 'approved'}
                    onClick={() => void send()}
                  >
                    🚀 Dispatch Approved Payload to Cloud AI
                  </button>
                </div>
              </div>
            )}
          </form>
        </section>

        {/* COLUMN 3: PREVIEWS & SECURITY PROOFS */}
        <aside className="col-card">
          <div className="card-head">
            <h2>Governance & Audit Proofs</h2>
          </div>
          <div className="panel-content">
            <ApprovalQueue key={auth.identity?.ownerId} />
            <hr />
            <h3>Detected Sensitive Identifiers</h3>
            <div className="entities">
              {(!preview.value?.spans || preview.value.spans.length === 0) && (
                <p className="muted">No direct PII detected yet.</p>
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

            <div className="proof-section">
              <h3>Outbound Payload (What Cloud AI & Admin AI Sees)</h3>
              <p className="muted">Demonstrating 0.00% Raw PII Leakage to Cloud LLM Providers:</p>
              <pre data-testid="masked-preview">{preview.value?.masked || 'No outbound payload generated yet.'}</pre>
            </div>

            <div className="proof-section">
              <h3>Gateway Audit Envelope (Auditable Dispatch)</h3>
              <pre data-testid="gateway-request">
                {lastRequest ? JSON.stringify(lastRequest, null, 2) : 'No requests dispatched yet.'}
              </pre>
            </div>

            <div className="proof-section">
              <h3>Database Storage (PostgreSQL Ciphertext)</h3>
              <p className="muted">Privileged DB Admin sees only AES-256-GCM ciphertext without plaintext keys:</p>
              <pre data-testid="stored-ciphertext">
                {opened?.row
                  ? JSON.stringify({ id: opened.row.id, revision: opened.row.revision, iv: opened.row.iv, ciphertext: opened.row.encryptedState.slice(0, 140) + '…' }, null, 2)
                  : 'No database snapshot stored yet.'}
              </pre>
            </div>
          </div>
        </aside>
      </main>

      <footer>
        PrivateChat Shield — Zero-Trust AI Privacy & Dual-Control Governance Gateway. Team ComGa • RMIT Hackathon 2026.
      </footer>
    </div>
  );
}
