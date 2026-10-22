# BẢNG PHÂN CHIA NHIỆM VỤ NHÓM RMIT_SGS_ComGa (CHALLENGE 2)
## Dự án: PrivateChat Shield — Lớp Bảo Mật & Giả Danh Hóa Cho Chat AI Với TideCloak

---

## 1. Tổng quan Dự án & Căn cứ Pháp lý
- **Bài toán:** Nhân viên ngân hàng, công ty luật, doanh nghiệp khi dán dữ liệu nhạy cảm (CCCD, STK, bệnh án, hợp đồng M&A) vào AI đối mặt 2 rủi ro:
  1. *Cloud LLM nước ngoài* thấy dữ liệu định danh trực tiếp (Vi phạm **Khoản 1 Điều 30 Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15** & Nghị định 13/2023/NĐ-CP).
  2. *Admin / DBA nội bộ* có quyền root truy cập database để đọc trộm lịch sử hội thoại.
- **Giải pháp 3 Trụ cột PrivateChat Shield:**
  1. **Trụ cột 1:** Mã hóa phong bì phía Client (Client-side Envelope Encryption), khóa hội thoại được bảo vệ bởi mạng node phi tập trung **TideCloak ORK** (0% Master Key trên server).
  2. **Trụ cột 2:** Cơ chế quản trị Quorum (QEA) xóa sổ "God Admin": Mọi hành vi tự cấp quyền của Admin đều biến thành Change Request đòi &ge; 2 chữ ký số độc lập.
  3. **Trụ cột 3:** Giả danh hóa PII tiếng Việt 3 tầng chạy 100% trên trình duyệt (CCCD, STK, SĐT, Tên người Việt).

---

## 2. Phân chia Nhiệm vụ 4 Thành viên

| Thành viên | Trách nhiệm chính | Chi tiết công việc cần hoàn thành |
|---|---|---|
| **Lê Gia Khánh (Lead)** | **Kiến trúc Hệ thống & Quản lý Chung** | - Quản lý code repo và cấu hình TideCloak IdP Docker.<br>- Kiểm tra tiêu chí nộp bài Hackathon: `README.md` (< 300 từ tiếng Anh) và form nộp bài.<br>- Review code và merge pull requests. |
| **Trần Trung Hiếu** | **Quay Video Demo 2–3 Phút (`Video.mp4`)** | - Mở `http://localhost:5173/` quay màn hình demo 3 cột thời gian thực.<br>- Diễn kịch bản 4 bước bên dưới, xuất file `Video.mp4` (< 100MB) vào thư mục gốc của repo.<br>- Cam kết nộp video trước 17:00. |
| **Phạm Chấn Khoa** | **Kiểm thử Bảo mật & Số liệu Metrics** | - Test các kịch bản tấn công: Bấm nút "Giả lập DBA Tamper" và "Thử thách Quorum".<br>- Thử nghiệm câu lệnh Prompt Injection để xác nhận Guardrail C1 chặn đứng.<br>- Thu thập ảnh chụp màn hình minh chứng cho báo cáo. |
| **Cái Hoàng Bảo Kin** | **Thuyết trình & Chuẩn bị Q&A Phản biện** | - Nắm vững kịch bản Pitch 3 phút và căn cứ pháp lý Luật 91/2025/QH15.<br>- Chuẩn bị sẵn câu trả lời cho Top 5 câu hỏi của Giám khảo (Mục 12 trong `PLAN.md`). |

---

## 3. Kịch bản Quay Video Demo 2–3 Phút (Dành cho Trần Trung Hiếu)

1. **Bước 1 (0:00 – 0:45): Giới thiệu Giao diện & Giả danh hóa PII**
   - Mở giao diện `http://localhost:5173/` (giao diện sáng chuẩn enterprise SaaS).
   - Nhấp vào preset **"📄 Hồ sơ Vay 2,5 Tỷ (Vietcombank)"**.
   - Chỉ vào thanh **PII Preview Bar** màu vàng cam: hiển thị phát hiện CCCD, Họ tên *Nguyễn Văn Hùng*, STK Vietcombank, mức rủi ro 100%.
   - Nhấn **"Gửi AI"**.

2. **Bước 2 (0:45 – 1:30): Màn hình 3 Cột Đồng bộ Thời gian thực**
   - **Cột 1 (Người dùng thấy):** Câu trả lời tư vấn tín dụng hiển thị mượt mà với tên thật đã unmask.
   - **Cột 2 (Cloud AI thấy):** Chỉ nhận các token `[NAME_1]`, `[CCCD_1]`, `[STK_1]` và vé ẩn danh Anonymous Quota Ticket (0.00% PII rò rỉ).
   - **Cột 3 (PostgreSQL):** Cơ sở dữ liệu 100% bản mã `AES-256-GCM`, không lưu bản rõ.

3. **Bước 3 (1:30 – 2:15): Thử nghiệm 2 Đòn Tấn công & Quorum**
   - **Đòn 1:** Nhấn nút **"Giả lập DBA Tamper: Sửa Ciphertext"** &rarr; Bảng cảnh báo đỏ hiện ra báo lỗi xác thực AAD, chặn đứng hành vi sửa lén.
   - **Đòn 2:** Nhấn nút **"Mở Thử thách Quorum"** &rarr; Modal Change Request hiện ra. Nhấn **"Ký Duyệt (Admin 2 / Giám khảo)"** để hoàn tất 2/2 chữ ký Quorum.

4. **Bước 4 (2:15 – 2:45): Crypto-Shredding & Kết luận**
   - Nhấn nút **"Crypto-Shred"** &rarr; Toàn bộ khóa giải mã bị hủy tức thì, chứng minh quyền được lãng quên thực chất.
   - Kết luận: *"PrivateChat Shield kết hợp TideCloak giúp doanh nghiệp Việt Nam tự tin ứng dụng AI mà không sợ lộ lọt dữ liệu."*
