import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Pool } from 'pg';
import type { ConversationRow } from '../shared/contracts';
export class HttpError extends Error { constructor(public status: number, public code: string) { super(code); } }
export interface Store {
  kind: 'file-demo' | 'postgres';
  list(owner: string): Promise<ConversationRow[]>;
  get(owner: string, id: string): Promise<ConversationRow>;
  create(row: ConversationRow): Promise<ConversationRow>;
  update(owner: string, id: string, expected: number, changes: Pick<ConversationRow, 'revision' | 'iv' | 'encryptedState'>): Promise<ConversationRow>;
  delete(owner: string, id: string): Promise<void>;
  close(): Promise<void>;
}
export class FileStore implements Store {
  kind = 'file-demo' as const; private rows: ConversationRow[] = []; private queue: Promise<unknown> = Promise.resolve();
  constructor(private path: string) {}
  async init() {
    try { this.rows = JSON.parse(await readFile(this.path, 'utf8')); if (!Array.isArray(this.rows)) throw new Error('Invalid store'); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    return this;
  }
  private async mutate<T>(fn: () => T): Promise<T> {
    const work = this.queue.then(async () => {
      const old = structuredClone(this.rows);
      try {
        const result = fn(); await mkdir(dirname(this.path), { recursive: true });
        const tmp = `${this.path}.${process.pid}.tmp`;
        await writeFile(tmp, JSON.stringify(this.rows), { mode: 0o600 }); await rename(tmp, this.path);
        return structuredClone(result);
      } catch (e) { this.rows = old; throw e; }
    });
    this.queue = work.catch(() => {}); return work;
  }
  async list(owner: string) { await this.queue; return structuredClone(this.rows.filter(r => r.ownerId === owner).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); }
  async get(owner: string, id: string) { await this.queue; const r = this.rows.find(r => r.id === id && r.ownerId === owner); if (!r) throw new HttpError(404, 'NOT_FOUND'); return structuredClone(r); }
  async create(row: ConversationRow) { return this.mutate(() => { if (this.rows.some(r => r.id === row.id)) throw new HttpError(409, 'ALREADY_EXISTS'); this.rows.push(row); return row; }); }
  async update(owner: string, id: string, expected: number, changes: Pick<ConversationRow, 'revision' | 'iv' | 'encryptedState'>) {
    return this.mutate(() => { const row = this.rows.find(r => r.id === id && r.ownerId === owner); if (!row) throw new HttpError(404, 'NOT_FOUND'); if (row.revision !== expected) throw new HttpError(409, 'REVISION_CONFLICT'); Object.assign(row, changes, { updatedAt: new Date().toISOString() }); return row; });
  }
  async delete(owner: string, id: string) { await this.mutate(() => { const i = this.rows.findIndex(r => r.id === id && r.ownerId === owner); if (i < 0) throw new HttpError(404, 'NOT_FOUND'); this.rows.splice(i, 1); }); }
  async close() { await this.queue; }
}
const sql = `CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY, owner_id TEXT NOT NULL, wrapped_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0), iv TEXT NOT NULL, encrypted_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
); CREATE INDEX IF NOT EXISTS conversations_owner_idx ON conversations(owner_id);`;
function decode(r: Record<string, any>): ConversationRow {
  return { id: r.id, ownerId: r.owner_id, wrappedKey: r.wrapped_key, revision: r.revision, iv: r.iv, encryptedState: r.encrypted_state, createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString() };
}
export class PostgresStore implements Store {
  kind = 'postgres' as const; private pool: Pick<Pool, 'query' | 'end'>;
  constructor(url: string, database?: Pick<Pool, 'query' | 'end'>) { this.pool = database ?? new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 5000 }); }
  async init() { await this.pool.query(sql); return this; }
  async list(owner: string) { return (await this.pool.query('SELECT * FROM conversations WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 200', [owner])).rows.map(decode); }
  async get(owner: string, id: string) { const r = (await this.pool.query('SELECT * FROM conversations WHERE id=$1 AND owner_id=$2', [id, owner])).rows[0]; if (!r) throw new HttpError(404, 'NOT_FOUND'); return decode(r); }
  async create(r: ConversationRow) {
    const out = await this.pool.query('INSERT INTO conversations(id,owner_id,wrapped_key,revision,iv,encrypted_state) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING *', [r.id, r.ownerId, r.wrappedKey, r.revision, r.iv, r.encryptedState]);
    if (!out.rows[0]) throw new HttpError(409, 'ALREADY_EXISTS'); return decode(out.rows[0]);
  }
  async update(owner: string, id: string, expected: number, c: Pick<ConversationRow, 'revision' | 'iv' | 'encryptedState'>) {
    const out = await this.pool.query('UPDATE conversations SET revision=$1,iv=$2,encrypted_state=$3,updated_at=NOW() WHERE id=$4 AND owner_id=$5 AND revision=$6 RETURNING *', [c.revision, c.iv, c.encryptedState, id, owner, expected]);
    if (!out.rows[0]) { await this.get(owner, id); throw new HttpError(409, 'REVISION_CONFLICT'); } return decode(out.rows[0]);
  }
  async delete(owner: string, id: string) { if (!(await this.pool.query('DELETE FROM conversations WHERE id=$1 AND owner_id=$2', [id, owner])).rowCount) throw new HttpError(404, 'NOT_FOUND'); }
  async close() { await this.pool.end(); }
}
