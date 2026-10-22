# 📋 KẾ HOẠCH PHÂN CHIA NHIỆM VỤ ĐỘI THI (TEAM TASK ASSIGNMENT)
**Cuộc thi:** RMIT Hackathon 2026  
**Tên đội (Group Name):** `RMIT_SGS_ComGa`  
- Challenge 1: `RMIT_SGS_ComGa_C1` (Kaggle)
- Challenge 2: `RMIT_SGS_ComGa_C2` (Tide Foundation - UNLOCKED)  
**Thời gian hiện tại:** 14:00 ngày 22/10/2026  
**DEADLINE NỘP BÀI:** **18:00 ngày 22/10/2026** (Cần hoàn tất mọi thứ trước 17:00 để an toàn)

---

## 👥 DANH SÁCH THÀNH VIÊN VÀ PHÂN CÔNG CHÍNH

| STT | Họ và Tên | Vai trò chính | Trọng tâm phụ trách |
| :---: | :--- | :--- | :--- |
| **1** | **Lê Gia Khánh** | **Team Leader & Full-Stack Lead** | Quản lý tiến độ chung, Repository GitHub, chốt nộp sản phẩm cả 2 Challenge. |
| **2** | **Trần Trung Hiếu** | **Media & Storytelling Lead** | Quay, thu âm và dựng Video Demo 2 phút (`Video.mp4` < 100MB) cho Challenge 2. |
| **3** | **Phạm Chấn Khoa** | **AI / Machine Learning Lead** | Huấn luyện mô hình XLM-RoBERTa trên Kaggle, tối ưu F1-score & nộp bài Challenge 1. |
| **4** | **Cái Hoàng Bảo Kin** | **QA / Product & Documentation Lead** | Kiểm thử Web Prototype CarePassport, rà soát tiêu chí chấm điểm, chuẩn bị form nộp bài. |

---

## 🎯 CHI TIẾT NHIỆM VỤ TỪNG THÀNH VIÊN

### 1. Lê Gia Khánh (Team Leader & Full-Stack Lead)
* [ ] **Điều phối chung:** Giám sát tiến độ của 3 thành viên, giải quyết ngay lập tức các nút thắt kỹ thuật.
* [ ] **Quản trị GitHub (`RMIT_SGS_ComGa_C2`):**
  - Đảm bảo repo ở chế độ **Public**.
  - Kiểm tra các commit, đảm bảo code chạy ổn định trên nhánh `main`.
  - Tiếp nhận file `Video.mp4` từ Hiếu để commit lên root repo trước 16:30.
* [ ] **Hỗ trợ kỹ thuật:**
  - Hỗ trợ Khoa nếu Kaggle gặp lỗi OOM hoặc CUDA.
  - Hỗ trợ Hiếu các góc quay màn hình và hiệu ứng của app CarePassport.
* [ ] **Tổng duyệt nộp bài (17:00 - 17:30):**
  - Kiểm tra lần cuối link GitHub và Google Form Challenge 2 (`https://forms.gle/HRHYjnqB86j1LFS97`).
  - Kiểm tra submission trên Kaggle cho Challenge 1.

---

### 2. Trần Trung Hiếu (Media & Storytelling Lead - Trọng tâm Challenge 2)
> ⚠️ **Nhiệm vụ sống còn:** Challenge 2 bắt buộc phải có file `Video.mp4` (< 100MB, thời lượng tối đa 2 phút) nằm ngay tại thư mục gốc của GitHub.

* [ ] **Chuẩn bị công cụ:** Cài đặt phần mềm quay màn hình (OBS Studio, Camtasia, Loom, hoặc dùng phím tắt `Win + G` / `Win + Alt + R` trên Windows).
* [ ] **Thực hiện quay video (theo 4 phân cảnh chuẩn của BTC Tide):**
  1. **0:00 - 0:30 (The Possibility):** Giới thiệu CarePassport — nền tảng y tế đa viện loại bỏ rủi ro rò rỉ bệnh án, trao quyền tối thượng cho bệnh nhân.
  2. **0:30 - 0:50 (The Constraint):** Trình bày "Nút thắt niềm tin": Trong hệ thống viện truyền thống, Admin IT giữ Master Key nên có thể xem trộm/bán dữ liệu nhạy cảm (tâm thần, di truyền).
  3. **0:50 - 1:40 (The Prototype & TideCloak Role):**
     - Mở web `http://localhost:5173/`.
     - Thao tác Bệnh nhân bật chia sẻ Dị ứng, khóa Bệnh án Tâm thần.
     - Bấm vai Bác sĩ: Thấy mục được mở đã giải mã, mục khóa là chuỗi mật mã vàng (Ciphertext).
     - **Điểm nhấn ăn tiền:** Bấm vai Rogue Admin $\rightarrow$ Bấm "Force Unilateral DB Dump" $\rightarrow$ Chỉ vào banner đỏ **UNILATERAL OVERRIDE BLOCKED BY TIDECLOAK** (chứng minh hệ thống không hề có Master Key).
     - Bấm vai Ethics Overseer $\rightarrow$ Ký duyệt cấp cứu (Dual-Consensus 2-of-2).
  4. **1:40 - 2:00 (What Changes):** Tóm tắt lợi ích: Cứu sống bệnh nhân trong cấp cứu tức thời mà vẫn bảo vệ quyền riêng tư tuyệt đối bằng toán học.
* [ ] **Hậu kỳ & Xuất file:**
  - Xuất định dạng: `.mp4`.
  - Dung lượng: **< 100MB** (Nếu nặng hơn, dùng Handbrake hoặc converter nén lại).
  - Tên file bắt buộc: `Video.mp4`.
  - Giao lại cho Khánh trước **16:00** để push lên repo.

---

### 3. Phạm Chấn Khoa (AI / Machine Learning Lead - Trọng tâm Challenge 1)
* [ ] **Mở Notebook Challenge 1 trên Kaggle:**
  - Import file `RMIT_SGS_ComGa_C1.ipynb` lên Kaggle Notebook.
  - Bật môi trường Accelerator: **GPU T4 x 2**.
  - Kiểm tra kết nối dataset `rmit-hackathon-2026`.
* [ ] **Chạy Fine-tuning Model `xlm-roberta-large`:**
  - Chạy toàn bộ pipeline PyTorch đã tối ưu (Batch size = 4, Gradient Accumulation = 4, Class-weighted Loss, Gradient Checkpointing).
  - Theo dõi quá trình train 3 epochs, ghi nhận Macro-F1 trên tập validation.
* [ ] **Tạo và Nộp Submission:**
  - Kiểm tra file `submission.csv` đầu ra (đủ 6000 dòng test, 2 cột `id`, `label`).
  - Nộp file lên bảng xếp hạng Kaggle để ghi nhận điểm số chính thức.
  - Báo cáo kết quả Macro-F1 lại cho team trước **16:30**.

---

### 4. Cái Hoàng Bảo Kin (QA / Product & Documentation Lead)
* [ ] **Kiểm thử Web Prototype CarePassport:**
  - Chạy thử app trên trình duyệt cá nhân (`npm run dev`).
  - Test đầy đủ các kịch bản:
    - Bật/tắt các công tắc dữ liệu.
    - Bấm nút "Emergency Lockdown" xem có khóa sạch toàn bộ không.
    - Bấm các nút tấn công của Rogue Admin xem có ra thông báo chặn màu đỏ không.
    - Kiểm tra bảng Immutable Audit Trail bên phải xem có ghi log và chữ ký mã hóa không.
* [ ] **Rà soát tài liệu & Tiêu chí chấm điểm:**
  - Soát lại file `README.md` trong repo: Đảm bảo độ dài dưới 300 từ (hiện đang ~270 từ rất chuẩn), không bị lỗi cú pháp Markdown.
  - Chuẩn bị sẵn thông tin form nộp bài Challenge 2:
    - Link Form: `https://forms.gle/HRHYjnqB86j1LFS97`
    - Tên nhóm: `RMIT_SGS_ComGa_C2`
    - Link Public GitHub: `https://github.com/.../RMIT_SGS_ComGa_C2`
* [ ] **Hỗ trợ Hiếu:** Kiểm tra video demo sau khi xuất file (âm thanh rõ ràng, thời lượng dưới 2 phút, dung lượng dưới 100MB).

---

## ⏰ DÒNG THỜI GIAN HÀNH ĐỘNG (TIMELINE ĐẾN DEADLINE 18:00)

```
[14:00 - 15:30] 🚀 TÁC CHIẾN TỰ DO & SONG SONG
│  ├─ Khoa: Chạy fine-tune model trên Kaggle GPU.
│  ├─ Hiếu: Quay màn hình và lồng tiếng Video Demo 2 phút.
│  ├─ Kin: Test app, kiểm tra checklist & chuẩn bị form nộp.
│  └─ Khánh: Giám sát, code polish & hỗ trợ thành viên.
│
[15:30 - 16:30] 📦 TẬP HỢP VÀ CHỐT SẢN PHẨM
│  ├─ Hiếu nộp Video.mp4 cho Khánh.
│  ├─ Khánh commit Video.mp4 lên root repo GitHub & kiểm tra link repo.
│  └─ Khoa xuất file submission.csv và nộp Kaggle lần 1.
│
[16:30 - 17:15] 📝 NỘP BÀI CHÍNH THỨC
│  ├─ Khánh & Kin: Điền Google Form cho Challenge 2.
│  ├─ Khoa & Khánh: Kiểm tra leaderboard Challenge 1.
│  └─ Chụp ảnh xác nhận đã nộp thành công cả 2 bên.
│
[17:15 - 18:00] 🛡️ VÙNG ĐỆM AN TOÀN (BUFFER TIME)
   └─ Tuyệt đối KHÔNG commit thêm sau thời điểm này. Thư giãn chờ công bố kết quả!
```

---

## 📌 NGUYÊN TẮC PHỐI HỢP CỦA TEAM
1. **Thông tin minh bạch:** Có bất kỳ vướng mắc gì (lỗi GPU, video bị dài, lag...) phải báo ngay lên nhóm để Khánh và team hỗ trợ liền.
2. **Tuân thủ quy định:** Video **bắt buộc < 2 phút** và **< 100MB**; README **bắt buộc < 300 từ**; Repo **phải để Public**.
3. **Mục tiêu tối thượng:** Nộp bài thành công cả 2 Challenge trước 17:00!
