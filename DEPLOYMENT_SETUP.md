# 📋 Hướng dẫn cấu hình Deployment Tự động

## ✅ Các lỗi đã được sửa

### 1. **Deploy Backend (Render)**
- ✅ Loại bỏ lệnh `render-cli` không hợp lệ
- ✅ Sử dụng Render Deploy Hook (cách tiêu chuẩn của Render)
- ✅ Thêm kiểm tra và thông báo lỗi
- ✅ Cấu hình Node.js cache cho tốc độ build nhanh hơn

### 2. **Deploy Frontend (Cloudflare Pages)**
- ✅ Thêm path triggers để chỉ deploy khi cần
- ✅ Cấu hình `workingDirectory` đúng
- ✅ Thêm thông báo success/failure
- ✅ Fetch-depth cho rebase chính xác

### 3. **Tệp cấu hình mới**
- ✅ `render.yaml` - Cấu hình service trên Render
- ✅ `.env.example` - Template biến môi trường

---

## 🚀 Bước 1: Cấu hình GitHub Secrets

### Frontend - Cloudflare Pages
1. Vào **Settings → Secrets and variables → Actions**
2. Thêm 3 secrets sau:
   - `CLOUDFLARE_API_TOKEN` - Lấy từ https://dash.cloudflare.com/
   - `CLOUDFLARE_ACCOUNT_ID` - ID tài khoản Cloudflare
   - `CLOUDFLARE_PROJECT_NAME` - Tên project Pages (vd: `ban-hang-taobao`)

### Backend - Render Deployment
1. Tạo service mới trên [Render.com](https://render.com/)
   - **Name**: `taobao-shop-backend`
   - **Runtime**: Node
   - **Build command**: `cd server && npm ci --omit=dev`
   - **Start command**: `cd server && npm start`
   - **Port**: 8787

2. Vào **Settings → Deploy Webhook → Copy URL**
3. Thêm GitHub Secret:
   - `RENDER_DEPLOY_HOOK` - URL từ Render webhook

---

## 📝 Bước 2: Cấu hình môi trường

### Trên máy cục bộ
```bash
# Sao chép từ template
cp .env.example .env

# Chỉnh sửa các giá trị
nano .env
```

### Trên Render Dashboard
1. Vào Service → **Environment**
2. Thêm các biến:
   - `PORT`: `8787`
   - `NODE_ENV`: `production`
   - `TAOBAO_LOGIN_TIMEOUT`: `300000`
   - `TAOBAO_LOGIN_MIN_WAIT`: `60000`

---

## 🔄 Bước 3: Kiểm tra Workflows

### Frontend Workflow (`deploy-pages.yml`)
```yaml
Triggers:
  ✅ Push to main branch
  ✅ Changes trong: *.html, assets/**, .github/workflows/
  ✅ Tự động build và deploy lên Cloudflare Pages
```

### Backend Workflow (`deploy-backend.yml`)
```yaml
Triggers:
  ✅ Push to main branch
  ✅ Changes trong: server/**, .github/workflows/
  ✅ Cài dependencies
  ✅ Trigger Render deployment hook
```

---

## 🧪 Bước 4: Test Deployment

### Test Frontend
```bash
# Chỉnh sửa một file HTML
echo "<!-- Updated: $(date) -->" >> index.html
git add index.html
git commit -m "test: cloudflare pages deployment"
git push origin main
# Kiểm tra: https://github.com/user/repo/actions
```

### Test Backend
```bash
# Chỉnh sửa một file trong server/
echo "// Updated at $(date)" >> server/index.js
git add server/index.js
git commit -m "test: render backend deployment"
git push origin main
# Kiểm tra: https://github.com/user/repo/actions
```

---

## 📊 Cấu trúc Project sau cấu hình

```
ban-hang-taobao/
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml      ✅ Frontend → Cloudflare Pages
│       └── deploy-backend.yml    ✅ Backend → Render
├── render.yaml                   ✅ Cấu hình Render
├── .env.example                  ✅ Template biến môi trường
├── server/
│   ├── index.js                  (Express server)
│   ├── package.json
│   ├── scripts/
│   └── src/
├── assets/
│   ├── app.js
│   ├── styles.css
│   └── images/
└── *.html                        (Frontend pages)
```

---

## 🔧 Troubleshooting

### Frontend không deploy
- ❌ Kiểm tra `CLOUDFLARE_API_TOKEN` có hợp lệ
- ❌ Kiểm tra `CLOUDFLARE_PROJECT_NAME` đúng tên trên Pages
- ✅ Xem logs: GitHub Actions → deploy-pages

### Backend không deploy
- ❌ Kiểm tra `RENDER_DEPLOY_HOOK` URL đúng
- ❌ Kiểm tra service trên Render đang active
- ✅ Xem logs: GitHub Actions → deploy-backend
- ✅ Xem logs Render: Dashboard → Service → Logs

### Lỗi build server
```bash
# Test cục bộ
cd server
npm ci
npm start

# Kiểm tra Node version
node --version  # Cần >= 18
npm --version   # Cần >= 8
```

---

## 📞 Liên hệ hỗ trợ

- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **Render Docs**: https://render.com/docs
- **GitHub Actions Docs**: https://docs.github.com/en/actions

---

✅ **Tất cả cấu hình đã được sửa và sẵn sàng hoạt động!**
