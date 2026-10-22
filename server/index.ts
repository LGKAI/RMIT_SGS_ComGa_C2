import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import express from 'express';
import { createApp } from './app';
import { FileStore, PostgresStore } from './store';
import { createProvider } from './provider';
import { resolveDpopAuthRequest } from '@tidecloak/js/dpop-server';
import { ApprovalService, FileApprovalRepository, PostgresApprovalRepository, loadApprovalKey } from './approvals';
if (existsSync('.env')) process.loadEnvFile('.env');
const mode = process.env.AUTH_MODE;
if (mode !== 'demo' && mode !== 'tide') throw new Error('Set AUTH_MODE=tide, or run npm run dev:demo explicitly');
if (mode === 'tide' && !process.env.DATABASE_URL) throw new Error('Live mode requires DATABASE_URL');
const ai = process.env.AI_PROVIDER;
if (ai !== 'demo' && ai !== 'gemini') throw new Error('Set AI_PROVIDER=demo or gemini');
if (mode === 'tide' && (!process.env.TIDE_ISSUER || !process.env.TIDE_AUDIENCE)) throw new Error('TIDE_ISSUER and TIDE_AUDIENCE are required');
const provider = createProvider(ai, process.env.GEMINI_API_KEY ?? '', process.env.GEMINI_MODEL ?? '');
const store = process.env.DATABASE_URL ? await new PostgresStore(process.env.DATABASE_URL).init() : await new FileStore(process.env.DEMO_DATA_FILE ?? '.data/demo-conversations.json').init();
const approvalPath = process.env.DEMO_APPROVAL_FILE ?? `${process.env.DEMO_DATA_FILE ?? '.data/demo-conversations.json'}.approvals`;
const approvalRepo = process.env.DATABASE_URL ? await new PostgresApprovalRepository(process.env.DATABASE_URL).init() : await new FileApprovalRepository(approvalPath).init();
const approvalKey = await loadApprovalKey(mode, process.env.APPROVAL_STORAGE_KEY, `${approvalPath}.key`);
const model = ai === 'demo' ? 'demo-template' : process.env.GEMINI_MODEL!;
const approvals = new ApprovalService(approvalRepo, approvalKey, ai, model);
const app = createApp({ store, provider, approvals, model, authMode: mode, aiProvider: ai, issuer: process.env.TIDE_ISSUER, audience: process.env.TIDE_AUDIENCE, origin: process.env.APP_ORIGIN, timeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS ?? 30000), minuteLimit: Number(process.env.CHAT_REQUESTS_PER_MINUTE ?? 10), dayLimit: Number(process.env.CHAT_REQUESTS_PER_DAY ?? 100) });
app.use((req, res, next) => {
  const result = resolveDpopAuthRequest({ pathname: req.originalUrl, method: req.method, expectedIssuer: process.env.TIDE_ISSUER, expectedClient: process.env.TIDE_AUDIENCE });
  if (!result) return next();
  // This narrowly scoped SDK page must be embedded by the Tide enclave.
  res.removeHeader('X-Frame-Options');
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.status(result.status).send(result.body ?? '');
});
const silentSsoHash = createHash('sha256').update('parent.postMessage(location.href, location.origin)').digest('base64');
app.use((_req, res, next) => {
  res.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'sha256-${silentSsoHash}'; style-src 'self'; img-src 'self' data:; connect-src 'self' ${process.env.TIDE_ISSUER ? new URL(process.env.TIDE_ISSUER).origin : ''}; frame-src 'self' ${process.env.TIDE_ISSUER ? new URL(process.env.TIDE_ISSUER).origin : ''} https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`); next();
});
if (existsSync('dist/index.html')) { app.use(express.static('dist', { etag: false })); app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html'))); }
const server = app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1', () => console.log(`PrivateChat API: http://localhost:${process.env.PORT ?? 3001} | auth=${mode} ai=${ai} storage=${store.kind}`));
let stopping = false;
async function stop() { if (stopping) return; stopping = true; server.close(); server.closeAllConnections(); await Promise.all([store.close(), approvalRepo.close()]); }
process.on('SIGTERM', () => void stop()); process.on('SIGINT', () => void stop());
