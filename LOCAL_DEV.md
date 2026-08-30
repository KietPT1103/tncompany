# Local development

## Chạy toàn bộ code ở local

1. Sao chép `.env.local.example` thành `.env.local`.
2. Khởi động MySQL/MariaDB local.
3. Điền cấu hình local trong `.env.local`:

```env
APP_ENV=local
APP_DEBUG=true
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=tn_company_local
DB_USER=tn_company_dev
DB_PASSWORD=tn_company_local_2026

VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=http://127.0.0.1:8000
```

4. Chạy:

```bash
npm run dev:full
```

5. Mở `http://localhost:5173/login`.

Lệnh trên khởi động:

- Vite tại `http://127.0.0.1:5173`.
- PHP API local tại `http://127.0.0.1:8000`.
- TikTok social-listening worker.

Vite proxy `/api/*` vào PHP local, vì vậy mọi thay đổi backend trong `public/api` có hiệu lực ngay.

## Cấu hình production

Production dùng file `.env` tại `domains/tnservice.vn/.env`, nằm ngoài `public_html`. Tạo file này dựa trên `.env.server.example`.

`public/api/config.php` là code chung đọc biến môi trường. Không tạo hoặc deploy `public/api/config.local.php`.

Các file `.env` và `.env.local` chứa thông tin bí mật, không được commit.
