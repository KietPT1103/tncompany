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
import EditSeoArticlePage from "./app/(dashboard)/seo-articles/[id]/page";
import NewSeoArticlePage from "./app/(dashboard)/seo-articles/new/page";
import SeoArticlesPage from "./app/(dashboard)/seo-articles/page";
import TaxInvoicesPage from "./app/(dashboard)/tax-invoices/page";
import TimesheetPage from "./app/(dashboard)/timesheet/page";
import LoginPage from "./app/login/page";
import RoleGuard from "./components/RoleGuard";
import SeoManager from "./components/SeoManager";
import { useAuth } from "./context/AuthContext";
import { getDefaultRouteForUser } from "./lib/permissions";

function ProtectedLayout({ allowedRoles, inferPermission = true }) {
  return (
    <RoleGuard allowedRoles={allowedRoles} inferPermission={inferPermission}>
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
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const nextPath = getDefaultRouteForUser(user);
  return nextPath === "/" ? <DashboardPage /> : <Navigate to={nextPath} replace />;
}

export default function App() {
  const landingHashes = pages.filter((page) => page.hash !== "/").map((page) => page.hash);

  return (
    <>
      <SeoManager />
      <Routes>
        <Route path="/" element={<LandingApp />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedLayout
              allowedRoles={["admin", "manager", "user", "server"]}
              inferPermission={false}
            />
          }
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
              <Route path="seo-articles/new" element={<NewSeoArticlePage />} />
              <Route path="seo-articles/:id" element={<EditSeoArticlePage />} />
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
