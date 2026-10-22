# HƯỚNG DẪN CHI TIẾT SỬ DỤNG ỨNG DỤNG PRIVATECHAT SHIELD
[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

> **Dự án tham dự RMIT Hackathon 2026 — Challenge 2 (TideCloak Track)**  
> **Tên ứng dụng:** PrivateChat Shield — Zero-Trust AI Privacy Gateway with TideCloak  
> **Đội thi:** RMIT_SGS_ComGa  
> **Địa chỉ chạy trực tiếp:** `http://localhost:5173/`

---

## 1. Tổng quan & Căn cứ Pháp lý
* **Bài toán thực tế:** Doanh nghiệp và cá nhân Việt Nam muốn nhờ AI phân tích các dữ liệu cực kỳ nhạy cảm (hồ sơ vay vốn, căn cước công dân, số tài khoản, CV nhân sự cấp cao, hợp đồng sáp nhập M&A, bệnh án), nhưng không dám dùng AI vì sợ Cloud LLM nước ngoài lưu trộm dữ liệu, hoặc quản trị viên (DBA/Admin) đọc lén lịch sử chat trong cơ sở dữ liệu.
* **Căn cứ pháp lý cốt lõi:**
  * **Khoản 1 Điều 30 Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15** *(Xử lý dữ liệu cá nhân trong môi trường AI & Cloud phải tối thiểu hóa, không chuyển dữ liệu định danh vượt biên giới)*.
  * **Điều 18 Luật 91/2025/QH15 & Nghị định 13/2023/NĐ-CP** *(Quyền được xóa dữ liệu / Quyền được lãng quên - Right to Erasure)*.
* **Giải pháp PrivateChat Shield:** 
  1. Trình duyệt tự nhận diện và ẩn danh hóa PII (CCCD, SĐT, STK, Tên) bằng WebCrypto trước khi gửi ra Cloud AI (Rò rỉ PII: `0.00%`).
  2. Database PostgreSQL chỉ lưu bản mã `AES-256-GCM`, kèm chữ ký HMAC toàn vẹn dữ liệu.
  3. Cơ chế cấp quyền tạm thời **Emergent Authority (15 phút)** qua TideCloak khi phân tích tài liệu mật.
  4. Cơ chế đồng thuận đa bên **Quorum (QEA 2-of-3)** ngăn chặn hoàn toàn "God Admin" tự cấp quyền giải mã.
  5. Cơ chế **Crypto-Shredding** tiêu hủy master key, biến dữ liệu lưu trữ thành rác toán học vĩnh viễn.

---

## 2. Các Chế độ Quan sát (Perspective Switcher)

Ngay trên thanh Header, bạn có thể bấm vào các nút Segmented Navigation Pills để chuyển đổi linh hoạt:

1. **`🖥️ Tri-Pane (Mặc định)`**: Hiển thị đồng thời cả 3 cột để giám khảo thấy rõ dòng chảy dữ liệu qua 3 ranh giới bảo mật cùng lúc.
2. **`👤 End User`**: Chế độ người dùng cuối — giao diện mở rộng toàn màn hình, tập trung vào khung chat bảo mật, đính kèm file và che PII.
3. **`🌐 AI Gateway`**: Chế độ nhà cung cấp Cloud AI — xem đúng những gì rời khỏi trình duyệt (chỉ có các token biến số `[NAME_1]`, vé quota ẩn danh).
4. **`🛡️ DBA & Attack Lab`**: Chế độ quản trị cơ sở dữ liệu & Phòng thử nghiệm tấn công (SOC View).
5. **`🚨 Attack Lab (Nút đỏ)`**: Phím tắt nhảy ngay lập tức vào Phòng Thử nghiệm Tấn công.

---

## 3. Hướng dẫn Đăng nhập Zero-Trust

Trên góc phải thanh Topbar:
* **Cách 1 — 1-Click Demo (Khuyên dùng khi thuyết trình nhanh):**
  * Nhấn nút **`⚡ Quick Demo`**.
  * Ngay lập tức đăng nhập với tư cách **Sarah Nguyen**, kích hoạt phiên bảo mật Zero-Trust.
* **Cách 2 — Đăng nhập thật qua Docker TideCloak IdP:**
  * Khởi động Docker container TideCloak trên cổng 8080.
  * Nhấn nút **`Connect TideCloak IdP`**.
  * Đăng nhập với tài khoản:
    * **Username:** `sarah`
    * **Password:** `password123`
  * TideCloak sẽ xác thực và chuyển hướng về ứng dụng kèm DPoP Bearer Token.

---

## 4. Hướng dẫn Tương tác Chat & Khử PII Tự động (Cột 1: Client Safe Zone)

1. **Gõ prompt chứa PII tiếng Việt:**
   * Bạn có thể gõ câu hỏi chứa họ tên, số điện thoại, CCCD, STK:  
     `"Tôi tên Khoa, 20 tuổi, sđt 0987654321, có phải đi nghĩa vụ quân sự không?"`  
     hoặc bấm nút preset **`🎖️ Nghĩa vụ quân sự`**.
2. **Quan sát thanh PII DETECTED:**
   * Trình duyệt tự phát hiện `[NAME] Khoa` và `[PHONE] 0987654321`.
3. **Bấm "Send":**
   * **Tại máy bạn (Cột 1):** AI trả lời chi tiết và gọi bạn là "Khoa" (phục hồi bản rõ cục bộ).
   * **Tại Cloud AI (Cột 2):** Chỉ thấy `[NAME_1]`, `[PHONE_1]` — rò rỉ dữ liệu cá nhân là `0.00%`.
4. **Bật/tắt nút `👁️ Unmasked View` / `🔒 Masked Tokens`:**
   * Bấm nút góc trên Cột 1 để xem cách trình duyệt tráo đổi giữa dữ liệu thật và các token mã hóa.

---

## 5. Hướng dẫn Đính kèm Tài liệu & Cấp quyền Emergent Authority (15 Phút)

1. **Đính kèm file:**
   * Bấm biểu tượng kẹp giấy **`📎`** để chọn tải lên file từ máy tính (`.pdf`, `.png`, `.jpg`, `.docx`,...).
   * Hoặc bấm nút nhanh: **`📎 Sample CV (PDF)`** hoặc **`📎 Passport (Image)`**.
2. **Kích hoạt chốt chặn Zero-Trust:**
   * Hệ thống tự nhận diện đây là tài liệu mật (`CONFIDENTIAL ASSET`).
   * Bấm **`Send`** $\rightarrow$ AI lập tức dừng lại, từ chối giải mã và xuất hiện thẻ:
     > 🔒 **Thẩm quyền Giải mã Tạm thời (Emergent Authority):** AI yêu cầu cấp quyền 15 phút để phân tích hồ sơ mật.
3. **Phê duyệt cấp quyền:**
   * Bấm nút **`✍️ Phê duyệt Cấp quyền 15 Phút qua TideCloak`**.
   * Huy hiệu xanh lá hiện ra cùng đồng hồ đếm ngược `15-Min Active ✓ (14:59)`.
   * AI tiến hành giải mã trong vùng nhớ RAM cô lập (enclave) và phân tích hồ sơ chuyên sâu.
4. **Khóa khẩn cấp (Emergency Lockdown):**
   * Bấm nút đỏ **`🔒 Revoke Token`** ở góc trên bất cứ lúc nào để thu hồi quyền ngay tức thì, xóa sạch bộ nhớ tạm của AI.

---

## 6. Hướng dẫn Phòng Thử nghiệm Tấn công (🚨 Live Attack Lab)

Chuyển sang tab **`🛡️ DBA & Attack Lab`** (hoặc bấm nút đỏ **`🚨 Attack Lab`** trên header). Bạn sẽ thấy bảng PostgreSQL và 4 thẻ tấn công trực quan:

### 💥 Đòn 1: Rogue DBA Direct SQL Update (Tấn công can thiệp dữ liệu DB)
* **Kịch bản:** Quản trị viên cơ sở dữ liệu có quyền root lén chạy lệnh SQL sửa trộm bản mã tin nhắn trong PostgreSQL.
* **Thao tác:** Bấm nút **`⚡ Alter Ciphertext in DB`**.
* **Phản ứng:**
  * Dòng 2 trong bảng PostgreSQL chuyển sang **màu đỏ rực**, ciphertext biến thành `⚠️ CORRUPTED_0xDEADBEEF`.
  * Trạng thái toàn vẹn báo đỏ: `❌ MAC MISMATCH`.
  * Cảnh báo vi phạm xuất hiện: `Cryptographic Integrity Violation: AES-GCM AAD Mismatch!`. Client từ chối nhận dữ liệu bị tráo.
* **Hồi phục:** Bấm nút xanh **`↩️ Restore Data Integrity`** để đưa dữ liệu về trạng thái an toàn.

### ⚖️ Đòn 2: God-Admin Self-Decryption (Tấn công leo thang đặc quyền)
* **Kịch bản:** Admin cố tình tự gán quyền `_tide_chat.selfdecrypt` để đọc trộm chat người dùng mà không có sự đồng ý.
* **Thao tác:** Bấm nút **`⚡ Attempt Self-Decryption`**.
* **Phản ứng:**
  * TideCloak Quorum-Enforced Governance (QEA) chặn đứng hành vi đơn phương.
  * Xuất hiện Modal **Change Request #CR-2026-89** yêu cầu đủ ít nhất 2 chữ ký số độc lập.
  * Bấm **`Approve & Sign as Judge (Admin 2)`** để hoàn tất cơ chế đồng thuận 2-of-3, hoặc bấm **`Reject & Block`** để bác bỏ.

### 🚨 Đòn 3: Multilingual Prompt Injection & Jailbreak (Tấn công bẻ khóa AI)
* **Kịch bản:** Kẻ tấn công gửi các prompt đối kháng nhằm ép AI nhả API key và dump toàn bộ cơ sở dữ liệu.
* **Thao tác:** Bấm nút **`⚡ Fire Prompt Injection Attack`** (hoặc bấm preset `🚨 Jailbreak Injection Test` trong khung chat).
* **Phản ứng:**
  * Bộ phân loại đa ngữ Challenge 1 Guardrail Classifier phát hiện ý đồ đánh cắp dữ liệu với **Độ tin cậy 94.8% (F1-score: 0.93)**.
  * AI khóa chặt vault, từ chối cấp thẩm quyền Emergent Authority và phát cảnh báo an ninh.

### 🗑️ Phòng thủ 4: Instant Crypto-Shredding (Điều 18 - Quyền được lãng quên)
* **Kịch bản:** Người dùng thực hiện quyền yêu cầu xóa bỏ dữ liệu cá nhân theo Luật 91/2025/QH15.
* **Thao tác:** Bấm nút **`💥 Shred All Keys`** (hoặc bấm nút `💥 Crypto-Shredding` ở Cột 1).
* **Phản ứng:**
  * Master Key bị xóa vĩnh viễn khỏi bộ nhớ WebCrypto của trình duyệt.
  * Tất cả các dòng trong PostgreSQL biến thành `NULL (SHREDDED)`. Toàn bộ các bản sao lưu (backup) cũ của DB biến thành rác toán học vĩnh viễn không thể khôi phục.
* **Khởi động lại:** Bấm **`🔄 Reset Demo`** để tái tạo môi trường ban đầu.

---
*Tài liệu kỹ thuật được xây dựng bởi Đội thi RMIT_SGS_ComGa — RMIT Hackathon 2026.*
