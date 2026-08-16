import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "TN Admin",
  slug: "tn-company-admin",
  scheme: "tnadmin",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "vn.tncompany.admin",
  },
  android: {
    package: "vn.tncompany.admin",
    softwareKeyboardLayoutMode: "resize",
  },
  plugins: ["expo-router", "expo-secure-store"],
  owner: "tacachuta",
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    eas: { projectId: "ded96c53-b470-4f37-9253-8df3c239ff99" },
  },
};

export default config;
