import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Pool } from 'pg';
import { proposalSchema } from '../shared/contracts';
import type { ApprovalProposal, ApprovalStatus, ApprovalView, Identity } from '../shared/contracts';
import { HttpError } from './store';

export interface ApprovalRecord extends Omit<ApprovalView, 'proposal'> { sealed: string | null }
export interface ApprovalRepository {
  insert(row: ApprovalRecord): Promise<void>;
  list(owner?: string): Promise<ApprovalRecord[]>;
  get(id: string): Promise<ApprovalRecord>;
  transition(id: string, from: ApprovalStatus, to: ApprovalStatus, now: number, reviewerId?: string): Promise<ApprovalRecord>;
  close(): Promise<void>;
}
// Single-process demo storage; live deployments use the PostgreSQL compare-and-swap below.
export class FileApprovalRepository implements ApprovalRepository {
  private rows: ApprovalRecord[] = []; private queue: Promise<unknown> = Promise.resolve();
  constructor(private path?: string) {}
  async init() {
    if (this.path) try { this.rows = JSON.parse(await readFile(this.path, 'utf8')); if (!Array.isArray(this.rows)) throw new Error('Invalid approval store'); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    return this;
  }
  private mutate<T>(fn: () => T): Promise<T> {
    const work = this.queue.then(async () => {
      const old = structuredClone(this.rows);
      try {
        const result = fn();
        if (this.path) { await mkdir(dirname(this.path), { recursive: true }); const temp = `${this.path}.${process.pid}.tmp`; await writeFile(temp, JSON.stringify(this.rows), { mode: 0o600 }); await rename(temp, this.path); }
        return structuredClone(result);
      } catch (e) { this.rows = old; throw e; }
    });
    this.queue = work.catch(() => {}); return work;
  }
  async insert(row: ApprovalRecord) {
    await this.mutate(() => {
      // Purge expired previews; retain only a bounded metadata audit in demo mode.
      for (const r of this.rows) if (r.expiresAt <= row.createdAt && ['pending', 'approved'].includes(r.status)) { r.status = 'expired'; r.sealed = null; }
      if (this.rows.filter(r => r.ownerId === row.ownerId && ['pending', 'approved'].includes(r.status)).length >= 20) throw new HttpError(429, 'TOO_MANY_APPROVALS');
      if (this.rows.some(r => r.id === row.id)) throw new HttpError(409, 'APPROVAL_CONFLICT');
      this.rows.push(row); if (this.rows.length > 5000) this.rows = this.rows.slice(-5000);
    });
  }
  async list(owner?: string) { await this.queue; return structuredClone(this.rows.filter(r => !owner || r.ownerId === owner).slice(-100).reverse()); }
  async get(id: string) { await this.queue; const row = this.rows.find(r => r.id === id); if (!row) throw new HttpError(404, 'NOT_FOUND'); return structuredClone(row); }
  async transition(id: string, from: ApprovalStatus, to: ApprovalStatus, now: number, reviewerId?: string) {
    return this.mutate(() => {
      const r = this.rows.find(r => r.id === id);
      if (!r) throw new HttpError(404, 'NOT_FOUND');
      if (r.expiresAt <= now) throw new HttpError(409, 'APPROVAL_EXPIRED');
      if (r.status !== from) throw new HttpError(409, 'APPROVAL_CONFLICT');
      r.status = to; if (reviewerId) r.reviewerId = reviewerId;
      if (to === 'consumed') r.consumedAt = now;
      if (['consumed', 'rejected'].includes(to)) r.sealed = null;
      return r;
    });
  }
  async close() { await this.queue; }
}
export class PostgresApprovalRepository implements ApprovalRepository {
  private pool: Pick<Pool, 'query' | 'end'>;
  constructor(url: string, database?: Pick<Pool, 'query' | 'end'>) { this.pool = database ?? new Pool({ connectionString: url, max: 5, statement_timeout: 5000 }); }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS file_approvals (id UUID PRIMARY KEY, owner_id TEXT NOT NULL, status TEXT NOT NULL, expires_at BIGINT NOT NULL, record JSONB NOT NULL);
      CREATE INDEX IF NOT EXISTS file_approvals_owner_idx ON file_approvals(owner_id);`); return this;
  }
  async insert(row: ApprovalRecord) {
    await this.pool.query(`UPDATE file_approvals SET status='expired', record=record || '{"status":"expired","sealed":null}'::jsonb WHERE expires_at <= $1 AND status IN ('pending','approved')`, [row.createdAt]);
    // Outstanding count is a queue abuse limit; the state transition below enforces one-use atomically.
    const result = await this.pool.query(`WITH admitted AS (SELECT $1::uuid AS id WHERE (SELECT count(*) FROM file_approvals WHERE owner_id=$2 AND status IN ('pending','approved') AND expires_at>$4) < 20)
      INSERT INTO file_approvals(id,owner_id,status,expires_at,record) SELECT id,$2,'pending',$3,$5::jsonb FROM admitted RETURNING id`, [row.id, row.ownerId, row.expiresAt, row.createdAt, JSON.stringify(row)]);
    if (!result.rowCount) throw new HttpError(429, 'TOO_MANY_APPROVALS');
  }
  async list(owner?: string) { return (await this.pool.query(`SELECT record FROM file_approvals ${owner ? 'WHERE owner_id=$1' : ''} ORDER BY (record->>'createdAt')::bigint DESC LIMIT 100`, owner ? [owner] : [])).rows.map(r => r.record as ApprovalRecord); }
  async get(id: string) { const r = (await this.pool.query('SELECT record FROM file_approvals WHERE id=$1', [id])).rows[0]; if (!r) throw new HttpError(404, 'NOT_FOUND'); return r.record as ApprovalRecord; }
  async transition(id: string, from: ApprovalStatus, to: ApprovalStatus, now: number, reviewerId?: string) {
    const patch = { status: to, ...(reviewerId ? { reviewerId } : {}), ...(to === 'consumed' ? { consumedAt: now } : {}), ...(['consumed', 'rejected'].includes(to) ? { sealed: null } : {}) };
    const out = await this.pool.query('UPDATE file_approvals SET status=$1, record=record || $2::jsonb WHERE id=$3 AND status=$4 AND expires_at>$5 RETURNING record', [to, JSON.stringify(patch), id, from, now]);
    if (!out.rowCount) { const r = await this.get(id); throw new HttpError(409, r.expiresAt <= now ? 'APPROVAL_EXPIRED' : 'APPROVAL_CONFLICT'); }
    return out.rows[0].record as ApprovalRecord;
  }
  async close() { await this.pool.end(); }
}
// A queue preview is deliberately visible to the gateway and authorized reviewer.
// Its server-owned key protects database-at-rest only; conversation originals use the independent client/Tide key.
export async function loadApprovalKey(mode: 'demo' | 'tide', value: string | undefined, path: string): Promise<Buffer> {
  if (value) { if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('APPROVAL_STORAGE_KEY must be 64 hex characters'); return Buffer.from(value, 'hex'); }
  if (mode === 'tide') throw new Error('APPROVAL_STORAGE_KEY is required for the review queue; no live fallback');
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, randomBytes(32), { mode: 0o600, flag: 'wx' }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
  const key = await readFile(path); if (key.length !== 32) throw new Error('Invalid demo approval key'); return key;
}
export class ApprovalService {
  constructor(public repository: ApprovalRepository, private key: Buffer, public provider: string, public model: string, private clock = Date.now) { if (key.length !== 32) throw new Error('Invalid approval key'); }
  digest(owner: string, proposal: ApprovalProposal) { return createHash('sha256').update(JSON.stringify([1, owner, this.provider, this.model, proposalSchema.parse(proposal)])).digest('hex'); }
  private seal(row: ApprovalView, proposal: ApprovalProposal) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, iv); cipher.setAAD(Buffer.from(JSON.stringify([row.id, row.ownerId, row.digest])));
    const ct = Buffer.concat([cipher.update(JSON.stringify(proposal)), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
  }
  private unseal(row: ApprovalRecord): ApprovalProposal {
    if (!row.sealed) throw new HttpError(409, 'APPROVAL_CONFLICT');
    try { const b = Buffer.from(row.sealed, 'base64'); const d = createDecipheriv('aes-256-gcm', this.key, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); d.setAAD(Buffer.from(JSON.stringify([row.id, row.ownerId, row.digest]))); return proposalSchema.parse(JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString())); }
    catch { throw new HttpError(409, 'APPROVAL_INTEGRITY_FAILED'); }
  }
  view(row: ApprovalRecord): ApprovalView {
    const { sealed: _, ...view } = row; return { ...view, status: row.expiresAt <= this.clock() && ['pending', 'approved'].includes(row.status) ? 'expired' : row.status };
  }
  async create(who: Identity, proposal: ApprovalProposal) {
    if (proposal.classification === 'restricted') throw new HttpError(403, 'RESTRICTED_CONTENT');
    const now = this.clock(); const view: ApprovalView = { id: randomUUID(), ownerId: who.ownerId, conversationId: proposal.conversationId, digest: this.digest(who.ownerId, proposal), status: 'pending', createdAt: now, expiresAt: now + 10 * 60000, reviewerId: null, consumedAt: null, provider: this.provider, model: this.model };
    await this.repository.insert({ ...view, sealed: this.seal(view, proposal) }); return view;
  }
  async list(who: Identity) { return (await this.repository.list(who.canApproveFiles ? undefined : who.ownerId)).map(r => this.view(r)); }
  async get(who: Identity, id: string) {
    const r = await this.repository.get(id); if (r.ownerId !== who.ownerId && !who.canApproveFiles) throw new HttpError(404, 'NOT_FOUND');
    const view = this.view(r); return { ...view, ...(['pending', 'approved'].includes(view.status) ? { proposal: this.unseal(r) } : {}) };
  }
  async decide(who: Identity, id: string, decision: 'approved' | 'rejected', digest: string) {
    if (!who.canApproveFiles) throw new HttpError(403, 'APPROVER_REQUIRED');
    const r = await this.repository.get(id);
    if (r.ownerId === who.ownerId) throw new HttpError(403, 'SELF_APPROVAL_DENIED');
    if (r.digest !== digest) throw new HttpError(409, 'APPROVAL_CHANGED');
    const p = this.unseal(r); if (this.digest(r.ownerId, p) !== r.digest) throw new HttpError(409, 'APPROVAL_INTEGRITY_FAILED');
    return this.view(await this.repository.transition(id, 'pending', decision, this.clock(), who.ownerId));
  }
  async consume(who: Identity, id: string, proposal: ApprovalProposal) {
    const r = await this.repository.get(id);
    if (r.ownerId !== who.ownerId) throw new HttpError(404, 'NOT_FOUND');
    if (r.provider !== this.provider || r.model !== this.model || r.digest !== this.digest(who.ownerId, proposal)) throw new HttpError(409, 'APPROVAL_CHANGED');
    if (r.expiresAt <= this.clock()) throw new HttpError(409, 'APPROVAL_EXPIRED');
    if (r.status !== 'approved' || !r.reviewerId || r.reviewerId === who.ownerId) throw new HttpError(403, 'APPROVAL_REQUIRED');
    const approved = this.unseal(r);
    if (this.digest(who.ownerId, approved) !== r.digest) throw new HttpError(409, 'APPROVAL_INTEGRITY_FAILED');
    await this.repository.transition(id, 'approved', 'consumed', this.clock()); // burn before any external side effect
    return approved.request;
  }
}
