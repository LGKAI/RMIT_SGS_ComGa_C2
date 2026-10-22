import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptState, decryptState, importConversationKey, demoWrap, demoUnwrap, ownerId, fromBase64, toBase64 } from '../src/lib/crypto';
import { makeOwnerId } from '../server/auth';
import { newPiiContext } from '../src/lib/pii';
import type { ConversationRow, ConversationState } from '../shared/contracts';
const sample = ():ConversationState=>({version:1,id:crypto.randomUUID(),revision:1,title:'secret title',pii:newPiiContext(),turns:[]});
test('client/server owner IDs match, HKDF key is not extractable, ciphertext has no plaintext',async()=>{
 const owner=await ownerId('issuer','alice');assert.equal(owner,makeOwnerId('issuer','alice'));
 const root=await importConversationKey(crypto.getRandomValues(new Uint8Array(32)));assert.equal(root.extractable,false);
 const state=sample(); const encrypted=await encryptState(root,owner,state);
 const row:ConversationRow={...encrypted,id:state.id,ownerId:owner,wrappedKey:'test',createdAt:'',updatedAt:''};
 assert.deepEqual(await decryptState(root,owner,row),state);assert.ok(!row.encryptedState.includes('secret title'));
 const again=await encryptState(root,owner,state);assert.notEqual(encrypted.iv,again.iv);
});
test('tamper, swapped conversation, owner, and wrong revision fail authentication',async()=>{
 const key=await importConversationKey(crypto.getRandomValues(new Uint8Array(32)));const s=sample();
 const row:ConversationRow={...await encryptState(key,'alice',s),id:s.id,ownerId:'alice',wrappedKey:'x',createdAt:'',updatedAt:''};
 const bytes=fromBase64(row.encryptedState);bytes[0]^=1;
 for(const mutation of [{encryptedState:toBase64(bytes)},{id:crypto.randomUUID()},{revision:2},{ownerId:'bob'}])await assert.rejects(decryptState(key,'alice',{...row,...mutation}));
});
test('full snapshot rollback remains valid: do not claim freshness',async()=>{
 const key=await importConversationKey(crypto.getRandomValues(new Uint8Array(32)));const s=sample();const old=await encryptState(key,'alice',s);
 await encryptState(key,'alice',{...s,revision:2});
 assert.equal((await decryptState(key,'alice',{...old,id:s.id,ownerId:'alice',wrappedKey:'x',createdAt:'',updatedAt:''})).revision,1);
});
test('explicit demo wrapping rejects wrong passphrase, owner, or conversation',async()=>{
 const raw=crypto.getRandomValues(new Uint8Array(32));const id=crypto.randomUUID();const wrapped=await demoWrap(raw,'synthetic-password','alice',id);
 assert.deepEqual(await demoUnwrap(wrapped,'synthetic-password','alice',id),raw);
 await assert.rejects(demoUnwrap(wrapped,'wrong-password','alice',id));
 await assert.rejects(demoUnwrap(wrapped,'synthetic-password','bob',id));
 await assert.rejects(demoUnwrap(wrapped,'synthetic-password','alice',crypto.randomUUID()));
 assert.ok(!wrapped.includes(toBase64(raw)));
});
