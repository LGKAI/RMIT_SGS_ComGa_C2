import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProvider } from '../server/provider';
import { prepareMessage, newPiiContext, unmaskText } from '../src/lib/pii';
test('ten synthetic utility smoke tasks preserve placeholders and supplied monetary facts',async()=>{
 const provider=createProvider('demo','','');
 const templates=[
 'Tóm tắt hồ sơ của Nguyễn Văn Hùng, vay 2,5 tỷ đồng.',
 'Liệt kê giấy tờ của Đặng Thị Mai, CCCD 001092012345.',
 'Soạn yêu cầu bổ sung cho Trần Thị Lan; email lan@example.test.',
 'Ghi nhận khoản vay 250 triệu đồng; không quyết định phê duyệt.',
 'Hồ sơ STK 123456789 và SĐT 0912345678 cần kiểm tra gì?',
 'Nguyễn Văn Hùng gặp Nguyễn Văn Hùng; giữ cùng định danh.',
 'CCCD 0010 9201 2345; soạn danh sách thông tin thiếu.',
 'STK 123456; liệt kê giấy tờ cần xác minh.',
 'Email contact@example.test; viết đoạn yêu cầu xác nhận.',
 'Tóm tắt phạm vi thông tin còn thiếu cho khoản vay 1,2 tỷ đồng.',
 ];
 for(const text of templates){const masked=prepareMessage(text,newPiiContext());const output=await provider([{role:'user',content:masked.masked}],new AbortController().signal);assert.ok(output.includes(masked.masked));assert.ok(output.includes('DEMO'));assert.ok(unmaskText(output,masked.context).includes(text));}
 // This is a functional smoke check for the demo adapter, not a measured real-model utility score.
});
