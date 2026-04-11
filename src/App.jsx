import React from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { pages } from "./data/siteData";
import LandingApp from "./LandingApp";
import DashboardLayout from "./app/(dashboard)/layout";
import BillsPage from "./app/(dashboard)/bills/page";
import CashFlowPage from "./app/(dashboard)/cash-flow/page";
import AccountManagementPage from "./app/(dashboard)/accounts-page";
import CategoryManagementPage from "./app/(dashboard)/categories/page";
import DashboardPage from "./app/(dashboard)/page";
import PayrollPage from "./app/(dashboard)/payroll/page";
import SalaryEstimatePage from "./app/(dashboard)/payroll-estimate-page";
import ProductsPage from "./app/(dashboard)/product/page";
import ReportDetailPage from "./app/(dashboard)/reports/[id]/page";
import ReportsPage from "./app/(dashboard)/reports/page";
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
    .filter((page) => page.id !== "home")
    .map((page) => page.hash);

  return (
    <>
      <SeoManager />
      <Routes>
        <Route path="/" element={<LandingApp />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
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
              <Route path="categories" element={<CategoryManagementPage />} />
              <Route path="accounts" element={<AccountManagementPage />} />
              <Route path="payroll" element={<PayrollPage />} />
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
