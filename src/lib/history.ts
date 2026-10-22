import { MAX_CONTEXT_CHARS } from '../../shared/contracts';
import type { ConversationState, ChatRequest } from '../../shared/contracts';
export function buildChatRequest(state: ConversationState, masked: string): ChatRequest {
  const completed = state.turns.filter(t => t.status === 'complete' && t.assistantRawMasked);
  const messages: ChatRequest['messages'] = [];
  let size = masked.length;
  if (size > MAX_CONTEXT_CHARS) throw new Error('Tin nhắn vượt giới hạn context.');
  for (const t of [...completed].reverse()) {
    const extra = t.masked.length + t.assistantRawMasked!.length;
    if (size + extra > MAX_CONTEXT_CHARS || messages.length >= 38) break;
    messages.unshift({ role: 'user', content: t.masked }, { role: 'assistant', content: t.assistantRawMasked! }); size += extra;
  }
  messages.push({ role: 'user', content: masked });
  return { requestId: crypto.randomUUID(), messages };
}
