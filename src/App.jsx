import React from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { pages } from "./data/siteData";
import LandingApp from "./LandingApp";
import DashboardLayout from "./app/(dashboard)/layout";
import BillsPage from "./app/(dashboard)/bills/page";
import CashFlowPage from "./app/(dashboard)/cash-flow/page";
import CategoryManagementPage from "./app/(dashboard)/categories/page";
import DashboardPage from "./app/(dashboard)/page";
import PayrollPage from "./app/(dashboard)/payroll/page";
import ProductsPage from "./app/(dashboard)/product/page";
import ReportDetailPage from "./app/(dashboard)/reports/[id]/page";
import ReportsPage from "./app/(dashboard)/reports/page";
import TimesheetPage from "./app/(dashboard)/timesheet/page";
import LoginPage from "./app/login/page";

function AdminLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

export default function App() {
  const landingHashes = pages.map((page) => page.hash);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:id" element={<ReportDetailPage />} />
        <Route path="cash-flow" element={<CashFlowPage />} />
        <Route path="product" element={<ProductsPage />} />
        <Route path="categories" element={<CategoryManagementPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="timesheet" element={<TimesheetPage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="pos" element={<Navigate to="/admin/bills" replace />} />
      </Route>
      {landingHashes.map((path) => (
        <Route key={path} path={path} element={<LandingApp />} />
      ))}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
