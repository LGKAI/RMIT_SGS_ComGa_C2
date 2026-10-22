# Tích hợp Tide thật và kiểm chứng QEA

Trạng thái hiện tại: code adapter và verifier đã viết; chưa có realm/license hoặc hai Tide account để chứng minh vận hành thực tế. Demo passphrase không thay thế kiểm chứng này.

## Chuẩn bị

1. Khởi động Docker Desktop. Tham khảo [Tide Quickstart](https://docs.tide.org/Admin/) và [QEA setup](https://docs.tide.org/Admin/SetupIGA) để dùng image được nhà cung cấp hỗ trợ. Compose có profile `tide` cho dev. Sau khi xác định image chạy được, đặt `TIDECLOAK_IMAGE` thành tag/digest đã thử, không coi `latest` là phiên bản đã kiểm chứng.
2. Chạy `docker compose --profile tide up -d`. Dịch vụ chỉ publish trên loopback. Mật khẩu compose là development-only; đổi nếu dùng ngoài máy cá nhân.
3. Mở `http://localhost:8080/`; hoàn tất setup realm `privatechat`, license và liên kết Tide account. Không dùng master realm cho dữ liệu ứng dụng.
4. Thêm admin độc lập thứ hai và hoàn tất enrollment, QEA approval của việc gán admin. Xác nhận quorum thực tế lớn hơn một; realm một admin chưa chứng minh nhiều bên.
5. Tạo app/client `privatechat`, public client phù hợp SDK. Redirect URI `http://localhost:5173/*`; Web origin `http://localhost:5173`. Duyệt/commit các thay đổi.
6. Tạo và duyệt `_tide_chat.selfencrypt` cùng `_tide_chat.selfdecrypt`; gán đúng người dùng hoặc default roles bằng governed changes.
7. Tải Tide adapter chính thức từ Apps → client → Credentials → Tide adapter, thay `public/tidecloak.json`. File mẫu trong repo chỉ là placeholder, không chứng minh đã cấp license.
8. Cấu hình audience của access token cho API. Điền `.env`: `TIDE_ISSUER` đúng issuer trong discovery; `TIDE_AUDIENCE` có mặt trong `aud`; `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
9. Chạy `npm run dev:live`. Callback `/auth/redirect` được Vite/backend SPA phục vụ. Không đổi sang mock nếu đăng nhập/mở khóa thất bại.

Verifier dùng JWKS cố định từ issuer đã cấu hình: `/protocol/openid-connect/certs`, kiểm tra chữ ký, issuer, audience, expiry. HTTP chỉ được phép cho issuer localhost; issuer bên ngoài cần HTTPS. Kiểm tra cấu hình CSP/network với adapter và các endpoint thực tế trước khi triển khai hosting.

## Kiểm tra A/B và khóa

| Kiểm tra | Các bước | Đạt khi |
|---|---|---|
| A round-trip | Đăng nhập A; bấm Kiểm tra key provider | Hash khóa sau unwrap khớp trước wrap |
| A reload | Lưu hội thoại; F5; đăng nhập lại A; mở | Snapshot giải mã đúng |
| B cùng role | Copy probe JSON của A; đăng nhập B cùng các role; thử mở probe | Fabric/SDK từ chối hoặc không trả khóa khớp |
| API ownership | B thử ID hội thoại của A qua endpoint được xác thực | GET/PUT/DELETE bị từ chối |

Nếu B mở probe A được, dừng sử dụng dữ liệu nhạy cảm, lưu evidence và xác minh semantics với Tide. Không sửa bằng cách chỉ ẩn hội thoại trên UI hoặc thêm role giả.

## Kiểm tra QEA ở Console

1. Chọn một thay đổi role/scope được tài liệu QEA hỗ trợ, ví dụ cấp role mới cho một tài khoản thử nghiệm chưa có role.
2. Ghi trạng thái quyền trước thay đổi. Admin 1 tạo yêu cầu và chỉ phê duyệt bằng danh tính của mình.
3. Xác nhận Change Request còn pending và quyền chưa có hiệu lực khi chưa đạt quorum. Nếu thử commit, ghi trạng thái lỗi thực tế; không dựng thông báo giả.
4. Admin 2 đăng nhập độc lập, duyệt hoặc từ chối trong Console/enclave. Kiểm tra quyền cuối cùng bằng token/operation mới khi cần, không chỉ nhìn số chữ ký.
5. Lưu version server/SDK, request ID, số admin, quorum, thời gian và ảnh/video vào ghi chú test. Không lưu access token, private key hoặc mật khẩu.

QEA này quản trị thay đổi quyền; nó không có nghĩa mọi lượt chat cần hai admin ký. Với self-encryption, gán cùng role không tự động chứng minh người khác có thể giải mã dữ liệu của A.

## Bằng chứng hiện chưa có

- License và realm chạy thật.
- A/B trên Fabric thật và hai enrollment độc lập.
- QEA nhiều admin thực sự giữ quyền ở trạng thái chưa có hiệu lực.
- End-to-end với Postgres Docker và Gemini có billing/key thật.

Đây là các bước cấu hình/vận hành cần account của người dùng; không được đánh dấu hoàn thành bằng unit test hoặc demo passphrase.

Nguồn: [React SDK](https://docs.tide.org/Languages/React/tidecloak-react-tutorial), [E2EE setup](https://docs.tide.org/Admin/e2ee), [QEA](https://docs.tide.org/Admin/SetupIGA).
