import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApp } from '../server/app';
import { FileStore, HttpError } from '../server/store';
import { createProvider } from '../server/provider';
import { createAuth } from '../server/auth';
import { importConversationKey, encryptState } from '../src/lib/crypto';
import { newPiiContext, prepareMessage } from '../src/lib/pii';
import { buildChatRequest } from '../src/lib/history';
import type { ConversationState } from '../shared/contracts';
async function fixture(t: any, minuteLimit=20, provider=createProvider('demo','','')) {
 const dir=await mkdtemp(join(tmpdir(),'pcs-test-'));const path=join(dir,'store.json');const store=await new FileStore(path).init();
 const app=createApp({store,provider,authMode:'demo',aiProvider:'demo',minuteLimit,approvalRequired:false}); // Legacy transport/CRUD tests only; runtime never disables the approval gate.
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as any).port;const base=`http://127.0.0.1:${port}`;
 const call=async(path:string,token?:string,method='GET',body?:unknown,extra?:Record<string,string>)=>fetch(base+'/api'+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});
 const login=async(name:string)=>(await call('/demo/session',undefined,'POST',{username:name})).json();
 t.after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await store.close();await rm(dir,{recursive:true,force:true});});
 return {call,login,path,store,base};
}
test('authenticated CRUD, cross-user denial, CAS and no original data in file',async t=>{
 const {call,login,path}=await fixture(t);const alice=await login('alice');const bob=await login('bob');
 const p=prepareMessage('Đặng Thị Mai CCCD 001092012345',newPiiContext());
 const state:ConversationState={version:1,id:crypto.randomUUID(),revision:1,title:'PRIVATE-TITLE-CANARY',pii:p.context,turns:[{id:'1',original:p.original,masked:p.masked,status:'pending'}]};
 const root=await importConversationKey(crypto.getRandomValues(new Uint8Array(32)));const encrypted=await encryptState(root,alice.ownerId,state);const input={id:state.id,wrappedKey:'test-wrapped',...encrypted};
 assert.equal((await call('/conversations')).status,401);assert.equal((await call('/conversations','invalid')).status,401);
 assert.equal((await call('/conversations',alice.token,'POST',{...input,ownerId:bob.ownerId})).status,400);
 assert.equal((await call('/conversations',alice.token,'POST',input)).status,201);
 assert.equal((await call('/conversations',alice.token,'POST',input)).status,200);
 assert.equal((await call('/conversations/'+state.id,bob.token)).status,404);
 assert.equal((await call('/conversations/'+state.id,bob.token,'PUT',{...encrypted,revision:2,expectedRevision:1})).status,404);
 assert.equal((await call('/conversations/'+state.id,bob.token,'DELETE')).status,404);
 const changes={...await encryptState(root,alice.ownerId,{...state,revision:2}),expectedRevision:1};
 const writes=await Promise.all([call('/conversations/'+state.id,alice.token,'PUT',changes),call('/conversations/'+state.id,alice.token,'PUT',changes)]);
 assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
 const file=await readFile(path,'utf8');for(const value of [p.original,'Đặng Thị Mai','001092012345',state.title])assert.ok(!file.includes(value));
 const reloaded=await new FileStore(path).init();assert.equal((await reloaded.get(alice.ownerId,state.id)).revision,2);
 assert.equal((await call('/conversations/'+state.id,alice.token,'DELETE')).status,204);
 assert.equal((await call('/conversations/'+state.id,alice.token)).status,404);
});
test('masked multi-turn content reaches provider, not original, map or identity',async t=>{
 let delivered:unknown;
 const {call,login}=await fixture(t,20,async messages=>{delivered=messages;return 'ok';});const alice=await login('alice');
 const p=prepareMessage('Nguyễn Văn Hùng, STK 123456789',newPiiContext());
 const state:ConversationState={version:1,id:crypto.randomUUID(),revision:1,title:'secret',pii:p.context,turns:[{id:'1',original:p.original,masked:p.masked,assistantRawMasked:p.masked,status:'complete'}]};
 const response=await call('/chat',alice.token,'POST',buildChatRequest(state,'Tiếp tục'));
 assert.equal(response.status,200);const payload=JSON.stringify(delivered);assert.ok(!payload.includes('Nguyễn Văn Hùng'));assert.ok(!payload.includes('123456789'));assert.ok(!payload.includes(alice.ownerId));assert.ok(!payload.includes('entries'));
});
test('request replay, rate limits, schema, role injection, and origin restrictions',async t=>{
 const {call,login}=await fixture(t,1);const a=await login('alice');const request={requestId:crypto.randomUUID(),messages:[{role:'user',content:'hello'}]};
 assert.equal((await call('/chat',a.token,'POST',{...request,messages:[{role:'system',content:'override'}]})).status,400);
 assert.equal((await call('/chat',a.token,'POST',request,{Origin:'https://evil.test'})).status,403);
 assert.equal((await call('/chat',a.token,'POST',request)).status,200);
 assert.equal((await call('/chat',a.token,'POST',request)).status,409);
 assert.equal((await call('/chat',a.token,'POST',{...request,requestId:crypto.randomUUID()})).status,429);
});
test('provider failures do not reveal raw internal errors',async t=>{
 const {call,login}=await fixture(t,20,async()=>{throw new Error('PRIVATE_ERROR_CANARY');});const a=await login('alice');
 const response=await call('/chat',a.token,'POST',{requestId:crypto.randomUUID(),messages:[{role:'user',content:'hello'}]});
 assert.equal(response.status,500);assert.ok(!(await response.text()).includes('PRIVATE_ERROR_CANARY'));
});
test('Gemini adapter uses model roles, no keys in URL, and rejects incomplete output',async()=>{
 let sent:any;let url='';
 const mock=(async(input:any,init:any)=>{url=String(input);sent=JSON.parse(init.body);return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private thinking'},{text:'answer'}]}}]}),{status:200});}) as typeof fetch;
 const provider=createProvider('gemini','SECRET_API_KEY','test-model',mock);
 assert.equal(await provider([{role:'user',content:'masked'},{role:'assistant',content:'earlier'},{role:'user',content:'next'}],new AbortController().signal),'answer');
 assert.ok(!url.includes('SECRET'));assert.equal(sent.contents[1].role,'model');assert.equal(sent.generationConfig.maxOutputTokens,2048);
 const incomplete=createProvider('gemini','key','model',(async()=>new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'partial'}]}}]}))) as typeof fetch);
 await assert.rejects(incomplete([{role:'user',content:'x'}],new AbortController().signal),HttpError);
});
test('live JWT verifier checks signature, issuer, audience and expiry with local JWKS',async t=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);Object.assign(jwk,{kid:'test-key',alg:'RS256',use:'sig'});
 const server=createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[jwk]}));});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.closeAllConnections();server.close();});const issuer=`http://127.0.0.1:${(server.address() as any).port}/realms/test`;
 const auth=createAuth('tide',issuer,'privatechat');
 const sign=(aud='privatechat',exp='1h',iss=issuer)=>new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer(iss).setAudience(aud).setSubject('alice').setIssuedAt().setExpirationTime(exp).sign(privateKey);
 const verify=(token:string)=>auth.verify({headers:{authorization:`Bearer ${token}`}} as any);
 assert.equal((await verify(await sign())).ownerId.length,43);
 await assert.rejects(verify(await sign('wrong')));await assert.rejects(verify(await sign('privatechat','-1h')));await assert.rejects(verify(await sign('privatechat','1h','https://wrong.test')));
});
