# Workflow AI

**Workflow AI** là một ứng dụng máy tính (Desktop App) hoạt động độc lập, có thể chạy offline, chuyên hỗ trợ học tập và quản lý tài liệu dựa trên Trí tuệ Nhân tạo (AI). Ứng dụng giúp bạn quản lý tài liệu, ghi chú thông minh và tự động tạo ra các học liệu tương tác như Flashcards, Quizzes, Sơ đồ tư duy (Concept Maps) và Lộ trình học tập trực tiếp từ các tài liệu cá nhân của bạn.

---

## 📥 Tải xuống & Cài đặt (Dành cho người dùng)

Bạn không cần biết lập trình để sử dụng Workflow AI. Chỉ cần tải bản cài đặt có sẵn cho hệ điều hành của bạn!

### Dành cho macOS (MacBook)
1. Truy cập vào trang **[Releases](https://github.com/nguyenhoangkhoi2312/workflow/releases)** của dự án.
2. Tìm phiên bản mới nhất (ví dụ: `v1.0.0`) và tải xuống file có đuôi **`.dmg`** (ví dụ: `Workflow-0.0.0-arm64.dmg`).
3. Mở file `.dmg` vừa tải về.
4. Kéo biểu tượng của **Workflow** thả vào thư mục **Applications** (Ứng dụng).
5. Mở Launchpad hoặc thư mục Applications và khởi động ứng dụng! *(Lưu ý: Nếu macOS cảnh báo ứng dụng tải từ Internet, hãy vào `System Settings` > `Privacy & Security` và cho phép mở).*

### Dành cho Windows
1. Truy cập vào trang **[Releases](https://github.com/nguyenhoangkhoi2312/workflow/releases)** của dự án.
2. Tìm phiên bản mới nhất (ví dụ: `v1.0.0`) và tải xuống file cài đặt có đuôi **`.exe`** (ví dụ: `Workflow Setup 0.0.0.exe`).
3. Nhấn đúp chuột vào file `.exe` vừa tải về để bắt đầu quá trình cài đặt.
4. Làm theo các bước hướng dẫn trên màn hình cài đặt.
5. Khi cài đặt xong, biểu tượng **Workflow** sẽ xuất hiện trên Desktop của bạn. Bấm vào để bắt đầu học tập!

---

## ⚙️ Cài đặt Trí tuệ Nhân tạo (AI Engine)

Workflow AI cho phép bạn chọn lựa "bộ não" để phân tích tài liệu tuỳ theo nhu cầu cấu hình và quyền riêng tư của bạn. Mở ứng dụng, bấm vào **Cài đặt hệ thống (Settings)** ở góc trái dưới màn hình để thiết lập.

### 1. Sử dụng Cloud API (Google Gemini) - Khuyên dùng 🌟
Phương pháp này sử dụng máy chủ siêu tốc của Google, cho tốc độ xử lý nhanh nhất, thông minh nhất và không tốn tài nguyên máy tính của bạn.
- **Bước 1**: Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey) và đăng nhập bằng tài khoản Google.
- **Bước 2**: Bấm nút **Create API Key**.
- **Bước 3**: Sao chép đoạn mã (API Key) vừa tạo.
- **Bước 4**: Quay lại phần **Cài đặt** trong Workflow app, dán API Key vào và lưu lại.

### 2. Sử dụng Local AI (Ollama) - Bảo mật 100% 🔒
Phương pháp này sử dụng sức mạnh trực tiếp từ máy tính của bạn. Mọi tài liệu và dữ liệu đều không bao giờ bị đẩy lên Internet. Thích hợp cho máy tính có RAM >= 8GB.
- **Bước 1**: Tải và cài đặt phần mềm [Ollama](https://ollama.com/) vào máy tính.
- **Bước 2**: Mở Terminal (Mac) hoặc Command Prompt (Windows).
- **Bước 3**: Tải mô hình AI. Workflow app sẽ gợi ý mô hình phù hợp nhất với máy tính của bạn. Nhập lệnh tương ứng (Ví dụ: `ollama pull qwen2.5:3b` hoặc `ollama pull gemma2:9b`).
- **Bước 4**: Vào **Cài đặt** trong Workflow app, chọn chuyển sang chế độ Local Model và chọn tên mô hình bạn vừa tải về.

---

## 🚀 Tính năng nổi bật

- **Studio Tài liệu (Document Studio)**: Tải lên và đọc các file PDF, DOCX, TXT với giao diện chia đôi màn hình tiện lợi.
- **Trợ lý AI (AI Assistant)**: Chat, hỏi đáp và khai thác kiến thức trực tiếp với tài liệu của bạn.
- **Công cụ Học tập Thông minh**: Chỉ với 1 click để tự động tạo Flashcards, Quizzes, Hướng dẫn học, Sơ đồ tư duy (Mindmaps).
- **Lặp lại Ngắt quãng (Spaced Repetition)**: Ôn tập từ vựng, kiến thức bằng hệ thống nhắc nhở khoa học (giống Anki) giúp nhớ lâu hơn.

---

## 💻 Hướng dẫn cho Lập trình viên (Developer Setup)

Nếu bạn muốn chỉnh sửa mã nguồn và chạy ứng dụng trong môi trường lập trình.

### Yêu cầu hệ thống (Prerequisites)
- Node.js (v20+)
- Python (v3.10+)

### 1. Cài đặt Backend (Python)
Mở Terminal, di chuyển vào thư mục `backend` và cài đặt môi trường ảo:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Trên Windows dùng lệnh: venv\Scripts\activate
pip install -r requirements.txt
```
Chạy máy chủ Backend:
```bash
python main.py
```
*(Máy chủ FastAPI sẽ chạy tại địa chỉ `http://localhost:8000`)*

### 2. Cài đặt Frontend (React)
Mở một tab Terminal mới, ở thư mục gốc của dự án, cài đặt thư viện:
```bash
npm install
```
Chạy máy chủ Vite phục vụ phát triển:
```bash
npm run dev
```

### 3. Build & Chạy thử Desktop App (Electron)
Để chạy app như một phần mềm máy tính trong lúc lập trình:
```bash
npm run electron:dev
```
Để đóng gói và xuất xưởng file `.dmg` (Mac) hoặc `.exe` (Windows):
```bash
npm run electron:build
```

---

## 📝 Giấy phép (License)
Dự án được phân phối dưới giấy phép MIT License.
