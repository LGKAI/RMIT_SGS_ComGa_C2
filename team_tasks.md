# 🏥 KẾ HOẠCH TÁC CHIẾN CHALLENGE 2: TIDE "UNLOCKED"
**Cuộc thi:** RMIT Hackathon 2026  
**Nhóm:** `RMIT_SGS_ComGa_C2`  
**Đơn vị tài trợ thử thách:** Tide Foundation  
**Hạn nộp bài chính thức:** **18:00 ngày 22/10/2026** (Mục tiêu team nộp trước 16:30)

---

## PHẦN 1: TỔNG QUAN VẤN ĐỀ (CHO CẢ NHÓM NẮM RÕ)

### 1. Đề bài Challenge 2 là gì?
Ban tổ chức (Tide Foundation) đặt ra một bài toán mở:  
> *"Bạn sẽ xây dựng điều gì nếu niềm tin không còn là nút thắt cổ chai (Trust Bottleneck)?"*

* **Vấn đề của thế giới hiện nay (Hệ thống truyền thống):**
  Trong hầu hết các ứng dụng y tế, tài chính hay dữ liệu hiện nay, luôn có một **Super Admin** (hoặc quản trị viên server/database) nắm giữ **Master Key** (Chìa khóa vạn năng). Dù có phân quyền thế nào thì một anh IT bệnh viện hay một hacker chiếm được server backend vẫn có thể **đơn phương (unilateral override)** xem trộm bệnh án, bán dữ liệu nhạy cảm hoặc sửa đổi thông tin.
  $\rightarrow$ Vì **người dùng và các tổ chức sợ bị lạm quyền**, nên nhiều ý tưởng hợp tác chia sẻ dữ liệu không dám triển khai (gọi là *Trust Bottleneck*).

* **Công nghệ TideCloak (Emergent Authority) giải quyết thế nào?**
  * Slogan cốt lõi của Tide: **"Authority for an action, with NO master key to keep"** (Thẩm quyền hành động mà không ai giữ chìa khóa vạn năng).
  * **Không một ai** (kể cả Admin, Bác sĩ hay Giám đốc bệnh viện) có quyền tự ý mở khóa dữ liệu một mình. Quyền giải mã chỉ **tự động phát sinh (emerge)** khi chính sách bảo mật của bệnh nhân VÀ chữ ký của bác sĩ khớp nhau về mặt toán học.

* **Tiêu chí chấm điểm của Giám khảo (Rất khắt khe):**
  * **25% Vision & Originality:** Ý tưởng đột phá, nhân văn.
  * **20% Trust Constraint Insight:** Chỉ rõ cái gì đang bị kìm hãm vì sợ lộ/lạm quyền.
  * **20% Value & Impact:** Lợi ích cứu sống con người / minh bạch dữ liệu.
  * **20% Why TideCloak Matters:** Giám khảo cảnh báo: *Nếu app của bạn làm bằng cơ chế login/phân quyền admin thông thường mà cũng chạy được thì sẽ bị chấm điểm rất thấp!* Phải chứng minh TideCloak ngăn chặn được hành vi Admin lạm quyền.
  * **15% Prototype & Storytelling:** Bản demo chạy mượt, giao diện đẹp và video 2 phút thuyết phục.

---

### 2. Ý tưởng của nhóm: CarePassport (Hồ sơ bệnh án đa viện)
*CarePassport* là ý tưởng gợi ý số 1 của chính Ban tổ chức Tide:
* **Bối cảnh thực tế:** Bệnh nhân Sarah đi khám gãy tay ở Bệnh viện Chợ Rẫy. Bác sĩ cần biết ngay Sarah có bị dị ứng thuốc kháng sinh Penicillin không để kê đơn cấp cứu. Nhưng Sarah rất sợ nếu chia sẻ toàn bộ hồ sơ thì nhân viên IT bệnh viện sẽ đọc trộm hồ sơ khám Tâm thần hay xét nghiệm Di truyền bí mật của cô.
* **Cách CarePassport giải quyết với TideCloak:**
  1. **Bệnh nhân làm chủ quyền:** Sarah tự bật/tắt chia sẻ cho từng mục (cho phép xem Dị ứng, khóa chặt mục Tâm thần).
  2. **Bác sĩ xem an toàn:** Bác sĩ mở ra chỉ giải mã được mục Dị ứng. Mục Tâm thần hiển thị dưới dạng chuỗi mật mã khóa kín (Zero-Knowledge Ciphertext).
  3. **Chặn đứng Admin gian lận:** Nếu một IT Admin bệnh viện cố tình bấm "Force Dump" database để trộm dữ liệu $\rightarrow$ Hệ thống TideCloak lập tức báo động đỏ: **BLOCKED: Unilateral Override Denied! (Không tồn tại Master Key)**.
  4. **Cấp cứu khẩn cấp (Dual-Consensus):** Nếu bệnh nhân hôn mê, cần 2 bên cùng ký duyệt (Bác sĩ + Đại diện Hội đồng Y đức) thì thẩm quyền cấp cứu mới phát sinh.

---

### 3. Những gì Khánh đã làm xong (Hiện trạng dự án):
1. **Source Code Prototype hoàn chỉnh:** Đã lập trình bằng Vite + React + `@tidecloak/react` + giao diện Dark Mode Cyber-Medical cực kỳ xịn sò.
2. **Đã test các luồng chạy:** Chạy mượt tại `http://localhost:5173/`, có đủ 4 góc nhìn (Bệnh nhân, Bác sĩ, Hội đồng Y đức, Rogue Admin gian lận).
3. **Đã viết xong `README.md`:** Chuẩn 100% template 5 câu hỏi của Tide, độ dài ~270 từ (đạt chuẩn quy định < 300 từ của BTC).
4. **Đã cấu hình `.gitignore` sạch đẹp:** Không dính file rác hay file Challenge 1.
5. **Đã tạo và push code lên GitHub:** Repo `RMIT_SGS_ComGa_C2` ở chế độ Public.

---

### 4. Nhóm cần làm thêm những gì nữa để hoàn tất 100% bài nộp?
Chỉ còn **3 việc then chốt** cần làm trước 16:30:
1. **Quay Video Demo 2 phút (`Video.mp4` < 100MB):** Đặt trực tiếp vào thư mục gốc của GitHub repo. Đây là yêu cầu bắt buộc của BTC.
2. **Kiểm thử chéo trên máy thành viên:** Đảm bảo clone về chạy được ngay không bị lỗi môi trường.
3. **Điền Google Form nộp bài:** Link form: `https://forms.gle/HRHYjnqB86j1LFS97`.

---

## PHẦN 2: PHÂN CHIA NHIỆM VỤ 4 THÀNH VIÊN

```
                 ┌────────────────────────────────┐
                 │     LÊ GIA KHÁNH (Lead)        │
                 │ Quản trị Repo & Chốt Nộp Form  │
                 └───────────────┬────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌────────┴────────┐     ┌────────┴────────┐     ┌────────┴────────┐
│ TRẦN TRUNG HIẾU │     │ PHẠM CHẤN KHOA  │     │ CÁI HOÀNG B.KIN │
│ Quay Video 2 Phút│    │ Test Clone & Run│     │ QA, Review Web  │
│  (Video.mp4)    │     │ & Kỹ thuật Tide │     │ & Chuẩn bị Form │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 1. Lê Gia Khánh (Team Leader & Full-Stack Lead)
* [ ] Kiểm tra trạng thái GitHub repo `RMIT_SGS_ComGa_C2` (chắc chắn Public).
* [ ] Chạy dev server tại máy local để hỗ trợ Hiếu trong lúc quay video (nếu Hiếu cần màn hình demo).
* [ ] Tiếp nhận file `Video.mp4` từ Hiếu (kiểm tra < 100MB, < 2 phút), commit và push thẳng vào root repo.
* [ ] Điền link repo vào Google Form nộp bài trước 16:30, chụp ảnh xác nhận gửi nhóm.

### 2. Trần Trung Hiếu (Media & Storytelling Lead — NHIỆM VỤ SỐNG CÒN)
> ⚠️ **Video.mp4 là điều kiện tiên quyết để được chấm điểm.** Video phải dưới 2 phút và dung lượng dưới 100MB.

* [ ] Mở trình duyệt vào app: `http://localhost:5173/` (hoặc phối hợp với Khánh để share màn hình).
* [ ] Dùng phần mềm quay màn hình (OBS Studio, Camtasia, Loom, hoặc phím tắt `Win + Alt + R` trên Windows).
* [ ] **Quay và thuyết minh đúng theo 4 phân cảnh mẫu của BTC (Kịch bản chi tiết bên dưới):**
  1. *Phút 0:00 - 0:30:* Ý tưởng CarePassport là gì?
  2. *Phút 0:30 - 0:50:* Nút thắt niềm tin (sợ Admin IT xem trộm bệnh án).
  3. *Phút 0:50 - 1:40:* Demo app (Bệnh nhân toggle quyền $\rightarrow$ Bác sĩ thấy giải mã $\rightarrow$ **Bấm nút Rogue Admin "Force DB Dump" để thấy bảng đỏ BLOCKED** $\rightarrow$ Ký duyệt cấp cứu Dual-Consensus).
  4. *Phút 1:40 - 2:00:* Ý nghĩa mang lại cho y tế và người bệnh.
* [ ] Xuất file: Đặt tên chính xác là **`Video.mp4`**, kiểm tra dung lượng **< 100MB**, gửi cho Khánh trước **16:00**.

### 3. Phạm Chấn Khoa (Cross-Platform Testing & Technical Support)
* [ ] Thực hiện Clone repo từ GitHub về máy cá nhân:
  ```bash
  git clone https://github.com/leogiakhanh/RMIT_SGS_ComGa_C2.git
  cd RMIT_SGS_ComGa_C2
  npm install
  npm run dev
  ```
* [ ] Xác nhận xem trên máy của Khoa app có hiển thị đầy đủ, font chữ và các nút bấm có hoạt động trơn tru không (đảm bảo giám khảo clone về chấm bài là chạy 100%).
* [ ] Hỗ trợ Hiếu: Nếu Hiếu cần một người cùng đọc thoại tiếng Anh hoặc cần gõ phụ đề ngắn cho video.
* [ ] Nắm vững cơ chế TideCloak Emergent Authority (nằm ở thẻ bên phải màn hình) để sẵn sàng nếu có phần Q&A với giám khảo.

### 4. Cái Hoàng Bảo Kin (Product QA & Submission Verification)
* [ ] **Kiểm thử chi tiết (QA Checklist):**
  - Click thử vai Bệnh nhân: Gạt tắt mục Dị ứng $\rightarrow$ Kiểm tra Bác sĩ có bị khóa không.
  - Bấm nút đỏ "Emergency Lockdown" $\rightarrow$ Xem tất cả thẻ có bị khóa hết không.
  - Click vai Rogue Admin $\rightarrow$ Bấm cả 3 nút tấn công $\rightarrow$ Kiểm tra thông báo đỏ có nhảy ra không.
  - Kiểm tra bảng **Immutable Audit Trail** xem các dòng log có xuất hiện không.
* [ ] **Kiểm tra hồ sơ nộp:**
  - Soát lại file `README.md` trên giao diện web GitHub (đảm bảo không bị vỡ Markdown, nội dung súc tích dưới 300 từ).
  - Chuẩn bị sẵn link và thông tin nộp bài:
    - Group Name: `RMIT_SGS_ComGa_C2`
    - Form nộp: `https://forms.gle/HRHYjnqB86j1LFS97`
* [ ] Cùng Hiếu review video xuất ra xem âm thanh có rõ và thời lượng có đúng dưới 2 phút không.

---

## PHẦN 3: KỊCH BẢN QUAY VIDEO DEMO 2 PHÚT (CHO HIẾU & NHÓM)

* **Phân cảnh 1: The Possibility (0:00 - 0:30)**
  > *"Xin chào Ban giám khảo! Đây là CarePassport — nền tảng bệnh án điện tử đa viện nơi bệnh nhân nắm quyền kiểm soát dữ liệu y tế tối thượng, được xây dựng trên nền tảng TideCloak Emergent Authority."*  
  *(Màn hình: Hiển thị giao diện tổng quan CarePassport, chỉ vào huy hiệu TideCloak đang phát sáng).*

* **Phân cảnh 2: The Constraint (0:30 - 0:50)**
  > *"Ngày nay, các bệnh viện không dám liên thông hồ sơ và người bệnh không dám khai báo các tiền sử nhạy cảm như tâm thần hay di truyền. Lý do là trong hệ thống truyền thống, người quản trị IT luôn nắm giữ Master Key, có thể xem trộm hoặc bán dữ liệu bất cứ lúc nào."*

* **Phân cảnh 3: The Prototype & TideCloak Role (0:50 - 1:40) — ĐOẠN ĂN ĐIỂM NHẤT**
  > *(Thao tác 1)*: *"Với vai trò Bệnh nhân Sarah Nguyen, tôi chỉ cho phép Bác sĩ xem Dị ứng và Đơn thuốc, còn hồ sơ Tâm thần tôi khóa lại."*  
  > *(Thao tác 2)*: *"Chuyển sang vai Bác sĩ tại Bệnh viện Chợ Rẫy: Dữ liệu dị ứng được giải mã tức thì. Nhưng hồ sơ tâm thần hiển thị chuỗi mã hóa Zero-Knowledge Ciphertext."*  
  > *(Thao tác 3 - QUAN TRỌNG)*: *"Điều gì xảy ra nếu một Admin IT bệnh viện lạm quyền? Chúng tôi chuyển sang vai Rogue Admin và bấm 'Force DB Dump'. Ngay lập tức, TideCloak CHẶN ĐỨNG hành động này với cảnh báo đỏ rực: Unilateral Override Blocked! Trong CarePassport, KHÔNG AI CÓ MASTER KEY để tự ý ghi đè."*  
  > *(Thao tác 4)*: *"Khi cấp cứu khẩn cấp, tính năng Dual-Consensus đòi hỏi Bác sĩ và Hội đồng Y đức cùng ký duyệt thì chìa khóa mới tự động phát sinh."*

* **Phân cảnh 4: What Changes (1:40 - 2:00)**
  > *"Nhờ loại bỏ nút thắt niềm tin, bệnh nhân có thể an tâm đến bất kỳ bệnh viện nào mà không sợ lộ đời tư, còn bác sĩ cấp cứu có được thông tin dị ứng cứu mạng trong tích tắc. CarePassport đã biến việc liên thông y tế zero-trust thành hiện thực."*

---

## ⏰ MỐC THỜI GIAN CHỐT (DEADLINE HÔM NAY)
* **14:00 - 15:30:** Khoa test clone repo; Hiếu quay video demo; Kin kiểm thử tính năng web.
* **15:30 - 16:00:** Hiếu xuất file `Video.mp4`, gửi cho Khánh & Kin review.
* **16:00 - 16:30:** Khánh push `Video.mp4` lên GitHub repo, cả nhóm cùng kiểm tra link.
* **16:30 - 17:00:** Điền Google Form chính thức. Hoàn thành bài thi Challenge 2 an toàn tuyệt đối!
