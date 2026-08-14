import React from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { pages } from "./data/siteData";
import LandingApp from "./LandingApp";
import DashboardLayout from "./app/(dashboard)/layout";
import BillsPage from "./app/(dashboard)/bills/page";
import PosPage from "./app/(dashboard)/pos/page";
import CashFlowPage from "./app/(dashboard)/cash-flow/page";
import AccountManagementPage from "./app/(dashboard)/accounts-page";
import ActivityLogsPage from "./app/(dashboard)/activity-logs/page";
import CategoryManagementPage from "./app/(dashboard)/categories/page";
import DashboardPage from "./app/(dashboard)/page";
import InternalInvoicesPage from "./app/(dashboard)/internal-invoices/page";
import PayrollPage from "./app/(dashboard)/payroll/page";
import SalaryEstimatePage from "./app/(dashboard)/payroll-estimate-page";
import ProductsPage from "./app/(dashboard)/product/page";
import IngredientsPage from "./pages/IngredientsPage";
import SuppliersPage from "./pages/SuppliersPage";
import InventoryChecksPage from "./app/(dashboard)/product/checks/page";
import InventoryReceiptsPage from "./app/(dashboard)/product/receipts/page";
import FieldInventoryReceiptsPage from "./app/(dashboard)/inventory-receipts/page";
import FieldInventoryReceiptDetailPage from "./app/(dashboard)/inventory-receipts/[id]/page";
import ReportDetailPage from "./app/(dashboard)/reports/[id]/page";
import ReportsPage from "./app/(dashboard)/reports/page";
import SocialListeningPage from "./app/(dashboard)/social-listening/page";
import GestureStudioPage from "./app/(dashboard)/gesture-studio/page";
import DustRitualPage from "./app/dust-ritual/page";
import DownloadAppPage from "./app/download-app/page";
import EditSeoArticlePage from "./app/(dashboard)/seo-articles/[id]/page";
import NewSeoArticlePage from "./app/(dashboard)/seo-articles/new/page";
import SeoArticlesPage from "./app/(dashboard)/seo-articles/page";
import TaxInvoicesPage from "./app/(dashboard)/tax-invoices/page";
import TimesheetPage from "./app/(dashboard)/timesheet/page";
import SampleBillProductsPage from "./app/(dashboard)/sample-bills/products/page";
import CoffeeSampleBillsPage from "./app/(dashboard)/sample-bills/coffee/page";
import HotpotSampleBillsPage from "./app/(dashboard)/sample-bills/hotpot/page";
import FarmSampleBillsPage from "./app/(dashboard)/sample-bills/farm/page";
import LoginPage from "./app/login/page";
import RoleGuard from "./components/RoleGuard";
import SeoManager from "./components/SeoManager";
import ArticlesIndexPage from "./app/tin-tuc/ArticlesIndexPage";
import ArticleDetailPage from "./app/tin-tuc/ArticleDetailPage";
import { useAuth } from "./context/AuthContext";
import { getDefaultRouteForUser } from "./lib/permissions";
import { normalizeAdminHref } from "./router/pathUtils";

function ProtectedLayout({ allowedRoles, permission, inferPermission = true }) {
  return (
    <RoleGuard
      allowedRoles={allowedRoles}
      permission={permission}
      inferPermission={inferPermission}
    >
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
  return nextPath === "/" ? <DashboardPage /> : <Navigate to={normalizeAdminHref(nextPath)} replace />;
}

export function App() {
  const landingHashes = pages.filter((page) => page.hash !== "/" && page.hash !== "/tin-tuc").map((page) => page.hash);

  return (
    <>
      <SeoManager />
      <Routes>
        <Route path="/" element={<LandingApp />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/bills" element={<Navigate to="/admin/bills" replace />} />
        <Route
          element={
            <ProtectedLayout
              allowedRoles={["admin", "user", "server"]}
              permission="bills.access"
              inferPermission={false}
            />
          }
        >
          <Route path="/pos" element={<PosPage />} />
        </Route>
        <Route path="/gesture-studio" element={<GestureStudioPage />} />
        <Route path="/dust-ritual" element={<DustRitualPage />} />
        <Route path="/tai-app" element={<DownloadAppPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedLayout
              allowedRoles={["admin", "manager", "user", "server"]}
              inferPermission={false}
            />
          }
        >
          <Route path="gesture-studio" element={<Navigate to="/gesture-studio" replace />} />
          <Route path="pos" element={<Navigate to="/pos" replace />} />
          <Route element={<AdminLayout />}>
            <Route index element={<AdminIndexPage />} />
            <Route element={<ProtectedLayout />}>
              <Route path="bills" element={<BillsPage />} />
              <Route path="payroll-estimate" element={<SalaryEstimatePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="cash-flow" element={<CashFlowPage />} />
              <Route path="virtual-bills" element={<Navigate to="/admin/sample-bills/coffee" replace />} />
              <Route path="sample-bills/products" element={<SampleBillProductsPage />} />
              <Route path="sample-bills/coffee" element={<CoffeeSampleBillsPage />} />
              <Route path="sample-bills/hotpot" element={<HotpotSampleBillsPage />} />
              <Route path="sample-bills/farm" element={<FarmSampleBillsPage />} />
              <Route path="product" element={<ProductsPage />} />
              <Route path="product/ingredients" element={<IngredientsPage />} />
              <Route path="product/suppliers" element={<SuppliersPage />} />
              <Route path="product/checks" element={<InventoryChecksPage />} />
              <Route path="product/receipts" element={<InventoryReceiptsPage />} />
              <Route path="inventory-receipts" element={<FieldInventoryReceiptsPage />} />
              <Route path="inventory-receipts/:id" element={<FieldInventoryReceiptDetailPage />} />
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
        <Route path="/tin-tuc" element={<ArticlesIndexPage />} />
        <Route path="/tin-tuc/:slug" element={<ArticleDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
