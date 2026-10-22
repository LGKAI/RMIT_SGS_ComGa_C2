import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { platform, arch } from 'node:os';
import { newPiiContext, prepareMessage } from '../src/lib/pii';
type Case = { id:string; split:string; text:string; expected:{kind:string;value:string}[] };
const cases=JSON.parse(await readFile('fixtures/pii-corpus.json','utf8')) as Case[];
const measured=cases.filter(c=>c.split==='holdout');
const metrics:Record<string,{tp:number;fp:number;fn:number}>={}; const errors:unknown[]=[]; const times:number[]=[];
for(const item of measured){
 const start=performance.now();const result=prepareMessage(item.text,newPiiContext());times.push(performance.now()-start);
 const expected=item.expected.map(e=>`${e.kind}:${e.value}`);const actual=result.spans.map(e=>`${e.kind}:${e.value}`);
 for(const kind of ['NAME','CCCD','PHONE','STK','EMAIL']){
  const m=metrics[kind]??={tp:0,fp:0,fn:0};const a=actual.filter(v=>v.startsWith(kind+':'));const e=expected.filter(v=>v.startsWith(kind+':'));
  const remaining=[...e];for(const value of a){const i=remaining.indexOf(value);if(i>=0){m.tp++;remaining.splice(i,1);}else m.fp++;}m.fn+=remaining.length;
 }
 if(expected.some(e=>!actual.includes(e))||actual.some(a=>!expected.includes(a)))errors.push({id:item.id,expected,actual});
}
times.sort((a,b)=>a-b);
const report={generatedAt:new Date().toISOString(),scope:'Synthetic template-based corpus. Automatic detection only; no manual preview correction. Not representative of real-world Vietnamese PII.',split:{dev:cases.filter(c=>c.split==='dev').length,holdout:measured.length},perKind:Object.fromEntries(Object.entries(metrics).map(([k,m])=>[k,{...m,precision:m.tp/(m.tp+m.fp||1),recall:m.tp/(m.tp+m.fn||1),f1:2*m.tp/(2*m.tp+m.fp+m.fn||1)}])),casesWithMismatch:errors.length,errors,latency:{environment:`Node ${process.version} ${platform()} ${arch()}`,samples:times.length,p50Ms:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)]}};
await mkdir('test-results',{recursive:true});await writeFile('test-results/pii-metrics.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
