import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { chatSchema, createSchema, updateSchema, proposalSchema, dispatchSchema } from '../shared/contracts';
import type { ApprovalService } from './approvals';
import type { Identity } from '../shared/contracts';
import { createAuth } from './auth';
import { HttpError } from './store';
import type { Store } from './store';
import type { Provider } from './provider';
export interface AppOptions { store: Store; provider: Provider; authMode: 'demo' | 'tide'; aiProvider: 'demo' | 'gemini'; issuer?: string; audience?: string; origin?: string; timeoutMs?: number; minuteLimit?: number; dayLimit?: number; approvals?: ApprovalService; approvalRequired?: boolean; model?: string }
export function createApp(options: AppOptions) {
  if (options.authMode === 'demo' && process.env.NODE_ENV === 'production') throw new Error('Demo auth is disabled in production');
  const app = express(); app.disable('x-powered-by');
  const approvalRequired = options.approvalRequired ?? true;
  if (approvalRequired && !options.approvals) throw new Error('Approval service is required; no ungated fallback');
  const origin = options.origin ?? 'http://localhost:5173';
  const auth = createAuth(options.authMode, options.issuer ?? '', options.audience ?? '', options.authMode === 'tide' ? origin : undefined);
  const origins = new Set([origin, origin.replace('localhost', '127.0.0.1')]);
  const counts = new Map<string, { minute: number; day: number; minuteCount: number; dayCount: number }>();
  const requests = new Map<string, number>();
  const logins = new Map<string, { count: number; until: number }>();
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' });
    if (req.headers.origin && !origins.has(req.headers.origin)) return res.status(403).json({ error: 'ORIGIN_DENIED' });
    next();
  });
  app.use(express.json({ limit: '512kb', strict: true }));
  app.get('/api/config', (_req, res) => res.json({ authMode: options.authMode, aiProvider: options.aiProvider, storage: options.store.kind, tideIssuer: options.issuer ?? '', tag: 'chat', approvalRequired, model: options.model ?? (options.aiProvider === 'demo' ? 'demo-template' : '') }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/demo/session', async (req, res) => {
    if (options.authMode !== 'demo') throw new HttpError(404, 'NOT_FOUND');
    const key = req.ip ?? 'local'; const time = Date.now();
    for (const [k, v] of logins) if (v.until < time) logins.delete(k);
    const old = logins.get(key) ?? { count: 0, until: time + 60000 }; old.count++; logins.set(key, old);
    if (old.count > 20 || logins.size > 1000) throw new HttpError(429, 'RATE_LIMITED');
    const { username } = z.object({ username: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/) }).strict().parse(req.body);
    res.json(await auth.demoLogin(username));
  });
  app.use('/api', async (req, res, next) => { try { res.locals.identity = await auth.verify(req); next(); } catch (e) { next(e); } });
  const identity = (res: express.Response) => res.locals.identity as Identity;
  const id = (req: express.Request) => z.string().uuid().parse(req.params.id);
  app.get('/api/me', (_req, res) => { const { token: _token, ...me } = identity(res); res.json(me); });
  app.get('/api/conversations', async (_req, res) => res.json((await options.store.list(identity(res).ownerId)).map(({ id, revision, createdAt, updatedAt }) => ({ id, revision, createdAt, updatedAt }))));
  app.post('/api/conversations', async (req, res) => {
    const input = createSchema.parse(req.body); const ownerId = identity(res).ownerId; const timestamp = new Date().toISOString();
    try { res.status(201).json(await options.store.create({ ...input, ownerId, createdAt: timestamp, updatedAt: timestamp })); }
    catch (e) {
      if (e instanceof HttpError && e.status === 409) {
        const old = await options.store.get(ownerId, input.id);
        if (old.wrappedKey === input.wrappedKey && old.iv === input.iv && old.encryptedState === input.encryptedState && old.revision === 1) return res.status(200).json(old);
      } throw e;
    }
  });
  app.get('/api/conversations/:id', async (req, res) => res.json(await options.store.get(identity(res).ownerId, id(req))));
  app.put('/api/conversations/:id', async (req, res) => { const { expectedRevision, ...changes } = updateSchema.parse(req.body); res.json(await options.store.update(identity(res).ownerId, id(req), expectedRevision, changes)); });
  app.delete('/api/conversations/:id', async (req, res) => { await options.store.delete(identity(res).ownerId, id(req)); res.status(204).end(); });
  app.get('/api/approvals', async (_req, res) => { if (!options.approvals) throw new HttpError(404, 'NOT_FOUND'); res.json(await options.approvals.list(identity(res))); });
  app.post('/api/approvals', async (req, res) => {
    if (!options.approvals) throw new HttpError(404, 'NOT_FOUND');
    const p = proposalSchema.parse(req.body); await options.store.get(identity(res).ownerId, p.conversationId);
    res.status(201).json(await options.approvals.create(identity(res), p));
  });
  app.get('/api/approvals/:id', async (req, res) => { if (!options.approvals) throw new HttpError(404, 'NOT_FOUND'); res.json(await options.approvals.get(identity(res), id(req))); });
  app.post('/api/approvals/:id/decision', async (req, res) => {
    if (!options.approvals) throw new HttpError(404, 'NOT_FOUND');
    const p = z.object({ decision: z.enum(['approved', 'rejected']), digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(req.body);
    res.json(await options.approvals.decide(identity(res), id(req), p.decision, p.digest));
  });
  app.post('/api/chat', async (req, res) => {
    const dispatch = approvalRequired ? dispatchSchema.parse(req.body) : null;
    let input = dispatch ? dispatch.proposal.request : chatSchema.parse(req.body); const owner = identity(res).ownerId; const now = Date.now();
    for (const [k, v] of requests) if (v < now) requests.delete(k);
    for (const [k, v] of counts) if (v.day !== Math.floor(now / 86400000)) counts.delete(k);
    if (requests.size > 10000 || counts.size > 10000) throw new HttpError(429, 'RATE_LIMITED');
    const requestKey = `${owner}:${input.requestId}`;
    if (requests.has(requestKey)) throw new HttpError(409, 'DUPLICATE_REQUEST');
    const minute = Math.floor(now / 60000); const day = Math.floor(now / 86400000);
    const count = counts.get(owner) ?? { minute, day, minuteCount: 0, dayCount: 0 };
    if (count.minute !== minute) { count.minute = minute; count.minuteCount = 0; }
    if (count.minuteCount >= (options.minuteLimit ?? 10) || count.dayCount >= (options.dayLimit ?? 100)) throw new HttpError(429, 'RATE_LIMITED');
    if (dispatch) {
      await options.store.get(owner, dispatch.proposal.conversationId);
      input = await options.approvals!.consume(identity(res), dispatch.approvalId, dispatch.proposal);
    }
    count.minuteCount++; count.dayCount++; counts.set(owner, count); requests.set(requestKey, now + 3600000);
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(options.timeoutMs ?? 30000)]);
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    const text = await options.provider(input.messages, signal);
    if (!res.destroyed) res.json({ requestId: input.requestId, text, provider: options.aiProvider });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (res.headersSent) return;
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'INVALID_REQUEST' }); return; }
    if (err instanceof HttpError) { res.status(err.status).json({ error: err.code }); return; }
    if (err?.type === 'entity.too.large') { res.status(413).json({ error: 'BODY_TOO_LARGE' }); return; }
    if (err instanceof SyntaxError) { res.status(400).json({ error: 'INVALID_JSON' }); return; }
    // Never include raw error, body, token, URL with credentials, or provider response in logs.
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  };
  app.use(errorHandler); return app;
}
