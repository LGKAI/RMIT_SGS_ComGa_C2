import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.TIDE_TEST_APP_ORIGIN??'http://localhost:5173';
const config=await(await fetch(origin+'/api/config')).json();assert.equal(config.authMode,'tide','Start npm run dev:tide:demo first');
const browser=await chromium.launch({headless:false,...(process.platform==='darwin'?{executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{channel:'chrome'})});
const page=await browser.newPage({viewport:{width:1440,height:1000}});let token='';let meOk=false;const checks:string[]=[];
const pass=(s:string)=>{checks.push(s);console.log('PASS:',s);};
page.on('request',r=>{if(r.url().startsWith(origin+'/api/')&&r.headers().authorization?.startsWith('DPoP '))token=r.headers().authorization.slice(5);});
page.on('response',r=>{if(r.url()===origin+'/api/me'&&r.status()===200)meOk=true;});
try{
 await page.goto(origin);
 console.log('Complete Tide sign-in in the Chrome window. The test never reads password fields or logs tokens.');
 await page.getByRole('button',{name:'Đăng nhập Tide',exact:true}).click();
 await page.getByRole('button',{name:'+ Hội thoại mới',exact:true}).waitFor({timeout:300000});assert.ok(meOk);pass('Real Tide login, JWT verification and DPoP request accepted by gateway');
 await page.getByRole('button',{name:'Kiểm tra key provider',exact:true}).click();
 await page.getByText('Round-trip key provider tide thành công.',{exact:false}).waitFor({timeout:180000});pass('Real Tide SDK encrypt/decrypt round-trip on random conversation key');
 const copied=await fetch(origin+'/api/me',{headers:{Authorization:'Bearer '+token}});assert.equal(copied.status,401);pass('Copied access token without matching DPoP proof is rejected');
 await page.locator('#chat-input').fill('Tóm tắt hồ sơ thử nghiệm.');
 await page.getByLabel('File cần bảo mật',{exact:true}).setInputFiles({name:'private-test.txt',mimeType:'text/plain',buffer:Buffer.from('Đặng Thị Mai, CCCD 001092012345, SĐT 0912345678. Khoản vay 2 tỷ đồng.')});
 await page.getByTestId('attachment-info').waitFor();const preview=await page.getByTestId('masked-preview').innerText();assert.ok(!preview.includes('001092012345'));assert.ok(!preview.includes('0912345678'));
 await page.getByRole('button',{name:'Xin phê duyệt nội dung',exact:true}).click();await page.getByText('Đã xin duyệt.',{exact:false}).waitFor({timeout:180000});assert.ok(await page.getByRole('button',{name:'Gửi nội dung đã duyệt',exact:true}).isDisabled());pass('Real Tide-wrapped encrypted draft + masked file approval remains blocked pending independent review');
 await page.getByRole('button',{name:'Tải lại từ server',exact:true}).click();await page.getByText('Đã xác thực và giải mã hội thoại tại trình duyệt.').waitFor({timeout:180000});assert.ok((await page.getByTestId('attachment-info').innerText()).includes('private-test.txt'));pass('Encrypted draft reloads through real Tide unwrap and AES-GCM');
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/tide-smoke.png',fullPage:true});
 await writeFile('test-results/tide-smoke.json',JSON.stringify({checks,auth:'real-tide',ai:config.aiProvider,independentTideReviewerTested:false,when:new Date().toISOString()},null,2));
 console.log('Live Tide smoke complete. Independent reviewer approval and multi-admin quorum require separate enrolled users.');
}finally{token='';await browser.close();}
