import { z } from 'zod';
export const MAX_CIPHERTEXT_BYTES = 256 * 1024;
export const MAX_TURNS = 20;
export const MAX_INPUT_CHARS = 12000;
export const MAX_CONTEXT_CHARS = 32000;
const base64 = z.string().min(1).max(360000).regex(/^[A-Za-z0-9+/]*={0,2}$/).refine(v => v.length % 4 === 0);
export const snapshotSchema = z.object({
  revision: z.number().int().positive().max(2147483647),
  iv: base64.refine(v => Buffer.from(v, 'base64').length === 12, 'IV must be 12 bytes'),
  encryptedState: base64.refine(v => { const n = Buffer.from(v, 'base64').length; return n >= 16 && n <= MAX_CIPHERTEXT_BYTES; }),
}).strict();
export const createSchema = snapshotSchema.extend({ id: z.string().uuid(), wrappedKey: z.string().min(1).max(65536), revision: z.literal(1) }).strict();
export const updateSchema = snapshotSchema.extend({ expectedRevision: z.number().int().positive() }).strict()
  .refine(v => v.revision === v.expectedRevision + 1, 'Revision must increase by one');
export const chatSchema = z.object({
  requestId: z.string().uuid(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(MAX_CONTEXT_CHARS) }).strict()).min(1).max(40),
}).strict().refine(v => v.messages.reduce((n, m) => n + m.content.length, 0) <= MAX_CONTEXT_CHARS, 'Context too large')
  .refine(v => v.messages.every((m, i) => m.role === (i % 2 === 0 ? 'user' : 'assistant')) && v.messages.at(-1)?.role === 'user', 'Expected alternating turns ending with user');
export type Snapshot = z.infer<typeof snapshotSchema>;
export type ConversationRow = Snapshot & { id: string; ownerId: string; wrappedKey: string; createdAt: string; updatedAt: string };
export type ChatRequest = z.infer<typeof chatSchema>;
export type PiiKind = 'NAME' | 'CCCD' | 'PHONE' | 'STK' | 'EMAIL' | 'CUSTOM';
export interface PiiEntry { token: string; value: string; kind: PiiKind }
export interface PiiContext { namespace: string; entries: PiiEntry[] }
export interface Turn { id: string; original: string; masked: string; assistantRawMasked?: string; status: 'pending' | 'complete' | 'failed' }
export interface ConversationState { version: 1; id: string; revision: number; title: string; pii: PiiContext; turns: Turn[]; approvalDraft?: ApprovalDraft }
export interface Identity { ownerId: string; username: string; token: string; canApproveFiles: boolean }
export interface PublicConfig { authMode: 'demo' | 'tide'; aiProvider: 'demo' | 'gemini'; storage: 'file-demo' | 'postgres'; tideIssuer: string; tag: string; approvalRequired: boolean; model: string }
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const APPROVER_ROLE = 'file-approver';
export const fileSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive().max(MAX_FILE_BYTES),
  mediaType: z.enum([
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
  ]),
}).strict();
export const proposalSchema = z.object({
  conversationId: z.string().uuid(), request: chatSchema,
  files: z.array(fileSchema).max(1), purpose: z.enum(['summarize', 'extract', 'question']),
  classification: z.enum(['confidential', 'restricted']),
}).strict();
export const dispatchSchema = z.object({ approvalId: z.string().uuid(), proposal: proposalSchema }).strict();
export type ApprovalProposal = z.infer<typeof proposalSchema>;
export type FileManifest = z.infer<typeof fileSchema>;
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'consumed' | 'expired';
export interface ApprovalView {
  id: string; ownerId: string; conversationId: string; digest: string; status: ApprovalStatus;
  createdAt: number; expiresAt: number; reviewerId: string | null; consumedAt: number | null;
  provider: string; model: string; proposal?: ApprovalProposal;
}
export interface ApprovalDraft {
  approvalId: string; proposal: ApprovalProposal; original: string; masked: string; prompt: string; names: string;
  attachment: { name: string; text: string; manifest: FileManifest } | null;
  disabled: string[]; manual: { start: number; end: number; kind: PiiKind }[]; retryId?: string;
}
