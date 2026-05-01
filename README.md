# T&N Services Landing Page (React + Vite)

Landing page giới thiệu công ty **Công ty TNHH Thương mại Dịch vụ đầu tư Tổng hợp T-N**.

## Chạy dự án

```bash
npm install
npm run dev
```

## Build production

```bash
npm run build
npm run preview
```

## Auto deploy len DirectAdmin

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) se tu dong build tren GitHub Actions va sync `dist/` len server moi khi push vao nhanh `main`.

Can cau hinh tren GitHub:

- Repository secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
- Repository variables: `FTP_SERVER_DIR`
- Repository variables tuy chon: `FTP_PORT` (mac dinh `21`), `FTP_PROTOCOL` (mac dinh `ftp`, nen dung `ftps` neu host ho tro)

`FTP_SERVER_DIR` thuong la `domains/tnservice.vn/public_html/` hoac `public_html/`, tuy FTP user cua host dang bi chroot den dau.

Workflow se giu nguyen cac file/folder chi ton tai tren server:

- `api/config.php`
- `uploads/`
- `deploy.php`
- `webhook.php`
- `test.php`

Luu y:

- `public/api/config.php` dang bi gitignore, nen can tao san 1 lan tren server tu `public/api/config.php.example`.
- Sau khi setup xong, quy trinh se la `git push` -> GitHub Actions build -> file moi duoc day len `public_html`, khong can upload `dist.zip` hay giai nen thu cong nua.
