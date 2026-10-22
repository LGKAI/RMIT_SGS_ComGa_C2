[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# PrivateChat Shield — Lớp Bảo Mật & Giả Danh Hóa Cho Chat AI Với TideCloak

## Tổng quan dự án

PrivateChat Shield là cổng bảo mật AI Zero-Trust kết hợp mã hóa phong bì ngưỡng TideCloak, cơ chế quản trị đa chữ ký Quorum (QEA), và hệ thống giả danh hóa dữ liệu cá nhân (PII) tiếng Việt chạy 100% trên trình duyệt, tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15.

Xây dựng bằng [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Tầm nhìn & Tính độc đáo
Doanh nghiệp và chuyên gia hàng ngày dán hồ sơ tín dụng ngân hàng, bệnh án, và hợp đồng M&A vào mô hình AI. PrivateChat Shield đảm bảo không một bên nào — kể cả các mô hình Cloud LLM nước ngoài hay quản trị viên cơ sở dữ liệu (DBA) có quyền root — có thể đọc được nội dung văn bản thô.

### 2. Thấu hiểu ràng buộc niềm tin
Trong kiến trúc truyền thống, nhà cung cấp ứng dụng AI và DBA nắm giữ toàn quyền master key với cơ sở dữ liệu chat, trong khi Cloud LLM nước ngoài nhận trực tiếp định danh công dân dạng bản rõ. Việc triệt tiêu quyền lực của quản trị viên đơn lẻ và phi tập trung hóa quyền giữ khóa là chìa khóa mở đường cho doanh nghiệp ứng dụng AI an toàn.

### 3. Giá trị & Tác động
Hiện thực hóa kỹ thuật cho nguyên tắc tối thiểu hóa dữ liệu tại Khoản 1 Điều 30 Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (về xử lý DLCN trong AI & Điện toán đám mây) và Nghị định 13/2023/NĐ-CP. Ngân hàng, bệnh viện và hãng luật có thể tận dụng AI hàng đầu thế giới với tỷ lệ rò rỉ PII trực tiếp ra Cloud đạt 0.00%.

### 4. Vì sao TideCloak quan trọng
Mạng lưới node ORK của TideCloak bọc khóa hội thoại bằng mật mã ngưỡng, xóa sổ hoàn toàn master key trên máy chủ. Đặc biệt, cơ chế Quorum-Enforced Governance (QEA) vô hiệu hóa "God Admin": mọi hành vi tự cấp role giải mã trái phép đều bị chặn thành Change Request đòi hỏi đủ chữ ký số từ Quorum các Admin độc lập.

### 5. Nguyên mẫu & Câu chuyện trình diễn
Trải nghiệm giao diện 3 cột đồng bộ thời gian thực:
- **Cột 1 (Vùng an toàn Trình duyệt):** Quét và che PII tiếng Việt 100% trên máy (CCCD 63 tỉnh thành, STK ngân hàng, tên người Việt) kèm thanh tương tác PII Preview trước khi gửi.
- **Cột 2 (AI Gateway Phi trạng thái):** Cloud LLM chỉ nhận các token giả danh `[NAME_1]`, `[CCCD_1]`, `[STK_1]` đi kèm vé ẩn danh HMAC Anonymous Quota Ticket.
- **Cột 3 (PostgreSQL & Phòng thủ Quorum):** Dữ liệu 100% bản mã AES-256-GCM, nút giả lập DBA sửa trộm DB bị chặn bởi WebCrypto AAD verification, và modal duyệt Quorum tương tác cho Giám khảo.

---

## Hướng dẫn Cài đặt & Chạy Thực tế

### Khởi chạy nhanh
```bash
# Clone repository
git clone https://github.com/LGKAI/RMIT_SGS_ComGa_C2.git
cd RMIT_SGS_ComGa_C2

# Cài đặt thư viện phụ thuộc
npm install

# Khởi động máy chủ phát triển
npm run dev
```

Mở trình duyệt tại [http://localhost:5173](http://localhost:5173).

### Kết nối TideCloak Identity Provider (Docker)
- Khởi chạy container TideCloak local trên cổng 8080:
  ```bash
  docker run -d -p 8080:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=password tideorg/tidecloak-dev:latest
  ```
- Ứng dụng đã cấu hình sẵn file `public/tidecloak.json` trỏ tới `master` realm và `account-console` client.
