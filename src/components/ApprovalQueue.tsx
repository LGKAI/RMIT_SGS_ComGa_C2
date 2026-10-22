import { useEffect, useState } from 'react';
import { useAuth } from '../auth/Auth';
import { api } from '../lib/api';
import type { ApprovalView } from '../../shared/contracts';
export const statusLabel = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', consumed: 'Đã sử dụng', expired: 'Hết hạn' };
export function ApprovalQueue() {
  const auth = useAuth(); const [rows, setRows] = useState<ApprovalView[]>([]); const [selected, setSelected] = useState<ApprovalView | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function refresh() { setError(''); try { const token = await auth.getToken(); setRows(await api('/approvals', token)); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { void refresh(); }, [auth.identity?.ownerId]);
  async function review(id: string) { setBusy(true); try { setSelected(await api(`/approvals/${id}`, await auth.getToken())); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function decide(decision: 'approved' | 'rejected') {
    if (!selected) return; setBusy(true); setError('');
    try { setSelected(await api(`/approvals/${selected.id}/decision`, await auth.getToken(), { method: 'POST', body: { decision, digest: selected.digest } })); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="approval-queue"><h3>{auth.identity?.canApproveFiles ? 'Hàng đợi người duyệt' : 'Yêu cầu phê duyệt của tôi'}</h3>
    <button disabled={busy} onClick={() => void refresh()}>Tải danh sách duyệt</button>
    {rows.length === 0 && <p>Chưa có yêu cầu.</p>}
    {rows.map(r => <button key={r.id} className="approval-item" disabled={busy} onClick={() => void review(r.id)}><strong>{r.id.slice(0, 8)} · {statusLabel[r.status]}</strong><span>{r.provider}/{r.model} · {new Date(r.expiresAt).toLocaleTimeString('vi-VN')}</span></button>)}
    {selected && <div data-testid="approval-review"><h4>Kiểm tra trước khi quyết định</h4><p>{statusLabel[selected.status]} · {selected.provider}/{selected.model}</p><small>Mã đối chiếu: {selected.digest.slice(0, 16)}</small>
      {selected.proposal && <><p>Mục đích: {selected.proposal.purpose} · Phân loại: {selected.proposal.classification} · {selected.proposal.files.length} file</p><pre>{JSON.stringify(selected.proposal.request.messages, null, 2)}</pre></>}
      {auth.identity?.canApproveFiles && selected.ownerId !== auth.identity.ownerId && selected.status === 'pending' && <><button className="primary" disabled={busy} onClick={() => void decide('approved')}>Duyệt nội dung này</button><button className="danger" disabled={busy} onClick={() => void decide('rejected')}>Từ chối nội dung này</button></>}
      {selected.ownerId === auth.identity?.ownerId && <p className="muted">Người gửi không được tự duyệt.</p>}
    </div>}{error && <p role="alert">{error}</p>}
  </section>;
}
