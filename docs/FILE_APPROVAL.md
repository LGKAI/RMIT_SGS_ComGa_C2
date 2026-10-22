# Duyệt tài liệu trước khi gửi AI

Luồng: chọn file tại trình duyệt → che định danh → xem preview → người khác duyệt → người gửi xác nhận gửi → gateway kiểm tra và dùng phê duyệt đúng một lần.

## Phạm vi hiện tại

- Nhận một file `.txt`, `.csv`, `.md` UTF-8, tối đa 32 KiB; tổng câu hỏi + nội dung file tối đa 12.000 ký tự. Chặn file rỗng, nhị phân, UTF-8 lỗi, PDF/Word/ảnh và file quá lớn. Chưa có OCR hoặc parser tài liệu Office/PDF.
- Tên file không vào hàng đợi hoặc provider. Nội dung file được đọc cục bộ, ghép vào prompt rồi chạy cùng bộ che PII. Bản gốc, tên file, bản nháp duyệt và bảng ánh xạ chỉ được lưu trong snapshot mã hóa tại client.
- Hàng đợi nhận **toàn bộ payload đã che**, bao gồm lịch sử gửi kèm. Gateway và người có quyền duyệt thấy payload này trước khi AI nhận. Nội dung đã che vẫn có thể mang bí mật nghiệp vụ; người duyệt phải kiểm tra.
- Preview hàng đợi được mã hóa AES-256-GCM bằng `APPROVAL_STORAGE_KEY` do server giữ. Đây là mã hóa tại nơi lưu của hàng đợi, không phải E2EE với server. Sau từ chối hoặc sử dụng, bản preview mã hóa được bỏ khỏi record; bản hết hạn được dọn ở lần tạo yêu cầu tiếp theo. Metadata audit còn được giữ. Không bảo đảm xóa backup.
- `confidential`: cần một người khác có client role `file-approver` duyệt. `restricted` (Tuyệt mật): chặn gửi cloud ở cả UI lẫn server. Phân loại do người dùng chọn, chưa có bộ phân loại DLP tự động.
- Mọi request tới `/api/chat`, kể cả văn bản dán, đều cần phê duyệt; không có cờ `isFile` để lách qua cổng chat thường. Một ứng dụng khác hoặc người có quyền sửa gateway vẫn nằm ngoài giới hạn này.

## Điều kiện cho phép gửi

Digest SHA-256 ràng buộc phiên bản cấu trúc, chủ sở hữu, conversation ID, request ID, toàn bộ messages, hash/size/type file, mục đích, phân loại, provider và model. Thay một thành phần phải xin duyệt lại. Hash file do client khai báo, không chứng minh tự động rằng client đã trích xuất/che đúng toàn bộ file gốc; server không nhận file gốc để so sánh.

Người gửi không thể tự duyệt kể cả có role; quyết định chỉ dựa trên token đã xác minh. Phê duyệt có hạn 10 phút từ lúc xin duyệt, chỉ dùng một lần. Chuyển `approved → consumed` bằng compare-and-swap trước khi gọi provider. Hai request đồng thời chỉ có một request đi qua. Nếu AI timeout/lỗi, phải xin duyệt lại; không hoàn lại phê duyệt đã dùng.

## TideCloak thật

- Đăng nhập và key wrapping dùng `@tidecloak/react`; lỗi Tide không tự hạ về demo.
- API kiểm chữ ký JWT qua JWKS, issuer, audience và expiry. Role lấy riêng từ `resource_access[TIDE_AUDIENCE].roles`; role trong request body hoặc ở client khác không cấp quyền.
- Live API bắt buộc DPoP: khớp public-key thumbprint với `cnf.jkt`, chữ ký proof, token hash, method, URL, thời gian và chống replay. Frontend dùng `sdk.secureFetch`.
- DPoP replay cache hiện trong một tiến trình; triển khai nhiều instance cần cache chung trước khi đưa production. Rate limit hiện cũng theo tiến trình.
- QEA của Tide quản trị việc cấp/thu hồi quyền. Quyết định duyệt từng payload hiện do ứng dụng và database thi hành, **chưa phải chữ ký/quorum Forseti cho từng file**. Chưa bảo vệ khỏi server ứng dụng bị chiếm quyền, sửa code frontend, rollback toàn database hay người dùng tự tiết lộ bí mật.
- Sau thu hồi role, access token đã cấp có thể còn hiệu lực đến hạn; cần token ngắn hạn/chiến lược thu hồi khi triển khai thực.

## Test nhanh

1. Chạy `npm run dev:demo`, mở hai cửa sổ ở `http://localhost:5173`.
2. Cửa sổ A: tài khoản `alice`, mật khẩu demo ít nhất 12 ký tự. Cửa sổ B: tài khoản `reviewer`, mật khẩu demo ít nhất 12 ký tự. Đây là danh tính giả lập, ai cũng chọn được; không dùng dữ liệu thật.
3. A tải `fixtures/files/ho-so-vay.txt`, nhập “Tóm tắt hồ sơ”, kiểm tra preview và bấm **Xin phê duyệt nội dung**. Chưa có request tới AI.
4. B bấm **Tải danh sách duyệt**, chọn yêu cầu, xem đủ lịch sử/preview, bấm **Duyệt nội dung này** hoặc **Từ chối nội dung này**.
5. A bấm **Kiểm tra phê duyệt**, rồi **Gửi nội dung đã duyệt**. Sửa câu hỏi, đổi file hoặc mục đích thì phải xin duyệt lại. F5 rồi mở hội thoại vẫn khôi phục bản nháp đã mã hóa.
6. Thử chọn **Tuyệt mật**: không thể gửi. Thử PDF hoặc file quá 32 KiB: bị từ chối trước upload.

Ví dụ: hồ sơ vay có họ tên/CCCD/SĐT được đổi thành token; số tiền 2 tỷ vẫn giữ. Báo cáo lương tuy đã che tên vẫn còn mức lương: người duyệt có thể từ chối. Khóa API, bí mật kinh doanh hoặc dữ liệu chưa được bộ che nhận ra cần che thủ công/từ chối; không coi phát hiện PII là đầy đủ.

## Lệnh xác minh

```sh
npm run check
npm run test:e2e
# Có PostgreSQL thật đang chạy:
TEST_DATABASE_URL=postgres://privatechat:privatechat_dev_only@localhost:5432/privatechat npm run check
# Tide thật, AI giả lập để không cần Gemini key:
npm run dev:tide:demo
# Tide thật + Gemini thật sau khi điền key/model:
npm run dev:live
```

Tide mode cần PostgreSQL, adapter thật, issuer/audience và `APPROVAL_STORAGE_KEY` (32 byte ngẫu nhiên, dạng 64 ký tự hex). Xem `TIDE_SETUP.md`. Không thay adapter tải từ Tide bằng JSON tự chế.
