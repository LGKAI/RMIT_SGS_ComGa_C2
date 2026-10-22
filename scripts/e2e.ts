import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const dir=await mkdtemp(join(tmpdir(),'pcs-browser-')); const origin='http://127.0.0.1:5190';
const env={...process.env,AUTH_MODE:'demo',AI_PROVIDER:'demo',DATABASE_URL:'',PORT:'3191',API_PORT:'3191',APP_ORIGIN:origin,DEMO_DATA_FILE:join(dir,'encrypted-store.json')};
const children=[spawn(process.execPath,['--import','tsx','server/index.ts'],{env,stdio:['ignore','pipe','pipe']}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--port','5190'],{env,stdio:['ignore','pipe','pipe']})];
let startupErrors='';for(const child of children)child.stderr?.on('data',chunk=>startupErrors+=chunk.toString());
const checks:string[]=[];const pass=(s:string)=>{checks.push(s);console.log('PASS:',s);};
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
async function waitReady(url:string){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('Server not ready: '+startupErrors);}
try{
 await waitReady('http://127.0.0.1:3191/api/health');await waitReady(origin);
 browser=await chromium.launch({headless:true,...(process.platform==='darwin'?{executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{channel:'chrome'})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
 const requests:any[]=[];page.on('request',req=>{if(req.url().endsWith('/api/chat'))requests.push(req.postDataJSON());});
 async function login(name:string,password='demo-passphrase-123',target=page){await target.getByLabel('Tên tài khoản demo').fill(name);await target.getByLabel('Mật khẩu mở khóa demo').fill(password);await target.getByRole('button',{name:'Đăng nhập demo',exact:true}).click();await target.getByRole('button',{name:'+ Hội thoại mới'}).waitFor();}
 const reviewer=await browser.newPage();await reviewer.goto(origin);await login('reviewer','reviewer-passphrase-123',reviewer);
 async function prepare(target=page){
   const waiting=target.waitForResponse(r=>r.url().endsWith('/api/approvals')&&r.request().method()==='POST');
   await target.getByRole('button',{name:'Xin phê duyệt nội dung',exact:true}).click();const row=await (await waiting).json();
   await target.getByText('Đã xin duyệt.',{exact:false}).waitFor();
   await reviewer.getByRole('button',{name:'Tải danh sách duyệt'}).click();await reviewer.getByRole('button',{name:new RegExp(row.id.slice(0,8))}).click();
   await reviewer.getByRole('button',{name:'Duyệt nội dung này',exact:true}).click();await reviewer.getByTestId('approval-review').getByText('Đã duyệt',{exact:false}).waitFor();
   await target.getByRole('button',{name:'Kiểm tra phê duyệt',exact:true}).click();await target.getByTestId('approval-status').getByText('Đã duyệt',{exact:true}).waitFor();return row;
 }
 async function approveAndSend(){await prepare();await page.getByRole('button',{name:'Gửi nội dung đã duyệt',exact:true}).click();await page.getByText('Đã lưu bản mã.',{exact:false}).waitFor();}
 async function send(text:string){await page.locator('#chat-input').fill(text);await approveAndSend();}
 await page.goto(origin);await login('alice');await page.getByRole('button',{name:'Dùng hồ sơ mẫu'}).click();
 const preview=await page.getByTestId('masked-preview').innerText();assert.ok(!preview.includes('Đặng Thị Mai'));assert.ok(!preview.includes('0912345678'));assert.ok(preview.includes('2,5 tỷ đồng'));
 await approveAndSend();pass('PII preview, real encrypted save and demo provider response');
 await send('Tóm tắt lại hồ sơ của Đặng Thị Mai.');assert.equal(requests[1].proposal.request.messages.length,3);const payload=JSON.stringify(requests);for(const s of ['Đặng Thị Mai','0010 9201 2345','0071000123456','0912345678','mai@example.com'])assert.ok(!payload.includes(s));pass('Second turn uses masked history only');
 await page.getByRole('button',{name:'Thử sửa bản sao ciphertext'}).click();await page.getByText('PASS — AES-GCM',{exact:false}).waitFor();pass('Tampered ciphertext is rejected by real AES-GCM');
 await page.getByRole('button',{name:'Kiểm tra key provider'}).click();await page.getByText('Round-trip key provider demo thành công.',{exact:false}).waitFor();pass('Demo key wrap/unwrap works');
 const aliceProbe=await page.getByLabel('Probe mở khóa',{exact:true}).inputValue();
 const stored=JSON.parse(await readFile(env.DEMO_DATA_FILE,'utf8'));assert.equal(stored.length,1);const rawStore=JSON.stringify(stored);for(const s of ['Đặng Thị Mai','0912345678','2,5 tỷ','piiMap','demo-passphrase-123'])assert.ok(!rawStore.includes(s));pass('Persistent file contains ciphertext, not original PII or passphrase');
 await page.reload();await login('alice');await page.locator('.conversation').first().click();await page.getByText('Đã xác thực và giải mã hội thoại tại trình duyệt.').waitFor();assert.ok((await page.locator('.chat-body').innerText()).includes('Đặng Thị Mai'));pass('Reload + same identity/passphrase restores history');
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await login('bob');assert.equal(await page.locator('.conversation').count(),0);pass('Another demo identity does not list Alice conversations');
 await page.getByLabel('Probe mở khóa',{exact:true}).fill(aliceProbe);await page.getByRole('button',{name:'Thử mở probe đã dán'}).click();await page.getByText('Probe bị từ chối hoặc không hợp lệ:',{exact:false}).waitFor();pass('Foreign identity cannot unwrap Alice demo probe');
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await login('alice','wrong-password-123');await page.locator('.conversation').first().click();await page.getByRole('alert').waitFor();assert.ok((await page.getByRole('alert').innerText()).includes('Không mở được khóa'));pass('Wrong passphrase cannot decrypt history');
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await login('alice');await page.locator('.conversation').first().click();await page.getByText('Đã xác thực và giải mã hội thoại tại trình duyệt.').waitFor();
 await page.locator('#chat-input').fill('nguyen van hung, <img src="https://evil.test/canary">');await page.getByLabel('Tên cần che thêm').fill('nguyen van hung');assert.ok(!(await page.getByTestId('masked-preview').innerText()).includes('nguyen van hung'));await approveAndSend();assert.equal(await page.locator('img').count(),0);pass('Manual name dictionary and text-only HTML rendering');
 await page.locator('#chat-input').fill('Doanh nghiệp bí mật ZebraVault');
 await page.locator('#chat-input').evaluate(el=>{const input=el as HTMLTextAreaElement;input.focus();input.setSelectionRange(input.value.indexOf('ZebraVault'),input.value.length);});
 await page.getByRole('button',{name:'Che đoạn đã chọn',exact:true}).click();assert.ok(!(await page.getByTestId('masked-preview').innerText()).includes('ZebraVault'));
 await approveAndSend();pass('Selected text can be manually masked before send');
 await page.locator('#chat-input').fill('Tóm tắt file này.');
 await page.getByLabel('File cần bảo mật',{exact:true}).setInputFiles({name:'Đặng-Thị-Mai-private.txt',mimeType:'text/plain',buffer:Buffer.from('Đặng Thị Mai, CCCD 001092012345, SĐT 0912345678. Khoản vay 2 tỷ đồng.')});
 await page.getByTestId('attachment-info').waitFor();const filePreview=await page.getByTestId('masked-preview').innerText();assert.ok(!filePreview.includes('001092012345'));assert.ok(!filePreview.includes('0912345678'));assert.ok(filePreview.includes('2 tỷ đồng'));
 const approvedFile=await prepare();const reviewed=await reviewer.getByTestId('approval-review').innerText();assert.ok(!reviewed.includes('Đặng Thị Mai'));assert.ok(!reviewed.includes('Đặng-Thị-Mai-private.txt'));
 await page.locator('#chat-input').fill('Tóm tắt file theo mục đích khác.');assert.equal(await page.getByRole('button',{name:'Gửi nội dung đã duyệt',exact:true}).isDisabled(),true);pass('Editing prompt after file approval disables dispatch');
 await page.locator('#chat-input').fill('Tóm tắt file này.');
 await page.reload();await login('alice');await page.locator('.conversation').first().click();await page.getByText('Đã xác thực và giải mã hội thoại tại trình duyệt.').waitFor();await page.getByTestId('attachment-info').waitFor();await page.getByRole('button',{name:'Gửi nội dung đã duyệt',exact:true}).click();await page.getByText('Đã lưu bản mã.',{exact:false}).waitFor();
 assert.equal(requests.at(-1).approvalId,approvedFile.id);assert.equal(requests.at(-1).proposal.files.length,1);pass('File + masked reviewer preview + encrypted draft survive reload and approved dispatch');
 const diskWithFile=await readFile(env.DEMO_DATA_FILE,'utf8');assert.ok(!diskWithFile.includes('Đặng-Thị-Mai-private.txt'));assert.ok(!diskWithFile.includes('001092012345'));
 await page.getByLabel('File cần bảo mật',{exact:true}).setInputFiles({name:'unsupported.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7')});await page.getByRole('alert').waitFor();assert.ok((await page.getByRole('alert').innerText()).includes('Chỉ nhận'));pass('Unsupported PDF is explicitly rejected before upload');
 await page.getByLabel('Mức bảo mật',{exact:true}).selectOption('restricted');await page.locator('#chat-input').fill('Bí mật công ty');assert.equal(await page.getByRole('button',{name:'Xin phê duyệt nội dung',exact:true}).isDisabled(),true);await page.getByLabel('Mức bảo mật',{exact:true}).selectOption('confidential');pass('Restricted file policy blocks cloud submission');
 const stalePage=await browser.newPage();await stalePage.goto(origin);await login('alice','demo-passphrase-123',stalePage);await stalePage.locator('.conversation').first().click();await stalePage.getByText('Đã xác thực và giải mã hội thoại tại trình duyệt.').waitFor();
 await send('Cập nhật hồ sơ từ tab chính.');await stalePage.locator('#chat-input').fill('Cập nhật từ tab cũ.');await stalePage.getByRole('button',{name:'Xin phê duyệt nội dung',exact:true}).click();await stalePage.getByRole('alert').waitFor();assert.ok((await stalePage.getByRole('alert').innerText()).includes('tab khác'));await stalePage.close();pass('Stale tab receives revision conflict instead of overwriting history');
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/demo-desktop.png',fullPage:true});
 await page.route('**/api/chat',async route=>{await new Promise(r=>setTimeout(r,800));await route.continue().catch(()=>{});});
 await page.locator('#chat-input').fill('Lượt chờ để kiểm tra xóa.');await prepare();await page.getByRole('button',{name:'Gửi nội dung đã duyệt',exact:true}).click();await page.getByText('Đang xử lý và lưu bản mã…').waitFor();
 page.once('dialog',dialog=>void dialog.accept());await page.getByRole('button',{name:'Xóa hội thoại',exact:true}).click();await page.getByText('Đã xóa khỏi ứng dụng.',{exact:false}).waitFor();await new Promise(r=>setTimeout(r,1200));assert.equal(await page.locator('.bubble').count(),0);assert.equal(await page.locator('.conversation').count(),0);pass('Delete while request pending does not resurrect response');
 await page.locator('#chat-input').fill('Kiểm tra logout trong khi chờ AI.');await prepare();await page.getByRole('button',{name:'Gửi nội dung đã duyệt',exact:true}).click();await page.getByText('Đang xử lý và lưu bản mã…').waitFor();await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByRole('button',{name:'Đăng nhập demo',exact:true}).waitFor();await new Promise(r=>setTimeout(r,1200));assert.equal(await page.locator('.bubble').count(),0);pass('Logout clears state and ignores late provider response');
 assert.deepEqual(pageErrors,[]);pass('No uncaught browser errors');
 console.log(JSON.stringify({checks:checks.length,mode:'explicit-demo',externalTideOrGeminiTested:false}));
}finally{await browser?.close();for(const child of children)child.kill('SIGTERM');await new Promise(r=>setTimeout(r,400));for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await rm(dir,{recursive:true,force:true});}
