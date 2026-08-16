# TN Admin Mobile

Ứng dụng Expo riêng dành cho quản trị viên TN Company. App dùng chung API với hệ thống web nhưng có package Android/iOS và phiên đăng nhập độc lập.

## Chạy tại máy

1. Sao chép `.env.example` thành `.env` và điền URL API, ví dụ `https://ten-mien.vn/api`.
2. Cài dependency bằng `npm install`.
3. Chạy `npm start`, sau đó mở bằng Expo Go hoặc simulator.

## Kiểm tra và đóng gói

- `npm run typecheck`: kiểm tra TypeScript.
- `npx expo export --platform android`: kiểm tra Metro bundle Android.
- `npx eas build -p android --profile preview`: tạo APK cài nội bộ.
- `npx eas build -p android --profile production`: tạo Android App Bundle phát hành.

App chỉ chấp nhận tài khoản có vai trò `admin`. Dữ liệu dashboard được lấy từ endpoint hóa đơn hiện tại và tự làm mới khi người dùng kéo xuống.
