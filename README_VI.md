# PrivateChat Shield — Hướng dẫn chạy và test

Ứng dụng che định danh trước khi gửi AI và mã hóa lịch sử tại trình duyệt. Đã thay bản prototype chỉ hiển thị thông báo bằng crypto, storage API và kiểm thử thật.

## 1. Chạy ngay, chưa cần tài khoản ngoài

Cài Node.js 22 trở lên; mở terminal ở thư mục dự án:

```bash
npm ci --ignore-scripts
npm run dev:demo
```

Mở [http://localhost:5173](http://localhost:5173). Backend dùng cổng 3001. Nếu một cổng đang bận, dừng server cũ trước khi chạy. `npm run dev` cũng khởi động cùng chế độ demo.

Nhập tài khoản `alice` và mật khẩu demo bất kỳ từ 12 ký tự, ví dụ `demo-passphrase-123`. **Nhớ cùng tên và mật khẩu để mở lại lịch sử.** Mật khẩu không gửi tới backend và không lưu trong localStorage; sau F5 cần nhập lại.

Demo chỉ dành cho dữ liệu tổng hợp:

- Đăng nhập demo chỉ tạo danh tính thử nghiệm; người biết username có thể nhận cùng danh tính. Mật khẩu chỉ bảo vệ lớp mở khóa phía client, không xác thực tài khoản tại server.
- Crypto AES-GCM, HKDF, PBKDF2 và lưu bản mã là thật. Đây là key provider phát triển riêng, chỉ hoạt động khi người chạy chọn demo; không thay Tide và không được dùng như fallback trong live mode.
- AI demo trả lời theo mẫu. UI luôn ghi rõ chưa gọi model AI.
- File lưu trữ là `.data/demo-conversations.json`, không phải PostgreSQL. File chứa ciphertext và metadata; chỉ hỗ trợ một process. Không đưa vào Git.

## 2. Test bằng giao diện trong 5 phút

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập `alice`; bấm **Dùng hồ sơ mẫu** | Preview có token thay tên, CCCD, STK, SĐT, email; số tiền giữ nguyên |
| 2 | Gõ tên viết thường chưa bắt được vào ô **Tên cần che thêm**, hoặc bôi đen trong ô nhập rồi bấm **Che đoạn đã chọn** | Preview đổi theo lựa chọn; có thể bỏ che từng thực thể bằng checkbox |
| 3 | Bấm **Xác nhận preview và gửi** | Có phản hồi ghi DEMO; panel Gateway có request thực tế; panel storage có IV và ciphertext thật |
| 4 | Gửi tiếp “Tóm tắt lại hồ sơ của Đặng Thị Mai.” | Request gồm context đã che; token của cùng người giữ nguyên, không gửi bản hiển thị đã khôi phục |
| 5 | F5; đăng nhập lại đúng `alice` và mật khẩu cũ; chọn hội thoại | Lịch sử được giải mã và hiển thị lại |
| 6 | Đăng xuất; đăng nhập `alice` bằng mật khẩu khác; mở hội thoại | Báo không mở được khóa, không trả về nội dung |
| 7 | Đăng xuất; đăng nhập `bob` | Không có hội thoại của Alice trong danh sách; API cũng từ chối truy cập chéo |
| 8 | Đăng nhập lại Alice; bấm **Thử sửa bản sao ciphertext** | AES-GCM thực sự từ chối bản sao đã đổi byte; bản lưu không bị sửa |
| 9 | Bấm **Xóa hội thoại** và xác nhận | Xóa khỏi ứng dụng; không tuyên bố xóa các backup bên ngoài |

**Kiểm tra key provider:** bấm **Kiểm tra key provider** để bọc/mở một khóa ngẫu nhiên và so sánh hash. Ô Probe chỉ chứa khóa thử nghiệm đã được bọc. Copy JSON đó, đăng nhập bằng user B, dán vào ô và bấm **Thử mở probe đã dán**. Cùng user/passphrase mở được; user B không nên mở được. Trong Tide mode, thao tác này giúp kiểm chứng scope bằng hai tài khoản thật có cùng role. Không dùng conversation key thật làm probe.

## 3. Kiểm thử tự động

```bash
npm test
npm run build
npm run eval:pii
npm run test:e2e
```

- `npm test`: PII, token ổn định, crypto, sai khóa/owner/revision, API authorization, concurrent update, replay/quota, adapter Gemini và xác minh JWT với JWKS local. SQL chạy trên PostgreSQL nhúng PGlite.
- `npm run build`: kiểm tra TypeScript và build frontend.
- `npm run eval:pii`: 100 câu tổng hợp theo template, chia 60 dev/40 holdout. Báo cáo `test-results/pii-metrics.json` ghi recall/precision từng loại, lỗi và latency trên Node. Đây không phải benchmark đại diện tiếng Việt thực tế.
- `npm run test:e2e`: chạy server và Chrome headless tạm, kiểm tra UI end-to-end. Trên macOS dùng Google Chrome đã cài; có thể đặt `CHROME_PATH`. Trên Windows/Linux cần cài Google Chrome.

Tên viết thường vẫn có thể bị bỏ sót ở nhận diện tự động; dùng từ điển hoặc che thủ công. Số liệu sau sửa bằng tay phải được báo riêng. Bộ smoke test utility chỉ kiểm tra dữ liệu/token của AI demo, chưa chấm chất lượng Gemini thật.

Mở DevTools → Network → `/api/chat` để kiểm tra payload. Không được có `original`, `piiMap`, khóa hoặc mật khẩu trong request chat. Request storage chỉ gửi snapshot mã hóa. Tài khoản/thời gian/kích thước vẫn là metadata mà backend biết.

## 4. Thử Gemini khi chưa có Tide

```bash
cp .env.example .env
```

Điền `GEMINI_API_KEY` và `GEMINI_MODEL` hợp lệ trong `.env`, rồi:

```bash
npm run dev:gemini
```

Mode này vẫn là demo identity và file storage, nhưng gọi Gemini thật. Không gửi dữ liệu khách hàng thật. Key chỉ nằm ở backend. Không huấn luyện và không lưu dữ liệu là hai thuộc tính khác nhau; kiểm tra [chính sách Gemini](https://ai.google.dev/gemini-api/docs/zdr) của đúng dịch vụ bạn dùng.

## 5. Thử PostgreSQL và Tide thật

Để kiểm tra storage bằng PostgreSQL nhưng vẫn dùng demo auth/AI:

```bash
docker compose up -d db
# Điền DATABASE_URL từ .env.example vào .env
npm run dev:demo:pg
```

Không chạy nhiều mode đồng thời trên cùng cổng. Dữ liệu demo-file không tự chuyển sang PostgreSQL. Xem [TIDE_SETUP.md](docs/TIDE_SETUP.md) để tạo realm, bật QEA, tải adapter và chạy `npm run dev:live`.

Để chạy frontend đã build cùng backend: `npm run build`, cấu hình `.env` rồi `npm start`. Đổi `APP_ORIGIN` thành URL app thực tế (ví dụ `http://localhost:3001` khi mở bản build qua backend), cập nhật redirect URI/origin trên Tide tương ứng. Live mode yêu cầu Postgres, Tide issuer/audience và Gemini key/model; thiếu cấu hình sẽ dừng, không tự chuyển qua demo.

## 6. Giới hạn

LLM/Gateway vẫn thấy nội dung đã giả danh hóa; che PII không che được toàn bộ bí mật nghiệp vụ. Chưa bảo đảm chống tái định danh, rollback đồng bộ toàn DB, xóa backup, thiết bị bị chiếm quyền hoặc bên phát hành JavaScript độc hại. Thu hồi quyền không xóa khóa đã mở trong RAM hoặc bản rõ người nhận đã sao chép. Không tuyên bố tự động tuân thủ pháp luật.

Trong live mode, QEA được thực hiện bởi Tide Console và tài khoản admin thật. Chỉ đánh dấu đạt sau khi có bằng chứng hai user và quorum thật. Các thay đổi đang nằm local; không tự động commit/push.
