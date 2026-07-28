import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "TN Company Nhập hàng",
  slug: "tn-company-inventory",
  scheme: "tncompany",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "vn.tncompany.inventory",
    infoPlist: {
      NSCameraUsageDescription: "Dùng camera để chụp hóa đơn nhập hàng.",
      NSLocationWhenInUseUsageDescription: "Dùng vị trí để đóng watermark xác thực lên ảnh."
    }
  },
  android: {
    package: "vn.tncompany.inventory",
    permissions: ["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-camera", { cameraPermission: "Cho phép chụp hóa đơn nhập hàng." }],
    ["expo-location", { locationWhenInUsePermission: "Cho phép lấy vị trí để đóng watermark lên ảnh." }]
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    eas: {
      projectId: "414755a7-39ea-4e7a-b61a-256a5828eb74"
    }
  }
};

export default config;
