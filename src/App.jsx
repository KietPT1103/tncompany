import React from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { pages } from "./data/siteData";
import LandingApp from "./LandingApp";
import DashboardLayout from "./app/(dashboard)/layout";
import BillsPage from "./app/(dashboard)/bills/page";
import CashFlowPage from "./app/(dashboard)/cash-flow/page";
import AccountManagementPage from "./app/(dashboard)/accounts-page";
import ActivityLogsPage from "./app/(dashboard)/activity-logs/page";
import CategoryManagementPage from "./app/(dashboard)/categories/page";
import DashboardPage from "./app/(dashboard)/page";
import InternalInvoicesPage from "./app/(dashboard)/internal-invoices/page";
import PayrollPage from "./app/(dashboard)/payroll/page";
import SalaryEstimatePage from "./app/(dashboard)/payroll-estimate-page";
import ProductsPage from "./app/(dashboard)/product/page";
import InventoryChecksPage from "./app/(dashboard)/product/checks/page";
import InventoryReceiptsPage from "./app/(dashboard)/product/receipts/page";
import ReportDetailPage from "./app/(dashboard)/reports/[id]/page";
import ReportsPage from "./app/(dashboard)/reports/page";
import SocialListeningPage from "./app/(dashboard)/social-listening/page";
import SeoArticlesPage from "./app/(dashboard)/seo-articles/page";
import TaxInvoicesPage from "./app/(dashboard)/tax-invoices/page";
import TimesheetPage from "./app/(dashboard)/timesheet/page";
import LoginPage from "./app/login/page";
import RoleGuard from "./components/RoleGuard";
import SeoManager from "./components/SeoManager";
import { useAuth } from "./context/AuthContext";

function ProtectedLayout({ allowedRoles }) {
  return (
    <RoleGuard allowedRoles={allowedRoles}>
      <Outlet />
    </RoleGuard>
  );
}

function AdminLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

function AdminIndexPage() {
  const { role, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (role === "manager") {
    return <Navigate to="/admin/payroll-estimate" replace />;
  }

  return <DashboardPage />;
}

export default function App() {
  const landingHashes = pages
    .filter((page) => page.id !== "home" && page.hash !== "/")
    .map((page) => page.hash);

  return (
    <>
      <SeoManager />
      <Routes>
        <Route path="/about" element={<LandingApp />} />
        <Route path="/" element={<LandingApp />} />
        <Route path="/ca-phe-ong-quan" element={<Navigate to="/" replace />} />
        <Route path="/home" element={<Navigate to="/about" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={<ProtectedLayout allowedRoles={["admin", "manager", "user", "server"]} />}
        >
          <Route element={<AdminLayout />}>
            <Route index element={<AdminIndexPage />} />
            <Route
              path="bills"
              element={
                <RoleGuard allowedRoles={["admin", "user", "server"]}>
                  <BillsPage />
                </RoleGuard>
              }
            />
            <Route path="pos" element={<Navigate to="/admin/bills" replace />} />
            <Route
              path="payroll-estimate"
              element={
                <RoleGuard allowedRoles={["admin", "manager"]}>
                  <SalaryEstimatePage />
                </RoleGuard>
              }
            />
            <Route element={<ProtectedLayout allowedRoles={["admin"]} />}>
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="cash-flow" element={<CashFlowPage />} />
              <Route path="product" element={<ProductsPage />} />
              <Route path="product/checks" element={<InventoryChecksPage />} />
              <Route path="product/receipts" element={<InventoryReceiptsPage />} />
              <Route path="categories" element={<CategoryManagementPage />} />
              <Route path="accounts" element={<AccountManagementPage />} />
              <Route path="activity-logs" element={<ActivityLogsPage />} />
              <Route path="internal-invoices" element={<InternalInvoicesPage />} />
              <Route path="payroll" element={<PayrollPage />} />
              <Route path="social-listening" element={<SocialListeningPage />} />
              <Route path="seo-articles" element={<SeoArticlesPage />} />
              <Route path="tax-invoices" element={<TaxInvoicesPage />} />
              <Route path="timesheet" element={<TimesheetPage />} />
            </Route>
          </Route>
        </Route>
        {landingHashes.map((path) => (
          <Route key={path} path={path} element={<LandingApp />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
