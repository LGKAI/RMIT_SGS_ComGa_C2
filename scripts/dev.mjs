import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const tideDemo = process.argv.includes('--tide-demo');
const demo = !tideDemo && (process.argv.includes('--demo') || !process.argv.includes('--live'));
if (process.argv.includes('--postgres') && !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env first');
const env = { ...process.env, AUTH_MODE: demo ? 'demo' : 'tide', AI_PROVIDER: tideDemo ? 'demo' : process.argv.includes('--gemini') || !demo ? 'gemini' : 'demo', ...(demo && !process.argv.includes('--postgres') ? { DATABASE_URL: '' } : {}) };
const children = [spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { stdio: 'inherit', env }), spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit', env })];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const p of children) p.kill('SIGTERM'); process.exitCode = code; }
for (const p of children) p.on('exit', code => stop(code ?? 0));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
