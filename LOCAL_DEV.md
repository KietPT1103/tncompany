# Local dev

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

## If you want full local

- run PHP locally with `php -S 127.0.0.1:8000 -t public`
- run MySQL locally
- point `VITE_PROXY_TARGET` or `VITE_API_BASE_URL` to that local PHP server
