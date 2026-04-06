# Local dev

## Recommended: full local

1. Create `.env.local` from `.env.local.example`
2. Keep:

```env
VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=http://127.0.0.1:8000
```

3. Copy `public/api/config.php.example` to `public/api/config.php`
4. Fill valid local MySQL credentials in `public/api/config.php`
5. Run:

```bash
npm run dev:full
```

6. Open:

```text
http://localhost:5173/login
```

This starts:

- Vite on `http://127.0.0.1:5173`
- PHP built-in server on `http://127.0.0.1:8000`

Vite will proxy `/api/*` to the local PHP server, so pages like payroll and employees use the PHP files inside this repo.

## Frontend local, API on server

1. Create `.env.local` from `.env.local.example`
2. Keep:

```env
VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=https://tnservice.vn
```

3. Run:

```bash
npm run dev
```

4. Open:

```text
http://localhost:5173/login
```

Vite will proxy `/api/*` to `https://tnservice.vn/api/*`, so the browser will not hit CORS.

Note: if a PHP endpoint exists only in this repo and has not been deployed to `tnservice.vn` yet, Vite proxying to the server will still return `404`.

## If you want full local

- run PHP locally with `php -S 127.0.0.1:8000 -t public`
- run MySQL locally
- point `VITE_PROXY_TARGET` or `VITE_API_BASE_URL` to that local PHP server
- or simply use `npm run dev:full`
