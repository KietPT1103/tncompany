# MySQL migration bootstrap

This repo now contains the first MySQL/PHP foundation for replacing Firebase on shared hosting.
The admin core has been moved to PHP/MySQL for these modules:

- auth/login
- dashboard cost save flow
- categories
- products
- reports
- cash-flow

## Files

- `database/schema.sql`
- `public/api/config.php.example`
- `public/api/_lib/bootstrap.php`
- `public/api/_lib/db.php`
- `public/api/_lib/auth.php`
- `public/api/_lib/response.php`
- `public/api/health.php`
- `public/api/auth.php`
- `public/api/categories.php`
- `public/api/products.php`
- `public/api/reports.php`

## Hosting setup

1. Copy `public/api/config.php.example` to `public/api/config.php`.
2. Fill the real MySQL credentials in `public/api/config.php`.
3. Import `database/schema.sql` into phpMyAdmin.
4. Open `/api/health.php` on the deployed domain to verify MySQL is reachable.
5. Open `/api/auth.php?action=seed` with a `POST` request from the login page quick action to create default users.

## Default accounts

Use the quick action on `#/login` to seed these accounts into MySQL:

- `admin / admin123`
- `thungan1 / thungan1`
- `thungan2 / thungan2`
- `thungan3 / thungan3`
- `phucvu1 / phucvu1`

## Current DB values confirmed

- `DB_HOST=localhost`
- `DB_NAME=tnservic69a7_tnservice`
- `DB_USER=tnservic69a7_tnservice`

Do not commit the real password into git.
