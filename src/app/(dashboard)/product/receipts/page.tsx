import { Navigate } from "react-router-dom";

/** Backward-compatible alias for the original inventory receipt route. */
export default function InventoryReceiptsLegacyRoute() {
  return <Navigate to="/admin/inventory-receipts" replace />;
}
