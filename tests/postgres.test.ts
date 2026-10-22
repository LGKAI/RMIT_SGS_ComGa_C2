import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PostgresStore } from '../server/store';
import type { ConversationRow } from '../shared/contracts';
import { encryptState, decryptState, importConversationKey, fromBase64, toBase64 } from '../src/lib/crypto';
import { newPiiContext } from '../src/lib/pii';
test('Postgres SQL: ownership, CAS, unique create and delete on embedded PostgreSQL',async()=>{
 const db=new PGlite();
 const adapter={
  async query(sql:string,args?:unknown[]){
   if(args){const r=await db.query(sql,args);return {rows:r.rows,rowCount:r.affectedRows};}
   const results=await db.exec(sql);const r=results.at(-1)!;return {rows:r.rows,rowCount:r.affectedRows};
  },
  async end(){await db.close();},
 };
 const store=await new PostgresStore('',adapter as any).init();
 try{
  const state={version:1 as const,id:crypto.randomUUID(),revision:1,title:'PRIVATE_SQL_CANARY',pii:newPiiContext(),turns:[]};
  const key=await importConversationKey(crypto.getRandomValues(new Uint8Array(32)));
  const r:ConversationRow={id:state.id,ownerId:'alice',wrappedKey:'wrapped',...await encryptState(key,'alice',state),createdAt:'',updatedAt:''};
  assert.equal((await store.create(r)).revision,1);
  assert.equal((await decryptState(key,'alice',await store.get('alice',r.id))).title,state.title);
  const tampered=fromBase64(r.encryptedState);tampered[0]^=1;
  await db.query('UPDATE conversations SET encrypted_state=$1 WHERE id=$2',[toBase64(tampered),r.id]);
  await assert.rejects(decryptState(key,'alice',await store.get('alice',r.id)));
  await db.query('UPDATE conversations SET encrypted_state=$1 WHERE id=$2',[r.encryptedState,r.id]);
  assert.equal((await store.list('bob')).length,0);
  await assert.rejects(store.get('bob',r.id),{code:'NOT_FOUND'});
  await assert.rejects(store.create(r),{code:'ALREADY_EXISTS'});
  const changed={revision:2,iv:'new-iv',encryptedState:'new-cipher'};
  assert.equal((await store.update('alice',r.id,1,changed)).revision,2);
  await assert.rejects(store.update('alice',r.id,1,changed),{code:'REVISION_CONFLICT'});
  await assert.rejects(store.delete('bob',r.id),{code:'NOT_FOUND'});
  await store.delete('alice',r.id);assert.equal((await store.list('alice')).length,0);
 }finally{await store.close();}
});
