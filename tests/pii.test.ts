import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPiiContext, prepareMessage, unmaskText } from '../src/lib/pii';
import { buildChatRequest } from '../src/lib/history';
import type { ConversationState } from '../shared/contracts';
test('Unicode names and bank/phone priority; monetary context remains usable', () => {
  const r = prepareMessage('Đặng Thị Mai, STK Vietcombank 0071000123456, SĐT 0912345678. Vay 2,5 tỷ đồng.', newPiiContext());
  assert.ok(r.spans.some(s => s.kind === 'NAME' && s.value === 'Đặng Thị Mai'));
  assert.ok(r.spans.some(s => s.kind === 'STK' && s.value === '0071000123456'));
  assert.ok(r.spans.some(s => s.kind === 'PHONE' && s.value === '0912345678'));
  assert.ok(r.masked.includes('2,5 tỷ đồng'));
});
test('stable identity, repeated mentions, and different people across turns', () => {
  const a = prepareMessage('Nguyễn Văn Hùng gặp Nguyễn Văn Hùng.', newPiiContext());
  assert.equal(a.spans[0].token, a.spans[1].token);
  const b = prepareMessage('Trần Thị Mai gặp Nguyễn Văn Hùng.', a.context);
  assert.notEqual(b.spans[0].token, a.spans[0].token); assert.equal(b.spans[1].token, a.spans[0].token);
});
test('manual dictionary, manual spans, formatted CCCD, short/long STK', () => {
  const text = 'nguyen van hung, CCCD 0010 9201 2345; STK 123456; STK 1234567890123456789';
  const r = prepareMessage(text, newPiiContext(), { names: ['nguyen van hung'] });
  assert.deepEqual(r.spans.map(s => s.kind), ['NAME','CCCD','STK','STK']);
  const manual = prepareMessage('Công ty bí mật', newPiiContext(), { manual: [{start:0,end:14,kind:'CUSTOM'}] });
  assert.equal(manual.spans.length, 1);
});
test('declining a mask never reuses an existing token ID', () => {
  const initial = newPiiContext();
  const preview = prepareMessage('Nguyễn Văn Hùng và Trần Thị Mai', initial);
  const first = preview.spans[0];
  const accepted = prepareMessage(preview.original, initial, { disabled:[`${first.start}:${first.end}`] });
  const next = prepareMessage('Đặng Thị Lan', accepted.context);
  assert.equal(new Set(next.context.entries.map(e => e.token)).size, next.context.entries.length);
});
test('unmask is exact, single pass and preserves dollar signs', () => {
  const r = prepareMessage('Nguyen $&', newPiiContext(), { manual:[{start:0,end:9,kind:'CUSTOM'}] });
  assert.equal(unmaskText(r.masked,r.context),'Nguyen $&');
  assert.equal(unmaskText('[NAME_1]',r.context),'[NAME_1]');
  assert.throws(() => prepareMessage(r.masked,r.context));
});
test('manually masked custom entities preserve their token in later turns', () => {
  const a = prepareMessage('Dự án TOPSECRET', newPiiContext(), { manual: [{ start: 6, end: 15, kind: 'CUSTOM' }] });
  const b = prepareMessage('Tiếp tục TOPSECRET', a.context);
  assert.equal(b.spans[0].token, a.spans[0].token);
});
test('three-turn request never uses original or displayed assistant text', () => {
  const canary='Đặng Thị Mai'; const a=prepareMessage(canary,newPiiContext());
  const state:ConversationState={version:1,id:crypto.randomUUID(),revision:1,title:'test',pii:a.context,turns:[{id:'1',original:canary,masked:a.masked,assistantRawMasked:`Xin chào ${a.masked}`,status:'complete'}]};
  const b=prepareMessage('Liệt kê giấy tờ.',a.context); const request=buildChatRequest(state,b.masked);
  assert.equal(request.messages.length,3); assert.ok(!JSON.stringify(request).includes(canary));
  state.turns.push({id:'2',original:'Liệt kê giấy tờ.',masked:b.masked,assistantRawMasked:'Cần giấy tờ.',status:'complete'});
  assert.equal(buildChatRequest(state,'Tiếp tục.').messages.length,5);
  state.turns.push({id:'3',original:'failed secret',masked:'masked',status:'failed'});
  assert.ok(!JSON.stringify(buildChatRequest(state,'Tiếp tục.')).includes('failed secret'));
});
