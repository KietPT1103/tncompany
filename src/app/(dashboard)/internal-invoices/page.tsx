"use client";

import RoleGuard from "@/components/RoleGuard";
import InvoiceAdminPage from "../_components/InvoiceAdminPage";

export default function InternalInvoicesPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <InvoiceAdminPage
        scope="internal"
        title="Hóa đơn nội bộ"
        description="Theo dõi hóa đơn chi tiết phục vụ vận hành nội bộ, có thể tách riêng từng khoản như thầy thợ, vật tư, nguyên liệu."
        accentClassName="text-emerald-700"
      />
    </RoleGuard>
  );
}
