# Trạng thái triển khai

Triển khai một đầu mối theo yêu cầu mới; ID trong PLAN.md chỉ dùng để đối chiếu, không còn là phân công cho thành viên.

| Task | Trạng thái thực tế |
|---|---|
| A1 | Có cấu hình/compose/hướng dẫn; chưa xác minh realm và license thật |
| A2 | Adapter Tide và công cụ probe A/B đã có; demo wrap/unwrap đã test; Fabric thật chờ account |
| A3 | Bỏ modal ký giả; mở Console và checklist QEA thật; chờ enrollment hai admin |
| A4 | Backend JWKS/JWT và owner checks đã test; issuer/audience Tide thật chưa xác minh |
| A5 | Có dọn phiên/request, không persist raw key, text rendering, no content logging; cần kiểm tra CSP/SDK trên live |
| B1 | HKDF/AES-GCM/AAD, IV ngẫu nhiên và lỗi tamper đã test |
| B2 | Atomic encrypted snapshot, owner checks, unique ID/retry, CAS; file demo + SQL PostgreSQL nhúng đã test |
| B3 | Gateway demo và Gemini REST adapter có timeout/quota/output limit; Gemini adapter dùng mock HTTP trong test, chưa gọi dịch vụ thật |
| B4 | Save/reload hoàn chỉnh với demo identity/key provider; Tide mode đã nối code nhưng chưa có evidence live |
| B5 | Có lockfile, build, `.env.example`, xử lý lỗi và tài liệu; không tự hủy dữ liệu để reset |
| C1 | 100 câu tổng hợp theo template, 60 dev/40 holdout; chưa là corpus đại diện thực tế |
| C2 | 4 nhóm số/email và gợi ý tên; từ điển/che thủ công; có test Unicode và khoảng trắng |
| C3 | Stable namespace, token exact-match một lượt; cùng tên giữ token, khác người không trùng |
| C4 | Unit/API/browser test cho payload nhiều lượt, DB canary, sửa ciphertext và hủy request |
| C5 | Script xuất metrics và lỗi thật; 10 utility smoke tasks chỉ cho demo, chưa có đánh giá chất lượng model thật |
| D1 | Chat UI text thuần đã build và test bằng Chrome |
| D2 | Preview có checkbox, dictionary và chọn đoạn để che |
| D3 | Demo end-to-end đã test gồm F5, sai mật khẩu, đổi user, lỗi/xóa khi request chờ |
| D4 | Panel request thực tế và ciphertext từ snapshot đã lưu; không giả là live Postgres khi dùng file |
| D5 | README EN/VI, hướng dẫn live và kịch bản demo đã có; video/slides chính thức chưa quay/xuất |

## Kiểm thử đã chạy

- TypeScript + Vite production build.
- Unit/integration tests cho crypto, PII, backend, JWT và SQL PostgreSQL nhúng.
- Chrome end-to-end trên chế độ demo, bao gồm kiểm tra không có PII gốc trong request chat hoặc file snapshot.
- Automatic PII baseline trên 40 câu holdout tổng hợp. Lỗi tên viết thường được giữ trong báo cáo, không điều chỉnh detector bằng holdout rồi tuyên bố kết quả độc lập.

Kết quả chi tiết có thể tái tạo bằng các lệnh trong README_VI.md. `test-results/` là output local được gitignore.

## Chưa được chứng minh

Tide license/user isolation/QEA thật, Gemini thật, Docker Postgres deployment, tính bất biến log, chống rollback toàn bộ DB, xóa backup, legal compliance và bảo vệ chống bên phát hành frontend độc hại. Demo auth không an toàn để triển khai công khai; production mode từ chối demo auth.

## Luồng demo 2 phút

1. Đăng nhập demo, mở preset và chỉ vào preview đã che.
2. Gửi, xem request đã che và ciphertext thật; giải thích AI đang là template demo.
3. Gửi lượt tiếp theo, F5 và mở lại bằng cùng passphrase.
4. Thử đổi byte ciphertext hoặc sai passphrase để thấy từ chối thật.
5. Nêu rõ Tide/QEA chưa có account để chạy; chỉ dùng live video khi đã có bằng chứng thật.
