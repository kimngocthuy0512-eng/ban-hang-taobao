# Hướng dẫn triển khai tự động

## Frontend (Cloudflare Pages)

1. Tạo project trên [Cloudflare Pages](https://pages.cloudflare.com/) trỏ vào repo này.
2. Trong phần “Build settings”, chọn:
   - **Framework preset**: `None`
   - **Build command**: để trống
   - **Build output directory**: `.`
3. Tạo các `Secret` sau cho GitHub Actions:
   - `CLOUDFLARE_API_TOKEN` (chỉ cần quyền deploy Pages)
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_PROJECT_NAME`
4. Workflow `.github/workflows/deploy-pages.yml` sẽ tự động chạy mỗi lần push lên `main` và cập nhật `https://ban-hang-taobao.pages.dev`.

## Backend crawler/importer (Render)

1. Tạo service Node.js trong Render, cấu hình command `npm run start` trong thư mục `server/` và cho phép cổng 8787.
2. Đảm bảo môi trường Render có Chromium để Playwright chạy, đồng thời đăng nhập Taobao một lần (Playwright mở trình duyệt để lấy cookie, lưu trong `server/data/taobao-cookie.txt`).
3. Tạo `Secret` GitHub:
   - `RENDER_API_KEY`
   - `RENDER_SERVICE_ID`
4. Workflow `.github/workflows/deploy-backend.yml` sẽ cài dependencies trong `server/`, chạy `render deploy`, và đưa phiên bản mới vào môi trường production lúc push lên `main`.

## Kết nối frontend với backend

1. Trên trang admin (`/admin-settings.html`), nhập:
   - **Import URL** → `https://<render-host>/import`
   - **Sync URL** → `https://<render-host>/sync`
2. Khởi chạy “Auto import Taobao” trong admin để backend tự crawl trang đã cấu hình, log được ghi vào `server/data/taobao-auto.log`.

Các workflow đã chuẩn bị sẵn và chỉ chờ được cấp các `Secret` để auto deploy. Nếu bạn muốn dùng dịch vụ khác ngoài Render, hãy điều chỉnh bước deploy tương ứng hoặc cung cấp tên CLI để mình thay thế. 
