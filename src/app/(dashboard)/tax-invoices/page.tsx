"use client";

import RoleGuard from "@/components/RoleGuard";
import InvoiceAdminPage from "../_components/InvoiceAdminPage";

export default function TaxInvoicesPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <InvoiceAdminPage
        scope="tax"
        title="Hóa đơn bên thuế"
        description="Ghi nhận bill theo cách xuất cho bên thuế, có thể nhập nhiều dòng hàng nhưng tổng hợp theo hóa đơn chính."
        accentClassName="text-sky-700"
      />
    </RoleGuard>
  );
}
