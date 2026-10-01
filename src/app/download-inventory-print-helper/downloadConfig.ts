export const DOWNLOAD_PAGE_PATH = "/tai-cai-dat-may-in";

export const INVENTORY_PRINT_HELPER_COPY = {
  platform: "Dành cho Windows 10/11 64-bit",
  usbPrerequisite: "Cắm máy in A4/A5 qua USB và cài driver để Windows nhận máy in trước khi thiết lập.",
  autoStart: "Sau khi cài, ứng dụng tự động mở khi đăng nhập Windows và chạy ở khay hệ thống.",
} as const;

export const inventoryPrintHelperDownloads = {
  exe: {
    label: "Bộ cài EXE",
    url: "/api/download-inventory-print-helper.php?format=exe",
    filename: "TN-Company-Inventory-Print-Helper-Setup.exe",
    checksumFile: "TN-Company-Inventory-Print-Helper-Setup.exe.sha256",
    checksumUrl: "/api/download-inventory-print-helper.php?format=exe-sha256",
    recommended: true,
  },
  zip: {
    label: "Bản ZIP dự phòng",
    url: "/api/download-inventory-print-helper.php?format=zip",
    filename: "tn-company-inventory-print-helper-windows-x64.zip",
    checksumFile: "tn-company-inventory-print-helper-windows-x64.zip.sha256",
    checksumUrl: "/api/download-inventory-print-helper.php?format=zip-sha256",
    recommended: false,
  },
} as const;
