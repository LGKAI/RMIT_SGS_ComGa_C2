import { useEffect, useState } from 'react';
import { useAuth } from '../auth/Auth';
import { api } from '../lib/api';
import type { ApprovalView } from '../../shared/contracts';

export const statusLabel: Record<string, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  consumed: 'Consumed',
  expired: 'Expired',
};

export function ApprovalQueue() {
  const auth = useAuth();
  const [rows, setRows] = useState<ApprovalView[]>([]);
  const [selected, setSelected] = useState<ApprovalView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setError('');
    try {
      const token = await auth.getToken();
      setRows(await api('/approvals', token));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void refresh();
  }, [auth.identity?.ownerId]);

  async function review(id: string) {
    setBusy(true);
    try {
      setSelected(await api(`/approvals/${id}`, await auth.getToken()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: 'approved' | 'rejected') {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      setSelected(
        await api(`/approvals/${selected.id}/decision`, await auth.getToken(), {
          method: 'POST',
          body: { decision, digest: selected.digest },
        })
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="approval-queue">
      <div className="section-header-compact">
        <h3>{auth.identity?.canApproveFiles ? '🛡️ Reviewer Approval Queue' : '📋 Outbound Review Queue'}</h3>
        <button className="btn-sm" disabled={busy} onClick={() => void refresh()}>
          🔄 Refresh
        </button>
      </div>

      {rows.length === 0 && <p className="muted">No outbound requests in queue.</p>}

      <div className="approval-items-list">
        {rows.map(r => (
          <button
            key={r.id}
            className={`approval-item ${selected?.id === r.id ? 'active' : ''}`}
            disabled={busy}
            onClick={() => void review(r.id)}
          >
            <div className="approval-item-top">
              <strong>Request {r.id.slice(0, 8)}</strong>
              <span className={`status-badge status-${r.status}`}>{statusLabel[r.status] ?? r.status}</span>
            </div>
            <span>Target: {r.provider}/{r.model} · Expires: {new Date(r.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div data-testid="approval-review" className="approval-review-card">
          <h4>Pre-Dispatch Inspection</h4>
          <p className="review-meta">
            Status: <span className={`status-badge status-${selected.status}`}>{statusLabel[selected.status] ?? selected.status}</span> · AI Engine: {selected.provider}/{selected.model}
          </p>
          <small className="digest-code">Digest: {selected.digest.slice(0, 20)}…</small>

          {selected.proposal && (
            <div className="review-proposal">
              <p>
                <strong>Purpose:</strong> {selected.proposal.purpose} | <strong>Classification:</strong> {selected.proposal.classification} | <strong>Files:</strong> {selected.proposal.files.length}
              </p>
              <pre>{JSON.stringify(selected.proposal.request.messages, null, 2)}</pre>
            </div>
          )}

          {auth.identity?.canApproveFiles && selected.ownerId !== auth.identity.ownerId && selected.status === 'pending' && (
            <div className="review-actions">
              <button className="primary" disabled={busy} onClick={() => void decide('approved')}>
                ✅ Approve Outbound Payload
              </button>
              <button className="danger" disabled={busy} onClick={() => void decide('rejected')}>
                ❌ Reject Outbound Payload
              </button>
            </div>
          )}

          {selected.ownerId === auth.identity?.ownerId && (
            <p className="muted notice-self-approval">
              ⚠️ Separation of Duties enforced: As the requester, you cannot self-approve. Switch to <strong>Cái Hoàng Bảo Kin</strong> to approve.
            </p>
          )}
        </div>
      )}

      {error && <p role="alert" className="error-text">{error}</p>}
    </section>
  );
}
