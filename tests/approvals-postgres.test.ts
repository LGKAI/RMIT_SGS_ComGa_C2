import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {PostgresApprovalRepository,ApprovalService} from '../server/approvals';
import type {Identity,ApprovalProposal} from '../shared/contracts';
test('real PostgreSQL approval persistence, encrypted preview, expiry and concurrent consumption',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const admin=new Pool({connectionString:process.env.TEST_DATABASE_URL});const schema='approval_test_'+crypto.randomUUID().replaceAll('-','');await admin.query('CREATE SCHEMA '+schema);
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path='+schema});const repo=await new PostgresApprovalRepository('',pool).init();const key=randomBytes(32);let now=Date.now();const service=new ApprovalService(repo,key,'demo','demo-template',()=>now);
 try{
 const alice:Identity={ownerId:'alice',username:'alice',token:'',canApproveFiles:false};const reviewer:Identity={ownerId:'reviewer',username:'reviewer',token:'',canApproveFiles:true};
 const p:ApprovalProposal={conversationId:crypto.randomUUID(),request:{requestId:crypto.randomUUID(),messages:[{role:'user',content:'PRIVATE_PG_PREVIEW_CANARY'}]},files:[],purpose:'summarize',classification:'confidential'};
 const row=await service.create(alice,p);const persisted=await pool.query('SELECT record FROM file_approvals WHERE id=$1',[row.id]);assert.ok(!JSON.stringify(persisted.rows).includes('PRIVATE_PG_PREVIEW_CANARY'));
 assert.deepEqual((await new ApprovalService(repo,key,'demo','demo-template',()=>now).get(reviewer,row.id)).proposal,p);
 await service.decide(reviewer,row.id,'approved',row.digest);const race=await Promise.allSettled(Array.from({length:5},()=>service.consume(alice,row.id,p)));assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal((await repo.get(row.id)).sealed,null);
 const p2={...p,request:{...p.request,requestId:crypto.randomUUID()}};const r2=await service.create(alice,p2);await service.decide(reviewer,r2.id,'approved',r2.digest);now+=600001;await assert.rejects(service.consume(alice,r2.id,p2),{code:'APPROVAL_EXPIRED'});
 }finally{await repo.close();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
});
