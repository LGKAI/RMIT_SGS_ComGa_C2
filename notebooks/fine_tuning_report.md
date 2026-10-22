# BÁO CÁO PHƯƠNG PHÁP HUẤN LUYỆN (FINE-TUNING METHODOLOGY REPORT)
## Cuộc thi: RMIT Hackathon 2026 — Challenge 1: Multilingual Prompt-Attack Classification
* **Đội thi:** `RMIT_SGS_ComGa_C1`
* **Mô hình lựa chọn:** `FacebookAI/xlm-roberta-large` (Encoder 560M tham số)
* **Nguồn Model Kaggle:** [aisuko/xlm-roberta-large](https://www.kaggle.com/models/aisuko/xlm-roberta-large/Transformers/default)
* **Mục tiêu:** Phân loại 3 lớp prompt (`BENIGN`, `JAILBREAK`, `PROMPT_INJECTION`) đa ngôn ngữ, tối ưu hóa chỉ số **Macro-averaged F1 Score**.

---

## 1. TỔNG QUAN BÀI TOÁN & PHÂN TÍCH DỮ LIỆU THỰC TẾ

### 1.1. Mục tiêu và Thể lệ
Bài toán yêu cầu xây dựng một mô hình phòng thủ **AI Protector** để phát hiện các cuộc tấn công prompt bằng các ngôn ngữ ngoài tiếng Anh (tiếng Bồ Đào Nha `pt`, tiếng Pháp `fr`, tiếng Ý `it`) và tiếng Anh `en`.
* **Tập huấn luyện (`train.csv`):** 14,000 dòng gồm các trường `[id, text, language, label]`.
* **Tập kiểm tra (`test.csv`):** 6,000 dòng gồm các trường `[id, text, language]`.
* **Giới hạn thi đấu:** Tối đa **6 lượt nộp bài (submissions)**.

### 1.2. Khảo sát & Phân tích Dữ liệu Thực tế (EDA Findings)
Qua phân tích chuyên sâu tập dữ liệu `train.csv` và `test.csv`, chúng tôi phát hiện 3 đặc trưng cốt lõi:

1. **Sự mất cân bằng nhãn nghiêm trọng (Severe Class Imbalance):**
   * `BENIGN`: **62.0%** (8,680 mẫu) — Các câu lệnh thông thường, an toàn.
   * `JAILBREAK`: **31.0%** (4,340 mẫu) — Câu lệnh tìm cách phá vỡ quy tắc an toàn của mô hình.
   * `PROMPT_INJECTION`: **7.0%** (980 mẫu) — Câu lệnh ghi đè chỉ thị hệ thống (Lớp thiểu số).
   * **Hệ quả đối với Metric Macro-F1:** Macro-F1 tính trọng số đồng đều 33.3% cho mỗi lớp:
     $$\text{Macro-F1} = \frac{F1_{\text{BENIGN}} + F1_{\text{JAILBREAK}} + F1_{\text{PROMPT\_INJECTION}}}{3}$$
     Nếu mô hình thiên vị lớp chiếm đa số và dự đoán toàn bộ là `BENIGN`, điểm số chỉ đạt vỏn vẹn **~0.26**. Việc bắt chính xác lớp thiểu số `PROMPT_INJECTION` quyết định trực tiếp đến hơn 1/3 tổng điểm thi đấu.

2. **Đặc trưng phân bố ngôn ngữ (Multilingual Disparity):**
   * Tỉ lệ ngôn ngữ: Tiếng Bồ Đào Nha (`pt` ~50%), Pháp (`fr` ~25%), Ý (`it` ~20%), Anh (`en` ~10%).
   * Cả tập train và tập test đều duy trì chính xác phân bố ngôn ngữ này.
   * Hơn 90% dữ liệu không phải tiếng Anh — đúng với ngữ cảnh "Low-Resource for AI Safety" mà đề bài nhắm tới.

3. **Phân bố độ dài văn bản:**
   * `PROMPT_INJECTION` thường có độ dài rất ngắn (trung vị: 16 từ).
   * `JAILBREAK` thường dài và phức tạp (trung vị: 86 từ, 75% dưới 130 từ).
   * `BENIGN` dao động rộng (trung vị: 18 từ, có mẫu dài cá biệt).
   * Thiết lập `MAXLEN = 256` token là hoàn hảo để bao phủ trên 98% toàn bộ thông tin văn bản mà không gây lãng phí bộ nhớ.

---

## 2. KIẾN TRÚC MÔ HÌNH & CHIẾN LƯỢC HUẤN LUYỆN (METHODOLOGY)

Để giải quyết bài toán với model `FacebookAI/xlm-roberta-large` trên phần cứng Kaggle (GPU Tesla T4 15GB VRAM), chúng tôi triển khai chiến lược huấn luyện 5 trụ cột:

```
+-----------------------------------------------------------------------------------+
|                           PIPELINE CHIẾN LƯỢC TOÀN DIỆN                           |
+-----------------------------------------------------------------------------------+
|  1. Language-Aware Formatting: "[" + language + "] " + text                      |
|  2. Stratified Cross-Split: Stratify theo (Label + Language)                      |
|  3. Class-Weighted Loss: Trọng số phạt nghịch đảo tần suất (w_inj = 4.76)         |
|  4. VRAM Engineering: Gradient Checkpointing + Gradient Accumulation + Freeze Emb|
|  5. Logit-Bias Tuning: Post-processing tối đa hóa Macro-F1 trên Validation         |
+-----------------------------------------------------------------------------------+
```

### Trụ cột 1: Xử lý Mất Cân Bằng bằng Weighted Cross-Entropy Loss
Thay vì hàm mất mát thông thường, chúng tôi sử dụng Cross-Entropy có đánh trọng số lớp:
$$\mathcal{L} = -\sum_{c=1}^{3} w_c \cdot y_c \log(p_c)$$
Trong đó trọng số $w_c$ được tính toán tự động theo công thức cân bằng:
$$w_c = \frac{N}{3 \cdot N_c}$$
* $w_{\text{BENIGN}} = 0.5376$
* $w_{\text{JAILBREAK}} = 1.0753$
* $w_{\text{PROMPT\_INJECTION}} = 4.7619$

> **Ý nghĩa:** Khi mô hình phân loại sai một mẫu `PROMPT_INJECTION`, mức phạt gradient sẽ gấp gần **9 lần** so với việc phân loại sai một mẫu `BENIGN`. Điều này ngăn mô hình "lười biếng" bỏ qua lớp hiếm, kéo Recall và F1 của `PROMPT_INJECTION` lên mức tối đa.

### Trụ cột 2: Tận dụng Metadata Ngôn ngữ (Language-Aware Prompting)
Mỗi mẫu văn bản trước khi đưa vào Tokenizer được chuẩn hóa theo định dạng:
$$x_{\text{formatted}} = \text{"["} + \text{language} + \text{"] "} + \text{text}$$
* Ví dụ: `[pt] Explique como funciona...` hoặc `[fr] Vous devez ignorer...`
* **Ý nghĩa:** Thẻ tag đầu chuỗi đóng vai trò như một tín hiệu điều hướng (prefix conditioning), kích hoạt các vùng biểu diễn ngữ nghĩa tương ứng của mạng XLM-RoBERTa đa ngôn ngữ ngay từ các tầng self-attention đầu tiên.

### Trụ cột 3: Chia tập Validation Đa chiều (Multi-attribute Stratification)
Chúng tôi chia tập Train/Validation theo tỉ lệ **85% / 15%** (11,900 train / 2,100 validation).
* Tiêu chí phân tầng (Stratify): Sử dụng khóa kết hợp `label + "_" + language` (tổng cộng $3 \times 4 = 12$ nhóm con).
* **Ý nghĩa:** Đảm bảo mọi ngôn ngữ và mọi lớp (đặc biệt là các lớp cực hiếm như `PROMPT_INJECTION` tiếng Anh chỉ có ~98 mẫu) đều được đại diện chính xác trong tập Validation theo đúng tỉ lệ thực tế.

---

## 3. KỸ THUẬT QUẢN TRỊ BỘ NHỚ VRAM (VRAM ENGINEERING)

Mô hình `xlm-roberta-large` có **560 triệu tham số** (24 layers, hidden size 1024). Việc huấn luyện full model trên card Tesla T4 (14.56 GiB VRAM) rất dễ bị lỗi `CUDA out of memory` nếu không tối ưu. Chúng tôi áp dụng 4 kỹ thuật đồng thời:

| Kỹ thuật | Nguyên lý hoạt động | Mức giảm VRAM |
| :--- | :--- | :--- |
| **Gradient Checkpointing** | Không lưu activation của tất cả 24 layers trong forward pass; chỉ tính toán lại khi backward | **Giảm ~75% VRAM của Activations** (từ ~6GB xuống ~1GB) |
| **Gradient Accumulation** (`MICRO_BS=4`, `ACCUM=4`) | Chia bước forward thành các micro-batch kích thước 4, tích lũy gradient qua 4 lần rồi mới gọi `optimizer.step()` | **Giảm đỉnh VRAM từ 14GB xuống ~6.5GB** trong khi effective batch size vẫn đạt 16 |
| **Đóng băng Word Embeddings** | Giữ cố định ma trận `word_embeddings` ($250,002 \times 1024 \approx 256\text{M}$ tham số) | **Tiết kiệm ~3 GB VRAM** của bộ nhớ optimizer AdamW (không cần lưu first/second moments) |
| **Mixed Precision (AMP FP16)** | Sử dụng `torch.autocast('cuda', dtype=torch.float16)` và `GradScaler` | **Tăng tốc 2x**, giảm bộ nhớ lưu trữ trọng số và kích hoạt |

---

## 4. CHI TIẾT CẤU HÌNH SIÊU THAM SỐ (HYPERPARAMETERS)

| Tham số | Giá trị | Giải thích |
| :--- | :--- | :--- |
| **Mô hình nền** | `FacebookAI/xlm-roberta-large` | 24-layer, 1024-hidden, 16-heads, 560M params |
| **Độ dài tối đa (`MAXLEN`)** | `256` | Bao phủ 98% câu lệnh, cân bằng tốc độ và ngữ cảnh |
| **Số Epochs** | `3` | Đủ để hội tụ fine-tuning cho Large model mà không overfit |
| **Tốc độ học (`Learning Rate`)** | `1.5e-5` | Mức chuẩn tối ưu cho các mô hình RoBERTa Large |
| **Optimizer** | `AdamW` (Weight decay = 0.01) | Tối ưu hóa có điều chuẩn L2 |
| **LR Scheduler** | Linear Warmup with Cosine Decay | Warmup 10% tổng số bước để ổn định gradient ban đầu |
| **Micro Batch Size** | `4` | Kích thước batch tức thời cho mỗi GPU step |
| **Gradient Accumulation** | `4` steps | Effective Batch Size = $4 \times 4 = 16$ |
| **Gradient Clipping** | `1.0` | Chống hiện tượng nổ gradient (Exploding Gradients) |
| **Evaluation Strategy** | Per Epoch | Lưu checkpoint có `Macro-F1` cao nhất trên Validation |

---

## 5. HẬU XỬ LÝ: TINH CHỈNH LOGIT BIAS (POST-PROCESSING)

Sau khi huấn luyện mô hình tốt nhất, xác suất thô đầu ra đôi khi vẫn bị lệch nhẹ về phía lớp đa số do ngưỡng quyết định mặc định là $\arg\max$.
* Chúng tôi áp dụng kỹ thuật **Additive Logit Bias**:
  $$z_{\text{adjusted}} = z + [0, b_1, b_2]$$
* Thực hiện tìm kiếm lưới mịn (grid search) trên tập Validation cho $b_1, b_2 \in [-1.0, 1.5]$ với bước nhảy 0.25 để tìm bộ bias đẩy chỉ số **Macro-F1** lên đỉnh cao nhất.
* Áp dụng trực tiếp bộ vector bias này lên tập Test trước khi xuất file kết quả cuối cùng.

---

## 6. QUY TRÌNH NỘP BÀI & CHIẾN LƯỢC 6 SUBMISSIONS

Do quy định cuộc thi chỉ cho phép **tối đa 6 lượt nộp bài**:

1. **Lượt 1 (Submission Baseline an toàn):** Nộp kết quả từ notebook chuẩn hóa hiện tại ngay khi chạy xong. Đảm bảo đạt 100% điểm môn thi theo quy định của ban tổ chức (*"You earn full Challenge 1 marks once you successfully submit your first valid result"*).
2. **Lượt 2 & 3 (Threshold / Bias Tuning):** Đánh giá tác động của Logit Bias để tối ưu điểm số trên Public Leaderboard.
3. **Lượt 4 & 5 (K-Fold Ensemble):** Chạy 5-Fold Cross Validation và lấy trung bình xác suất (soft-voting) từ 5 mô hình để loại bỏ hoàn toàn độ lệch dữ liệu.
4. **Lượt 6 (Final Submission):** Chọn mô hình có điểm Cross-Validation F1 ổn định và cao nhất để chốt điểm số chung cuộc trước 18:00 ngày 22/10/2026.

---
*Báo cáo được chuẩn bị bởi đội RMIT_SGS_ComGa_C1 — RMIT Hackathon 2026.*
