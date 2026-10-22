# BẢNG PHÂN CHIA NHIỆM VỤ NHÓM RMIT_SGS_ComGa (CHALLENGE 2)
## Dự án: PrivateChat Shield — Zero-Trust AI Privacy Gateway with TideCloak

---

## 1. Phân chia Nhiệm vụ 4 Thành viên

| Thành viên | Trách nhiệm chính | Chi tiết công việc cần hoàn thành |
|---|---|---|
| **Lê Gia Khánh (Lead)** | **Kiến trúc & Quản lý Chung** | - Quản lý code repo và cấu hình TideCloak IdP Docker.<br>- Kiểm tra tiêu chí nộp bài Hackathon: `README.md` (< 300 từ tiếng Anh) và Google Form.<br>- Push code và đảm bảo repo Public trước 17:00. |
| **Trần Trung Hiếu** | **Quay Video Demo 2–3 Phút (`Video.mp4`)** | - Mở `http://localhost:5173/` quay màn hình demo 3 cột.<br>- Làm theo kịch bản 4 bước bên dưới, xuất file `Video.mp4` (< 100MB) vào thư mục gốc của repo.<br>- Cam kết nộp video trước 17:00. |
| **Phạm Chấn Khoa** | **Kiểm thử Bảo mật & Metrics** | - Test các nút: "Simulate Rogue DBA Tamper" và "Trigger Quorum Approval Challenge".<br>- Thử nghiệm câu lệnh Jailbreak/Prompt Injection để xác nhận Guardrail C1 chặn đứng. |
| **Cái Hoàng Bảo Kin** | **Thuyết trình & Q&A Phản biện** | - Nắm vững kịch bản Pitch 3 phút và căn cứ pháp lý Luật 91/2025/QH15.<br>- Chuẩn bị sẵn câu trả lời cho Top 5 câu hỏi của Giám khảo (Mục 12 trong `PLAN.md`). |

---

## 2. Kịch bản Quay Video Demo 2–3 Phút (Dành cho Trần Trung Hiếu)

1. **Bước 1 (0:00 – 0:45): Giao diện 3 Cột & Nhận diện PII**
   - Mở giao diện `http://localhost:5173/` (giao diện tiếng Anh tối giản, tone Trắng - Xanh Blue).
   - Nhấp vào preset **"📄 Loan Dossier (Vietcombank)"**.
   - Chỉ vào thanh **PII DETECTED**: hiển thị CCCD, Họ tên *Nguyễn Văn Hùng*, STK Vietcombank, mức rủi ro 95%.
   - Nhấn **"Send"**.

2. **Bước 2 (0:45 – 1:30): Màn hình 3 Cột Đồng bộ Thời gian thực**
   - **Column 1 (Client Safe Zone):** Phản hồi hiển thị an toàn trên máy người dùng, có nút chuyển đổi Unmasked / Masked.
   - **Column 2 (AI Gateway Echo):** Cloud LLM chỉ nhận các token `[NAME_1]`, `[CCCD_1]`, `[STK_1]` và vé ẩn danh Anonymous Quota Ticket (0.00% PII rò rỉ).
   - **Column 3 (Storage & Defense):** Cơ sở dữ liệu PostgreSQL lưu 100% bản mã `AES-256-GCM`.

3. **Bước 3 (1:30 – 2:15): Thử nghiệm 2 Đòn Tấn công & Quorum**
   - **Đòn 1:** Nhấn nút **"Simulate Rogue DBA: Alter Ciphertext"** &rarr; Bảng cảnh báo đỏ hiện ra báo lỗi xác thực AAD, chặn đứng hành vi sửa lén.
   - **Đòn 2:** Nhấn nút **"Trigger Quorum Approval Challenge"** &rarr; Modal Change Request hiện ra. Nhấn **"Approve & Sign (Admin 2 / Judge)"** để hoàn tất 2/2 chữ ký Quorum.

4. **Bước 4 (2:15 – 2:45): Crypto-Shredding & Kết luận**
   - Nhấn nút **"Crypto-Shred"** &rarr; Toàn bộ khóa giải mã bị hủy tức thì, chứng minh quyền được lãng quên thực chất.
   - Kết luận: *"PrivateChat Shield kết hợp TideCloak giúp doanh nghiệp tự tin ứng dụng AI mà không sợ lộ lọt dữ liệu."*
